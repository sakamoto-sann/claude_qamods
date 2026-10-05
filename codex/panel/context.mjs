// Context supplied explicitly by the calling chat. No transcript/file collection.
export function compactContext(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('文脈はオブジェクトで指定してください');
  const clip=(text,max)=>{if(typeof text!=='string')throw new Error('文脈は文字列で指定してください');return text.length<=max?text:text.slice(0,max-1)+'…';};
  if(value.recentInstructions!==undefined&&(!Array.isArray(value.recentInstructions)||value.recentInstructions.some(s=>typeof s!=='string')))throw new Error('最近の指示は文字列の配列です');
  return {mode:'compact',recentInstructions:(value.recentInstructions??[]).slice(-3).map(s=>clip(s,600)),precedingExplanation:clip(value.precedingExplanation??'',2500),latestWorkSummary:clip(value.latestWorkSummary??'',1600)};
}
export function requestExplanation(previous,question,revision,data) {
  if(!question||data.questionId!==question.id||data.revision!==revision)throw new Error('質問が更新されました');
  if(previous?.status==='pending')return previous;
  return {questionId:question.id,revision,requestId:(previous?.requestId??0)+1,mode:'full',status:'pending',executionApproval:false};
}
export function completeExplanation(request,question,revision,data) {
  if(!question||!request||request.status!=='pending'||data.questionId!==question.id||data.revision!==revision||data.requestId!==request.requestId)throw new Error('古い再説明は反映しません');
  if(typeof data.text!=='string'||!data.text.trim()||data.text.length>12000)throw new Error('再説明は1〜12000文字で指定してください');
  return {...request,status:'done',text:data.text,scope:'呼出元のCodexがこの会話で参照できた文脈',executionApproval:false};
}
export function explanationStatus(value) {
  if(!value)return '要点のみ';
  return value.status==='pending'?'全文脈の再説明を依頼しました。Codexの読取り待ちです。':'全文脈で再説明（この会話で参照できた範囲）';
}
