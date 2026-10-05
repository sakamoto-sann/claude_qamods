import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startPanel} from './server.mjs';
import {createClient} from './client-core.mjs';
const directory=mkdtempSync(join(tmpdir(),'qa-guide-test-'));
const sessionFile=join(directory,'session.json');
const question=JSON.parse(readFileSync(new URL('./demo-question.json',import.meta.url),'utf8'));
const passed=[];
let server;
try {
  const started=await startPanel({sessionFile,initialState:{question,revision:7,answer:null}});server=started.server;
  const {session}=started;const client=createClient(session);
  const state=await client.request('/state');assert.equal(state.revision,7);assert.equal(state.answer,null);passed.push('migration keeps revision and unanswered state');
  assert.equal((await fetch(session.origin+'/state')).status,401);passed.push('state requires session authentication');
  assert.equal((await fetch(session.origin+'/state',{headers:{Authorization:`Bearer ${session.token}`,Origin:'https://example.invalid'}})).status,403);passed.push('foreign origin rejected');
  assert.equal((await fetch(session.origin+'/constructor')).status,401);passed.push('inherited asset name is not served');
  const html=await (await fetch(session.origin+'/')).text();assert.ok(html.includes('全文脈で解説'));assert.ok(html.includes('トークン・料金：取得不可'));passed.push('page serves explicit explanation button and unavailable metrics');
  const module=await fetch(session.origin+'/context.mjs');assert.equal(module.status,200);assert.ok(module.headers.get('content-type').includes('javascript'));passed.push('module route and MIME type work');
  await assert.rejects(client.request('/explanation-request',{questionId:question.id,revision:6}));passed.push('stale explanation request rejected');
  const request=await client.request('/explanation-request',{questionId:question.id,revision:7});
  const waiting=await client.waitCurrent();assert.deepEqual(waiting.explanationRequested,request.explanation);assert.equal(waiting.executionApproval,false);passed.push('wait surfaces full-context request without approval');
  await assert.rejects(client.request('/explanation',{questionId:question.id,revision:7,requestId:2,text:'stale'}));passed.push('wrong explanation run rejected');
  const complete=await client.request('/explanation',{questionId:question.id,revision:7,requestId:1,text:'架空の資料では担当者が読む目的を優先します。'});assert.equal(complete.explanation.status,'done');assert.equal(complete.revision,7);assert.equal(complete.answer,null);passed.push('explanation completion preserves unanswered question');
  const submitted=await client.request('/answer',{questionId:question.id,revision:7,optionId:'csv'});assert.equal(submitted.answer.optionId,'csv');assert.equal(submitted.answer.executionApproval,false);
  assert.deepEqual(await client.waitCurrent(),submitted.answer);passed.push('explicit simulated choice is read back by client');
  await assert.rejects(client.request('/answer',{questionId:question.id,revision:7,optionId:'markdown'}));passed.push('duplicate answer rejected');
  const ask=client.ask(question);
  for(let i=0;i<20;i++){const next=await client.request('/state');if(next.revision===8)break;await new Promise(r=>setTimeout(r,10));}
  await client.request('/answer',{questionId:question.id,revision:8,optionId:'markdown'});
  const nextAnswer=await ask;assert.equal(nextAnswer.revision,8);assert.equal(nextAnswer.optionId,'markdown');passed.push('ask publishes once and reads matching new answer');
  await client.request('/stop',{});await new Promise(r=>server.listening?server.once('close',r):r());assert.equal(existsSync(sessionFile),false);passed.push('stop cleans its own session file');
  console.log(JSON.stringify({passed,scope:'isolated localhost server with fictional fixture; simulated selections only',modelCalls:0,nativeCodexUIVerified:false},null,2));
} finally {
  if(server?.listening)await new Promise(r=>server.close(r));
  rmSync(directory,{recursive:true,force:true});
}
