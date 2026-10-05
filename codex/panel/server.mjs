import http from 'node:http';
import {compactContext,requestExplanation,completeExplanation} from './context.mjs';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function validateQuestion(q) {
  const text=(s,max=3000)=>typeof s==='string' && s.trim().length>0 && s.length<=max;
  if (!q || !text(q.id,100) || !text(q.question) || !text(q.background) || !text(q.goal)) throw new Error('質問、背景、目的、IDが必要です');
  if (!Array.isArray(q.options) || q.options.length<2 || q.options.length>3) throw new Error('選択肢は2〜3件です');
  const ids=new Set();
  for(const o of q.options) {
    if(!o || !['id','label','effect','benefit','cost'].every(k=>text(o[k],k==='id'?100:3000)) || ids.has(o.id)) throw new Error('選択肢には重複しないID・結果・利点・代償が必要です');
    ids.add(o.id);
  }
  if (!q.recommendation || !ids.has(q.recommendation.optionId) || !text(q.recommendation.reason)) throw new Error('おすすめと理由が必要です');
  for(const key of ['constraints','uncertainties']) if(q[key]!==undefined && (!Array.isArray(q[key]) || q[key].length>10 || q[key].some(s=>!text(s)))) throw new Error('条件・未確認事項の形式が不正です');
  return JSON.parse(JSON.stringify({id:q.id,question:q.question,background:q.background,goal:q.goal,options:q.options.map(({id,label,effect,benefit,cost})=>({id,label,effect,benefit,cost})),recommendation:q.recommendation,constraints:q.constraints??[],uncertainties:q.uncertainties??[],context:compactContext(q.context)}));
}

export function prepareInitialState(state) {
  if(!state)return {question:null,revision:0,answer:null};
  if(!state.question||!Number.isSafeInteger(state.revision)||state.revision<1)throw new Error('移行元の質問とrevisionが不正です');
  const question=validateQuestion(state.question);
  let answer=null;
  if(state.answer){
    const source=state.answer;
    if(source.questionId!==question.id||source.revision!==state.revision||source.executionApproval!==false||!question.options.some(o=>o.id===source.optionId))throw new Error('移行元の回答が質問と一致しません');
    answer=JSON.parse(JSON.stringify(source));
  }
  return {question,revision:state.revision,answer};
}

export function startPanel({port=0,sessionFile='/tmp/qa-guide-panel-session.json',initialState}={}) {
  const token=randomBytes(32).toString('hex');
  let {question,revision,answer}=prepareInitialState(initialState);
  let explanation=null,origin;
  const snapshot=()=>({question,revision,answer,explanation});
  const assets={'/':'panel.html','/panel.js':'panel.js','/panel.css':'panel.css','/context.mjs':'context.mjs'};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    if(req.headers.host!==new URL(origin).host || (req.headers.origin && req.headers.origin!==origin)) return json(res,403,{error:'このパネルの同一オリジンからのみアクセスできます'});
    const path=new URL(req.url,origin).pathname;
    if(req.method==='GET' && Object.hasOwn(assets,path)) {
      res.writeHead(200,{'Content-Type':(path.endsWith('.js')||path.endsWith('.mjs'))?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
      return res.end(readFileSync(new URL(assets[path],import.meta.url)));
    }
    if(req.headers.authorization!==`Bearer ${token}`) return json(res,401,{error:'パネルのセッションキーが必要です'});
    if(req.method==='GET' && path==='/state') return json(res,200,snapshot());
    if(req.method!=='POST' || !['/question','/answer','/stop','/explanation-request','/explanation'].includes(path)) return json(res,404,{error:'見つかりません'});
    if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSONを使ってください'});
    const chunks=[];let bytes=0;
    try {
      for await(const chunk of req) {bytes+=chunk.length;if(bytes>32768)return json(res,413,{error:'データが大きすぎます'});chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(path==='/question') {const next=validateQuestion(data);question=next;revision++;answer=null;explanation=null;return json(res,200,snapshot());}
      if(path==='/explanation-request'){explanation=requestExplanation(explanation,question,revision,data);return json(res,200,snapshot());}
      if(path==='/explanation'){explanation=completeExplanation(explanation,question,revision,data);return json(res,200,snapshot());}
      if(path==='/stop') {json(res,200,{stopped:true});server.close();return;}
      if(!question || data.questionId!==question.id || data.revision!==revision) return json(res,409,{error:'質問が更新されました。現在の質問に回答してください'});
      if(answer) return json(res,409,{error:'この質問には回答済みです'});
      const option=question.options.find(o=>o.id===data.optionId);
      if(!option) return json(res,400,{error:'選択肢が不正です'});
      answer={questionId:question.id,revision,optionId:option.id,label:option.label,effect:option.effect,answeredAt:new Date().toISOString(),executionApproval:false,message:`質問「${question.question}」への回答は「${option.label}」です。\n選んだ結果：${option.effect}\nこれは質問への回答であり、別途必要な実行承認の代用ではありません。`};
      return json(res,200,snapshot());
    } catch(error) {return json(res,400,{error:error instanceof SyntaxError?'JSONの形式が不正です':error.message});}
  });
  server.on('close',()=>{try {const stored=JSON.parse(readFileSync(sessionFile));if(stored.token===token) unlinkSync(sessionFile);}catch{}});
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{
      origin=`http://127.0.0.1:${server.address().port}`;
      const session={origin,token,pid:process.pid,url:`${origin}/#${token}`};
      try {writeFileSync(sessionFile,JSON.stringify(session),{mode:0o600,flag:'wx'});}catch(e){server.close();reject(e);return;}
      resolve({server,session,sessionFile});
    });
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const sessionFile=process.argv[2]??'/tmp/qa-guide-panel-session.json';
  const {server,session}=await startPanel({sessionFile,initialState:process.argv[3]?JSON.parse(readFileSync(process.argv[3],'utf8')):undefined});
  console.log(JSON.stringify({sessionFile,url:session.url,mode:'local-browser-panel',historyAccess:false}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
}
