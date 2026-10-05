// Real Chrome + official MCP Apps bridge. Fixtures stay on loopback; no ChatGPT auth.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {validateQuestion} from '../src/question.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executable=candidates.find(existsSync);
assert.ok(executable,'Set CHROME_BIN to an existing Chrome binary; this test never downloads a browser.');
const work=mkdtempSync(join(tmpdir(),'qa-browser-test-'));
try{
const profile=join(work,'profile');mkdirSync(profile);
const panel=process.env.QA_BROWSER_PANEL_MODULE?(await import(pathToFileURL(resolve(process.env.QA_BROWSER_PANEL_MODULE)).href)).default:readFileSync(join(root,'plugin/dist/panel.html'),'utf8');
const question=validateQuestion(JSON.parse(readFileSync(new URL('./question.json',import.meta.url))));
const output=process.env.QA_BROWSER_ARTIFACT_DIR?resolve(process.env.QA_BROWSER_ARTIFACT_DIR):null;
if(output)mkdirSync(output,{recursive:true});
const hostSource=`
 import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
 const frame=document.querySelector('iframe');
 window.proof={initialized:false,messages:[]};
 const supported=!location.search.includes('unsupported');
 const bridge=new AppBridge(null,{name:'Local browser test',version:'1'},supported?{message:{},experimental:{'openai/message':{}}}:{},{hostContext:{theme:'light',displayMode:'inline'}});
 bridge.onsizechange=({height})=>frame.style.height=height+'px';
 bridge.onmessage=async params=>{
  const payload=JSON.parse(params.content[0].text.split('\\n')[1]);window.proof.messages.push(payload);
  if(payload.requestId)setTimeout(()=>bridge.sendToolResult({content:[],structuredContent:{kind:'explanation',questionId:payload.questionId,revision:payload.revision,requestId:payload.requestId,text:'Browser fixture explanation'}}),20);
  return {};
 };
 window.showQuestion=()=>bridge.sendToolResult({content:[],structuredContent:{kind:'question',question:${JSON.stringify(question)},revision:1}});
 bridge.oninitialized=async()=>{window.proof.initialized=true;await bridge.sendToolResult({content:[],structuredContent:{kind:'question',question:null,revision:0}});};
 await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/panel';
`;
const hostBuild=await build({absWorkingDir:root,stdin:{contents:hostSource,resolveDir:root,sourcefile:'browser-host.mjs'},bundle:true,platform:'browser',format:'esm',write:false});
const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:\">";
const server=createServer((request,response)=>{
 const path=new URL(request.url,'http://localhost').pathname;
 let text,type='text/html; charset=utf-8';
 if(path==='/')text='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local QA browser verification</title><style>body{margin:0}iframe{width:100%;border:0;height:900px}</style><iframe title="QA fixture" sandbox="allow-scripts allow-same-origin"></iframe><script type="module" src="/host.js"></script>';
 else if(path==='/panel')text=panel.replace('<head>',()=>'<head>'+csp);
 else if(path==='/host.js'){text=hostBuild.outputFiles[0].text;type='text/javascript';}
 else{response.writeHead(204);response.end();return;}
 response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});response.end(text);
});
let chrome,ws,watcher,deadline,peakProfileBytes=0,failure,shuttingDown=false;
const pending=new Map();
const stop=error=>{failure??=error;for(const p of pending.values())p.reject(error);pending.clear();chrome?.kill('SIGTERM');};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const profileBytes=dir=>readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{try{return sum+(e.isDirectory()?profileBytes(join(dir,e.name)):statSync(join(dir,e.name)).size);}catch{return sum;}},0);
const passed=[];const exceptions=[];
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',()=>{server.off('error',j);r();});});
 chrome=spawn(executable,['--headless=new','--incognito','--disable-gpu','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-component-extensions-with-background-pages','--disable-sync','--disable-default-apps','--no-first-run','--no-default-browser-check','--disk'+'-cache-size=1','--media-cache-size=1','--disable-features=OptimizationGuideModelDownloading,OptimizationGuideOnDeviceModel,OptimizationHints,OptimizationHintsFetching,OptimizationTargetPrediction,MediaRouter','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
 chrome.on('error',stop);chrome.on('exit',()=>{if(!shuttingDown)stop(new Error('Chrome exited during verification'));});
 deadline=setTimeout(()=>stop(new Error('Browser verification exceeded 30 seconds')),30_000);
 watcher=setInterval(()=>{try{peakProfileBytes=Math.max(peakProfileBytes,profileBytes(profile));if(peakProfileBytes>40_000_000){stop(new Error('Disposable Chrome profile exceeded 40 MB'));}}catch{}},200);
 const portFile=join(profile,'DevToolsActivePort');
 for(let i=0;!existsSync(portFile)&&i<100;i++){if(failure)throw failure;if(chrome.exitCode!==null)throw new Error('Chrome exited before its debugging endpoint was ready');await delay(100);}
 assert.ok(existsSync(portFile),'Chrome debugging endpoint did not start');
 const debugPort=readFileSync(portFile,'utf8').split('\n')[0];
 const targets=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(5_000)})).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{const timeout=setTimeout(()=>{ws.close();j(new Error('Chrome debugging connection timed out'));},5_000);ws.onopen=()=>{clearTimeout(timeout);r();};ws.onerror=error=>{clearTimeout(timeout);j(error);};ws.onclose=()=>{clearTimeout(timeout);j(new Error('Chrome debugging connection closed before opening'));};});
 let nextId=0;
 ws.onclose=()=>{if(!shuttingDown)stop(new Error('Chrome debugging connection closed'));};
 ws.onerror=()=>stop(new Error('Chrome debugging connection failed'));
 ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.id){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);if(message.error||message.result?.exceptionDetails)p.reject(message.error??message.result.exceptionDetails);else p.resolve(message.result);}
  else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);
 };
 const rpc=(method,params={})=>new Promise((r,j)=>{
  if(failure||ws.readyState!==WebSocket.OPEN){j(failure??new Error('Chrome debugging connection is not open'));return;}
  const id=++nextId;const timeout=setTimeout(()=>{pending.delete(id);j(new Error('Chrome RPC timed out: '+method));},5_000);
  pending.set(id,{resolve:value=>{clearTimeout(timeout);r(value);},reject:error=>{clearTimeout(timeout);j(error);}});ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>(await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 const until=async expression=>{for(let i=0;i<100;i++){if(failure)throw failure;if(await evaluate(expression))return;await delay(50);}throw new Error('Browser condition timed out: '+expression);};
 await rpc('Page.enable');await rpc('Runtime.enable');
 const browser=await rpc('Browser.getVersion');
 await rpc('Emulation.setDeviceMetricsOverride',{width:430,height:932,deviceScaleFactor:1,mobile:true});
 const origin='http://127.0.0.1:'+server.address().port;
 const state=()=>evaluate("(()=>{const d=document.querySelector('iframe').contentDocument;return {initialized:window.proof.initialized,text:d.body.innerText,emptyHidden:d.getElementById('empty').hidden,questionHidden:d.getElementById('question-view').hidden,radios:d.querySelectorAll('input[type=radio]').length,checked:d.querySelectorAll('input:checked').length,submitDisabled:d.getElementById('submit').disabled,messages:window.proof.messages}})()");
 const capture=async name=>{if(!output)return;writeFileSync(join(output,name+'.json'),JSON.stringify(await state(),null,2)+'\n');const metrics=await rpc('Page.getLayoutMetrics');const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:430,height:Math.ceil(metrics.cssContentSize.height),scale:1}});writeFileSync(join(output,name+'.png'),Buffer.from(shot.data,'base64'));};
 await rpc('Page.navigate',{url:origin});await until('window.proof?.initialized===true');
 let actual=await state();assert.equal(actual.emptyHidden,false);assert.equal(actual.questionHidden,true);assert.ok(actual.text.includes('ホスト接続済み'));passed.push('real iframe initializes and displays a null-question empty state');await capture('empty');
 await evaluate('window.showQuestion()');await until("document.querySelector('iframe').contentDocument.querySelectorAll('input[type=radio]').length===2");
 actual=await state();assert.equal(actual.checked,0);assert.equal(actual.questionHidden,false);assert.equal(actual.submitDisabled,true);passed.push('question result renders two choices with no automatic selection');await capture('question');
 await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('input[type=radio]')[1].click()");actual=await state();assert.equal(actual.checked,1);assert.equal(actual.messages.length,0);passed.push('selection alone sends nothing');
 await evaluate("document.querySelector('iframe').contentDocument.getElementById('submit').click()");await until('window.proof.messages.length===1');await until("document.querySelector('iframe').contentDocument.getElementById('answer-status').textContent.includes('CSV')");
 actual=await state();assert.equal(actual.messages[0].kind,'qa-answer');assert.equal(actual.messages[0].optionId,'csv');assert.equal(actual.messages[0].executionApproval,false);passed.push('explicit button sends exactly one answer without allow-forms');await capture('answer');
 await evaluate("document.querySelector('iframe').contentDocument.getElementById('full').click()");await until("document.querySelector('iframe').contentDocument.getElementById('explanation').textContent==='Browser fixture explanation'");
 actual=await state();assert.equal(actual.messages.length,2);assert.equal(actual.messages[1].executionApproval,false);assert.equal(actual.checked,1);assert.ok(actual.text.includes('「CSV」をこの会話へ送りました。'));passed.push('correlated explanation arrives while choice and answer remain');await capture('explanation');
 await rpc('Page.navigate',{url:origin+'/?unsupported=1'});await until('window.proof?.initialized===true');await evaluate('window.showQuestion()');await until("document.querySelector('iframe').contentDocument.querySelectorAll('input[type=radio]').length===2");
 await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('input[type=radio]')[0].click()");actual=await state();assert.equal(actual.submitDisabled,true);assert.equal(actual.messages.length,0);assert.ok(actual.text.includes('未対応'));passed.push('unsupported host visibly disables message delivery');await capture('unsupported');
 assert.deepEqual(exceptions,[]);
 const result={passed,panel:process.env.QA_BROWSER_PANEL_MODULE?'cloud':'native',browser:browser.product,scope:'Actual Chrome, compiled native HTML, official SDK host, restrictive CSP, synthetic fixtures; not ChatGPT/iOS or hosted OAuth',jsExceptions:exceptions,peakProfileBytes};
 if(output)writeFileSync(join(output,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 shuttingDown=true;await rpc('Browser.close');
}finally{
 shuttingDown=true;if(watcher)clearInterval(watcher);if(deadline)clearTimeout(deadline);
 for(const p of pending.values())p.reject(new Error('Browser verification ended'));pending.clear();ws?.close();
 if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(1500)]);if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill('SIGKILL');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(1500)]);}}
 await new Promise(r=>server.close(r));
}

}finally{rmSync(work,{recursive:true,force:true});}
