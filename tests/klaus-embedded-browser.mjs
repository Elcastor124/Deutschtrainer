// Genuine practice layout regression; no fabricated server results.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from '../scripts/cdp.mjs';
const L = await launch({ shots: 'shots/klaus-embedded' });
const metrics = [];
try {
  for (const [width, height] of [[1366,768],[1024,768],[390,844],[320,740]]) {
    const B = await L.newPage(`embedded ${width}`, width, height, width < 500);
    await B.go('/practica?temas=dativ');
    await B.until(`!!document.querySelector('form.home input.field')`, 'setup');
    await B.type('form.home input.field', 'EmbeddedQA');
    await B.click('form.home .btn.primary.lg');
    await B.until(`!!document.querySelector('.qpanel') && !!document.querySelector('[data-klaus-figure]')`, 'real question and companion');
    await sleep(450);
    await B.eval('scrollTo(0,0)');
    await B.shot(`${process.env.PROOF ?? 'run'}-${width}`);
    const m = await B.eval(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};const p=document.querySelector('[data-klaus-panel]');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,q:rect('.qpanel'),k:rect('[data-klaus-panel]'),figure:rect('[data-klaus-figure]'),embedded:p.parentElement.matches('.player'),border:getComputedStyle(p).borderTopWidth,background:getComputedStyle(p).backgroundColor,preferences:!!p.querySelector('details:not([open]) > summary'),state:p.dataset.klausState}})()`);
    metrics.push(m);
    assert.ok(m.embedded, 'Klaus must share the actual exercise player, not precede the HUD');
    assert.ok(m.preferences, 'preferences start collapsed behind a native summary');
    assert.equal(m.border, '0px', 'no dashboard card border');
    assert.ok(m.scrollWidth <= width + 1, 'no horizontal overflow');
    assert.equal(m.state, 'thinking');
    if (width >= 1000) {
      assert.ok(m.k.x >= m.q.right, 'companion sits in the free right column');
      assert.ok(m.figure.width >= 230, 'canonical line art is a large companion, not an icon');
      assert.ok(m.q.y < 320, 'no companion banner steals the question fold');
      assert.ok(m.k.y < m.q.bottom && m.k.bottom > m.q.y, 'companion is alongside question');
    } else {
      assert.ok(m.k.y >= m.q.bottom, 'mobile sidekick follows answers without covering them');
      assert.ok(m.k.height <= 180, 'mobile companion is compact');
    }
    await B.click('[data-klaus-preferences] > summary');
    assert.equal(await B.eval(`document.querySelector('[data-klaus-preferences]').open`), true);
    assert.equal(await B.hitTest('[data-klaus-control="mute"]'), 'ok');
    await B.key('Escape');
    assert.equal(await B.eval(`document.querySelector('[data-klaus-preferences]').open`), false);
    assert.equal(await B.eval(`document.activeElement.matches('[data-klaus-preferences] > summary')`), true, 'Escape restores summary focus');
    if (width < 500) {
      await B.eval(`document.querySelector('[data-klaus-panel]').scrollIntoView({block:'end',behavior:'instant'})`);
      await B.shot(`${process.env.PROOF ?? 'run'}-${width}-sidekick`);
    }
    // Genuine result, preserving the actual exercise and Shell DOM across updates.
    await B.eval(`globalThis.__exerciseRoot=document.querySelector('.player'); globalThis.__shellRoot=document.querySelector('.app'); true`);
    assert.equal((await B.eval(`globalThis.__bcNet.request({t:'answer',qid:globalThis.__bcNet.state.view.q.id,a:{choice:999,text:'qqq zzz',gaps:['qqq','qqq','qqq','qqq'],order:[],index:999,fix:'qqq',pairs:[999,999,999,999]}})`)).ok, true);
    await B.until(`document.querySelector('[data-klaus-panel]').dataset.klausState === 'support'`, 'real supportive result');
    assert.equal(await B.eval(`globalThis.__exerciseRoot===document.querySelector('.player') && globalThis.__shellRoot===document.querySelector('.app')`), true, 'authoritative event does not remount gameplay');
    assert.deepEqual(B.errors(), []);
    console.log(`PASS embedded real practice ${width}x${height}`);
  }
} finally {
  writeFileSync(join(L.shots, `${process.env.PROOF ?? 'run'}-metrics.json`), JSON.stringify(metrics,null,2));
  await L.close();
}
