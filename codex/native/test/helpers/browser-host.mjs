import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {validateQuestion} from '../../src/question.mjs';
export async function startHost(panel,root){
 const question=validateQuestion(JSON.parse(readFileSync(new URL('../question.json',import.meta.url),'utf8')));
 const source=`
 import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
 const frame=document.querySelector('iframe'),supported=!location.search.includes('unsupported');
 window.proof={initialized:false,messages:[],modes:[]};
 const bridge=new AppBridge(null,{name:'Local QA fixture',version:'1'},supported?{message:{},experimental:{'openai/message':{}}}:{},{hostContext:{theme:'light',displayMode:'inline',availableDisplayModes:['inline','fullscreen']}});
 bridge.onsizechange=({height})=>frame.style.height=height+'px';
 bridge.onrequestdisplaymode=async({mode})=>{window.proof.modes.push(mode);bridge.setHostContext({displayMode:mode});return {mode};};
 bridge.onmessage=async params=>{
  const payload=JSON.parse(params.content[0].text.split('\\n')[1]);window.proof.messages.push(payload);
  setTimeout(()=>bridge.sendToolResult({content:[],structuredContent:{kind:'explanation',questionId:payload.questionId,revision:payload.revision,requestId:payload.requestId,text:'Browser fixture explanation'}}),20);return {};
 };
 window.showQuestion=(revision=1)=>bridge.sendToolResult({content:[],structuredContent:{kind:'question',question:${JSON.stringify(question)},revision}});
 bridge.oninitialized=async()=>{window.proof.initialized=true;await bridge.sendToolResult({content:[],structuredContent:{kind:'question',question:null,revision:0}});};
 await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/panel';
 `;
 const bundled=await build({absWorkingDir:root,stdin:{contents:source,resolveDir:root,sourcefile:'fixture-host.mjs'},bundle:true,platform:'browser',format:'esm',write:false});
 const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:">`;
 const routes={
  '/':['text/html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA fixture</title><style>body{margin:0}iframe{width:100%;border:0;height:900px}</style><iframe title="QA fixture" sandbox="allow-scripts allow-same-origin"></iframe><script type="module" src="/host.js"></script>'],
  '/panel':['text/html',panel.replace('<head>',()=>'<head>'+csp)],
  '/host.js':['text/javascript',bundled.outputFiles[0].text]
 };
 const server=createServer((req,res)=>{const route=routes[new URL(req.url,'http://localhost').pathname];if(!route){res.writeHead(204);res.end();return;}res.writeHead(200,{'Content-Type':route[0]+'; charset=utf-8','Cache-Control':'no-store'});res.end(route[1]);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
export async function until(page,expression){
 const end=Date.now()+5000;
 while(Date.now()<end){if(await page.evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}
 throw new Error('Browser fixture timed out: '+expression);
}
export const panelState=`(()=>{const d=document.querySelector('iframe').contentDocument;return {empty:d.getElementById('empty').hidden,hidden:d.getElementById('question-view').hidden,choices:d.querySelectorAll('.option').length,inputs:d.querySelectorAll('input,textarea,form').length,details:d.querySelector('details').open,expand:d.getElementById('expand').textContent,compactDisabled:d.getElementById('compact').disabled,text:d.body.innerText,explanation:d.getElementById('explanation').textContent,messages:window.proof.messages,modes:window.proof.modes}})()`;
export const click=id=>`document.querySelector('iframe').contentDocument.getElementById(${JSON.stringify(id)}).click()`;
