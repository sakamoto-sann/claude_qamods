import {App,applyDocumentTheme,applyHostStyleVariables} from '@modelcontextprotocol/ext-apps';
import {OpenAIExtensions} from '@openai/mcp-extensions/app';
import {acceptResult,requestFull,requestExplanation,dismissQuestion,fullStatus} from './view-state.mjs';
const app=new App({name:'qa-guide-codex',version:'0.6.2'},{availableDisplayModes:['inline','fullscreen']},{autoResize:true});
const extensions=new OpenAIExtensions(app);
let state={question:null,revision:0},busy=false;
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
function render(){
  const q=state.dismissed?null:state.question;
  $('empty').hidden=!!q;$('question-view').hidden=!q;
  $('capability').textContent=extensions.message?'':'追加の解説はチャットで依頼してください。';
  const host=app.getHostContext();
  const expanded=host?.displayMode==='fullscreen';
  $('expand').hidden=!host?.availableDisplayModes?.includes(expanded?'inline':'fullscreen');
  $('expand').textContent=expanded?'小さく表示':'広げる';$('expand').disabled=busy;
  if(!q)return;
  $('question-kind').textContent=q.kind==='chat'?'文章での質問':'判断の補足';
  $('task').textContent=q.taskName;$('task-reference').textContent=q.taskReference||'';
  $('current-state').textContent=q.currentState;$('decision').textContent=q.decision;$('completion').textContent=q.completionCriteria;
  $('question').textContent=q.question;$('goal').textContent=q.goal;$('background').textContent=q.background;
  $('constraints').replaceChildren(...q.constraints.map(s=>text('li',s)));
  $('recent').replaceChildren(...q.context.recentInstructions.map(s=>text('li',s)));
  $('preceding').textContent=q.context.precedingExplanation||'未提供';$('work').textContent=q.context.latestWorkSummary||'未提供';
  $('options').replaceChildren(...q.options.map((o,i)=>{
    const card=text('div','','option'),title=text('div',`${i+1}. ${o.label}`,'option-title');
    if(o.id===q.recommendation?.optionId)title.append(text('span','おすすめ','badge'));
    card.append(title,text('p',q.kind==='chat'?o.description:o.effect,'effect'));
    if(q.kind!=='chat')for(const [label,value]of [['利点',o.benefit],['代償',o.cost]]){
      const row=text('div','','detail');row.append(text('strong',label),document.createTextNode(value));card.append(row);
    }
    return card;
  }));
  $('options-section').hidden=!q.options.length;
  $('recommendation').hidden=!q.recommendation;$('reason').textContent=q.recommendation?.reason||'';
  $('uncertainties').replaceChildren(...q.uncertainties.map(s=>text('p','未確認：'+s)));
  for(const id of ['compact','full'])$(id).disabled=busy||!extensions.message||state.explanationPending;
  $('dismiss').disabled=busy;
  $('context-mode').textContent=state.explanationMode==='full'?'全文脈':state.explanationMode==='compact'?'要点のみ':'';
  $('explanation').textContent=state.explanation||'';$('full-status').textContent=fullStatus(state);
}
app.ontoolresult=result=>{try{state=acceptResult(state,result.structuredContent);render();}catch(error){$('error').textContent=error.message;}};
function style(context){if(context?.theme)applyDocumentTheme(context.theme);if(context?.styles?.variables)applyHostStyleVariables(context.styles.variables);}
app.addEventListener('hostcontextchanged',()=>{style(app.getHostContext());render();});
$('dismiss').addEventListener('click',()=>{if(!busy){state=dismissQuestion(state);render();}});
for(const [id,request]of [['compact',(s,m)=>requestExplanation(s,m,'compact')],['full',requestFull]]){
  $(id).addEventListener('click',async()=>{
    if(busy||!extensions.message||!state.question||state.dismissed||state.explanationPending)return;
    busy=true;const requestedState=state;render();
    try{await request(requestedState,extensions.message);$('error').textContent='';}
    catch(error){$('error').textContent=error.message;}
    finally{busy=false;render();}
  });
}
$('expand').addEventListener('click',async()=>{
  if(busy)return;const host=app.getHostContext(),mode=host?.displayMode==='fullscreen'?'inline':'fullscreen';
  if(!host?.availableDisplayModes?.includes(mode))return;
  busy=true;render();try{await app.requestDisplayMode({mode});$('error').textContent='';}
  catch(error){$('error').textContent=error.message;}finally{busy=false;render();}
});
try{await app.connect();$('connection').textContent='接続済み';style(app.getHostContext());render();}
catch(error){$('connection').textContent='接続できません';$('error').textContent=error.message;}
