import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createServer} from './server.mjs';
import panelHtml from './panel-html.mjs';

const MAX_BODY=65536;
const discovery=new Set(['initialize','notifications/initialized','ping','tools/list','resources/list','resources/templates/list','resources/read']);
const page='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA Guide</title><style>body{max-width:720px;margin:64px auto;padding:24px;font:16px/1.8 system-ui;color:#17251e;background:#f5f7f3}h1{font-size:32px}section{background:white;padding:24px;border-radius:18px}</style><h1>QA Guide</h1><section><p>質問の背景、対象タスク、現在状態、完了条件と、選択した結果を会話のパネルで確認できます。</p><p>本人専用のプラグインです。ChatGPTのPlugins → Personal → Created by youからQA Guideを開き、InstallまたはConnectしてください。</p><p>扱うのは明示的に渡した質問・説明と選択回答だけです。ファイルや会話履歴を自動で読みません。回答は実行承認の代用になりません。</p></section></html>';

async function parseBody(request){
  if(!request.body)return null;
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Object.assign(new Error('Request too large'),{status:413});}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
function requiresIdentity(body){
  if(!body||Array.isArray(body)||typeof body!=='object')return true;
  if(discovery.has(body.method))return false;
  return !(body.method==='tools/call'&&body.params?.name==='qa.open'&&body.params?.arguments?.question===undefined);
}
export default {
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    if(url.pathname!=='/mcp')return new Response('Not found',{status:404});
    if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
    let body;
    try{body=await parseBody(request);}catch(error){return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:error.status===413?'Request too large':'Invalid JSON'}},{status:error.status??400});}
    // Sites Dispatch owns authentication and the owner-private access boundary.
    // Service credentials do not create a user identity. Data-bearing calls need one.
    if(requiresIdentity(body)&&!request.headers.get('oai-authenticated-user-id'))return Response.json({jsonrpc:'2.0',id:body?.id??null,error:{code:-32001,message:'Authenticated user required'}},{status:401});
    const server=createServer(panelHtml);
    const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:MAX_BODY});
    try{await server.connect(transport);return await transport.handleRequest(request,{parsedBody:body});}
    finally{await server.close();}
  }
};
