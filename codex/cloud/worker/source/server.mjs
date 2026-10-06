import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAppResource,registerAppTool,RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server';
import {z} from 'zod';
import {validateQuestion,validateChat} from './question.mjs';
export function createServer(html){
  const server=new McpServer({name:'qa-guide-codex',version:'0.6.2'});
  const short=z.string().min(1).max(100),text=z.string().min(1).max(3000);
  const taskSchema=z.object({
    id:short,background:text,goal:text,
    taskId:short,taskName:text,taskReference:z.string().min(1).max(1000).optional(),
    currentState:text,decision:text,completionCriteria:text,
    context:z.object({mode:z.literal('compact').optional(),recentInstructions:z.array(z.string()),precedingExplanation:z.string(),latestWorkSummary:z.string()}),
    constraints:z.array(text).max(10).optional(),uncertainties:z.array(text).max(10).optional()
  });
  const questionSchema=taskSchema.extend({kind:z.literal('dialog').optional(),question:text,options:z.array(z.object({id:short,label:text,effect:text,benefit:text,cost:text})).min(2).max(3),recommendation:z.object({optionId:short,reason:text})});
  const chatSchema=taskSchema.extend({kind:z.literal('chat'),question:text,options:z.array(z.object({id:short,label:text,description:z.string()})).max(6),recommendation:z.null()});
  const resource='ui://qa-guide/question-panel/v0.6.2.html';
  const meta={ui:{resourceUri:resource},'openai/outputTemplate':resource,'openai/ui':{entrypoints:[{type:'thread'}]}};
  registerAppResource(server,'qa-question-panel',resource,{},async()=>({contents:[{uri:resource,mimeType:RESOURCE_MIME_TYPE,text:html,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/ui':{preferredDisplayMode:'inline',availableDisplayModes:['inline','fullscreen']}}}]}));
  const result=data=>({content:[{type:'text',text:JSON.stringify(data),annotations:{audience:['assistant']}}],structuredContent:data});
  registerAppTool(server,'qa.open',{title:'質問の背景と選択肢',description:'判断に必要な質問だけをこの会話のQAパネルに示します。対象タスク、現在状態、決める事項、完了条件、背景と、2〜3案の具体的な結果・利点・代償、おすすめの理由をquestionへ渡してください。文脈は参照できる範囲だけを記載し、取得できない内容を推測しないでください。revisionは会話内の質問更新ごとに増やします。空引数では空のパネル。本人が詳しく/??を求めた時だけ開きます。回答はCodex標準の質問UIまたはチャットで受け取ります。サーバーは履歴やファイルを読みません。',inputSchema:{question:questionSchema.optional(),revision:z.number().int().positive().optional()},outputSchema:{kind:z.literal('question'),question:questionSchema.extend({context:z.object({mode:z.literal('compact'),recentInstructions:z.array(z.string()),precedingExplanation:z.string(),latestWorkSummary:z.string()})}).nullable(),revision:z.number().int().nonnegative()},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:meta},async({question,revision=1})=>{
    if(question===undefined)return result({kind:'question',question:null,revision:0});
    if(JSON.stringify(question).length>32768)throw new Error('質問が大きすぎます');
    return result({kind:'question',question:validateQuestion(question),revision});
  });
  registerAppTool(server,'qa.chat',{title:'文章での質問',description:'本人が詳しく/??を求めた時に、明示された質問文と文脈を渡します。末尾の質問と明示された選択肢だけを検出し、おすすめを作りません。自動監視はしません。',inputSchema:{text:z.string().min(1).max(16000),details:taskSchema,revision:z.number().int().positive()},outputSchema:{kind:z.enum(['question','no-question']),question:chatSchema.optional(),revision:z.number().int().positive().optional(),detected:z.literal(false).optional()},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:meta},async({text,details,revision})=>{
    if(JSON.stringify(details).length>32768)throw new Error('文脈が大きすぎます');
    const question=validateChat(text,details);return result(question?{kind:'question',question,revision}:{kind:'no-question',detected:false});
  });
  registerAppTool(server,'qa.explain',{title:'質問を再説明',description:'本人の要約または全文脈再説明依頼に応答し、同じ質問ID・revision・requestIdの説明だけを返します。質問・選択・回答は更新しません。',inputSchema:{questionId:z.string().min(1).max(100),revision:z.number().int().positive(),requestId:z.string().min(1).max(100),text:z.string().min(1).max(12000)},outputSchema:{kind:z.literal('explanation'),questionId:short,revision:z.number().int().positive(),requestId:short,text:z.string().min(1).max(12000)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:resource},'openai/outputTemplate':resource}},async(data)=>result({kind:'explanation',...data}));
  return server;
}
