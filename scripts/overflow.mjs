// Recorre muchas preguntas de práctica en un móvil de 390 px y avisa si alguna desborda la pantalla.
import { launch, sleep } from './cdp.mjs';
const L = await launch({ shots: process.argv[2] ?? 'shots' });
let bad = 0, seen = 0;
try {
  const B = await L.newPage('móvil', 390, 844, true);
  for (let s = 0; s < 4; s++) {
    await B.go('/practica');
    await B.until(`!!document.querySelector('form .btn.primary.lg')`, 'form');
    await B.eval(`localStorage.removeItem('bc:practice'); true`);
    await B.type('form input.field', 'Test');
    await B.click('form .btn.primary.lg');
    for (let k = 0; k < 15; k++) {
      await B.until(`['question','reveal','final'].includes(globalThis.__bcNet?.state?.view?.phase)`, 'q');
      if (await B.eval(`globalThis.__bcNet.state.view.phase === 'final'`)) break;
      const v = await B.state();
      await sleep(350);
      for (const stage of ['q', 'r']) {
        const o = await B.eval(`document.documentElement.scrollWidth > innerWidth + 1`);
        if (o) {
          bad++;
          const c = await B.eval(`[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(e).position!=='fixed').slice(0,4).map(e=>e.tagName+'.'+e.className+' «'+(e.textContent||'').slice(0,50)+'»').join(' | ')`);
          console.log('OVERFLOW', stage, v.q?.type, v.q?.prompt, '→', c);
          await B.shot(`overflow-${bad}`);
        }
        seen++;
        if (stage === 'q') {
          await B.eval(`globalThis.__bcNet.request({t:'answer', qid: globalThis.__bcNet.state.view.q.id, a:{choice:0,text:'x',gaps:['x','x','x','x'],order:[],index:0,fix:'x',pairs:[0,0,0,0]}})`);
          await B.until(`globalThis.__bcNet.state.view.phase === 'reveal'`, 'reveal');
          await sleep(500);
        }
      }
      await B.eval(`globalThis.__bcNet.request({t:'pnext'})`);
      await sleep(150);
    }
  }
} catch (e) { console.error('ERR', e.message); }
console.log(`pantallas revisadas: ${seen} · con desbordamiento: ${bad}`);
await L.close();
process.exit(bad ? 1 : 0);
