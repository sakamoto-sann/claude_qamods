import {detectWaiting} from './chat-question.mjs';
import {compactContext} from './context.mjs';
export function validateQuestion(q) {
  const text=(s,max=3000)=>typeof s==='string' && s.trim().length>0 && s.length<=max;
  if (!q || !text(q.id,100) || !text(q.question) || !text(q.background) || !text(q.goal)) throw new Error('質問、背景、目的、IDが必要です');
  if (!text(q.taskId,100) || !['taskName','currentState','decision','completionCriteria'].every(k=>text(q[k]))) throw new Error('対象タスクのID・表示名、現在状態、決める事項、完了条件が必要です');
  if (q.taskReference!==undefined && !text(q.taskReference,1000)) throw new Error('タスクの参照先は空でない文字列で指定してください');
  if (!q.context || typeof q.context!=='object' || Array.isArray(q.context) || !Array.isArray(q.context.recentInstructions) || typeof q.context.precedingExplanation!=='string' || typeof q.context.latestWorkSummary!=='string') throw new Error('最近の指示・直前の説明・作業状況を含む文脈が必要です');
  const chat=q.kind==='chat';
  if (!Array.isArray(q.options) || q.options.length<(chat?0:2) || q.options.length>(chat?6:3)) throw new Error('選択肢は2〜3件です');
  const ids=new Set();
  for(const o of q.options) {
    if(!o || !(chat?['id','label']:['id','label','effect','benefit','cost']).every(k=>text(o[k],k==='id'?100:3000)) || (chat && (typeof o.description!=='string' || o.description.length>3000)) || ids.has(o.id)) throw new Error('選択肢には重複しないID・結果・利点・代償が必要です');
    ids.add(o.id);
  }
  if (!chat && (!q.recommendation || !ids.has(q.recommendation.optionId) || !text(q.recommendation.reason))) throw new Error('おすすめと理由が必要です');
  for(const key of ['constraints','uncertainties']) if(q[key]!==undefined && (!Array.isArray(q[key]) || q[key].length>10 || q[key].some(s=>!text(s)))) throw new Error('条件・未確認事項の形式が不正です');
  return JSON.parse(JSON.stringify({kind:chat?'chat':'dialog',id:q.id,question:q.question,background:q.background,goal:q.goal,taskId:q.taskId,taskName:q.taskName,taskReference:q.taskReference,currentState:q.currentState,decision:q.decision,completionCriteria:q.completionCriteria,options:q.options.map(({id,label,description,effect,benefit,cost})=>chat?({id,label,description}):({id,label,effect,benefit,cost})),recommendation:chat?null:q.recommendation,constraints:q.constraints??[],uncertainties:q.uncertainties??[],context:compactContext(q.context)}));
}

export function validateChat(text,details) {
  const found=detectWaiting(text);
  if(!found)return null;
  return validateQuestion({...details,kind:'chat',question:found.question,options:found.options.map((o,i)=>({id:String(i+1),...o}))});
}
