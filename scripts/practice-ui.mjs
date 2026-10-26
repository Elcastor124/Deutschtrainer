// Modo práctica («repaso») y juegos por temas en navegadores reales (Edge/Chrome headless vía CDP).
// Comprueba: 3 sesiones seguidas con poco solapamiento, recarga a mitad que se retoma sola, sala desaparecida →
// práctica nueva con aviso (sin pantalla muerta), sin errores de JavaScript, y /jugar + /jenga con ?temas=.
// Uso: node scripts/practice-ui.mjs            (arranca su propio servidor)
//      BASE=https://… node scripts/practice-ui.mjs   (contra un despliegue; no prueba /jenga con alumnos si no hay)
import { launch, sleep } from './cdp.mjs';

const L0 = await launch({ shots: 'shots/practice-ui', ...(process.env.BASE ? { base: process.env.BASE } : {}) });
let failures = 0;
const L = { ...L0, pages: [], async newPage(...a) { const p = await L0.newPage(...a); this.pages.push(p); return p; } };
const ok = (c, msg) => { console.log(`${c ? '  ✔' : '  ✘'} ${msg}`); if (!c) failures++; };
const PH = `['question','reveal','final'].includes(globalThis.__bcNet?.state?.view?.phase)`;

async function playSession(B, { reloadAt = -1, label }) {
  const ids = [];
  let reloaded = false;
  for (let k = 0; k < 80; k++) {
    await B.until(PH, `${label}: pregunta`, 12000);
    const v = await B.state();
    if (v.phase === 'final') return { ids, v };
    if (v.phase === 'question') {
      if (!ids.includes(v.q.id)) ids.push(v.q.id);
      if (ids.length === reloadAt && !reloaded) {
        reloaded = true;
        const before = v.q.id;
        await B.reload();
        await B.until(`globalThis.__bcNet?.state?.view?.phase === 'question'`, 'retomar tras recargar', 12000);
        const after = await B.state();
        ok(after.q.id === before, `${label}: recargar a mitad retoma la MISMA pregunta sin pasar por el formulario`);
        ok(!(await B.eval(`!!document.querySelector('form.home .btn.primary.lg')`)), `${label}: tras recargar no aparece el formulario de inicio`);
      }
      await B.eval(`globalThis.__bcNet.request({t:'answer', qid: globalThis.__bcNet.state.view.q.id, a:{choice:0,text:'x',gaps:['x','x','x','x'],order:[],index:0,fix:'x',pairs:[0,0,0,0]}})`);
      await B.until(`globalThis.__bcNet.state.view.phase !== 'question'`, `${label}: corrección`, 8000);
    }
    await sleep(120);
    if (!(await B.eval(`document.body.innerText.trim().length > 40`))) { ok(false, `${label}: pantalla en blanco (k=${k})`); await B.shot(`blank-${label}-${k}`); }
    await B.until(`!!document.querySelector('.qpanel .btn.primary.lg') || globalThis.__bcNet.state.view.phase === 'final'`, `${label}: botón Siguiente`, 8000);
    if (await B.eval(`globalThis.__bcNet.state.view.phase === 'final'`)) continue;
    // Native keyboard activation avoids Player's smooth-scroll moving the
    // pointer between mouseDown and mouseUp. Assert progress; never swallow it.
    await B.eval(`document.querySelector('.qpanel .btn.primary.lg').focus({preventScroll:true})`);
    await L.send('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:String.fromCharCode(13)}, B.sid);
    await L.send('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13}, B.sid);
    await B.until(`globalThis.__bcNet.state.view.phase !== 'reveal' || globalThis.__bcNet.state.view.qNo !== ${v.qNo}`, `${label}: avanzar`, 8000);
  }
  throw new Error(`${label}: la sesión no termina`);
}


try {
  console.log('\nPráctica: variedad entre sesiones, recarga y final');
  const B = await L.newPage('alumno', 1366, 768);
  const sessions = [];
  for (let s = 0; s < 3; s++) {
    await B.go(s === 0 ? '/practica?tema=1&temas=dativ' : '/practica?tema=1&temas=dativ');
    await B.until(`!!document.querySelector('form .btn.primary.lg')`, 'formulario');
    if (s === 0) {
      ok(await B.eval(`[...document.querySelectorAll('.chips .btn[aria-pressed=true]')].map(b=>b.textContent).join()==='Dativ'`), '?temas=dativ preselecciona Dativ');
      await B.type('form input.field', 'Probe');
      await B.click('[role=radio]', 0); // 10 preguntas
    }
    await B.click('form .btn.primary.lg');
    const { ids, v } = await playSession(B, { reloadAt: s === 0 ? 3 : -1, label: `sesión ${s + 1}` });
    sessions.push(ids);
    ok(v.qTotal >= 10 && new Set(ids).size === 10, `sesión ${s + 1}: 10 preguntas distintas (${new Set(ids).size})`);
    ok(await B.eval(`/Práctica|terminada/.test(document.body.innerText) && !!document.querySelector('.final .btn.primary.lg')`), `sesión ${s + 1}: pantalla final con «Otra práctica»`);
    ok(ids.every((id) => id.length > 0), 'ids válidos');
    if (s === 0) {
      // «Otra práctica» desde la pantalla final: empieza otra sin pasar por el formulario.
      await B.click('.final .btn.primary.lg');
      await B.until(`globalThis.__bcNet?.state?.view?.phase === 'question' && globalThis.__bcNet.state.view.practice.done === 0`, 'otra práctica', 10000);
      ok(true, '«Otra práctica» arranca una sesión nueva al momento');
      const { ids: ids2 } = await playSession(B, { label: 'sesión 1b' });
      sessions.push(ids2);
    }
    await B.eval(`localStorage.removeItem('bc:practice'); true`);
  }
  const uniq = sessions.map((x) => [...new Set(x)]);
  const overlaps = uniq.slice(1).map((x, i) => x.filter((id) => uniq[i].includes(id)).length);
  console.log('  solapamientos consecutivos:', JSON.stringify(overlaps), '(de 10)');
  ok(overlaps.every((n) => n <= 4), 'sesiones consecutivas comparten ≤ 40 % (todo fallado, tema pequeño)');
  ok(B.errors().length === 0, `sin errores de JavaScript ${JSON.stringify(B.errors().slice(0, 3))}`);

  console.log('\nPráctica guardada que ya no existe en el servidor (reinicio en Render)');
  const C = await L.newPage('alumno2', 390, 844, true);
  await C.go('/practica?tema=1');
  await C.until(`!!document.querySelector('form')`, 'formulario');
  await C.eval(`localStorage.setItem('bc:name','Bea'); localStorage.setItem('bc:practice', JSON.stringify({room:'PZZZZZ', token:'gone', opts:{topics:['akkusativ'],focus:false,size:10}})); true`);
  await C.reload();
  await C.until(`globalThis.__bcNet?.state?.view?.phase === 'question'`, 'práctica nueva automática', 12000);
  const cv = await C.state();
  ok(cv.code !== 'PZZZZZ' && cv.q.topic === 'akkusativ' && cv.qTotal === 10, `práctica nueva con los mismos temas y tamaño (${cv.q.topic}, ${cv.qTotal})`);
  ok(await C.eval(`/ya no estaba disponible/.test(document.body.innerText)`), 'aviso amable visible');
  ok(await C.eval(`JSON.parse(localStorage.getItem('bc:practice')).room !== 'PZZZZZ'`), 'se sustituye la sala guardada caducada');
  ok(await C.eval(`document.documentElement.scrollWidth <= innerWidth + 1`), 'móvil: sin desbordamiento horizontal');
  await C.shot('vanished-room');
  ok(C.errors().length === 0, `sin errores de JavaScript ${JSON.stringify(C.errors().slice(0, 3))}`);

  console.log('\nJuegos por temas: /jugar y /jenga');
  const T = await L.newPage('profesor', 1440, 900);
  await T.go('/jugar?temas=dativ,akkusativ');
  await T.until(`!!document.querySelector('.game-setup .home-card .btn.primary')`, '/jugar');
  ok(await T.eval(`document.querySelectorAll('.game-setup .chips .btn[aria-pressed=true]').length === 2`), '/jugar?temas= preselecciona 2 temas');
  await T.click('.game-setup .home-card .btn.primary');
  await T.until(`/^\\/t\\/[A-Z0-9]{4}$/.test(location.pathname) && !!document.querySelector('.lobby-code')`, 'lobby BlackCard');
  ok(await T.eval(`/Dativ/.test(document.querySelector('.lobby-topics')?.textContent ?? '')`), 'el lobby muestra los temas de la sala');
  const code = await T.eval(`document.querySelector('.lobby-code').textContent`);
  const P = await L.newPage('jugador', 1280, 800);
  await P.go(`/?sala=${code}`);
  await P.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'invitación');
  ok(await P.eval(`document.querySelector('input[aria-label="Código de sala"]').value === ${JSON.stringify(code)}`), '/?sala=CODE sigue rellenando el código');
  await P.type('input[aria-label="Tu nombre"]', 'Ana');
  await P.click('form.home-card .btn.primary');
  await P.until(`!!document.querySelector('#my-score')`, 'alumno dentro');
  await T.until(`!document.querySelector('.lobby .btn.primary.xl')?.disabled`, 'botón empezar');
  await T.click('.lobby .btn.primary.xl');
  await T.until(`globalThis.__bcNet.state.view.phase === 'intro'`, 'intro');
  ok(await T.eval(`globalThis.__bcNet.state.view.block === 'warmup'`), 'BlackCard por temas sin lectura empieza por el Calentamiento');
  await T.eval(`globalThis.__bcNet.request({t:'ctl', a:{k:'block', block:'r2'}})`);
  await T.until(`globalThis.__bcNet.state.view.phase === 'intro' && globalThis.__bcNet.state.view.block === 'r2'`, 'r2');
  await T.eval(`globalThis.__bcNet.request({t:'ctl', a:{k:'next'}})`);
  await T.until(`globalThis.__bcNet.state.view.phase === 'question'`, 'pregunta r2');
  const t1 = await T.eval(`globalThis.__bcNet.state.view.q.topic`);
  ok(['dativ', 'akkusativ'].includes(t1), `pregunta de la Grammar Arena del tema elegido (${t1})`);
  await T.shot('blackcard-topics');

  const T2 = await L.newPage('profesor-jenga', 1440, 900);
  await T2.go('/jenga?temas=perfekt');
  await T2.until(`!!document.querySelector('.game-setup .home-card .btn.primary')`, '/jenga');
  ok(await T2.eval(`/WORT-JENGA/.test(document.querySelector('.home-title').textContent)`), '/jenga muestra la preparación del Wort-Jenga');
  await T2.click('.game-setup .home-card .btn.primary');
  await T2.until(`/^\\/t\\/[A-Z0-9]{4}$/.test(location.pathname) && !!document.querySelector('.lobby-code')`, 'lobby Jenga');
  const code2 = await T2.eval(`document.querySelector('.lobby-code').textContent`);
  const P2 = [await L.newPage('j1', 1280, 800), await L.newPage('j2', 1280, 800)];
  for (const [i, p] of P2.entries()) {
    await p.go('/jenga');
    await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'form alumno jenga');
    await p.type('input[aria-label="Código de sala"]', code2);
    await p.type('input[aria-label="Tu nombre"]', `J${i + 1}`);
    await p.click('form.home-card .btn.primary');
    await p.until(`!!document.querySelector('#my-score')`, 'alumno jenga dentro');
  }
  await T2.until(`!document.querySelector('.lobby .btn.primary.xl')?.disabled && /Wort-Jenga/.test(document.querySelector('.lobby .btn.primary.xl').textContent)`, 'botón Empezar Wort-Jenga');
  await T2.click('.lobby .btn.primary.xl');
  await T2.until(`globalThis.__bcNet.state.view.phase === 'task' && globalThis.__bcNet.state.view.task?.kind === 'jenga'`, 'Jenga directo', 10000);
  ok(true, 'del lobby directo a la torre de Wort-Jenga');
  const topics = [];
  for (let k = 0; k < 5; k++) {
    const v = await T2.state();
    if (v.task.q) topics.push(v.task.q.topic);
    await T2.eval(`globalThis.__bcNet.request({t:'ctl', a:{k:'task', op:'skip'}})`);
    await sleep(200);
  }
  ok(topics.length > 0 && topics.every((t) => t === 'perfekt'), `preguntas del Jenga del tema elegido (${topics.join(',')})`);
  for (const p of P2) await p.until(`!!document.querySelector('.jenga')`, 'torre visible en el alumno');
  await P2[0].shot('jenga-student');
  await T2.shot('jenga-teacher');
  for (const p of [T, P, T2, ...P2]) ok(p.errors().length === 0, `${p.label}: sin errores de JavaScript ${JSON.stringify(p.errors().slice(0, 2))}`);
} catch (e) {
  failures++;
  console.error('  ✘ ERROR', e.message);
  for (const p of L.pages ?? []) await p.shot(`error-${p.label}`).catch(() => {});
}
await L.close();
console.log(failures ? `\n${failures} fallo(s)` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
