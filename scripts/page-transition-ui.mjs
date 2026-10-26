// Real isolated Edge/CDP navigation QA. npm run build && node scripts/page-transition-ui.mjs
import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';
const env = await launch({ shots: 'shots/page-transitions' });
const results = [];
const route = (path) => `history.pushState(null, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate'))`;
const running = `document.querySelector('[data-page-transition]').getAnimations().filter(a => a.playState === 'running').length`;
const count = `window.__entrances.length`;
async function instrument(p) {
  await p.eval(`window.__identity = crypto.randomUUID(); window.__surface = document.querySelector('#contenido'); window.__entrances = [];
    window.__animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, opts) {
      if (this.matches('[data-page-transition]')) window.__entrances.push({path:location.pathname, frames, opts});
      return window.__animate.call(this, frames, opts);
    };`);
}
async function healthy(p, label) {
  assert.equal(await p.eval(`document.querySelectorAll('#contenido').length`), 1, `${label}: no duplicate exit DOM`);
  assert.equal(await p.eval(`document.querySelector('#contenido') === window.__surface`), true, `${label}: stable surface`);
  assert.equal(await p.eval(`document.querySelector('#contenido').innerText.length > 30`), true, `${label}: never blank`);
  assert.equal(await p.eval(`document.querySelectorAll('[inert]').length`), 0, `${label}: not inert`);
  assert.equal(await p.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${label}: no horizontal overflow`);
  assert.deepEqual(p.errors(), [], label);
}
try {
  const p = await env.newPage('navigation', 1366, 850);
  await p.go('/?intro=0');
  await p.until(`!!document.querySelector('.dt-nav-brand')`, 'home');
  await instrument(p);
  const identity = await p.eval('window.__identity');
  await p.click('.dt-nav-links a[href="/curso"]');
  assert.equal(await p.eval(`!!document.querySelector('[data-page-transition]')`), true, 'route changes have a transition surface');
  assert.equal(await p.eval(`document.querySelector('#contenido').dataset.pageRoute`), '/curso');
  assert.equal(await p.eval(count), 1, 'real link starts exactly one page entrance');
  assert.equal(await p.eval(running), 1, 'entrance is really animating');
  assert.equal(await p.eval(`document.querySelector('[data-page-accent]').getAnimations().length`), 1, 'brand sweep animates');
  await p.until(`document.activeElement.id === 'contenido'`, 'destination receives keyboard focus');
  assert.equal(await p.hitTest('.dt-nav-links a[href="/practica"]'), 'ok', 'navigation stays clickable during entrance');
  await p.shot('course-enter');
  await healthy(p, 'course entrance');
  // Hit the next route before the previous accent finishes: no delayed navigation queue.
  await p.click('.dt-nav-links a[href="/practica"]');
  await p.until(`!!document.querySelector('form.home')`, 'practice setup');
  await sleep(500);
  await p.until(`${running} === 0`, 'entrance settles');
  await p.eval('history.back()');
  await p.until(`location.pathname === '/curso'`, 'browser Back');
  assert.equal(await p.eval(`document.querySelector('#contenido').dataset.pageDirection`), 'back');
  await p.shot('browser-back');
  await healthy(p, 'browser Back');
  await p.eval('history.forward()');
  await p.until(`location.pathname === '/practica'`, 'browser Forward');
  assert.equal(await p.eval(`document.querySelector('#contenido').dataset.pageDirection`), 'forward');
  await sleep(500);
  // Query updates and answer snapshots must not remount practice or replay route motion.
  await p.type('form.home input.field', 'Navigation QA');
  await p.eval(`window.__input = document.querySelector('form.home input.field'); window.__input.focus()`);
  const beforeQuery = await p.eval(count);
  await p.eval(route('/practica?temas=dativ&qa=query'));
  await sleep(100);
  assert.equal(await p.eval(count), beforeQuery, 'query-only update does not animate');
  assert.equal(await p.eval(`document.querySelector('form.home input.field') === window.__input && window.__input.value === 'Navigation QA' && document.activeElement === window.__input`), true, 'query preserves field DOM, value and focus');
  await p.click('form.home .btn.primary.lg');
  await p.until(`globalThis.__bcNet?.state?.view?.phase === 'question'`, 'real practice question', 12000);
  await p.eval(`window.__net = globalThis.__bcNet`);
  const beforeAnswer = await p.eval(count);
  await p.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:{choice:0,text:'x',gaps:['x','x','x','x'],order:[],index:0,fix:'x',pairs:[0,0,0,0]}})`);
  await p.until(`globalThis.__bcNet.state.view.phase === 'reveal'`, 'real answer reveal');
  await p.eval(route('/practica?qa=live-snapshot'));
  await sleep(700);
  assert.equal(await p.eval(`window.__net === globalThis.__bcNet`), true, 'query/snapshots retain actual game connection');
  assert.equal(await p.eval(count), beforeAnswer, 'answer/reveal/query snapshots never animate page');
  await healthy(p, 'real practice reveal');
  await p.shot('practice-no-replay');
  results.push('clicks, Back/Forward, live practice snapshots and queries');

  // Change the OS preference while motion is running, not just before initial load.
  await p.click('.dt-nav-links a[href="/curso"]');
  assert.equal(await p.eval(running), 1);
  await env.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]}, p.sid);
  await p.until(`${running} === 0`, 'live motion preference cancels entrance');
  assert.equal(await p.eval(`getComputedStyle(document.querySelector('[data-page-accent]').parentElement).display`), 'none');
  const beforeReduced = await p.eval(count);
  await p.click('.dt-nav-links a[href="/road-to-b1"]');
  assert.equal(await p.eval(count), beforeReduced, 'reduced motion navigation has no entrance');
  await healthy(p, 'reduced assessment');
  await p.shot('reduced-motion');
  await env.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]}, p.sid);
  await p.click('.dt-nav-links a[href="/curso"]');
  assert.equal(await p.eval(count), beforeReduced + 1, 'motion can be re-enabled live');
  // Freeze the real animation at a representative frame for a deterministic proof image.
  await p.eval(`for (const e of document.querySelectorAll('[data-page-transition],[data-page-accent]')) for (const a of e.getAnimations()) { a.pause(); a.currentTime = 140; }`);
  await p.shot('accent-sweep-frame');
  await p.eval(`for (const e of document.querySelectorAll('[data-page-transition],[data-page-accent]')) for (const a of e.getAnimations()) a.play()`);
  results.push('live reduced motion cancellation and re-enable');

  // Same-page hash scrolling must retain DOM/focus and never create another entrance.
  await p.click('.dt-nav-brand');
  await sleep(500);
  const beforeHash = await p.eval(count);
  await p.click('.dt-nav-links a[href="/#juegos"]');
  await sleep(900);
  assert.equal(await p.eval(count), beforeHash, 'same-page anchor does not animate');
  assert.equal(await p.eval(`document.querySelector('#juegos').getBoundingClientRect().top < innerHeight && document.querySelector('#juegos').getBoundingClientRect().bottom > 0`), true, 'games hash reaches section');
  // Rapid real pointer clicks without waiting for the entrance; bring the sticky nav into view after the anchor.
  await p.eval(`window.scrollTo({top:0,behavior:'instant'})`);
  await p.until(`document.querySelector('.dt-nav-links a').getBoundingClientRect().top >= 0`, 'navigation visible after hash');
  for (const href of ['/curso','/practica','/curso','/road-to-b1','/curso']) {
    const q = await p.eval(`(() => {const r=document.querySelector('.dt-nav-links a[href="${href}"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for (const type of ['mousePressed','mouseReleased']) await env.send('Input.dispatchMouseEvent', {type,...q,button:'left',clickCount:1}, p.sid);
    await sleep(25);
  }
  await p.until(`location.pathname === '/curso'`, 'rapid navigation final destination');
  await sleep(550);
  await healthy(p, 'rapid pointer navigation');
  await p.until(`${running} === 0`, 'rapid navigation motion settles');
  assert.equal(await p.eval('window.__identity'), identity, 'all navigation remains in same document');
  await p.shot('rapid-settled');
  results.push('hash anchor, rapid real pointer navigation, no duplicates/blank/overflow');

  await p.click('.dt-nav-brand');
  await sleep(500);
  const beforeInvite = await p.eval(count);
  await p.eval(route('/?sala=TEST'));
  await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'search-only invitation must render');
  assert.equal(await p.eval(`document.querySelector('input[aria-label="Código de sala"]').value`), 'TEST');
  assert.equal(await p.eval(count), beforeInvite, 'invitation query does not replay motion');
  await healthy(p, 'search-only invitation');
  await p.shot('invitation');
  results.push('search-only invitation');

  const m = await env.newPage('mobile', 390, 844, true);
  await m.go('/curso?intro=0');
  await m.until(`!!document.querySelector('#contenido')`, 'mobile course');
  await instrument(m);
  await m.click('.dt-nav-toggle');
  await m.click('.dt-nav-links a[href="/practica"]');
  await healthy(m, 'mobile entrance');
  await m.shot('mobile-enter');
  await sleep(500);
  await healthy(m, 'mobile settled');
  // All standalone/classroom route families remain immediately visible and interactive.
  for (const path of ['/boxeo','/jenga','/jugar','/road-to-b1/level-1','/tema/1/taller','/tema/1']) {
    await p.eval(route(path));
    await p.until(`document.querySelector('#contenido').dataset.pageRoute === ${JSON.stringify(path)}`, path);
    await healthy(p, path);
    await sleep(480);
  }
  results.push('mobile menu/touch and boxing/Jenga/game/assessment/workshop/library routes');
  console.log(JSON.stringify({ok:true, results, screenshots:env.shots}, null, 2));
} finally { await env.close(); }
