import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateQuestion} from '../src/question.mjs';
import {acceptResult,answerPayload,requestFull,fullStatus} from '../src/view-state.mjs';
const input=()=>JSON.parse(readFileSync(new URL('./question.json',import.meta.url),'utf8'));
const ready=()=>({...acceptResult({}, {kind:'question',question:validateQuestion(input()),revision:1}),selected:'csv'});
const reply=(s,requestId,text='再説明')=>({kind:'explanation',questionId:s.question.id,revision:s.revision,requestId,text});

test('review P1: task identity, current state, decision and completion survive normalization; answer identifies task',()=>{
 const source=input(),q=validateQuestion(source);
 for(const k of ['taskId','taskName','taskReference','currentState','decision','completionCriteria'])assert.equal(q[k],source[k]);
 const payload=answerPayload(ready());assert.equal(payload.taskId,source.taskId);assert.equal(payload.taskName,source.taskName);assert.equal(payload.decision,source.decision);assert.equal(payload.effect,source.options[1].effect);assert.equal(payload.executionApproval,false);
});
test('review P1: missing task contract or missing context is rejected rather than silently discarded',()=>{
 for(const k of ['taskId','taskName','currentState','decision','completionCriteria','context']){const q=input();delete q[k];assert.throws(()=>validateQuestion(q),undefined,k);}
 for(const k of ['recentInstructions','precedingExplanation','latestWorkSummary']){const q=input();delete q.context[k];assert.throws(()=>validateQuestion(q),undefined,k);}
});
test('review P2: explicit refusal clears pending and allows an explicit fresh request',async()=>{
 const s=ready();await assert.rejects(requestFull(s,{send:async()=>({isError:true})},()=> 'rejected-1'),/再依頼できます/);
 assert.equal(s.explanationPending,false);assert.equal(s.explanationRequestId,null);assert.equal(s.explanationDelivery,'rejected');assert.ok(!fullStatus(s).includes('依頼しました'));
 const id=await requestFull(s,{send:async()=>({})},()=> 'retry-2');assert.equal(id,'retry-2');assert.equal(s.explanationPending,true);assert.equal(s.selected,'csv');assert.equal(s.explanationDelivery,'awaiting');
 assert.equal(acceptResult(s,reply(s,'rejected-1','旧依頼')),s);
 const done=acceptResult(s,reply(s,id));assert.equal(done.explanation,'再説明');assert.equal(done.selected,'csv');assert.equal(done.explanationPending,false);
});
test('review P2: timeout is uncertain, keeps correlation, blocks resend and never claims acknowledged delivery',async()=>{
 const s=ready();let calls=0;const message={send:async()=>{calls++;throw new Error('timeout');}};
 await assert.rejects(requestFull(s,message,()=> 'timeout-1'),/不明/);assert.equal(s.explanationDelivery,'uncertain');assert.equal(s.explanationPending,true);assert.equal(s.explanationRequestId,'timeout-1');assert.ok(!fullStatus(s).includes('依頼しました'));
 await assert.rejects(requestFull(s,message,()=> 'duplicate'));assert.equal(calls,1);
 const done=acceptResult(s,reply(s,'timeout-1'));assert.equal(done.explanationDelivery,'received');
});
test('review P2: unsolicited explanation is ignored even with matching question and revision',()=>{
 const s=ready();assert.equal(acceptResult(s,reply(s,'unsolicited')),s);assert.equal(s.explanation,null);
});
test('review P2: only active request is accepted once; duplicate and late previous requests never overwrite',async()=>{
 let s=ready();await requestFull(s,{send:async()=>({})},()=> 'request-A');s=acceptResult(s,reply(s,'request-A','説明A'));
 assert.equal(s.explanation,'説明A');assert.equal(acceptResult(s,reply(s,'request-A','重複A')),s);
 await requestFull(s,{send:async()=>({})},()=> 'request-B');assert.equal(acceptResult(s,reply(s,'request-A','後着A')),s);assert.equal(s.explanation,'説明A');
 s=acceptResult(s,reply(s,'request-B','説明B'));assert.equal(s.explanation,'説明B');assert.equal(acceptResult(s,reply(s,'request-A','更に後着A')),s);assert.equal(acceptResult(s,reply(s,'request-B','重複B')),s);
});
test('review P2: new question cancels previous correlation and old explanation cannot cross tasks',async()=>{
 const s=ready();await requestFull(s,{send:async()=>({})},()=> 'old-qa-request');
 const other=validateQuestion({...input(),id:'question-B',taskId:'job-B',taskName:'別タスク'});
 const next=acceptResult(s,{kind:'question',question:other,revision:2});assert.equal(next.explanationRequestId,null);assert.equal(next.explanationPending,false);assert.equal(acceptResult(next,reply(s,'old-qa-request')),next);
});
test('correlated explanation preserves an already confirmed answer and execution boundary',async()=>{
 const s=ready();s.answer=answerPayload(s);s.delivery='sent';await requestFull(s,{send:async()=>({})},()=> 'after-answer');const done=acceptResult(s,reply(s,'after-answer'));assert.deepEqual(done.answer,s.answer);assert.equal(done.delivery,'sent');assert.equal(done.answer.executionApproval,false);
});
