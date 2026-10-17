import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import {renderPanel} from '../native/render-panel.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(root,'../native');
const require=createRequire(path.join(base,'package.json'));
const {build}=require('esbuild');
const plugin=path.join(root,'native-marketplace/plugins/qa-guide-sidepanel-preview');
const fixture=JSON.parse(readFileSync(path.join(root,'sample-question.json'),'utf8'));
const transform={name:'isolated-preview',setup(builder){
 builder.onLoad({filter:/\/src\/.*\.mjs$/},async args=>{
  if(!args.path.startsWith(base+path.sep))return;
  let contents=readFileSync(args.path,'utf8');
  contents=contents.replaceAll('qa-guide-codex','qa-guide-sidepanel-preview')
   .replaceAll('0.6.2','0.1.0').replaceAll('ui://qa-guide/','ui://qa-guide-sidepanel-preview/')
   .replaceAll('qa.open','qapreview.open').replaceAll('qa.chat','qapreview.chat').replaceAll('qa.explain','qapreview.explain');
  if(path.basename(args.path)==='server.mjs'){
   const entry=",'openai/ui':{entrypoints:[{type:'thread'}]}";
   if(!contents.includes(entry))throw new Error('Base entrypoint definition changed');
   contents=contents.replace(entry,'');
   const marker='  return server;';
   if(!contents.includes(marker))throw new Error('Base server layout changed');
   contents=contents.replace(marker,`  registerAppTool(server,'qapreview.panel',{
    title:'質問の解説（試作）',description:'独立したサイドパネル試作。空引数でサンプルを表示します。回答や承認ではありません。',
    inputSchema:{},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    _meta:{...meta,'openai/ui':{entrypoints:[{type:'thread'}]}}
   },async()=>result({kind:'question',question:validateQuestion(${JSON.stringify(fixture)}),revision:1}));\n`+marker);
  }
  if(path.basename(args.path)==='app.mjs')contents=contents.replace("$('expand').hidden=!host?.availableDisplayModes?.includes(expanded?'inline':'fullscreen');","$('expand').hidden=true;");
  return {contents,loader:'js',resolveDir:path.dirname(args.path)};
 });
}};
const ui=await build({entryPoints:[path.join(base,'src/app.mjs')],bundle:true,platform:'browser',format:'esm',write:false,plugins:[transform],legalComments:'inline'});
const template=readFileSync(path.join(base,'src/panel.html'),'utf8').replace('<h1>質問の補足</h1>','<h1>質問の補足 · 試作</h1>');
const html=renderPanel(template,readFileSync(path.join(base,'src/panel.css'),'utf8'),ui.outputFiles[0].text);
mkdirSync(path.join(plugin,'dist'),{recursive:true});
writeFileSync(path.join(plugin,'dist/panel.html'),html);
writeFileSync(path.join(root,'panel.html'),html);
await build({entryPoints:[path.join(base,'src/main.mjs')],bundle:true,platform:'node',format:'esm',outfile:path.join(plugin,'dist/server.mjs'),plugins:[transform],banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"},legalComments:'inline'});
console.log('Built isolated preview. Existing plugin files were not modified.');
