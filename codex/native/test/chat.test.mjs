import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectWaiting} from '../src/chat-question.mjs';
import {validateChat} from '../src/question.mjs';
import {acceptResult,answerPayload,sendAnswer,requestExplanation,dismissQuestion} from '../src/view-state.mjs';
const details=JSON.parse(readFileSync(new URL('./question.json',import.meta.url),'utf8'));
const ready=()=>acceptResult({}, {kind:'question',question:validateChat('どちらにしますか？\n1. CSV: 表計算で使える\n2. JSON: APIで使える',details),revision:1});
test('plain question preserves explicit options; no fabricated recommendation',()=>{
 const q=ready().question;assert.equal(q.kind,'chat');assert.equal(q.options[0].label,'CSV');assert.equal(q.options[0].description,'表計算で使える');assert.equal(q.recommendation,null);
 assert.equal(validateChat('進めますか？',details).options.length,0);
 assert.equal(detectWaiting('完了しました。'),null);assert.equal(detectWaiting('進めますか？\n作業は完了しました。'),null);assert.equal(detectWaiting('他に何かありますか？'),null);assert.equal(detectWaiting('```\n進めますか？\n```'),null);
 assert.throws(()=>detectWaiting('a'.repeat(16001)));assert.throws(()=>validateChat('進めますか？',{}));
});
test('free text is explicit, bounded and does not become execution approval',async()=>{
 const s=ready();assert.throws(()=>answerPayload(s));s.freeform='別案を検討';let sent;
 await sendAnswer(s,{send:async p=>{sent=p;return {};}});assert.equal(s.answer.freeform,'別案を検討');assert.equal(s.answer.executionApproval,false);assert.ok(sent.content[0].text.includes('別案を検討'));
 const long=ready();long.freeform='a'.repeat(3001);assert.throws(()=>answerPayload(long));
});
test('compact explanation sends only bounded provided context; button does not answer',async()=>{
 const s=ready();let sent;await requestExplanation(s,{send:async p=>{sent=p;return {}; }},'compact',()=> 'compact-1');
 assert.equal(s.answer,null);assert.equal(s.explanationMode,'compact');assert.ok(sent.content[0].text.includes('文章にない選択肢'));assert.ok(sent.content[0].text.includes('compact-1'));
 const done=acceptResult(s,{kind:'explanation',questionId:s.question.id,revision:1,requestId:'compact-1',text:'説明'});assert.equal(done.explanation,'説明');
});
test('dismissal is local, invalidates pending replies, and needs a new revision to reopen',async()=>{
 const s=ready();await requestExplanation(s,{send:async()=>({})},'compact',()=> 'pending');const closed=dismissQuestion(s);
 assert.equal(closed.answer,null);assert.throws(()=>answerPayload({...closed,freeform:'回答'}));assert.equal(acceptResult(closed,{kind:'explanation',questionId:s.question.id,revision:1,requestId:'pending',text:'遅い返却'}),closed);
 assert.equal(acceptResult(closed,{kind:'question',question:s.question,revision:1}),closed);assert.equal(acceptResult(closed,{kind:'question',question:s.question,revision:2}).dismissed,undefined);
});
