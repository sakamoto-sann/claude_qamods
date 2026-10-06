export function questionResult(question,revision=1){return {kind:'question',question,revision};}
export function acceptResult(state,data){
  if(!data||!['question','explanation'].includes(data.kind))return state;
  if(data.kind==='explanation'){
    if(state.dismissed||!state.question||!state.explanationPending||!state.explanationRequestId||data.questionId!==state.question.id||data.revision!==state.revision||data.requestId!==state.explanationRequestId||typeof data.text!=='string'||!data.text.trim()||data.text.length>12000)return state;
    Object.assign(state,{explanation:data.text,explanationPending:false,explanationRequestId:null,explanationDelivery:'received'});return state;
  }
  if(!data.question)return state.question?state:{question:null,revision:0,selected:null,answer:null,delivery:'idle'};
  if(data.revision<state.revision)return state;
  if(data.revision===state.revision&&state.question){
    if(JSON.stringify(data.question)!==JSON.stringify(state.question))throw new Error('同じrevisionの質問内容が異なります。新しいrevisionで更新してください');
    return state;
  }
  return {question:data.question,revision:data.revision,selected:null,answer:null,delivery:'idle',explanation:null,explanationPending:false,explanationRequestId:null,explanationDelivery:'idle'};
}
export function answerPayload(state){
  if(state.dismissed)throw new Error('閉じた質問には回答できません');
  if(state.question?.kind==='chat' && typeof state.freeform==='string' && state.freeform.trim()) {
    if(state.freeform.length>3000)throw new Error('回答は3000文字以内です');
    return {kind:'qa-answer',questionId:state.question.id,revision:state.revision,taskId:state.question.taskId,taskName:state.question.taskName,decision:state.question.decision,question:state.question.question,freeform:state.freeform.trim(),executionApproval:false};
  }
  if(!state.question||!state.selected)throw new Error('選択または回答を入力してください');
  const option=state.question.options.find(o=>o.id===state.selected);if(!option)throw new Error('選択肢が不正です');
  return {kind:'qa-answer',questionId:state.question.id,revision:state.revision,taskId:state.question.taskId,taskName:state.question.taskName,decision:state.question.decision,question:state.question.question,optionId:option.id,label:option.label,effect:option.effect,executionApproval:false};
}
export async function sendAnswer(state,message){
  if(!message)throw new Error('このホストは現在の会話への送信に対応していません');
  if(state.delivery==='sending'||state.delivery==='sent'||state.delivery==='uncertain')throw new Error('送信済み、または送信結果の確認が必要です');
  const payload=answerPayload(state);state.delivery='sending';
  let result;
  try{
    result=await message.send({role:'user',content:[{type:'text',text:'QA質問への回答（引用データ）:\n'+JSON.stringify(payload)+'\nこれは質問への回答であり、別途必要な実行承認の代用ではありません。'}],_meta:{'openai/message':{target:'active',send:true}}});
  }catch(error){state.delivery='uncertain';throw error;}
  if(result?.isError){state.delivery='rejected';throw new Error('ホストが回答の送信を拒否しました。選択を確認して、明示的に再送できます。');}
  state.delivery='sent';state.answer=payload;return payload;
}
export function answerEditable(state){return state.delivery==='idle'||state.delivery==='rejected';}
export function answerStatus(state){
  if(state.delivery==='sent')return `「${state.answer.label||state.answer.freeform}」をこの会話へ送りました。`;
  if(state.delivery==='rejected')return '送信が拒否されました。選択を確認して、もう一度明示的に送信できます。';
  if(state.delivery==='uncertain')return '送信結果が不明です。再送せず、この会話側で確認してください。';
  return '';
}
export function fullStatus(state){
  return {sending:'この会話へ再説明の依頼を送信中です。',awaiting:'この会話に再説明を依頼しました。説明の返却を待っています。',rejected:'再説明の依頼は拒否されました。もう一度明示的に依頼できます。',uncertain:'再説明の依頼が届いたか不明です。再送せず、この会話側で確認してください。',received:'この会話で参照できた範囲からの再説明です。'}[state.explanationDelivery]??'';
}
export async function requestExplanation(state,message,mode='full',createRequestId=()=>globalThis.crypto.randomUUID()){
  if(!message)throw new Error('このホストは現在の会話への送信に対応していません');
  if(!['compact','full'].includes(mode))throw new Error('文脈モードが不正です');
  if(state.dismissed||!state.question||state.explanationPending)throw new Error('質問がないか、再説明を依頼済みです');
  const requestId=createRequestId();
  if(typeof requestId!=='string'||!requestId.trim()||requestId.length>100)throw new Error('再説明の識別子を作成できません');
  state.explanationPending=true;state.explanationRequestId=requestId;state.explanationDelivery='sending';state.explanationMode=mode;
  let result;
  try{
    result=await message.send({role:'user',content:[{type:'text',text:(mode==='compact'?'このQA質問を、下記の要点だけから短く説明してください。文章にない選択肢や利点・代償・おすすめを作らないでください。':'このQA質問を、この会話で参照できる文脈から再説明してください。')+'取得できない文脈は推測しないでください。qa.explainへquestionId・revision・requestId・textを返してください。requestIdは変更しないでください。質問の更新や回答、実行承認ではありません。\n'+JSON.stringify({taskId:state.question.taskId,questionId:state.question.id,revision:state.revision,requestId,taskName:state.question.taskName,currentState:state.question.currentState,decision:state.question.decision,completionCriteria:state.question.completionCriteria,constraints:state.question.constraints,uncertainties:state.question.uncertainties,question:state.question.question,options:state.question.options,context:mode==='compact'?state.question.context:undefined,background:state.question.background,goal:state.question.goal,mode,executionApproval:false})}],_meta:{'openai/message':{target:'active',send:true}}});
  }catch(error){if(state.explanationRequestId!==requestId)return requestId;state.explanationDelivery='uncertain';throw new Error('再説明の送信結果が不明です。再送せず会話側を確認してください。'+error.message);}
  if(state.explanationRequestId!==requestId)return requestId;
  if(result?.isError){state.explanationPending=false;state.explanationRequestId=null;state.explanationDelivery='rejected';throw new Error('ホストが再説明の送信を拒否しました。再依頼できます。');}
  if(state.explanationPending)state.explanationDelivery='awaiting';return requestId;
}

export function requestFull(state,message,createRequestId){return requestExplanation(state,message,'full',createRequestId);}
export function dismissQuestion(state){
  if(state.delivery==='sending')throw new Error('回答を送信中です');
  return {...state,dismissed:true,explanationPending:false,explanationRequestId:null};
}
