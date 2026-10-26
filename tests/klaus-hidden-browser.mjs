// Real Edge / authoritative server regression for short hide/show reaction replay.
// Build first; run: node --disable-warning=ExperimentalWarning tests/klaus-hidden-browser.mjs
// CASE=during|hidden narrows a case; PROOF=red|green names ignored proof artifacts.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from '../scripts/cdp.mjs';
import { loadBank } from '../server/bank/index.ts';

const bank = loadBank();
function answerFor(publicQ) {
  const q = bank.get(publicQ.id);
  switch (q.type) {
    case 'mc': return { choice: publicQ.options.indexOf(q.options[q.answer]) };
    case 'write': case 'build': return { text: q.accept[0] };
    case 'gap': return { gaps: q.gaps.map((g) => g[0]) };
    case 'order': {
      const used = new Set();
      return { order: q.tokens.map((token) => { const i = publicQ.tokens.findIndex((v, i) => v === token && !used.has(i)); used.add(i); return i; }) };
    }
    case 'error': return { index: q.wrong, fix: q.fix[0] };
    case 'match': return { pairs: q.pairs.map((pair) => publicQ.right.indexOf(pair[1])) };
  }
}
const L = await launch({ shots: 'shots/klaus-hidden' });
const results = [];
const phase = `globalThis.__bcNet?.state.view?.phase`;
const stage = `document.querySelector('[data-klaus-panel]')?.dataset.klausState`;
async function activate(B, selector) {
  if (selector.startsWith('[data-klaus-control=') && !await B.eval(`document.querySelector('[data-klaus-preferences]').open`)) {
    await B.click('[data-klaus-preferences] > summary');
  }
  await B.eval(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true}); true`);
  await L.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' }, B.sid);
  await L.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, B.sid);
  await sleep(100);
}
async function answer(B) {
  const v = await B.state();
  const a = answerFor(v.q);
  assert.equal((await B.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:${JSON.stringify(a)}})`)).ok, true);
  await B.until(`${phase} === 'reveal'`, 'real server result');
}
async function next(B) {
  await activate(B, '.qpanel .btn.primary.lg');
  await B.until(`${phase} === 'question'`, 'next real question');
}
try {
  for (const mode of ['during', 'hidden'].filter((mode) => !process.env.CASE || process.env.CASE === mode)) {
    const result = { mode, proof: process.env.PROOF ?? 'run' };
    results.push(result);
    try {
      const B = await L.newPage(`Klaus hide ${mode}`, 1366, 900);
      await L.send('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.__toneCount=0; const NativeAudio=globalThis.AudioContext; globalThis.AudioContext=class extends NativeAudio { createOscillator(){ globalThis.__toneCount++; return super.createOscillator(); } };` }, B.sid);
      await B.go('/practica?temas=dativ');
      await B.until(`!!document.querySelector('form.home input.field')`, 'practice setup');
      await B.type('form.home input.field', `HiddenQA-${mode}`);
      await activate(B, 'form.home .btn.primary.lg');
      await B.until(`${phase} === 'question'`, 'real practice');
      await activate(B, '[data-klaus-control="mute"]');
      await B.until(`document.querySelector('[data-klaus-panel]').dataset.klausMuted === 'false'`, 'sound opt-in');
      if (mode === 'hidden') await activate(B, '[data-klaus-control="hide"]');
      await answer(B);
      if (mode === 'during') await B.until(`${stage} === 'correct'`, 'visible new celebration');
      else await B.until(`${stage} === 'hidden'`, 'result remains hidden');
      const before = await B.eval(`({id:document.querySelector('[data-klaus-panel]').dataset.klausEvent, tones:globalThis.__toneCount, at:performance.now()})`);
      if (mode === 'during') await activate(B, '[data-klaus-control="hide"]');
      assert.equal(await B.eval(`!!document.querySelector('[data-klaus-figure]')`), false);
      await activate(B, '[data-klaus-control="hide"]');
      const after = await B.eval(`({state:${stage}, id:document.querySelector('[data-klaus-panel]').dataset.klausEvent, tones:globalThis.__toneCount, elapsed:performance.now()-${before.at}, reaction:document.querySelector('[data-klaus-figure]')?.dataset.klausReaction, burst:!!document.querySelector('[data-klaus-burst]'), animation:getComputedStyle(document.querySelector('.klaus-rig')).animationName, animationTime:document.querySelector('.klaus-rig').getAnimations()[0]?.currentTime, comment:document.querySelector('[data-klaus-comment]').textContent, live:document.querySelector('[data-klaus-comment]').getAttribute('aria-live'), streak:document.querySelector('[data-klaus-streak]')?.dataset.klausStreak, signature:!!document.querySelector('[data-klaus-signature]')})`);
      result.before = before; result.after = after;
      await B.shot(`${result.proof}-${mode}-show`);
      assert.ok(after.elapsed < 5200, 'show must occur inside the original reaction lifetime');
      assert.equal(after.tones, before.tones, 'show must never replay audio');
      assert.equal(after.state, 'idle', `show after ${mode} must consume the old visual event`);
      assert.equal(after.reaction, 'idle');
      assert.equal(after.burst, false);
      assert.equal(after.live, 'off');
      assert.equal(after.streak, '1', 'resting display keeps the real server streak');
      assert.equal(after.signature, true, 'canonical Klaus signature remains present');
      assert.ok(after.comment.length > 0, 'resting comment is retained');
      const v = await B.state();
      assert.equal(v.reveal.results[v.me.id].status, 'correct');
      assert.equal(v.players.find((p) => p.id === v.me.id).streak, 1);
      await B.eval(`for(let i=0;i<3;i++) globalThis.__bcNet.receive({t:'state',s:structuredClone(globalThis.__bcNet.state.view)}); true`);
      await sleep(150);
      assert.equal(await B.eval(stage), 'idle', 'polls cannot restore the consumed visual event');
      await next(B);
      await answer(B);
      await B.until(`${stage} === 'correct'`, 'subsequent real result celebrates');
      assert.equal(await B.eval(`!!document.querySelector('[data-klaus-burst]') && document.querySelector('[data-klaus-streak]').dataset.klausStreak === '2'`), true);
      assert.ok(await B.eval(`globalThis.__toneCount > ${after.tones}`), 'subsequent event still chimes');
      await B.shot(`${result.proof}-${mode}-new-event`);
      result.newEvent = await B.eval(`({state:${stage},id:document.querySelector('[data-klaus-panel]').dataset.klausEvent,tones:globalThis.__toneCount})`);
      assert.notEqual(result.newEvent.id, before.id, 'subsequent result has distinct authoritative identity');
      assert.deepEqual(B.errors(), []);
      result.passed = true;
      console.log(`PASS ${mode}: show idle without audio replay; next real event celebrates`);
    } catch (error) {
      result.passed = false; result.error = error.message;
      console.error(`FAIL ${mode}: ${error.message}`);
    }
  }
} finally {
  writeFileSync(join(L.shots, `${process.env.PROOF ?? 'run'}-results.json`), JSON.stringify(results, null, 2));
  await L.close();
}
assert.ok(results.length > 0 && results.every((r) => r.passed), 'hidden reaction browser regression');
