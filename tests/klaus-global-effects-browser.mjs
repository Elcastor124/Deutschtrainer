// Real Edge regression: the global effects switch consumes Klaus events rather than replaying them.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBank } from '../server/bank/index.ts';
import { launch, sleep } from '../scripts/cdp.mjs';
const bank = loadBank();
function answerFor(publicQ) {
  const q = bank.get(publicQ.id);
  switch (q.type) {
    case 'mc': return {choice:publicQ.options.indexOf(q.options[q.answer])};
    case 'write': case 'build': return {text:q.accept[0]};
    case 'gap': return {gaps:q.gaps.map(g=>g[0])};
    case 'error': return {index:q.wrong,fix:q.fix[0]};
    case 'match': return {pairs:q.pairs.map(pair=>publicQ.right.indexOf(pair[1]))};
    case 'order': { const used=new Set();return {order:q.tokens.map(t=>{const i=publicQ.tokens.findIndex((x,i)=>x===t&&!used.has(i));used.add(i);return i;})}; }
  }
}
const browser=await launch({shots:'shots/klaus-global-effects'}); const results=[];
async function activate(page,selector){
  await page.eval(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true});true`);
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'},page.sid);
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13},page.sid);
  await sleep(90);
}
async function answer(page){const v=await page.state();const a=answerFor(v.q);assert.equal((await page.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:${JSON.stringify(a)}})`)).ok,true);await page.until('globalThis.__bcNet?.state.view?.phase==="reveal"','server result');}
try {
  for(const mode of ['during','paused']){
    const page=await browser.newPage(mode,1366,900);
    await page.go('/practica?temas=dativ');await page.until('!!document.querySelector("form.home input.field")','setup');
    await page.type('form.home input.field',`Global-${mode}`);await activate(page,'form.home .btn.primary.lg');
    await page.until('globalThis.__bcNet?.state.view?.phase==="question"','practice');
    if(mode==='paused')await activate(page,'[data-effects-toggle]');
    await answer(page);
    if(mode==='during')await page.until('document.querySelector("[data-klaus-panel]")?.dataset.klausState==="correct"','celebration');
    if(mode==='during')await activate(page,'[data-effects-toggle]');
    assert.equal((await page.state()).phase, 'reveal', 'Enter on a nav control must not advance the question');
    await page.until('document.documentElement.dataset.dtEffects==="off"','effects off');
    await activate(page,'[data-effects-toggle]');
    await page.until('document.documentElement.dataset.dtEffects==="on"','effects on');
    const actual=await page.eval('({state:document.querySelector("[data-klaus-panel]").dataset.klausState, burst:!!document.querySelector("[data-klaus-burst]"),progress:document.querySelector("[data-practice-progress]").dataset.done})');
    results.push({mode,actual});await page.shot(`${process.env.PROOF??'run'}-${mode}`);
    assert.equal(actual.state,'idle',`${mode}: enabling effects must not replay Klaus celebration`);
    assert.equal(actual.burst,false);assert.equal(actual.progress,'1');
    await activate(page,'.qpanel .btn.primary.lg');await page.until('globalThis.__bcNet.state.view.phase==="question"','next');await answer(page);
    await page.until('document.querySelector("[data-klaus-panel]")?.dataset.klausState==="correct"','new result celebrates');
    assert.deepEqual(page.errors(),[]);results.at(-1).passed=true;
  }
}finally{writeFileSync(join(browser.shots,`${process.env.PROOF??'run'}-results.json`),JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify({passed:true,results}));
