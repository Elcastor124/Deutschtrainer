// Real Edge/CDP regression: npm run build && node scripts/intro-v2-ui.mjs
import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';

const env = await launch({ shots: 'shots/intro-v2' });
const report = { frames: [], overflow: [] };
try {
  const p = await env.newPage('intro-v2', 1366, 768);
  await env.send('Page.bringToFront', {}, p.sid);
  await p.go('/?intro=still');
  await p.until(`!!document.querySelector('[data-testid="intro"]')`, 'intro mounted');
  assert.equal(await p.eval(`document.activeElement?.classList.contains('dt-intro-skip')`), true, 'skip must receive focus immediately');
  await p.key('Tab');
  assert.equal(await p.eval(`document.activeElement?.classList.contains('dt-intro-skip')`), true, 'Tab must not reach hidden page');
  await p.key('a');
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), true, 'unrelated keys must not dismiss');
  await p.key('Escape');
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'Escape bypasses the cinematic exit rather than delaying the page');
  assert.equal(await p.eval(`document.activeElement?.id`), 'contenido', 'initial visit returns focus to content');
  assert.equal(await p.eval(`document.documentElement.classList.contains('dt-intro-lock')`), false);
  report.focusAndEscape = true;
  await p.go('/');
  await p.until(`!!document.querySelector('.dt-nav-brand')`, 'repeat visit loaded');
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'one intro per tab');
  report.oncePerTab = true;

  await p.go('/?intro=still');
  await p.until(`!!document.querySelector('[data-intro]')`, 'motion preference change setup');
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, p.sid);
  await p.until(`!document.querySelector('[data-intro]')`, 'motion preference must dismiss a playing intro immediately', 500);
  await p.go('/?intro=still');
  await p.until(`!!document.querySelector('.dt-nav-brand')`, 'reduced motion page ready');
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'forced URLs respect reduced motion');
  report.liveReducedMotion = true;
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, p.sid);
  await p.go('/?intro=0');
  await p.until(`!!document.querySelector('.dt-nav-brand')`, 'page ready for replay');
  await p.eval(`document.querySelector('.dt-nav-brand').focus(); window.dispatchEvent(new Event('dt:intro:replay'))`);
  await p.until(`document.activeElement?.classList.contains('dt-intro-skip')`, 'explicit replay ready', 1500);
  await p.key('Escape');
  await p.until(`!document.querySelector('[data-intro]')`, 'replay dismissed', 1500);
  assert.equal(await p.eval(`document.activeElement?.classList.contains('dt-nav-brand')`), true, 'replay restores its initiating control');
  report.replay = true;

  await p.go('/?intro=still');
  await p.until(`!!document.querySelector('[data-intro]')`, 'pointer skip setup');
  await p.eval(`window.__skipMs=null; addEventListener('pointerdown',()=>{const t=performance.now();const mo=new MutationObserver(()=>{if(!document.querySelector('[data-intro]')){window.__skipMs=performance.now()-t;mo.disconnect()}});mo.observe(document.body,{childList:true,subtree:true})},{once:true,capture:true})`);
  await p.click('[data-intro-skip]');
  await p.until(`window.__skipMs!==null`, 'pointer skip completed');
  report.pointerSkipMs = Math.round(await p.eval(`window.__skipMs`));
  assert(report.pointerSkipMs < 900, 'skip must not wait for the story');

  await p.go('/?intro=1');
  await p.until(`!!document.querySelector('[data-intro]')`, 'natural intro setup');
  await p.eval(`window.__introMs=null;const t=performance.now();const mo=new MutationObserver(()=>{if(!document.querySelector('[data-intro]')){window.__introMs=performance.now()-t;mo.disconnect()}});mo.observe(document.body,{childList:true,subtree:true})`);
  await p.until(`window.__introMs!==null`, 'natural intro completes', 8500);
  report.autoMs = Math.round(await p.eval(`window.__introMs`));
  assert(report.autoMs >= 5000 && report.autoMs <= 7200, 'cinematic intro must take five to seven seconds');
  assert.equal(await p.eval(`document.documentElement.classList.contains('dt-intro-lock')`), false);

  for (const [w, h] of [[320, 640], [390, 844], [768, 1024], [1366, 768]]) {
    await env.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 }, p.sid);
    await p.go('/?intro=still');
    await p.until(`!!document.querySelector('[data-intro]') && document.fonts.status==='loaded'`, 'visual capture ready');
    for (const ms of w === 1366 ? [900, 1900, 3000, 4700] : [4700]) {
      await p.eval(`document.querySelector('[data-intro]').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=${ms}})`);
      await sleep(80);
      const overflow = await p.eval(`(()=>{const r=document.querySelector('.dt-intro-word-window').getBoundingClientRect();const b=document.querySelector('[data-intro-skip]').getBoundingClientRect();return document.documentElement.scrollWidth>innerWidth || r.left<0 || r.right>innerWidth || b.left<0 || b.right>innerWidth || b.bottom>innerHeight})()`);
      if (overflow) report.overflow.push({ w, ms });
      const frame = `intro-${w}-${ms}`;
      await p.shot(frame);
      report.frames.push(frame);
    }
  }
  assert.deepEqual(report.overflow, []);
  assert.deepEqual(p.errors(), []);
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} finally { await env.close(); }
