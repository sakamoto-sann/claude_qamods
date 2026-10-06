import {test,beforeEach,afterEach,vi,expect} from 'vitest';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {validateQuestion} from '../src/question.mjs';
const mocks=vi.hoisted(()=>({instance:null,host:null,send:vi.fn(),display:vi.fn()}));
vi.mock('@modelcontextprotocol/ext-apps',()=>({
 App:class{constructor(){mocks.instance=this;}async connect(){}getHostContext(){return mocks.host;}addEventListener(){}requestDisplayMode(data){return mocks.display(data);}},
 applyDocumentTheme:vi.fn(),applyHostStyleVariables:vi.fn()
}));
vi.mock('@openai/mcp-extensions/app',()=>({OpenAIExtensions:class{constructor(){this.message={send:mocks.send};}}}));
let window;
beforeEach(async()=>{
 vi.resetModules();mocks.host={displayMode:'inline',availableDisplayModes:['inline','fullscreen']};mocks.send.mockReset().mockResolvedValue({});mocks.display.mockReset().mockImplementation(async({mode})=>{mocks.host.displayMode=mode;return {};});
 window=new Window();const html=readFileSync(new URL('../src/panel.html',import.meta.url),'utf8');window.document.body.innerHTML=html.split('<body>')[1].split('<script')[0];vi.stubGlobal('document',window.document);
 await import('../src/app.mjs');
});
afterEach(()=>{vi.unstubAllGlobals();window.close();});
const publish=()=>{const question=validateQuestion(JSON.parse(readFileSync(new URL('./question.json',import.meta.url),'utf8')));mocks.instance.ontoolresult({structuredContent:{kind:'question',question,revision:1}});return question;};
test('opening stays inline; expanding and shrinking require explicit clicks',async()=>{
 expect(mocks.display).not.toHaveBeenCalled();document.getElementById('expand').click();await vi.waitFor(()=>expect(mocks.display).toHaveBeenCalledWith({mode:'fullscreen'}));await vi.waitFor(()=>expect(document.getElementById('expand').textContent).toBe('小さく表示'));
 document.getElementById('expand').click();await vi.waitFor(()=>expect(mocks.display).toHaveBeenLastCalledWith({mode:'inline'}));
});
test('options explain the choice without creating another answer destination',()=>{
 publish();expect(document.querySelectorAll('.option').length).toBe(2);expect(document.querySelector('input,textarea,form')).toBeNull();expect(document.getElementById('reason').textContent).not.toBe('');expect(document.querySelector('details').open).toBe(false);expect(mocks.send).not.toHaveBeenCalled();
});
test('summary sends an explanation request; closing sends no answer',async()=>{
 publish();document.getElementById('compact').click();await vi.waitFor(()=>expect(mocks.send).toHaveBeenCalledTimes(1));expect(mocks.send.mock.calls[0][0].content[0].text).toContain('qa.explain');expect(mocks.send.mock.calls[0][0].content[0].text).not.toContain('qa-answer');
 await vi.waitFor(()=>expect(document.getElementById('dismiss').disabled).toBe(false));document.getElementById('dismiss').click();expect(document.getElementById('question-view').hidden).toBe(true);expect(mocks.send).toHaveBeenCalledTimes(1);
});
test('a host without fullscreen support does not offer expansion',()=>{
 mocks.host.availableDisplayModes=['inline'];publish();expect(document.getElementById('expand').hidden).toBe(true);expect(mocks.display).not.toHaveBeenCalled();
});
