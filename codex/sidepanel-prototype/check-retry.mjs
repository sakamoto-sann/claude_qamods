import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(root,'../native/package.json'));
const {Window}=require('happy-dom');
const window=new Window({url:'http://127.0.0.1:8766/',settings:{disableIframePageLoading:true}});
const html=readFileSync(path.join(root,'index.html'),'utf8');
const [markup,tail]=html.split('<script type="module">');
const script=tail.split('</script>')[0];
let fetches=0;
window.fetch=async()=>({ok:++fetches>1,json:async()=>JSON.parse(readFileSync(path.join(root,'sample-question.json'),'utf8'))});
try{
 window.document.write(markup);
 window.eval(script);
 const frame=window.document.querySelector('#panel');
 const bridge={postMessage(){}};
 Object.defineProperty(frame,'contentWindow',{get:()=>bridge,configurable:true});
 const initialized=()=>window.dispatchEvent(new window.MessageEvent('message',{
  source:frame.contentWindow,origin:'http://127.0.0.1:8766',
  data:{jsonrpc:'2.0',method:'ui/notifications/initialized'}
 }));
 initialized();await new Promise(setImmediate);
 assert.match(window.document.querySelector('#status').textContent,/読み込めません/);
 window.document.querySelector('#reload').click();
 initialized();await new Promise(setImmediate);
 assert.equal(fetches,2);
 assert.match(window.document.querySelector('#status').textContent,/サンプル表示中/);
 console.log('PASS: failed sample fetch recovers through the reload button');
}finally{await window.happyDOM.close()}
