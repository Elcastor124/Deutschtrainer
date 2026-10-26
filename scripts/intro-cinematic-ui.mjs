// Isolated real Edge + Vite source tests. Never builds dist or uses a shared server.
// node scripts/intro-cinematic-ui.mjs [--effects-only]
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { launch, sleep } from './cdp.mjs';

const scratch = process.env.INTRO_CINEMATIC_SCRATCH ?? join(process.env.LOCALAPPDATA, 'hermes', 'cache', 'scratch');
mkdirSync(scratch, { recursive: true });
process.env.TEMP = process.env.TMP = scratch;
const cache = mkdtempSync(join(scratch, 'dt-intro-vite-'));

// Focused component fixture, explicitly not a recording of the landing page.
// Location, focus, storage, timers, CSS and the Intro itself are real browser APIs.
const fixture = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Intro / focused browser QA</title>
<style>body{margin:0;background:#080808;color:#f2f1ee;font-family:system-ui}#contenido{min-height:100vh;padding:100px 7%;box-sizing:border-box}#contenido:focus{outline:none}#contenido h1{font-size:clamp(32px,6vw,76px);max-width:10em}button{min-height:44px}aside{padding:20px}</style></head><body><div id="root"></div><script type="module">
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Intro,IntroReplayButton} from '/src/brand/Intro.tsx';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
history.replaceState(null,'','/'+location.search);
window.__introCinematicDocument=crypto.randomUUID();
function Harness(){
  const [route,setRoute]=useState({path:location.pathname,search:location.search});
  useEffect(()=>{const sync=()=>setRoute({path:location.pathname,search:location.search});addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync)},[]);
  return React.createElement(React.Fragment,null,
    React.createElement(Intro,route),
    React.createElement('main',{id:'contenido',tabIndex:-1},React.createElement('a',{href:'#',className:'dt-nav-brand'},'Deutschtrainer'),React.createElement('h1',null,'Destino de prueba de intro.'),React.createElement('p',null,'Fixture de componente. No es la portada de la aplicación.'),React.createElement(IntroReplayButton)),
    React.createElement('aside',{id:'already-inert',inert:true},'Este elemento debe seguir inert después de la intro.'));
}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`;

const server = await createServer({
  configFile: false,
  cacheDir: cache,
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react(), {
    name: 'intro-cinematic-focused-fixture',
    configureServer(vite) {
      vite.middlewares.use('/api/health', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
      vite.middlewares.use('/__intro-cinematic', async (_req, res, next) => {
        try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/__intro-cinematic', fixture)); }
        catch (error) { next(error); }
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } },
  logLevel: 'error',
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let env;
let page;
const report = { focusedFixture: true, base, assertions: [], frames: [], errors: [] };
function passed(name) { report.assertions.push(name); }
try {
  env = await launch({ shots: 'shots/intro-cinematic', base });
  const p = page = await env.newPage('cinematic', 1366, 768);
  await env.send('Page.bringToFront', {}, p.sid);
  const go = async (search = '?intro=still') => {
    const previous = await p.eval('window.__introCinematicDocument ?? null');
    await p.go(`/__intro-cinematic${search}`);
    // Page.navigate resolves before the previous document is replaced. Never
    // let an old #contenido/intro satisfy the next scenario's readiness check.
    await p.until(`!!window.__introCinematicDocument && window.__introCinematicDocument!==${JSON.stringify(previous)} && !!document.querySelector('#contenido') && document.fonts.status==='loaded'`, 'new fixture document and cold source/font compilation ready', 30000);
  };
  const setEffects = (enabled) => p.eval(`(async()=>{const effects=await import('/src/brand/effects.ts');effects.setEffectsEnabled(${enabled})})()`);
  const trapTimers = () => p.eval(`window.__introTimers=new Set();window.__timeout=window.setTimeout;window.__clearTimeout=window.clearTimeout;
    window.setTimeout=function(fn,ms,...args){const id=window.__timeout(fn,ms,...args);if([800,2000,3200,4600,5740,460].includes(ms))window.__introTimers.add(id);return id};
    window.clearTimeout=function(id){window.__introTimers.delete(id);return window.__clearTimeout(id)};`);
  const replay = async () => {
    await p.eval(`document.querySelector('[data-intro-replay]').focus();window.dispatchEvent(new Event('dt:intro:replay'))`);
    await p.until(`!!document.querySelector('[data-intro]') && document.activeElement?.matches('[data-intro-skip]')`, 'replay focused');
  };
  const clean = async () => {
    assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
    assert.equal(await p.eval(`document.documentElement.classList.contains('dt-intro-lock')`), false);
    assert.equal(await p.eval(`document.querySelector('#contenido').inert`), false);
    assert.equal(await p.eval(`document.querySelector('#already-inert').inert`), true, 'restore pre-existing inert state');
    assert.equal(await p.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',cancelable:true}))`), true, 'keyboard trap removed');
    assert.equal(await p.eval(`window.__introTimers?.size ?? 0`), 0, 'no cinematic timers survive cancellation');
  };

  // RED tracer: the pre-hook intro only reacts to OS reduced-motion, not this toggle.
  await go();
  await p.until(`!!document.querySelector('[data-intro]')`, 'held intro');
  await p.key('Escape');
  await trapTimers();
  await replay();
  assert.equal(await p.eval('window.__introTimers.size'), 4, 'held replay only schedules its four cue timers');
  await setEffects(false);
  await p.until(`!document.querySelector('[data-intro]')`, 'global effects off must cancel the held intro immediately', 500);
  await clean();
  assert.equal(await p.eval(`document.activeElement?.matches('[data-intro-replay]')`), true);
  await p.eval(`window.dispatchEvent(new Event('dt:intro:replay'))`);
  await sleep(120);
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'effects-off replay suppressed');
  passed('live global effects off cancels overlay, timers, trap and inert; restores focus; blocks replay');
  await setEffects(true);
  await sleep(80);
  assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'enabling effects must not auto replay');
  if (!process.argv.includes('--effects-only')) {
    await go();
    await p.until(`!!document.querySelector('[data-intro]')`, 'forced intro');
    assert.equal(await p.eval(`document.activeElement?.matches('[data-intro-skip]')`), true);
    await p.key('Tab');
    assert.equal(await p.eval(`document.activeElement?.matches('[data-intro-skip]')`), true);
    await p.key('a');
    assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), true);
    await p.key('Escape');
    await clean();
    assert.equal(await p.eval(`document.activeElement?.id`), 'contenido');
    passed('initial focus, Tab trap, unrelated key, immediate Escape and initial content focus');
    await go('');
    assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
    passed('once per tab persistence');

    await go();
    await p.until(`!!document.querySelector('[data-intro]')`, 'pointer skip intro');
    const skip = await p.eval(`new Promise(resolve=>{const t=performance.now();const observer=new MutationObserver(()=>{if(!document.querySelector('[data-intro]')){observer.disconnect();resolve(performance.now()-t)}});observer.observe(document.body,{childList:true,subtree:true});document.querySelector('[data-intro-skip]').click()})`);
    assert(skip < 120, 'manual click must not run the 460ms exit');
    report.skipMs = Math.round(skip);
    await clean();
    passed('pointer skip bypasses exit');

    for (const target of ['/practica', '/?sala=TEST&intro=still', '/curso?intro=1']) {
      await go();
      await p.until(`!!document.querySelector('[data-intro]')`, 'navigation setup');
      await p.key('Escape');
      await trapTimers();
      await replay();
      await p.eval(`history.pushState(null,'',${JSON.stringify(target)});dispatchEvent(new PopStateEvent('popstate'))`);
      await p.until(`!document.querySelector('[data-intro]')`, 'navigation cancellation', 500);
      await clean();
      assert.equal(await p.eval(`document.activeElement?.matches('#contenido,[data-intro-replay]')`), true);
      await sleep(100);
      assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
      if (target.includes('sala') || target === '/practica') {
        await p.eval(`window.dispatchEvent(new Event('dt:intro:replay'))`);
        await sleep(120);
        assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
      }
    }
    passed('pathname, search-only invitation and eligible-route changes cancel held replay with complete cleanup');
    await go();
    await p.key('Escape');
    await p.eval(`history.pushState(null,'','/practica');dispatchEvent(new PopStateEvent('popstate'))`);
    await sleep(80);
    await p.eval(`history.pushState(null,'','/?intro=still');dispatchEvent(new PopStateEvent('popstate'))`);
    await sleep(80);
    await trapTimers();
    await replay();
    await p.eval('history.back()');
    await p.until(`location.pathname==='/practica' && !document.querySelector('[data-intro]')`, 'history back cancellation', 700);
    await clean();
    passed('history.back cancels held replay without reload');

    await go();
    await p.until(`!!document.querySelector('[data-intro]')`, 'live reduced setup');
    await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, p.sid);
    await p.until(`!document.querySelector('[data-intro]')`, 'live reduced cancellation', 500);
    await clean();
    await go();
    assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
    await p.eval(`window.dispatchEvent(new Event('dt:intro:replay'))`);
    await sleep(100);
    assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false);
    await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, p.sid);
    passed('live OS reduced-motion cancels and suppresses forced/held/replay motion');

    await go('?intro=0');
    await p.eval(`window.__measuredIntro=null;const start=performance.now();document.querySelector('[data-intro-replay]').focus();window.dispatchEvent(new Event('dt:intro:replay'));const observer=new MutationObserver(()=>{if(!document.querySelector('[data-intro]')){observer.disconnect();window.__measuredIntro=performance.now()-start}});observer.observe(document.body,{childList:true,subtree:true})`);
    await p.until(`document.querySelector('[data-intro]')?.dataset.introPhase==='reveal'`, 'natural final exit', 6400);
    await p.until(`window.__measuredIntro!==null`, 'natural completion', 1200);
    report.autoplayMs = Math.round(await p.eval('window.__measuredIntro'));
    assert(report.autoplayMs >= 6150 && report.autoplayMs <= 6600, '6200ms nominal includes the 460ms exit');
    await clean();
    assert.equal(await p.eval(`document.activeElement?.matches('[data-intro-replay]')`), true);
    passed('6200ms nominal autoplay including final 460ms exit and restored initiator');

    await go();
    await p.until(`!!document.querySelector('[data-intro]')`, 'held duration setup');
    await sleep(6500);
    assert.equal(await p.eval(`document.querySelector('[data-intro]')?.dataset.introPhase`), 'hold', 'still mode must survive beyond the nominal autoplay total');
    passed('held capture stays assembled beyond 6200ms');

    for (const [width, height] of [[320,640],[375,812],[768,1024],[1024,768],[1280,800],[1920,1080]]) {
      await env.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }, p.sid);
      await go();
      await p.until(`!!document.querySelector('[data-intro-convergence]')`, 'visual composition');
      for (const ms of width === 1280 ? [900,1900,3000,4700] : [4700]) {
        await p.eval(`document.querySelector('[data-intro]').getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=${ms}})`);
        await sleep(50);
        assert.equal(await p.eval(`document.documentElement.scrollWidth>innerWidth`), false, `no document overflow at ${width}`);
        assert.equal(await p.eval(`['.dt-intro-word-window','[data-intro-skip]','.dt-intro-v2-tag'].some(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight})`), false, `composition fits ${width}`);
        assert.equal(await p.eval(`document.querySelector('[data-intro]').getAnimations({subtree:true}).some(a=>a.effect.getTiming().iterations===Infinity)`), false, 'no infinitely looping energy or strobe');
        if (ms === 900) {
          assert.equal(await p.eval(`document.querySelectorAll('[data-intro-beam]').length`), 10);
          report.energyAt900 = await p.eval(`[...document.querySelectorAll('[data-intro-beam]')].map(el=>{const s=getComputedStyle(el);return {tone:el.dataset.introBeam,opacity:s.opacity,offset:s.strokeDashoffset,width:s.strokeWidth}})`);
          // Computed SVG lengths include a px unit even when authored unitless.
          assert.equal(await p.eval(`[...document.querySelectorAll('[data-intro-beam]')].some(el=>+getComputedStyle(el).opacity>.1 && parseFloat(getComputedStyle(el).strokeDashoffset)<.16)`), true, 'fine energy is visibly travelling inward');
          assert.equal(await p.eval(`[...document.querySelectorAll('[data-intro-beam]')].every(el=>parseFloat(getComputedStyle(el).strokeWidth)<=1.5)`), true, 'energy stays hairline, not broad flashing beams');
        }
        if (ms === 4700) {
          assert.equal(await p.eval(`[...document.querySelectorAll('[data-intro-beam]')].every(el=>+getComputedStyle(el).opacity===0)`), true, 'energy has settled before readable hold');
          assert.equal(await p.eval(`getComputedStyle(document.querySelector('.dt-intro-word')).transform==='none' || getComputedStyle(document.querySelector('.dt-intro-word')).transform==='matrix(1, 0, 0, 1, 0, 0)'`), true);
        }
        const name = `intro-${width}-${ms}`;
        await p.shot(name);
        report.frames.push(name);
      }
    }
    passed('six-width responsive sweep, actual inward energy, hairline stroke, settled signature and no loops');

    // Source-app smoke is opt-in: sibling changes may be in flight while this
    // self-contained regression is running. This is the real App, not fixture HTML.
    if (process.argv.includes('--app')) {
      const app = await env.newPage('actual-source-app', 1366, 768);
      await env.send('Page.bringToFront', {}, app.sid);
      await app.go('/?intro=still');
      await app.until(`!!document.querySelector('[data-intro-convergence]') && !!document.querySelector('.dt-landing') && document.fonts.status==='loaded'`, 'actual app source and fonts', 15000);
      for (const ms of [900,1900,4700]) {
        await app.eval(`document.querySelector('[data-intro]').getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=${ms}})`);
        await sleep(50);
        const name = `actual-app-${ms}`;
        await app.shot(name);
        report.frames.push(name);
      }
      // Seek the genuine CSS exit midway, while the held JS timeline keeps the
      // screenshot deterministic. Natural JS phase/total was proved above.
      await app.eval(`const root=document.querySelector('[data-intro]');root.classList.add('exit');getComputedStyle(root).clipPath;root.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=animation.animationName==='dt-v2-exit'||animation.animationName==='dt-v2-stage-out'||animation.animationName==='dt-v2-shutter'?230:5740})`);
      await sleep(50);
      report.exitClip = await app.eval(`getComputedStyle(document.querySelector('[data-intro]')).clipPath`);
      assert.equal(await app.eval(`[...document.querySelectorAll('.dt-intro-v2-reveal i')].every(el=>el.getBoundingClientRect().height<=1)`), true, 'exit uses hairline seams, not broad colour shutters');
      await app.shot('actual-app-handoff');
      report.frames.push('actual-app-handoff');
      await app.key('Escape');
      await app.until(`!document.querySelector('[data-intro]') && !!document.querySelector('.dt-landing')`, 'actual app handoff');
      await sleep(1000);
      await app.shot('actual-app-landing');
      report.frames.push('actual-app-landing');
      assert.equal(await app.eval(`document.documentElement.scrollWidth>innerWidth`), false);
      report.appErrors = app.errors();
      assert.deepEqual(report.appErrors, []);
      passed('actual App source smoke: intro, mid-handoff, landing, no overflow or runtime errors');
    }
  }
  report.errors = p.errors();
  assert.deepEqual(report.errors, []);
  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.ok = false;
  report.errors = page?.errors() ?? [];
  if (page) {
    report.document = await page.eval(`({url:location.href,title:document.title,text:document.body.innerText.slice(0,1200),motion:matchMedia('(prefers-reduced-motion: reduce)').matches,phase:document.querySelector('[data-intro]')?.dataset.introPhase,effects:document.documentElement.dataset.dtEffects,scripts:[...document.scripts].map(s=>({src:s.src,inline:s.textContent.slice(0,1800)})),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,duration:r.duration,status:r.responseStatus}))})`).catch(() => null);
    await page.shot('failure').catch(() => {});
  }
  report.failure = error.stack;
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (env) writeFileSync(join(env.shots, 'report.json'), JSON.stringify(report, null, 2));
  await env?.close();
  await server.close();
  rmSync(cache, { recursive: true, force: true });
}
