import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAppResource,registerAppTool,RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server';
import {z} from 'zod';
import {validateQuestion} from './question.mjs';
export function createServer(html){
  const server=new McpServer({name:'qa-guide-codex',version:'0.5.3'});
  const short=z.string().min(1).max(100),text=z.string().min(1).max(3000);
  const questionSchema=z.object({
    id:short,question:text,background:text,goal:text,
    taskId:short,taskName:text,taskReference:z.string().min(1).max(1000).optional(),
    currentState:text,decision:text,completionCriteria:text,
    context:z.object({recentInstructions:z.array(z.string()),precedingExplanation:z.string(),latestWorkSummary:z.string()}),
    options:z.array(z.object({id:short,label:text,effect:text,benefit:text,cost:text})).min(2).max(3),
    recommendation:z.object({optionId:short,reason:text}),
    constraints:z.array(text).max(10).optional(),uncertainties:z.array(text).max(10).optional()
  });
  const resource='ui://qa-guide/question-panel/v0.5.3.html';
  const meta={ui:{resourceUri:resource},'openai/outputTemplate':resource,'openai/ui':{entrypoints:[{type:'thread'}]}};
  registerAppResource(server,'qa-question-panel',resource,{},async()=>({contents:[{uri:resource,mimeType:RESOURCE_MIME_TYPE,text:html,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/ui':{preferredDisplayMode:'inline',availableDisplayModes:['inline','fullscreen']}}}]}));
  const result=data=>({content:[{type:'text',text:JSON.stringify(data),annotations:{audience:['assistant']}}],structuredContent:data});
  registerAppTool(server,'qa.open',{title:'質問の背景と選択肢',description:'判断に必要な質問だけをこの会話のQAパネルに示します。対象タスク、現在状態、決める事項、完了条件、背景と、2〜3案の具体的な結果・利点・代償、おすすめの理由をquestionへ渡してください。文脈は参照できる範囲だけを記載し、取得できない内容を推測しないでください。revisionは会話内の質問更新ごとに増やします。空引数では空のパネル。回答は本人の明示操作だけで、実行承認ではありません。サーバーは履歴やファイルを読みません。',inputSchema:{question:questionSchema.optional(),revision:z.number().int().positive().optional()},outputSchema:{kind:z.literal('question'),question:questionSchema.extend({context:z.object({mode:z.literal('compact'),recentInstructions:z.array(z.string()),precedingExplanation:z.string(),latestWorkSummary:z.string()})}).nullable(),revision:z.number().int().nonnegative()},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:meta},async({question,revision=1})=>{
    if(question===undefined)return result({kind:'question',question:null,revision:0});
    if(JSON.stringify(question).length>32768)throw new Error('質問が大きすぎます');
    return result({kind:'question',question:validateQuestion(question),revision});
  });
  registerAppTool(server,'qa.explain',{title:'質問を再説明',description:'本人の全文脈再説明依頼に応答し、同じ質問ID・revision・requestIdの説明だけを返します。質問・選択・回答は更新しません。',inputSchema:{questionId:z.string().min(1).max(100),revision:z.number().int().positive(),requestId:z.string().min(1).max(100),text:z.string().min(1).max(12000)},outputSchema:{kind:z.literal('explanation'),questionId:short,revision:z.number().int().positive(),requestId:short,text:z.string().min(1).max(12000)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:resource},'openai/outputTemplate':resource}},async(data)=>result({kind:'explanation',...data}));
  return server;
}
