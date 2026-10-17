import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
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
 builder.onLoad({filter:/[\\/]src[\\/].*\.mjs$/},async args=>{
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
const ui=await build({entryPoints:[path.join(base,'src/app.mjs')],bundle:true,platform:'browser',format:'esm',write:false,plugins:[transform],metafile:true,legalComments:'inline'});
const template=readFileSync(path.join(base,'src/panel.html'),'utf8').replace('<h1>質問の補足</h1>','<h1>質問の補足 · 試作</h1>');
const html=renderPanel(template,readFileSync(path.join(base,'src/panel.css'),'utf8'),ui.outputFiles[0].text);
mkdirSync(path.join(plugin,'dist'),{recursive:true});
writeFileSync(path.join(plugin,'dist/panel.html'),html);
writeFileSync(path.join(root,'panel.html'),html);
const server=await build({entryPoints:[path.join(base,'src/main.mjs')],bundle:true,platform:'node',format:'esm',outfile:path.join(plugin,'dist/server.mjs'),plugins:[transform],metafile:true,banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"},legalComments:'inline'});
console.log('Built isolated preview. Existing plugin files were not modified.');

// Derive license notices from the dependencies actually included by esbuild.
const packages=new Map();
for(const input of [...Object.keys(ui.metafile.inputs),...Object.keys(server.metafile.inputs)]){
 let directory=path.dirname(path.resolve(input));
 if(!directory.includes('node_modules'))continue;
 while(directory!==path.dirname(directory)){
  const manifestPath=path.join(directory,'package.json');
  if(existsSync(manifestPath)){
   const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
   if(manifest.name){packages.set(manifest.name,{directory,manifest});break;}
  }
  directory=path.dirname(directory);
 }
}
// Include the schema validator shipped as a direct SDK dependency as well.
const validator=path.join(base,'node_modules/@cfworker/json-schema');
if(existsSync(path.join(validator,'package.json'))){
 const manifest=JSON.parse(readFileSync(path.join(validator,'package.json'),'utf8'));
 packages.set(manifest.name,{directory:validator,manifest});
}
let notices='# Third-party runtime notices\n\nGenerated from the dependencies bundled by build-native.mjs.\n';
for(const [name,{directory,manifest}] of [...packages].sort(([a],[b])=>a.localeCompare(b))){
 const candidates=['LICENSE','LICENSE.md','LICENSE.txt','LICENSE-MIT','license','license.md','License'];
 const license=candidates.map(n=>path.join(directory,n)).find(existsSync)
  || (name==='@cfworker/json-schema' ? path.join(root,'licenses/cfworker-LICENSE.md') : undefined);
 if(!license)throw new Error('Missing license text for bundled dependency: '+name);
 notices+='\n## '+name+' '+manifest.version+'\n\n'+readFileSync(license,'utf8').trim()+'\n';
 for(const extra of ['NOTICE','NOTICE.txt'])if(existsSync(path.join(directory,extra)))notices+='\n'+readFileSync(path.join(directory,extra),'utf8').trim()+'\n';
}
writeFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),notices);
writeFileSync(path.join(plugin,'THIRD_PARTY_NOTICES.md'),notices);
