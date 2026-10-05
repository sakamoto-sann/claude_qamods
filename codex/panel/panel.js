import {explanationStatus} from './context.mjs';
const token=location.hash.slice(1);
let state=null,selected=null,busy=false;
const $=id=>document.getElementById(id);
const text=(tag,content,cls)=>{const el=document.createElement(tag);el.textContent=content;if(cls)el.className=cls;return el;};
async function api(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
function render(next){
  if(state && (next.revision<state.revision || (next.revision===state.revision && state.answer && !next.answer)))return;
  if(state && next.revision===state.revision){
    const old=state.explanation, incoming=next.explanation;
    if(old && (!incoming || incoming.requestId<old.requestId || (incoming.requestId===old.requestId && old.status==='done' && incoming.status!=='done')))return;
  }
  const changed=next.revision!==state?.revision;
  state=next;$('empty').hidden=!!state.question;$('question-view').hidden=!state.question;
  if(!state.question)return;
  const q=state.question;
  if(changed){
    selected=null;$('error').textContent='';$('question').textContent=q.question;$('goal').textContent=`目的：${q.goal}`;$('background').textContent=q.background;
    $('recent-instructions').replaceChildren(...(q.context?.recentInstructions??[]).map(s=>text('li',s)));
    $('preceding-explanation').textContent=q.context?.precedingExplanation||'未提供';$('latest-work').textContent=q.context?.latestWorkSummary||'未提供';
    $('constraints').replaceChildren(...q.constraints.map(s=>text('li',s)));
    $('options').replaceChildren(...q.options.map(o=>{
      const card=text('label','','option');const title=text('div','','option-title');const input=document.createElement('input');input.type='radio';input.name='choice';input.value=o.id;
      input.addEventListener('change',()=>{selected=o.id;$('submit').disabled=busy||!!state.answer;});
      title.append(input,text('span',o.label));if(o.id===q.recommendation.optionId)title.append(text('span','おすすめ','badge'));
      card.append(title,text('p',o.effect,'effect'));
      for(const [label,value] of [['利点',o.benefit],['代償',o.cost]]){const row=text('div','','detail');row.append(text('strong',label),document.createTextNode(value));card.append(row);}
      return card;
    }));
    $('reason').textContent=q.recommendation.reason;$('uncertainties').replaceChildren(...q.uncertainties.map(s=>text('p',`未確認：${s}`,'uncertainty')));
  }
  $('context-mode').textContent=explanationStatus(state.explanation);$('full-explanation').textContent=state.explanation?.text??'';
  $('full-context').disabled=busy||state.explanation?.status==='pending';
  for(const input of document.querySelectorAll('input[name=choice]')){input.disabled=busy||!!state.answer;input.checked=state.answer?input.value===state.answer.optionId:input.value===selected;}
  $('submit').disabled=busy||!!state.answer||!selected;
  $('answer-status').textContent=state.answer?`「${state.answer.label}」を回答しました。Codexが読み取ると会話に反映されます。`:changed?'質問が届きました。選択してから回答してください。':'';
}
$('full-context').addEventListener('click',async()=>{
  if(busy||!state?.question||state.explanation?.status==='pending')return;
  busy=true;render(state);
  try{render(await api('/explanation-request',{questionId:state.question.id,revision:state.revision}));$('error').textContent='';}catch(error){$('error').textContent=error.message;}
  finally{busy=false;render(state);}
});
$('answer-form').addEventListener('submit',async(event)=>{
  event.preventDefault();if(!selected||busy||state.answer)return;
  busy=true;$('submit').disabled=true;
  const submission={questionId:state.question.id,revision:state.revision,optionId:selected};
  try{render(await api('/answer',submission));$('error').textContent='';}catch(error){$('error').textContent=error.message;try{render(await api('/state'));}catch{}}
  finally{busy=false;render(state);}
});
async function refresh(){
  try{render(await api('/state'));$('connection').textContent='接続済み';document.body.classList.remove('offline');}
  catch(error){$('connection').textContent='接続できません';document.body.classList.add('offline');$('error').textContent=error.message;$('submit').disabled=true;}
}
if(!/^[a-f0-9]{64}$/.test(token)){$('connection').textContent='セッション未接続';$('error').textContent='起動時に表示されたURLから開いてください。';}
else{refresh();setInterval(refresh,800);}
