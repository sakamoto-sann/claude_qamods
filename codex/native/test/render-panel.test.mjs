import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {renderPanel} from '../render-panel.mjs';
test('embedded JavaScript preserves literal replacement sequences and closing tags',()=>{
 const js="globalThis.values=['$&','$`',"+JSON.stringify("$'")+",'</script>','</ScRiPt>'];";
 const html=renderPanel('<style>__CSS__</style><script type="module">__SCRIPT__</script>','$&',js);
 assert.ok(html.startsWith('<style>$&</style>'));assert.equal((html.match(/<\/script>/gi)||[]).length,1);
 const source=html.split('<script type="module">')[1].split('</script>')[0],context={};
 new Script(source).runInNewContext(context);assert.deepEqual(Array.from(context.values),['$&','$`',"$'",'</script>','</ScRiPt>']);
});
test('the built inline JavaScript parses before any host communication',()=>{
 const html=readFileSync(new URL('../plugin/dist/panel.html',import.meta.url),'utf8');
 const source=html.split('<script type="module">')[1].split('</script>')[0];assert.ok(source);
 // Bundled app uses top-level await, so parse inside an async function without executing it.
 assert.doesNotThrow(()=>new Script('(async()=>{'+source+'\n})'));
 assert.ok(!source.includes('<!doctype html>'));
});
