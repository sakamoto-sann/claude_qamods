// Context supplied explicitly by the calling chat. No transcript/file collection.
export function compactContext(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('文脈はオブジェクトで指定してください');
  const clip=(text,max)=>{if(typeof text!=='string')throw new Error('文脈は文字列で指定してください');return text.length<=max?text:text.slice(0,max-1)+'…';};
  if(value.recentInstructions!==undefined&&(!Array.isArray(value.recentInstructions)||value.recentInstructions.some(s=>typeof s!=='string')))throw new Error('最近の指示は文字列の配列です');
  return {mode:'compact',recentInstructions:(value.recentInstructions??[]).slice(-3).map(s=>clip(s,600)),precedingExplanation:clip(value.precedingExplanation??'',2500),latestWorkSummary:clip(value.latestWorkSummary??'',1600)};
}
