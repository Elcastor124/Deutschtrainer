// Real Edge typography/motion QA. Run against a Vite server; never rebuilds shared dist.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from '../scripts/cdp.mjs';

console.log('EDITORIAL: launching isolated Edge');
const env = await launch({ base: process.env.EDITORIAL_BASE ?? 'http://127.0.0.1:5178', shots: 'shots/editorial' });
console.log('EDITORIAL: Edge connected');
const pages = [];
const report = { sizes: [], checks: [] };
const open = async (name, w = 1366, h = 900, mobile = false) => {
  const page = await env.newPage(name, w, h, mobile);
  await env.send('Page.bringToFront', {}, page.sid);
  pages.push(page);
  return page;
};
const nativeEnter = async (page) => {
  await env.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' }, page.sid);
  await env.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, page.sid);
};

try {
  if (!process.env.EDITORIAL_TOUCH_ONLY) {
  const intro = await open('intro-gate');
  await intro.go('/?intro=still');
  await intro.until(`!!document.querySelector('[data-intro]') && !!document.querySelector('.dt-editorial')`, 'held intro + landing');
  await sleep(500);
  assert.notEqual(await intro.eval(`document.querySelector('.dt-editorial').dataset.editorialEnter`), 'play');
  assert.equal(await intro.eval(`document.querySelector('.dt-hero-title').getAnimations({subtree:true}).filter(a=>a.animationName==='dt-editorial-word-in').length`), 0);
  await intro.click('[data-intro-skip]');
  await intro.until(`!document.querySelector('[data-intro]') && document.querySelector('.dt-editorial')?.dataset.editorialEnter === 'play'`, 'post-intro word reveal');
  const times = await intro.eval(`document.querySelector('.dt-hero-title').getAnimations({subtree:true}).filter(a=>a.animationName==='dt-editorial-word-in').map(a=>a.currentTime)`);
  assert.equal(times.length, 8);
  assert(times.every((t) => t < 1200), 'word entrance must start after intro removal, not six seconds earlier');
  await sleep(1400);
  await intro.shot('hero-1366');
  report.checks.push('held intro does not consume hero reveal; 8 word animations start after skip');
  await env.send('Page.close', {}, intro.sid);

  for (const [w, h] of [[1366, 900], [1024, 768], [768, 1024], [390, 844], [320, 740]]) {
    const page = await open('width-' + w, w, h, w <= 390);
    await page.go('/?intro=0');
    await page.until(`document.querySelectorAll('[data-editorial-word]').length === 8`, 'real heading words');
    await page.eval('document.fonts.ready');
    await sleep(1450);
    // Request a real headless frame; an unpainted new target can defer CSS transitions.
    await env.send('Page.captureScreenshot', { format: 'png' }, page.sid);
    await page.until(`!!document.querySelector('.dt-hero-static') || (document.querySelector('.dt-hero-3d')?.classList.contains('is-ready') && getComputedStyle(document.querySelector('.dt-hero-3d canvas')).opacity==='1')`, 'fully visible 3D or canonical fallback');
    const state = await page.eval(`(() => {
      const title=document.querySelector('.dt-hero-title');
      const headings=[...document.querySelectorAll('.dt-editorial h1, .dt-editorial h2, .dt-editorial h3')];
      return {
        viewport:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        h1:document.querySelectorAll('h1').length,
        family:getComputedStyle(title).fontFamily,
        loaded:document.fonts.check('700 64px "Barlow Condensed"'),
        heroOpacity:getComputedStyle(document.querySelector('.dt-hero-visual')).opacity,
        canvasOpacity:document.querySelector('.dt-hero-3d canvas') ? getComputedStyle(document.querySelector('.dt-hero-3d canvas')).opacity : 'static',
        headingOverflow:headings.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
        title:title.textContent.replace(/\\s+/g,' ').trim(),
        ctaTarget:document.querySelector('.dt-hero-cta a')?.getAttribute('href'),
      };
    })()`);
    assert.equal(state.scrollWidth, state.viewport, `${w}px page overflow`);
    assert.deepEqual(state.headingOverflow, [], `${w}px clipped headings`);
    assert.equal(state.h1, 1);
    assert.match(state.family, /Barlow Condensed/);
    assert.equal(state.loaded, true);
    assert.equal(state.heroOpacity, '1');
    assert(['1', 'static'].includes(state.canvasOpacity), 'hero must not be intentionally ghosted');
    assert.equal(state.title, 'Aprende alemán paso a paso. Schritt für Schritt.');
    assert.match(state.ctaTarget, /^\/curso/);
    await page.shot('landing-' + w);
    report.sizes.push({ width: w, ...state });
    await env.send('Page.close', {}, page.sid);
  }

  const focus = await open('keyboard-focus');
  await focus.go('/?intro=0');
  await focus.until(`!!document.querySelector('.dt-card')`, 'access card');
  await focus.eval(`document.querySelector('.dt-card-practice').focus()`);
  await env.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, focus.sid);
  await env.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, focus.sid);
  await focus.eval(`document.querySelector('.dt-card-practice').focus()`);
  await sleep(420);
  const focusStyle = await focus.eval(`(() => { const e=document.querySelector('.dt-card-practice'); const cs=getComputedStyle(e); return {visible:e.matches(':focus-visible'), outline:cs.outlineStyle, arrow:getComputedStyle(e.querySelector('.dt-card-go')).backgroundColor}; })()`);
  assert.equal(focusStyle.visible, true);
  assert.equal(focusStyle.outline, 'solid');
  await focus.shot('card-keyboard-focus');
  await nativeEnter(focus);
  await focus.until(`location.pathname==='/practica'`, 'native Enter opens practice');
  report.checks.push('keyboard focus has visible outline and card feedback; native Enter navigates to real practice');
  await env.send('Page.close', {}, focus.sid);
  }

  const touch = await open('touch-pressure', 390, 844, true);
  await touch.go('/?intro=0');
  await touch.until(`!!document.querySelector('.dt-card-practice')`, 'touch access card');
  await touch.rect('.dt-card-practice');
  await touch.until(`getComputedStyle(document.querySelector('.dt-card-practice')).opacity==='1' && getComputedStyle(document.querySelector('.dt-card-practice')).transform==='none'`, 'touch card reveal settled');
  const point = await touch.rect('.dt-card-practice');
  await env.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] }, touch.sid);
  await sleep(220);
  const pressed = await touch.eval(`(() => { const e=document.querySelector('.dt-card-practice'); const hit=document.elementFromPoint(${point.x},${point.y}); return { scale:getComputedStyle(e).scale, active:e.matches(':active'), target:hit?.outerHTML.slice(0,240), point:{x:${point.x},y:${point.y}} }; })()`);
  assert.notEqual(pressed.scale, 'none', 'touch press needs the same tactile signal as pointer press: ' + JSON.stringify(pressed));
  await touch.shot('card-touch-pressed-390');
  await env.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, touch.sid);
  await touch.until(`location.pathname==='/practica'`, 'touch release opens practice');
  report.checks.push('touch press shows tactile scale; release navigates');
  await env.send('Page.close', {}, touch.sid);

  const off = await open('effects-off', 390, 844, true);
  await off.go('/?intro=0');
  await off.until(`!!document.querySelector('.dt-editorial')`, 'off preference setup');
  await off.eval(`localStorage.setItem('dt:effects','off')`);
  await off.reload();
  await off.until(`document.documentElement.dataset.dtEffects==='off' && !!document.querySelector('.dt-editorial')`, 'persisted off preference');
  const staticState = await off.eval(`(() => {
    const words=[...document.querySelectorAll('[data-editorial-word]')];
    return { visible:words.every(e=>getComputedStyle(e).opacity==='1'&&getComputedStyle(e).transform==='none'), animations:document.querySelector('.dt-hero-title').getAnimations({subtree:true}).map(a=>({name:a.animationName,property:a.transitionProperty,state:a.playState,target:a.effect?.target?.outerHTML?.slice(0,160)})) };
  })()`);
  assert.equal(staticState.visible, true);
  assert.deepEqual(staticState.animations, []);
  await off.shot('effects-off-390');
  report.checks.push('persisted effects-off exposes all headline words without animation');
  await env.send('Page.close', {}, off.sid);

  const reduced = await open('reduced-motion', 320, 740, true);
  await env.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, reduced.sid);
  await reduced.go('/?intro=still');
  await reduced.until(`!!document.querySelector('.dt-editorial')`, 'reduced-motion landing');
  assert.equal(await reduced.eval(`!!document.querySelector('[data-intro]')`), false);
  assert.equal(await reduced.eval(`document.querySelector('.dt-hero-title').getAnimations({subtree:true}).length`), 0);
  assert.equal(await reduced.eval(`[...document.querySelectorAll('[data-editorial-word]')].every(e=>getComputedStyle(e).opacity==='1')`), true);
  await reduced.shot('reduced-motion-320');
  report.checks.push('system reduced motion suppresses forced intro and headline motion at 320px');
  await env.send('Page.close', {}, reduced.sid);

  const errors = pages.flatMap((p) => p.errors().map((error) => ({ page: p.label, error })));
  assert.deepEqual(errors, [], 'browser errors');
  writeFileSync(join(env.shots, 'report.json'), JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('EDITORIAL BROWSER PASS');
} catch (error) {
  console.error(error);
  console.error('Browser errors:', pages.flatMap((p) => p.errors().map((message) => ({ page: p.label, message }))));
  try { console.error('Current page:', await pages.at(-1)?.eval(`({hidden:document.hidden, ready:document.querySelector('.dt-hero-3d')?.className, canvasOpacity:document.querySelector('.dt-hero-3d canvas')?getComputedStyle(document.querySelector('.dt-hero-3d canvas')).opacity:null, visualOpacity:document.querySelector('.dt-hero-visual')?getComputedStyle(document.querySelector('.dt-hero-visual')).opacity:null, words:document.querySelector('.dt-editorial')?.dataset.editorialEnter})`)); } catch { /* target may have closed */ }
  process.exitCode = 1;
} finally {
  await env.close();
}
