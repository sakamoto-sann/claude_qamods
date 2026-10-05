import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const question=JSON.parse(readFileSync(new URL('./question.json',import.meta.url),'utf8'));
test('built package: real stdio initialize, discovery, UI resource and question/explanation tools',async()=>{
 const client=new Client({name:'qa-test',version:'1.0.0'});const transport=new StdioClientTransport({command:process.execPath,args:[new URL('../plugin/dist/server.mjs',import.meta.url).pathname],stderr:'pipe'});
 let stderr='';transport.stderr?.on('data',d=>{stderr+=d;});
 try{
  await client.connect(transport);assert.equal(client.getServerVersion().version,'0.5.4');const list=await client.listTools();assert.deepEqual(list.tools.map(t=>t.name).sort(),['qa.explain','qa.open']);
  const open=list.tools.find(t=>t.name==='qa.open');assert.equal(open._meta.ui.resourceUri,'ui://qa-guide/question-panel/v0.5.4.html');assert.equal(open._meta['openai/outputTemplate'],open._meta.ui.resourceUri);assert.equal(list.tools.find(t=>t.name==='qa.explain')._meta.ui.resourceUri,open._meta.ui.resourceUri);const resources=await client.listResources();assert.deepEqual(resources.resources.map(r=>r.uri),[open._meta.ui.resourceUri]);await assert.rejects(client.readResource({uri:'ui://qa-guide/question-panel'}));await assert.rejects(client.readResource({uri:'ui://qa-guide/question-panel/v0.5.3.html'}));assert.deepEqual(open._meta['openai/ui'].entrypoints,[{type:'thread'}]);assert.equal(open.annotations.readOnlyHint,true);
  const blank=await client.callTool({name:'qa.open',arguments:{}});assert.equal(blank.structuredContent.question,null);
  const a=await client.callTool({name:'qa.open',arguments:{question,revision:1}});assert.equal(a.structuredContent.revision,1);assert.equal(a.structuredContent.question.options.length,2);assert.equal(a.structuredContent.question.taskId,question.taskId);assert.equal(a.structuredContent.question.currentState,question.currentState);assert.equal(a.structuredContent.question.completionCriteria,question.completionCriteria);
  const b=await client.callTool({name:'qa.open',arguments:{}});assert.equal(b.structuredContent.question,null); // server stores no cross-thread question
  const invalid=await client.callTool({name:'qa.open',arguments:{question:{id:'bad'},revision:1}});assert.equal(invalid.isError,true);
  const explanation=await client.callTool({name:'qa.explain',arguments:{questionId:question.id,revision:1,requestId:'request-1',text:'架空例の追加説明'}});assert.equal(explanation.structuredContent.kind,'explanation');assert.equal(explanation.structuredContent.requestId,'request-1');const missingRequest=await client.callTool({name:'qa.explain',arguments:{questionId:question.id,revision:1,text:'missing'}});assert.equal(missingRequest.isError,true);
  const resource=await client.readResource({uri:open._meta.ui.resourceUri});const html=resource.contents[0];assert.equal(html.mimeType,'text/html;profile=mcp-app');assert.ok(html.text.includes('この選択をこの会話へ回答する'));assert.deepEqual(html._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);assert.deepEqual(html._meta.ui.csp.connectDomains,[]);assert.ok(!html.text.includes('http://127.0.0.1:'));
  assert.equal(stderr,'');
 }finally{await client.close();}
});
