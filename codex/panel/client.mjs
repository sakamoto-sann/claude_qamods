import {readFileSync} from 'node:fs';
import {createClient} from './client-core.mjs';
const [command,sessionFile,...args]=process.argv.slice(2);
try {
  if(!['publish','ask','state','wait','wait-current','stop','explain'].includes(command)||!sessionFile)throw new Error('client.mjs publish|ask|state|wait|wait-current|stop|explain SESSION [QUESTION.json|QUESTION_ID REVISION]');
  const client=createClient(JSON.parse(readFileSync(sessionFile,'utf8')));
  let result;
  if(command==='publish'||command==='ask'){
    if(!args[0])throw new Error('質問JSONファイルが必要です');
    const question=JSON.parse(readFileSync(args[0],'utf8'));
    result=command==='ask'?await client.ask(question):await client.request('/question',question);
  }
  if(command==='explain'){if(!args[0])throw new Error('再説明JSONファイルが必要です');result=await client.request('/explanation',JSON.parse(readFileSync(args[0],'utf8')));}
  if(command==='state')result=await client.request('/state');
  if(command==='stop')result=await client.request('/stop',{});
  if(command==='wait')result=await client.wait(args[0],Number(args[1]));
  if(command==='wait-current')result=await client.waitCurrent();
  console.log(JSON.stringify(result));
  if(result?.pending)process.exitCode=2;
} catch(error){console.error(JSON.stringify({error:error.message,executionApproval:false}));process.exitCode=1;}
