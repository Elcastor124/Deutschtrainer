// Hörverstehen 001 en navegadores reales: profesor + dos alumnos (contextos aislados) y modo práctica.
// node scripts/horen-ui.mjs   (compila antes: npm run build). Capturas en shots/horen/.
import { launch, sleep } from './cdp.mjs';

const ok = (c, m) => { if (!c) throw new Error(`FALLO: ${m}`); console.log(`✓ ${m}`); };
const { base, newPage, close } = await launch({ shots: 'shots/horen' });
const SECRET_PROBES = ['Der nächste Bus fährt um zwanzig nach acht', 'Sein Fahrrad war kaputt', 'Lösung'];
try {
  // ── Lobby / hub ──
  const T = await newPage('profesor', 1440, 900);
  await T.go('/examenes'); await T.until(`[...document.querySelectorAll('.ex-block h2')].some(h=>h.textContent.includes('Hörverstehen 001'))`, 'hub con Hörverstehen');
  await T.click('a[href="/examenes/horen-001"]'); await T.until(`!!document.querySelector('[data-horen-create]')`, 'pantalla de elección');
  await T.click('[data-horen-create]'); await T.until(`!!document.querySelector('[data-horen-start]')`, 'panel del profesor');
  const code = await T.eval(`document.querySelector('.hv-sub .hv-dot').textContent`);
  ok(/^[A-F0-9]{6}$/.test(code), `sala creada ${code}`);
  ok(await T.eval(`!document.querySelector('.hv-error')`), 'las 10 pistas de audio están en el servidor');
  ok(await T.eval(`document.querySelector('[data-horen-start]').disabled`), 'no se puede empezar sin alumnos');

  const students = [];
  for (const [name, w, h, mob] of [['Ana', 1280, 800, false], ['Ben', 390, 844, true]]) {
    const S = await newPage(name, w, h, mob);
    await S.go(`/examenes/horen-001?code=${code}`); await S.until(`!!document.querySelector('[data-horen-name]')`, `${name}: formulario`);
    await S.type('[data-horen-name]', name);
    await S.click('[data-horen-join]'); await S.until(`document.querySelector('[data-horen-mode]')?.dataset.horenMode==='player'`, `${name}: dentro`);
    await S.click('[data-horen-arm]');
    students.push(S);
  }
  await T.until(`document.querySelectorAll('[data-horen-student]').length===2`, 'el profesor ve a los dos alumnos');
  await T.shot('01-teacher-lobby');
  await students[0].shot('02-student-lobby');

  // ── Start: everybody moves to Teil 1, step "instruction" (audio), synchronised by server clock ──
  await T.click('[data-horen-start]');
  for (const S of students) await S.until(`document.querySelector('[data-horen-status]')?.dataset.horenStatus==='running'`, `${S.label}: examen en marcha`);
  ok(await students[0].eval(`document.querySelectorAll('[data-horen-q]').length===6`), 'alumno ve las 6 preguntas de Teil 1');
  // Simultaneous answers from both devices.
  await Promise.all([students[0].click('[data-horen-q="q1"] [data-horen-opt="B"]'), students[1].click('[data-horen-q="q1"] [data-horen-opt="A"]')]);
  await students[0].click('[data-horen-q="q2"] [data-horen-opt="B"]');
  await T.until(`[...document.querySelectorAll('[data-horen-student]')].map(e=>e.querySelector('header .hv-dot').textContent).join()==='2/30,1/30'`, 'progreso individual en el panel del profesor', 6000);
  for (const S of students) { const html = await S.eval('document.body.innerText'); ok(!SECRET_PROBES.some((p) => html.includes(p)), `${S.label}: sin transcripción ni soluciones durante el examen`); }

  // Teacher jumps to the first listening; student audio element must be playing that track, in sync.
  await T.click('[data-horen-next]');
  await students[0].until(`document.querySelector('[data-horen-step]')?.dataset.horenStep==='read'`, 'paso lectura');
  await T.click('[data-horen-next]');
  await students[0].until(`document.querySelector('[data-horen-step]')?.dataset.horenStep==='listen1'`, 'paso 1. Hören');
  await sleep(2500);
  const playing = await Promise.all(students.map((S) => S.eval(`(()=>{const a=[...document.querySelectorAll('audio')];return performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/horen/audio?id=a1')).length})()`)));
  ok(playing.every((n) => n > 0), 'los dos alumnos cargan la pista a1 en 1. Hören');
  await students[1].shot('03-student-mobile-listen1');
  await T.shot('04-teacher-running');

  // Pause freezes the clock for everyone and blocks answers.
  await T.click('[data-horen-pause]');
  await students[0].until(`document.querySelector('[data-horen-status]')?.dataset.horenStatus==='paused'`, 'pausa propagada');
  const c1 = await students[0].eval(`document.querySelector('[data-horen-clock]').textContent`); await sleep(2200);
  const c2 = await students[0].eval(`document.querySelector('[data-horen-clock]').textContent`);
  ok(c1 === c2, `reloj congelado en pausa (${c1})`);
  ok(await students[0].eval(`document.querySelector('[data-horen-q="q3"] [data-horen-opt="B"]').disabled`), 'respuestas bloqueadas en pausa');
  await T.click('[data-horen-resume]');
  await students[0].until(`document.querySelector('[data-horen-status]')?.dataset.horenStatus==='running'`, 'reanudado');

  // Finish: answers locked, score /20 and review with transcript evidence.
  await T.eval(`window.confirm=()=>true`);
  await T.click('[data-horen-end]');
  for (const S of students) await S.until(`document.querySelector('[data-horen-status]')?.dataset.horenStatus==='finished'`, `${S.label}: terminado`);
  await students[0].until(`!!document.querySelector('[data-horen-score]')`, 'nota del alumno');
  ok(await students[0].eval(`document.querySelector('[data-horen-score]').dataset.horenScore==='2'`), 'Ana: 2/30 (q1 B y q2 B correctas)');
  ok(await students[0].eval(`document.querySelector('.hv-big .hv-dot').textContent==='1,3'`), 'Ana: nota 1,3/20');
  ok(await students[0].eval(`document.body.innerText.includes('Der nächste Bus fährt um zwanzig nach acht')`), 'revisión con la frase del audio');
  ok(await students[1].eval(`document.querySelector('[data-horen-score]').dataset.horenScore==='0'`), 'Ben: 0/30');
  await T.until(`!!document.querySelector('[data-horen-analysis]')`, 'análisis por pregunta del profesor');
  await students[0].shot('05-student-review');
  await T.shot('06-teacher-analysis');

  // ── Practice mode ──
  const P = await newPage('practica', 1280, 800);
  await P.go('/examenes/horen-001?modo=practica'); await P.until(`!!document.querySelector('[data-horen-play]')`, 'práctica cargada');
  await P.click('[data-horen-play]'); await sleep(1500);
  ok(await P.eval(`performance.getEntriesByType('resource').some(r=>r.name.includes('id=a1'))`), 'práctica: el alumno reproduce Teil 1');
  ok(await P.eval(`document.querySelectorAll('.hv-leds i.on').length===1`), 'práctica: LED de 1. escucha');
  await P.click('[data-horen-q="q1"] [data-horen-opt="B"]');
  await P.eval(`window.confirm=()=>true`);
  await P.click('[data-horen-finish]');
  await P.until(`!!document.querySelector('[data-horen-score]')`, 'práctica: nota al terminar');
  ok(await P.eval(`document.querySelector('[data-horen-score]').dataset.horenScore==='1'`), 'práctica: 1/30 corregida en servidor');
  ok(await P.eval(`!document.querySelector('.hv-player .dt-btn-ghost') && document.querySelector('[data-horen-play]').disabled`), 'práctica: al terminar el audio se detiene y se bloquea');
  await P.shot('07-practice-result');
  const errs = [T, ...students, P].flatMap((p) => p.errors().map((e) => `${p.label}: ${e}`));
  ok(errs.length === 0, `sin errores JS ${errs.join(' | ')}`);
  console.log('HOREN UI OK');
} finally { await close(); }
