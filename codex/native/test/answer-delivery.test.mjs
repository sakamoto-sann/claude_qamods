import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptResult,sendAnswer,requestFull,answerEditable,answerStatus} from '../src/view-state.mjs';
const question=JSON.parse(readFileSync(new URL('./question.json',import.meta.url)));
const ready=()=>({...acceptResult({}, {kind:'question',question,revision:1}),selected:question.options[0].id});
test('explicit refusal preserves selection, shows refusal and allows one manually requested retry',async()=>{
 const s=ready();let calls=0;const message={send:async()=>{calls++;return calls===1?{isError:true}:{};}};
 await assert.rejects(sendAnswer(s,message),/拒否/);assert.equal(s.delivery,'rejected');assert.equal(s.selected,question.options[0].id);assert.equal(s.answer,null);assert.equal(answerEditable(s),true);assert.match(answerStatus(s),/拒否/);assert.ok(!answerStatus(s).includes('不明'));assert.equal(calls,1);
 const result=await sendAnswer(s,message);assert.equal(calls,2);assert.equal(s.delivery,'sent');assert.equal(result.executionApproval,false);assert.equal(answerEditable(s),false);assert.match(answerStatus(s),/送りました/);await assert.rejects(sendAnswer(s,message));assert.equal(calls,2);
});
test('explicit refusal permits a changed selection followed by explicit send',async()=>{
 const s=ready();await assert.rejects(sendAnswer(s,{send:async()=>({isError:true})}));s.selected=question.options[1].id;
 const answer=await sendAnswer(s,{send:async()=>({})});assert.equal(answer.optionId,question.options[1].id);assert.equal(answer.effect,question.options[1].effect);assert.equal(answer.executionApproval,false);
});
test('timeout remains uncertain; selection survives and both editing and resend are blocked',async()=>{
 const s=ready();let calls=0;const message={send:async()=>{calls++;throw Error('timeout');}};
 await assert.rejects(sendAnswer(s,message),/timeout/);assert.equal(s.delivery,'uncertain');assert.equal(s.selected,question.options[0].id);assert.equal(s.answer,null);assert.equal(answerEditable(s),false);assert.match(answerStatus(s),/不明/);await assert.rejects(sendAnswer(s,message),/確認/);assert.equal(calls,1);
});
test('a thrown exception mentioning refusal is still uncertain, not evidence of delivery rejection',async()=>{
 const s=ready();await assert.rejects(sendAnswer(s,{send:async()=>{throw Error('拒否かもしれない');}}));assert.equal(s.delivery,'uncertain');assert.equal(answerEditable(s),false);
});
test('sending in progress blocks concurrent duplicate sends and becomes retryable only on explicit refusal',async()=>{
 const s=ready();let resolve,calls=0;const pending=sendAnswer(s,{send:()=>{calls++;return new Promise(r=>{resolve=r;});}});const rejected=assert.rejects(pending,/拒否/);
 assert.equal(s.delivery,'sending');assert.equal(answerEditable(s),false);await assert.rejects(sendAnswer(s,{send:async()=>{calls++;return {};}}));assert.equal(calls,1);resolve({isError:true});await rejected;assert.equal(answerEditable(s),true);
});

for(const outcome of ['sent','rejected','uncertain'])test(`explanation during answer send preserves current ${outcome} delivery`,async()=>{
 const submitted=ready();await requestFull(submitted,{send:async()=>({})},()=> 'explain-race');
 let resolve,reject;const sending=sendAnswer(submitted,{send:()=>new Promise((a,b)=>{resolve=a;reject=b;})});
 const current=acceptResult(submitted,{kind:'explanation',questionId:question.id,revision:1,requestId:'explain-race',text:'追加説明'});
 assert.equal(current,submitted);
 if(outcome==='uncertain')reject(new Error('timeout'));else resolve(outcome==='rejected'?{isError:true}:{});
 if(outcome==='sent')await sending;else await assert.rejects(sending);
 assert.equal(current.delivery,outcome);assert.equal(current.explanation,'追加説明');assert.equal(current.selected,submitted.selected);
 assert.equal(answerEditable(current),outcome==='rejected');
});
test('explanation arriving before request acknowledgement keeps received status',async()=>{
 const state=ready();let acknowledge;const pending=requestFull(state,{send:()=>new Promise(resolve=>{acknowledge=resolve;})},()=> 'early');
 const current=acceptResult(state,{kind:'explanation',questionId:question.id,revision:1,requestId:'early',text:'早い説明'});
 acknowledge({});await pending;assert.equal(current.explanationDelivery,'received');assert.equal(current.explanationPending,false);
});
test('old answer completion cannot update a newer question revision',async()=>{
 const old=ready();let acknowledge;const pending=sendAnswer(old,{send:()=>new Promise(resolve=>{acknowledge=resolve;})});
 const current=acceptResult(old,{kind:'question',question,revision:2});acknowledge({});await pending;
 assert.notEqual(current,old);assert.equal(current.delivery,'idle');assert.equal(current.answer,null);
});
