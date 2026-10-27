// Real isolated Edge desktop/mobile, raised logo interaction, reduced motion and WebGL fallback.
// npm run build && node scripts/hero-logo-ui.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const env = await launch({ shots: 'shots/hero-logo', base: process.env.BASE });
const report = {};
async function prepare(p, reduced = false, fallback = false) {
  await env.send('Page.bringToFront', {}, p.sid);
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, p.sid);
  await env.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__heroDraws = 0;
    window.__heroWarnings = [];
    const warn = console.warn; console.warn = (...args) => {window.__heroWarnings.push(args.map(a=>String(a)).join(' '));warn(...args)};
    for(const ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      for(const name of ['drawElements','drawArrays']) {
        const original=ctor.prototype[name];
        ctor.prototype[name]=function(...args){if(this.canvas.closest?.('.dt-hero-3d'))window.__heroDraws++;return original.apply(this,args)};
      }
    }
    ${fallback ? `const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...rest){return /webgl/.test(kind)?null:get.call(this,kind,...rest)}` : ''}
  ` }, p.sid);
  await p.go('/?intro=0');
  try { await p.until(`!!document.querySelector('.dt-hero-3d.is-${fallback ? 'static' : 'ready'}')`, 'hero ready', 30000); }
  catch (error) { console.error(p.label, p.errors(), await p.eval(`({warnings:window.__heroWarnings,state:document.querySelector('.dt-hero-3d')?.className,text:document.body.innerText.slice(0,200)})`)); throw error; }
  await sleep(2400);
}
try {
  const desktop = await env.newPage('hero desktop', 1440, 1000);
  await prepare(desktop);
  await desktop.shot('desktop-1440');
  report.desktop = await desktop.eval(`({width:document.documentElement.scrollWidth,viewport:innerWidth,draws:window.__heroDraws})`);
  assert.equal(report.desktop.width, report.desktop.viewport);
  assert(report.desktop.draws > 0, 'real WebGL must draw');
  const rect = await desktop.rect('.dt-hero-3d canvas');
  await env.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + 100, y: rect.y - 50 }, desktop.sid);
  await sleep(500);
  // Edge/SwiftShader can return a stale tiled compositor surface immediately after hover.
  const pointerShot = await env.send('Page.captureScreenshot', { format: 'png', fromSurface: false }, desktop.sid);
  writeFileSync(join(env.shots, 'desktop-pointer-depth.png'), Buffer.from(pointerShot.data, 'base64'));
  // Actual CDP pointer clicks, scan the left floating cube without application shortcuts.
  const canvasRect = await desktop.eval(`(()=>{const r=document.querySelector('.dt-hero-3d canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  // The plaque is the interactive object (the dice were retired with the jewel redesign).
  const point = { x: canvasRect.x + canvasRect.w*.5, y: canvasRect.y+canvasRect.h*.5, button:'left', clickCount:1 };
  for (const type of ['mouseMoved','mousePressed','mouseReleased']) await env.send('Input.dispatchMouseEvent', {type,...point}, desktop.sid);
  await sleep(200);
  report.plaqueCursor = await desktop.eval(`document.querySelector('.dt-hero-3d canvas').style.cursor`);
  assert.equal(report.plaqueCursor, 'pointer', 'the plaque is interactive');
  assert.deepEqual(desktop.errors(), []);

  // Route unmount disposes scene; remount restores a single working canvas.
  await env.send('Page.bringToFront', {},desktop.sid);
  await desktop.click('a[href="/curso"]');
  await desktop.until(`location.pathname==='/curso'&&!document.querySelector('.dt-hero-3d canvas')`,'scene unmounted');
  await desktop.go('/?intro=0');
  await desktop.until(`!!document.querySelector('.dt-hero-3d.is-ready canvas')`,'scene remounted',30000);
  assert.equal(await desktop.eval(`document.querySelectorAll('.dt-hero-3d canvas').length`),1);
  assert.deepEqual(desktop.errors(), []);

  // Release each GPU-backed document before creating the next isolated case.
  await env.send('Page.navigate', {url:'about:blank'},desktop.sid);
  await sleep(500);
  const mobile = await env.newPage('hero mobile', 390, 844, true);
  await prepare(mobile);
  await mobile.eval(`document.querySelector('.dt-hero-visual').scrollIntoView({block:'center',behavior:'instant'})`);
  await sleep(500);
  await mobile.shot('mobile-390');
  assert.equal(await mobile.eval('document.documentElement.scrollWidth'),390);
  assert.deepEqual(mobile.errors(), []);

  await env.send('Page.navigate', {url:'about:blank'},mobile.sid);
  await sleep(500);
  const reduced = await env.newPage('hero reduced',1440,1000);
  await prepare(reduced,true);
  await reduced.shot('desktop-reduced');
  const before = await reduced.eval('window.__heroDraws');
  await sleep(500);
  const after = await reduced.eval('window.__heroDraws');
  report.reducedDrawsDuringIdle = after-before;
  assert.equal(after,before,'reduced-motion hero must settle instead of continuously animating/rendering');
  assert.deepEqual(reduced.errors(), []);

  await env.send('Page.navigate', {url:'about:blank'},reduced.sid);
  await sleep(500);
  const fallback = await env.newPage('hero fallback',390,844,true);
  await prepare(fallback,true,true);
  await fallback.eval(`document.querySelector('.dt-hero-visual').scrollIntoView({block:'center',behavior:'instant'})`);
  await fallback.shot('mobile-webgl-fallback');
  assert(await fallback.eval(`!!document.querySelector('.dt-hero-static [data-brand-symbol="dt-pencil-book"] [data-brand-part="a-peak"]')`));
  assert(await fallback.eval(`!!document.querySelector('.dt-hero-static [data-brand-part="d-notebook"]')`));
  assert(await fallback.eval(`!!document.querySelector('.dt-hero-static [data-brand-part="t-pencil"]')`));
  assert.equal(await fallback.eval('window.__heroDraws'),0);
  assert.deepEqual(fallback.errors(), []);
  report.fallback = 'canonical sketch without WebGL';
  writeFileSync(join(env.shots,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await env.close(); }
