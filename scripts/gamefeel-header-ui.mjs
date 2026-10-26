import assert from 'node:assert/strict';
import { launch, sleep } from './cdp.mjs';
const b = await launch({ shots: 'shots/gamefeel-header' });
try {
  const p = await b.newPage('header', 1366, 768);
  await p.go('/practica');
  await p.until('!!document.querySelector("form.home input.field")','setup');
  await p.type('form.home input.field', 'Header QA');
  await p.click('form.home .btn.primary.lg');
  await p.until('!!document.querySelector(".qpanel")','real question');
  await p.eval('scrollTo({top:150,behavior:"instant"})');
  await sleep(300);
  const layout = await p.eval('({nav:document.querySelector(".dt-nav").getBoundingClientRect().toJSON(),hud:document.querySelector(".hud").getBoundingClientRect().toJSON()})');
  await p.shot('scrolled-header');
  assert.ok(layout.hud.top >= layout.nav.bottom - 1, `game HUD overlaps site nav: ${JSON.stringify(layout)}`);
  console.log(JSON.stringify({passed:true,layout}));
} finally { await b.close(); }
