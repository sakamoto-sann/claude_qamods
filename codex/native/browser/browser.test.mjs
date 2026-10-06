import {test,expect} from 'vitest';
import {localBrowser,Stagehand} from '@browserbasehq/stagehand';
import {existsSync,mkdtempSync,readFileSync,rmSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startHost,until,panelState,click} from '../test/helpers/browser-host.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const bytes=dir=>readdirSync(dir,{withFileTypes:true}).reduce((total,entry)=>{try{return total+(entry.isDirectory()?bytes(join(dir,entry.name)):statSync(join(dir,entry.name)).size);}catch{return total;}},0);
test('built explanation panel works with the official bridge and restrictive iframe CSP',async()=>{
 const executable=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find(existsSync);
 expect(executable,'Provide CHROME_BIN; this suite never downloads a browser.').toBeTruthy();
 const panel=process.env.QA_BROWSER_PANEL_MODULE?(await import(pathToFileURL(resolve(process.env.QA_BROWSER_PANEL_MODULE)).href)).default:readFileSync(join(root,'plugin/dist/panel.html'),'utf8');
 const work=mkdtempSync(join(tmpdir(),'qa-stagehand-')),host=await startHost(panel,root);
 let browser,stagehand,watcher,profileError;const exceptions=[];
 try{
  browser=await localBrowser.launch({headless:true,executablePath:executable,userDataDir:join(work,'profile'),preserveUserDataDir:false,viewport:{width:430,height:932},args:['--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run','--no-default-browser-check','--disk-cache-size=1','--media-cache-size=1','--disable-features=OptimizationGuideModelDownloading,OptimizationGuideOnDeviceModel,OptimizationHints,OptimizationHintsFetching,OptimizationTargetPrediction,MediaRouter']});
  watcher=setInterval(()=>{if(bytes(work)>40_000_000){profileError=new Error('Disposable profile exceeded 40 MB');clearInterval(watcher);}},200);
  stagehand=await Stagehand.create({browser});
  const page=await browser.context.newPage();await page.on('console',event=>{if(event.params.type==='error')exceptions.push(event);});
  await page.goto(host.origin);await until(page,'window.proof?.initialized===true');
  let state=await page.evaluate(panelState);expect(state.hidden).toBe(true);expect(state.empty).toBe(false);expect(state.modes).toEqual([]);
  await page.evaluate('window.showQuestion()');await until(page,"document.querySelector('iframe').contentDocument.querySelectorAll('.option').length===2");
  state=await page.evaluate(panelState);expect(state.inputs).toBe(0);expect(state.details).toBe(false);expect(state.messages).toEqual([]);expect(state.modes).toEqual([]);
  await page.evaluate(click('expand'));await until(page,"document.querySelector('iframe').contentDocument.getElementById('expand').textContent==='小さく表示'");
  await page.evaluate(click('expand'));await until(page,"document.querySelector('iframe').contentDocument.getElementById('expand').textContent==='広げる'");
  state=await page.evaluate(panelState);expect(state.modes).toEqual(['fullscreen','inline']);expect(state.messages).toEqual([]);
  for(const [button,mode]of [['compact','compact'],['full','full']]){
   await page.evaluate(click(button));await until(page,`window.proof.messages.length===${mode==='compact'?1:2}`);await until(page,"document.querySelector('iframe').contentDocument.getElementById('compact').disabled===false");
   state=await page.evaluate(panelState);expect(state.explanation).toBe('Browser fixture explanation');expect(state.messages.at(-1).mode).toBe(mode);expect(state.messages.at(-1).executionApproval).toBe(false);
  }
  await page.evaluate(click('dismiss'));state=await page.evaluate(panelState);expect(state.hidden).toBe(true);expect(state.messages.length).toBe(2);
  await page.evaluate('window.showQuestion(1)');state=await page.evaluate(panelState);expect(state.hidden).toBe(true);
  await page.evaluate('window.showQuestion(2)');await until(page,"document.querySelector('iframe').contentDocument.getElementById('question-view').hidden===false");
  await page.goto(host.origin+'/?unsupported=1');await until(page,'window.proof?.initialized===true');await page.evaluate('window.showQuestion()');await until(page,"document.querySelector('iframe').contentDocument.querySelectorAll('.option').length===2");
  state=await page.evaluate(panelState);expect(state.compactDisabled).toBe(true);expect(state.messages).toEqual([]);expect(state.text).toContain('チャットで依頼');expect(state.inputs).toBe(0);
  expect(exceptions).toEqual([]);if(profileError)throw profileError;
 }catch(error){console.error('Browser assertion:',error);throw error;}finally{if(watcher)clearInterval(watcher);try{await stagehand?.close();await browser?.close();}finally{await host.close();rmSync(work,{recursive:true,force:true});}}
},30_000);
