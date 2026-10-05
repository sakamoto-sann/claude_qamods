export function createClient(session, {fetchFn=fetch, now=Date.now, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)), timeoutMs=30000}={}) {
  const url=new URL(session.origin);
  if(url.hostname!=='127.0.0.1'||url.protocol!=='http:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('ローカルパネルだけに接続できます');
  if(typeof session.token!=='string'||!session.token)throw new Error('セッションキーがありません');
  const request=async(path,body)=>{
    let response;
    try {
      response=await fetchFn(url.origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(3000)});
    } catch {
      throw new Error('パネルに接続できません。起動状態を確認してください。セッションを自動削除・再起動しません');
    }
    const result=await response.json();if(!response.ok)throw new Error(result.error||'パネルの要求に失敗しました');return result;
  };
  const wait=async(id,revision)=>{
    if(!id||!Number.isSafeInteger(revision)||revision<1)throw new Error('質問IDと正のrevisionが必要です');
    const deadline=now()+timeoutMs;
    while(now()<deadline){
      const state=await request('/state');
      if(state.question?.id!==id||state.revision!==revision)throw new Error('質問が更新されました。古い回答を引き継ぎません');
      if(state.answer){
        if(state.answer.questionId!==id||state.answer.revision!==revision||state.answer.executionApproval!==false)throw new Error('回答と質問が一致しません');
        return state.answer;
      }
      if(state.explanation?.status==='pending')return {explanationRequested:state.explanation,pending:true,questionId:id,revision,executionApproval:false};
      await sleep(500);
    }
    return {pending:true,questionId:id,revision,executionApproval:false};
  };
  return {
    request, wait,
    async ask(question){const state=await request('/question',question);return wait(state.question?.id,state.revision);},
    async waitCurrent(){const state=await request('/state');if(!state.question)throw new Error('待機する質問がありません');return wait(state.question.id,state.revision);}
  };
}
