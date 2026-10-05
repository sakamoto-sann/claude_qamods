import {build} from 'esbuild';
import {renderPanel} from './render-panel.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const ui=await build({entryPoints:['src/app.mjs'],bundle:true,platform:'browser',format:'esm',write:false,legalComments:'inline'});
const html=renderPanel(readFileSync('src/panel.html','utf8'),readFileSync('src/panel.css','utf8'),ui.outputFiles[0].text);
mkdirSync('plugin/dist',{recursive:true});
writeFileSync('plugin/dist/panel.html',html);
await build({entryPoints:['src/main.mjs'],bundle:true,platform:'node',format:'esm',outfile:'plugin/dist/server.mjs',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"},legalComments:'inline'});
