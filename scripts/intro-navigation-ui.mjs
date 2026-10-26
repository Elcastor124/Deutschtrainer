// Real Edge/CDP regression for active intro cancellation on SPA navigation.
// npm run build && node scripts/intro-navigation-ui.mjs
import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';

const env = await launch({ shots: 'shots/intro-navigation' });
const results = [];
try {
  for (const scenario of ['pathname-back', 'search-only', 'eligible-route']) {
    const p = await env.newPage(scenario, 1366, 768);
    try {
      await p.go(scenario === 'pathname-back' ? '/practica' : '/?intro=still');
      if (scenario !== 'pathname-back') {
        await p.until(`!!document.querySelector('[data-intro]')`, 'initial held intro');
        await p.key('Escape');
      }
      await p.until(`!!document.querySelector('.dt-nav-brand')`, 'navigation ready');
      await p.eval(`window.__documentIdentity = crypto.randomUUID()`);
      const identity = await p.eval('window.__documentIdentity');
      if (scenario === 'pathname-back') {
        await p.eval(`document.querySelector('.dt-nav-brand').setAttribute('href', '/?intro=still')`);
        await p.click('.dt-nav-brand');
        await p.until(`location.pathname === '/' && !!document.querySelector('[data-intro-replay]')`, 'internal home navigation');
        assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'route changes must not auto replay');
      }
      // Record the actual cinematic timers, so cancellation must clear rather than merely hide them.
      await p.eval(`window.__introTimers = new Set(); window.__timeout = window.setTimeout; window.__clearTimeout = window.clearTimeout;
        window.setTimeout = function(fn, ms, ...args) { const id = window.__timeout(fn, ms, ...args); if ([800, 2000, 3200, 4600, 5740, 460].includes(ms)) window.__introTimers.add(id); return id; };
        window.clearTimeout = function(id) { window.__introTimers.delete(id); return window.__clearTimeout(id); };
        document.querySelector('[data-intro-replay]').focus();`);
      await p.click('[data-intro-replay]');
      await p.until(`!!document.querySelector('[data-intro]') && document.activeElement?.matches('[data-intro-skip]')`, 'replay active and focused');
      assert.equal(await p.eval(`document.querySelector('#contenido').inert`), true);
      assert.equal(await p.eval(`window.__introTimers.size`), 4);
      await p.shot(`${scenario}-active`);
      if (scenario === 'pathname-back') await p.eval('history.back()');
      else await p.eval(`history.pushState(null, '', ${JSON.stringify(scenario === 'search-only' ? '/?sala=TEST&intro=still' : '/curso?intro=1')}); dispatchEvent(new PopStateEvent('popstate'));`);
      const target = scenario === 'pathname-back' ? '/practica' : scenario === 'eligible-route' ? '/curso' : '/';
      await p.until(`location.pathname === ${JSON.stringify(target)}`, 'destination reached');
      await sleep(180);
      const state = await p.eval(`({overlay: !!document.querySelector('[data-intro]'), locked: document.documentElement.classList.contains('dt-intro-lock'), inert: [...document.querySelectorAll('[inert]')].length, timers: window.__introTimers.size, focus: document.activeElement?.id || document.activeElement?.getAttribute('data-intro-replay'), sameDocument: window.__documentIdentity === ${JSON.stringify(identity)}})`);
      console.log(JSON.stringify({ scenario, afterNavigation: state }));
      assert.equal(state.overlay, false, `${scenario}: active intro must cancel on location change`);
      assert.equal(state.locked, false, 'scroll lock cleaned');
      assert.equal(state.inert, 0, 'background inert cleaned');
      assert.equal(state.timers, 0, 'cinematic timers cleared');
      assert.equal(state.sameDocument, true, 'must exercise SPA navigation, not reload');
      assert.equal(await p.eval(`document.activeElement?.matches('#contenido, [data-intro-replay]')`), true, 'focus restored to connected initiator or content');
      assert.equal(await p.eval(`window.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', cancelable:true}))`), true, 'intro keyboard trap listener removed');
      await p.key('Tab');
      assert.equal(await p.eval(`!!document.activeElement?.closest('[inert]')`), false);
      if (scenario === 'search-only') {
        await p.eval(`window.dispatchEvent(new Event('dt:intro:replay'))`);
        await sleep(150);
        assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'invitation cannot replay after search-only navigation');
      }
      await p.shot(`${scenario}-cancelled`);
      await sleep(900);
      assert.equal(await p.eval(`!!document.querySelector('[data-intro]')`), false, 'route changes stay dismissed');
      assert.deepEqual(p.errors(), []);
      results.push({ scenario, ok: true });
    } catch (error) {
      results.push({ scenario, ok: false, error: error.message });
    }
  }
  console.log(JSON.stringify({ ok: results.every(r => r.ok), results }, null, 2));
  assert(results.every(r => r.ok), 'intro navigation regressions');
} finally { await env.close(); }
