import {App,applyDocumentTheme,applyHostStyleVariables} from '@modelcontextprotocol/ext-apps';
import {OpenAIExtensions} from '@openai/mcp-extensions/app';
import {acceptResult,sendAnswer,requestFull,fullStatus,answerEditable,answerStatus} from './view-state.mjs';
const app=new App({name:'qa-guide-codex',version:'0.5.2'},{availableDisplayModes:['inline','fullscreen']},{autoResize:true});
const extensions=new OpenAIExtensions(app);
let state={question:null,revision:0,selected:null,answer:null,delivery:'idle'},busy=false;
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
function render(){
  const q=state.question;$('empty').hidden=!!q;$('question-view').hidden=!q;
  $('capability').textContent=extensions.message?'この会話への回答送信に対応しています。':'このホストは現在の会話への送信に未対応です。チャットで回答してください。';
  if(!q)return;
  $('task').textContent=`対象タスク：${q.taskName}（${q.taskId}）`;$('taskReference').textContent=q.taskReference||'';
  $('current-state').textContent=q.currentState;$('decision').textContent=q.decision;$('completion').textContent=q.completionCriteria;
  $('question').textContent=q.question;$('goal').textContent='目的：'+q.goal;$('background').textContent=q.background;
  $('constraints').replaceChildren(...q.constraints.map(s=>text('li',s)));$('recent').replaceChildren(...q.context.recentInstructions.map(s=>text('li',s)));
  $('preceding').textContent=q.context.precedingExplanation||'未提供';$('work').textContent=q.context.latestWorkSummary||'未提供';
  $('options').replaceChildren(...q.options.map(o=>{
    const card=text('label','','option'),title=text('div','','option-title'),input=document.createElement('input');input.type='radio';input.name='choice';input.value=o.id;input.checked=state.selected===o.id;input.disabled=busy||!answerEditable(state);
    input.addEventListener('change',()=>{if(busy||!answerEditable(state))return;state.selected=o.id;render();});
    title.append(input,text('span',o.label));if(o.id===q.recommendation.optionId)title.append(text('span','おすすめ','badge'));
    card.append(title,text('p',o.effect,'effect'));for(const [label,value]of [['利点',o.benefit],['代償',o.cost]]){const row=text('div','','detail');row.append(text('strong',label),document.createTextNode(value));card.append(row);}return card;
  }));
  $('reason').textContent=q.recommendation.reason;$('uncertainties').replaceChildren(...q.uncertainties.map(s=>text('p','未確認：'+s)));
  $('submit').disabled=busy||!extensions.message||!state.selected||!answerEditable(state);
  $('full').disabled=busy||!extensions.message||state.explanationPending;
  $('explanation').textContent=state.explanation||'';$('full-status').textContent=fullStatus(state);
  $('answer-status').textContent=answerStatus(state);
}
app.ontoolresult=result=>{try{state=acceptResult(state,result.structuredContent);render();}catch(error){$('error').textContent=error.message;}};
function style(context){if(context?.theme)applyDocumentTheme(context.theme);if(context?.styles?.variables)applyHostStyleVariables(context.styles.variables);}
app.addEventListener('hostcontextchanged',()=>style(app.getHostContext()));
$('answer-form').addEventListener('submit',async event=>{event.preventDefault();if(busy||!state.selected||!extensions.message||!answerEditable(state))return;busy=true;const submittedState=state;render();try{await sendAnswer(submittedState,extensions.message);$('error').textContent='';}catch(error){$('error').textContent=error.message;}finally{busy=false;render();}});
$('full').addEventListener('click',async()=>{if(busy||!extensions.message||!state.question||state.explanationPending)return;busy=true;const requestedState=state;render();try{await requestFull(requestedState,extensions.message);$('error').textContent='';}catch(error){$('error').textContent=error.message;}finally{busy=false;render();}});
try{await app.connect();$('connection').textContent='ホスト接続済み';style(app.getHostContext());render();}catch(error){$('connection').textContent='接続できません';$('error').textContent=error.message;}
