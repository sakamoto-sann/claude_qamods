import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const ui=await build({entryPoints:['src/app.mjs'],bundle:true,platform:'browser',format:'esm',write:false,legalComments:'inline'});
const html=readFileSync('src/panel.html','utf8').replace('__CSS__',readFileSync('src/panel.css','utf8')).replace('__SCRIPT__',ui.outputFiles[0].text.replaceAll('</script','<\\/script'));
mkdirSync('plugin/dist',{recursive:true});
writeFileSync('plugin/dist/panel.html',html);
await build({entryPoints:['src/main.mjs'],bundle:true,platform:'node',format:'esm',outfile:'plugin/dist/server.mjs',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"},legalComments:'inline'});
