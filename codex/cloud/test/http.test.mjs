import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Client} from '../../native/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '../../native/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
const worker=(await import('data:text/javascript;base64,'+readFileSync(new URL('../worker/index.js',import.meta.url)).toString('base64'))).default;
const question=JSON.parse(readFileSync(new URL('../../native/test/question.json',import.meta.url)));
const endpoint='https://qa.example.invalid/mcp';
const request=(body,identity=false)=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...(identity?{'oai-authenticated-user-id':'site-test-user'}:{})},body:JSON.stringify(body)});
const call=(name,args={},identity=true)=>worker.fetch(request({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},identity));
test('official HTTP Client: stateless initialization, 0.5.3 version, tools and exact MCP App UI',async()=>{
 const client=new Client({name:'qa-cloud-test',version:'1.0.0'});
 const transport=new StreamableHTTPClientTransport(new URL(endpoint),{fetch:(input,init)=>worker.fetch(new Request(input,init)),requestInit:{headers:{'oai-authenticated-user-id':'site-test-user'}}});
 try{
  await client.connect(transport);assert.equal(client.getServerVersion().version,'0.5.3');
  const list=await client.listTools();assert.deepEqual(list.tools.map(t=>t.name).sort(),['qa.explain','qa.open']);
  const open=list.tools.find(t=>t.name==='qa.open');assert.equal(open._meta.ui.resourceUri,'ui://qa-guide/question-panel/v0.5.3.html');assert.equal(open._meta['openai/outputTemplate'],open._meta.ui.resourceUri);assert.equal(list.tools.find(t=>t.name==='qa.explain')._meta.ui.resourceUri,open._meta.ui.resourceUri);const resources=await client.listResources();assert.deepEqual(resources.resources.map(r=>r.uri),[open._meta.ui.resourceUri]);await assert.rejects(client.readResource({uri:'ui://qa-guide/question-panel'}));assert.deepEqual(open._meta['openai/ui'].entrypoints,[{type:'thread'}]);assert.equal(open.annotations.readOnlyHint,true);assert.equal(open._meta['openai/outputTemplate'],open._meta.ui.resourceUri);assert.ok(open.outputSchema);assert.ok(list.tools.find(t=>t.name==='qa.explain').outputSchema);for(const key of ['taskId','taskName','currentState','decision','completionCriteria','context'])assert.ok(open.inputSchema.properties.question.required.includes(key));
  const q=await client.callTool({name:'qa.open',arguments:{question,revision:1}});assert.equal(q.structuredContent.question.taskId,question.taskId);assert.equal(q.structuredContent.question.currentState,question.currentState);assert.equal(q.structuredContent.question.completionCriteria,question.completionCriteria);
  const resource=await client.readResource({uri:open._meta.ui.resourceUri});const html=resource.contents[0];assert.equal(html.mimeType,'text/html;profile=mcp-app');const expectedHtml=readFileSync(new URL('../worker/source/panel-html.mjs',import.meta.url),'utf8');assert.ok(expectedHtml.includes(JSON.stringify(html.text)));assert.equal(createHash('sha256').update(html.text).digest('hex').length,64);assert.deepEqual(html._meta.ui.csp.connectDomains,[]);assert.deepEqual(html._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);assert.equal(html._meta['openai/ui'].preferredDisplayMode,'inline');
  const result=await client.callTool({name:'qa.explain',arguments:{questionId:question.id,revision:1,requestId:'cloud-request-1',text:'明示依頼への再説明'}});assert.equal(result.structuredContent.requestId,'cloud-request-1');
  const invalid=await client.callTool({name:'qa.explain',arguments:{questionId:question.id,revision:1,text:'no request'}});assert.equal(invalid.isError,true);
 }finally{await client.close();}
});
test('data-bearing tools reject missing Sites identity; metadata discovery contains no private question',async()=>{
 for(const [name,args]of [['qa.open',{question}],['qa.explain',{questionId:question.id,revision:1,requestId:'r',text:'private'}]]){
  const response=await call(name,args,false);assert.equal(response.status,401);assert.ok(!(await response.text()).includes('private'));
 }
 const response=await worker.fetch(request({jsonrpc:'2.0',id:1,method:'tools/list'}));assert.equal(response.status,200);assert.ok(!(await response.text()).includes(question.taskName));
});
test('empty panel does not persist another request or user question on the Worker',async()=>{
 assert.equal((await call('qa.open',{question})).status,200);
 const response=await call('qa.open',{},false);assert.equal(response.status,200);assert.equal((await response.json()).result.structuredContent.question,null);
});
test('question contract is retained and incomplete task data is rejected over HTTP',async()=>{
 const incomplete={...question};delete incomplete.currentState;
 const response=await call('qa.open',{question:incomplete});assert.equal(response.status,200);assert.equal((await response.json()).result.isError,true);
});
test('malformed and oversized JSON fail before data use; no GET event stream is exposed',async()=>{
 const bad=await worker.fetch(new Request(endpoint,{method:'POST',body:'{'}));assert.equal(bad.status,400);
 const large=await worker.fetch(new Request(endpoint,{method:'POST',body:'x'.repeat(65537)}));assert.equal(large.status,413);
 assert.equal((await worker.fetch(new Request(endpoint))).status,405);
});
test('minimal Site page identifies private install flow without acting as a conversation view',async()=>{
 const response=await worker.fetch(new Request('https://qa.example.invalid/'));assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('Created by you'));assert.ok(!html.includes(question.taskName));
});
