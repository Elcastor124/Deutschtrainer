// No dist build: starts an ephemeral loopback Vite server and an isolated real Edge fixture.
// node scripts/ambient-ui.mjs  (captures/report: shots/ambient/)
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { launch, sleep } from './cdp.mjs';

const vite = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await vite.listen();
const address = vite.httpServer.address();
const env = await launch({ base: `http://127.0.0.1:${address.port}`, shots: 'shots/ambient' });
const report = {};
const field = `document.querySelector('[data-ambient-status]')`;
const control = '[data-effects-toggle]';
async function setup(page, { reduced = false, off = false, fallback = false } = {}) {
  await env.send('Page.bringToFront', {}, page.sid);
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, page.sid);
  await env.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__ambientQA={draws:0,contexts:0,deletedBuffers:0,deletedPrograms:0,pending:new Set(),pointerListeners:new Set()};
    const qa=window.__ambientQA;
    const add=window.addEventListener.bind(window), remove=window.removeEventListener.bind(window);
    window.addEventListener=(name,fn,...args)=>{if(name==='pointermove')qa.pointerListeners.add(fn);return add(name,fn,...args)};
    window.removeEventListener=(name,fn,...args)=>{if(name==='pointermove')qa.pointerListeners.delete(fn);return remove(name,fn,...args)};
    const raf=window.requestAnimationFrame.bind(window), cancel=window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=(fn)=>{const id=raf(t=>{qa.pending.delete(id);fn(t)});qa.pending.add(id);return id};
    window.cancelAnimationFrame=(id)=>{qa.pending.delete(id);cancel(id)};
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      if(/webgl/.test(kind)&&this.closest('.dt-ambient-field')){
        qa.contexts++;
        ${fallback ? 'return null;' : ''}
        const gl=get.call(this,kind,...args);qa.gl=gl;return gl;
      }
      return get.call(this,kind,...args);
    };
    const proto=window.WebGLRenderingContext?.prototype;
    if(proto)for(const [method,key] of [['drawArrays','draws'],['deleteBuffer','deletedBuffers'],['deleteProgram','deletedPrograms']]){
      const original=proto[method];proto[method]=function(...args){if(this.canvas.closest('.dt-ambient-field'))qa[key]++;return original.apply(this,args)};
    }
    ${off ? `localStorage.setItem('dt:effects','off');` : ''}
  ` }, page.sid);
  await page.go('/scripts/ambient-fixture.html');
  await page.until(`!!document.querySelector('${control}')`, 'effects control');
}
async function idle(page, label) {
  await sleep(100);
  const before = await page.eval('window.__ambientQA.draws');
  await sleep(300);
  assert.equal(await page.eval('window.__ambientQA.draws'), before, label);
  assert.equal(await page.eval('window.__ambientQA.pending.size'), 0, `${label}: no queued RAF`);
  assert.equal(await page.eval('window.__ambientQA.pointerListeners.size'), 0, `${label}: pointer listener released`);
}
try {
  const p = await env.newPage('ambient desktop', 1440, 1000);
  await setup(p);
  await p.until(`${field}?.dataset.ambientStatus==='running' && window.__ambientQA.draws>2`, 'real GLSL draws', 15000);
  assert.equal(await p.hitTest('.dt-btn-primary'), 'ok', 'ambient cannot intercept hero CTA');
  const size = await p.eval(`(()=>{const c=${field}.querySelector('canvas');return {width:c.width,height:c.height,frames:+${field}.dataset.ambientFrames}})()`);
  assert(size.width <= 960 && size.height <= 640 && size.width * size.height <= 460800);
  report.buffer = size;
  const before = await p.eval('window.__ambientQA.draws');
  await sleep(1000);
  report.drawsPerSecond = await p.eval('window.__ambientQA.draws') - before;
  assert(report.drawsPerSecond > 0 && report.drawsPerSecond <= 33, 'at most approximately 30 actual draws/sec');
  await p.shot('desktop-running');

  await p.click(control);
  await p.until(`document.documentElement.dataset.dtEffects==='off' && document.querySelector('${control}').getAttribute('aria-checked')==='false'`, 'pause');
  assert.equal(await p.eval(`localStorage.getItem('dt:effects')`), 'off');
  assert.match(await p.eval(`document.querySelector('${control}').textContent`), /Efectos: no/);
  await idle(p, 'explicit off stops GPU and RAF');
  await p.reload();
  await p.until(`!!document.querySelector('${control}')`, 'reload');
  assert.equal(await p.eval('window.__ambientQA.contexts'), 0, 'persisted off creates no GL context');
  await idle(p, 'reload stays paused');
  // Native keyboard action, not an artificial click handler.
  await p.eval(`document.querySelector('${control}').focus()`);
  for (const type of ['keyDown', 'keyUp']) await env.send('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, ...(type === 'keyDown' ? { text: ' ' } : {}) }, p.sid);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'keyboard resume');

  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, p.sid);
  await p.until(`document.querySelector('${control}').disabled && document.documentElement.dataset.dtEffects==='off'`, 'live OS reduce');
  assert.match(await p.eval(`document.querySelector('${control}').textContent`), /no.*sistema/);
  await idle(p, 'OS reduced stops GPU and RAF');
  assert.equal(await p.eval(`localStorage.getItem('dt:effects')`), 'on', 'OS override does not overwrite user preference');
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, p.sid);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'OS restore');

  await p.eval(`window.scrollTo({top:1400,behavior:'instant'})`);
  await p.until(`${field}?.dataset.ambientStatus==='still'`, 'hero out of viewport');
  await idle(p, 'offscreen hero stops GPU and RAF');
  await p.eval(`window.scrollTo({top:0,behavior:'instant'})`);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'hero back');

  // Visibility handler exercised while the browser remains schedulable (frozen tabs cannot prove cancellation).
  await p.eval(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))`);
  await p.until(`${field}?.dataset.ambientStatus==='still'`, 'document hidden');
  await idle(p, 'hidden document stops GPU and RAF');
  await p.eval(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))`);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'document visible');

  // A separate real same-origin tab writes localStorage; the browser delivers storage.
  const { targetInfo } = await env.send('Target.getTargetInfo', {}, p.sid);
  const { targetId: writerId } = await env.send('Target.createTarget', { url: `${env.base}/scripts/ambient-fixture.html`, browserContextId: targetInfo.browserContextId });
  const { sessionId: writerSession } = await env.send('Target.attachToTarget', { targetId: writerId, flatten: true });
  await env.send('Runtime.enable', {}, writerSession);
  let wrote = false;
  for (let i = 0; i < 50 && !wrote; i++) {
    const result = await env.send('Runtime.evaluate', { expression: `localStorage.setItem('dt:effects','off');true`, returnByValue: true }, writerSession);
    wrote = result.result?.value === true;
    if (!wrote) await sleep(100);
  }
  assert(wrote, 'same-origin writer navigated');
  await env.send('Target.closeTarget', { targetId: writerId });
  await env.send('Page.bringToFront', {}, p.sid);
  await p.until(`document.documentElement.dataset.dtEffects==='off'`, 'real cross-tab storage update');
  await idle(p, 'storage event pauses live');
  await p.click(control);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'resume after storage');

  for (const [path, search] of [['/curso',''],['/practica',''],['/jugar',''],['/jenga',''],['/boxeo',''],['/road-to-b1',''],['/','?sala=ROOM']]) {
    await p.eval(`window.__ambientRoute(${JSON.stringify(path)},${JSON.stringify(search)})`);
    await p.until(`!${field}`, `no ambient on ${path}${search}`);
    await idle(p, `${path}${search} has no GPU/RAF`);
  }
  await p.eval(`window.__ambientRoute('/')`);
  await p.until(`${field}?.dataset.ambientStatus==='running'`, 'remount renderer');
  assert.equal(await p.eval('document.querySelectorAll(".dt-ambient-field canvas").length'), 1);
  await p.eval('window.__ambientQA.gl.getExtension("WEBGL_lose_context").loseContext()');
  await p.until(`${field}?.dataset.ambientStatus==='fallback'`, 'actual WebGL context loss');
  await idle(p, 'context loss stops GPU and RAF');
  await p.shot('desktop-context-loss');
  assert(await p.eval(`getComputedStyle(${field}).backgroundImage.includes('radial-gradient')`));
  report.cleanup = await p.eval('({buffers:window.__ambientQA.deletedBuffers,programs:window.__ambientQA.deletedPrograms})');
  assert(report.cleanup.buffers > 0 && report.cleanup.programs > 0, 'GL resources explicitly released');
  await p.eval('window.__ambientUnmount()');
  await idle(p, 'unmount releases renderer');
  assert.deepEqual(p.errors(), []);
  await env.send('Page.navigate', { url: 'about:blank' }, p.sid);

  const runningMobile = await env.newPage('ambient mobile running', 390, 844, true);
  await setup(runningMobile);
  await runningMobile.until(`${field}?.dataset.ambientStatus==='running' && window.__ambientQA.draws>2`, 'mobile GLSL', 15000);
  assert.equal(await runningMobile.eval('window.__ambientQA.pointerListeners.size'), 0, 'touch/mobile has no ambient pointer listener');
  assert.equal(await runningMobile.eval('document.documentElement.scrollWidth'), 390);
  await runningMobile.shot('mobile-running');
  assert.deepEqual(runningMobile.errors(), []);
  report.mobile = 'real GLSL running; zero pointer listeners; no overflow';
  await env.send('Page.navigate', { url: 'about:blank' }, runningMobile.sid);

  for (const [label, options] of [['reduced',{reduced:true}],['persisted-off',{off:true}],['webgl-fallback',{fallback:true}]]) {
    const mobile = await env.newPage(`ambient ${label}`, 390, 844, true);
    await setup(mobile, options);
    await mobile.until(`${field}?.dataset.ambientStatus==='${options.fallback ? 'fallback' : 'still'}'`, label);
    await idle(mobile, `${label} does not animate`);
    assert.equal(await mobile.eval('window.__ambientQA.draws'), 0);
    if (!options.fallback) assert.equal(await mobile.eval('window.__ambientQA.contexts'), 0, `${label} never initializes GPU`);
    if (options.reduced) assert.notEqual(await mobile.eval(`getComputedStyle(document.querySelector('${control} small')).display`), 'none', 'mobile visibly explains the OS override');
    assert.equal(await mobile.eval('document.documentElement.scrollWidth'), 390);
    await mobile.shot(`mobile-${label}`);
    assert.deepEqual(mobile.errors(), []);
    report[label] = 'zero draws, no RAF, no overflow';
    await env.send('Page.navigate', { url: 'about:blank' }, mobile.sid);
  }
  // Integration smoke against the actual App, not the fixture's composition.
  const app = await env.newPage('ambient actual App', 1440, 1000);
  await setup(app);
  await app.go('/?intro=0');
  await app.until(`${field}?.dataset.ambientStatus==='running' && !!document.querySelector('.dt-hero-3d.is-ready canvas')`, 'actual App atmosphere + 3D', 30000);
  await app.eval('document.fonts.ready');
  await sleep(1200);
  assert.equal(await app.hitTest('.dt-hero-cta a'), 'ok', 'actual App CTA is not masked');
  assert.equal(await app.hitTest('.dt-hero-3d canvas'), 'ok', 'actual 3D canvas is not masked');
  report.integration = await app.eval(`({landingBackground:getComputedStyle(document.querySelector('.dt-landing')).backgroundColor,ambientStatus:${field}.dataset.ambientStatus,canvasCount:document.querySelectorAll('.dt-ambient-field canvas').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.equal(report.integration.canvasCount, 1);
  assert.equal(report.integration.overflow, false);
  await app.shot('app-desktop-running');
  await app.click('.dt-nav-links a[href="/curso"]');
  await app.until(`location.pathname==='/curso' && !${field}`, 'actual App course has no ambient');
  const courseDraws = await app.eval('window.__ambientQA.draws');
  await sleep(400);
  assert.equal(await app.eval('window.__ambientQA.draws'), courseDraws, 'actual course has zero ambient GPU work');
  assert.deepEqual(app.errors(), []);

  report.guards = ['toggle + keyboard + reload', 'live OS reduced', 'real cross-tab storage', 'offscreen hero', 'document.hidden handler', 'learning/game/invitation routes', 'context loss + resource disposal', 'unmount'];
  writeFileSync(join(env.shots, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await env.close();
  await vite.close();
}
