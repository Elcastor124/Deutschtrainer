// Real browser regression. Test-only bank access stays in Node, never in the page bundle.
// Run after npm run build: node --disable-warning=ExperimentalWarning tests/klaus-browser.mjs
import assert from 'node:assert/strict';
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
      return { order: q.tokens.map((token) => { const index = publicQ.tokens.findIndex((value, index) => value === token && !used.has(index)); used.add(index); return index; }) };
    }
    case 'error': return { index: q.wrong, fix: q.fix[0] };
    case 'match': return { pairs: q.pairs.map((pair) => publicQ.right.indexOf(pair[1])) };
  }
}

const L = await launch({ shots: 'shots/klaus-ui', ...(process.env.BASE ? { base: process.env.BASE } : {}) });
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`  PASS ${label}`); };
const phase = `globalThis.__bcNet?.state.view?.phase`;
const stage = `document.querySelector('[data-klaus-panel]')?.dataset.klausState`;
async function next(B) {
  // Exercise the app's documented Enter shortcut. Its smooth-scroll transition can
  // move a pointer target between CDP mouseDown/up when answering faster than a human.
  await B.eval(`document.querySelector('.qpanel .btn.primary.lg').focus({preventScroll:true}); true`);
  await L.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' }, B.sid);
  await L.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, B.sid);
  await B.until(`${phase} !== 'reveal'`, 'next question/final');
}
async function answer(B, good = true) {
  const v = await B.state();
  const a = good ? answerFor(v.q) : { choice: 999, text: 'qqq zzz', gaps: ['qqq','qqq','qqq','qqq'], order: [], index: 999, fix: 'qqq', pairs: [999,999,999,999] };
  const result = await B.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:${JSON.stringify(a)}})`);
  assert.equal(result.ok, true);
  await B.until(`${phase} === 'reveal'`, 'server result');
}
try {
  const B = await L.newPage('Klaus real practice', 1366, 900);
  await B.go('/practica?temas=dativ');
  await B.until(`!!document.querySelector('form .btn.primary.lg')`, 'practice form');
  check(await B.eval(`${stage} === 'waving' && !!document.querySelector('[data-klaus-paw]')`), 'setup shows original Klaus with four-bean paw');
  await B.type('form input.field', 'KlausQA');
  await B.click('form .btn.primary.lg');
  await B.until(`${phase} === 'question'`, 'real practice');
  check(await B.eval(`${stage} === 'thinking'`), 'actual question puts Klaus in thinking mode');
  for (let n = 1; n <= 10; n++) {
    await answer(B);
    const kind = n === 3 ? 'streak3' : n === 5 ? 'streak5' : n === 10 ? 'streak10' : 'correct';
    await B.until(`${stage} === '${kind}'`, `real ${kind}`);
    check(await B.eval(`document.querySelector('[data-klaus-streak]')?.dataset.klausStreak === '${n}'`), `real result ${n} reflects authoritative streak`);
    if ([3, 5, 10].includes(n)) { await B.eval(`scrollTo(0,0)`); await B.shot(`streak-${n}`); }
    if (n === 1) {
      await B.eval(`globalThis.__klausFigure = document.querySelector('[data-klaus-figure]'); for(let i=0;i<5;i++) globalThis.__bcNet.receive({t:'state',s:structuredClone(globalThis.__bcNet.state.view)}); true`);
      check(await B.eval(`globalThis.__klausFigure === document.querySelector('[data-klaus-figure]')`), 'identical network snapshots never remount reaction animation');
      await sleep(5400);
      await B.eval(`globalThis.__bcNet.receive({t:'state',s:structuredClone(globalThis.__bcNet.state.view)}); true`);
      check(await B.eval(`${stage} === 'idle'`), 'celebration settles and stays idle through another network snapshot');
    }
    if (n === 3) {
      await B.reload();
      await B.until(`${phase} === 'reveal'`, 'resume reveal');
      check(await B.eval(`${stage} === 'idle'`), 'reloading a result does not replay its milestone');
      await B.click('[data-klaus-preferences] > summary');
      await B.eval(`const NativeAudio=globalThis.AudioContext; globalThis.AudioContext=class extends NativeAudio { constructor(...args){super(...args);globalThis.__klausAudio=this;} }; document.querySelector('[data-klaus-control="mute"]').focus(); true`);
      await L.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' }, B.sid);
      await L.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, B.sid);
      await B.until(`document.querySelector('[data-klaus-panel]').dataset.klausMuted === 'false'`, 'keyboard toggles sound');
      check(await B.eval(`${phase} === 'reveal'`), 'Enter on Klaus controls does not advance the question');
      check(await B.eval(`document.querySelector('[data-klaus-panel]').dataset.klausMuted === 'false' && globalThis.__klausAudio?.state === 'running'`), 'sound enables only after an explicit user gesture');
      await B.click('[data-klaus-control="hide"]');
      await B.until(`${stage} === 'hidden'`, 'hide');
      await B.reload();
      await B.until(`${phase} === 'reveal' && ${stage} === 'hidden'`, 'hidden state restored');
      check(await B.eval(`!document.querySelector('[data-klaus-figure]')`), 'hide preference survives reload and removes artwork/comments');
      check(await B.eval(`document.querySelector('[data-klaus-panel]').dataset.klausMuted === 'false'`), 'sound preference survives reload');
      await B.click('[data-klaus-preferences] > summary');
      await B.eval(`const NativeAudio=globalThis.AudioContext; globalThis.AudioContext=class extends NativeAudio { constructor(...args){super(...args);globalThis.__klausAudio=this;} }; true`);
      await B.click('[data-klaus-control="hide"]');
      check(await B.eval(`${stage} === 'idle'`), 'showing Klaus never replays the old result');
      check(await B.eval(`globalThis.__klausAudio?.state === 'running'`), 'explicit show gesture resumes opted-in sound without replaying the old reaction');
      await B.click('[data-klaus-control="motion"]');
      check(await B.eval(`getComputedStyle(document.querySelector('.klaus-rig')).animationName === 'none'`), 'persisted reduced motion stops rig animation');
      await B.reload();
      await B.until(`${phase} === 'reveal'`, 'reduced-motion resume');
      check(await B.eval(`document.querySelector('[data-klaus-panel]').dataset.klausReduced === 'true'`), 'motion preference survives reload');
      await B.eval(`const NativeAudio=globalThis.AudioContext; globalThis.AudioContext=class extends NativeAudio { constructor(...args){super(...args);globalThis.__klausAudio=this;} }; true`);
      check(await B.eval(`!globalThis.__klausAudio`), 'persisted opt-in does not autoplay audio during page restoration');
      await B.click('[data-klaus-preferences] > summary');
      await B.click('[data-klaus-control="motion"]');
      check(await B.eval(`globalThis.__klausAudio?.state === 'running'`), 'persisted sound opt-in unlocks again on the next genuine interaction');
    }
    await next(B);
  }
  await answer(B, false);
  await B.until(`${stage} === 'support'`, 'supportive error reaction');
  check(await B.eval(`!document.querySelector('[data-klaus-streak]') && /Kein Problem|Seguimos|Noch einmal|Alles gut|Respira|practicar|tropiezo|Probamos/.test(document.querySelector('[data-klaus-comment]').textContent)`), 'wrong answer resets only real streak and offers support, never ridicule');
  await B.eval(`scrollTo(0,0)`); await B.shot('support');
  for (let guard = 0; guard < 30; guard++) {
    await next(B);
    if ((await B.state()).phase === 'final') break;
    await answer(B);
  }
  await B.until(`${stage} === 'complete'`, 'real session end');
  check((await B.state()).phase === 'final', 'session-end reaction is driven by actual final phase');
  await B.shot('complete');
  await L.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, B.sid);
  await B.until(`document.querySelector('[data-klaus-panel]').dataset.klausReduced === 'true'`, 'OS reduced motion');
  check(await B.eval(`document.querySelector('[data-klaus-control="motion"]').disabled && getComputedStyle(document.querySelector('.klaus-rig')).animationName === 'none'`), 'OS reduced motion wins and disables opt-out');
  check(B.errors().length === 0, `desktop JS errors: ${B.errors().length}`);
  for (const width of [320, 390]) {
    const M = await L.newPage(`mobile ${width}`, width, 844, true);
    await M.go('/practica?temas=dativ');
    await M.until(`!!document.querySelector('form input.field')`, 'mobile setup');
    check(await M.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), `${width}px setup has no horizontal overflow`);
    await M.type('form input.field', 'MobileQA');
    await M.click('form .btn.primary.lg');
    await M.until(`${phase} === 'question'`, 'mobile practice');
    check(await M.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), `${width}px active practice has no horizontal overflow`);
    check(await M.eval(`getComputedStyle(document.querySelector('[data-klaus-panel]')).position === 'static'`), `${width}px companion stays in normal flow, not above answer controls`);
    await M.shot(`mobile-${width}`);
    check(M.errors().length === 0, `${width}px JS errors: ${M.errors().length}`);
  }
  console.log(`Klaus browser QA: ${checks} assertions passed`);
} finally { await L.close(); }
