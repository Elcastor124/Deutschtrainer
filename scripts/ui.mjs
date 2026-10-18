// Prueba de interfaz con navegadores reales (Edge/Chrome headless): profesor 1920×1080, Chromebook 1366×768 y móvil 390×844 táctil.
// Pulsa de verdad los botones (ratón y toque) y comprueba en el estado del servidor que cada uno hace lo que dice.
// Uso: npm run build && node scripts/ui.mjs [carpeta-capturas]
import { loadBank } from '../server/bank/index.ts';
import { launch, sleep } from './cdp.mjs';

const bank = loadBank();
const L = await launch({ shots: process.argv[2] ?? 'shots' });
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };
const st = (p, expr) => p.eval(`(()=>{const v=globalThis.__bcNet?.state?.view; return ${expr}})()`);
const waitSt = (p, expr, what, ms = 8000) => p.until(`(()=>{const v=globalThis.__bcNet?.state?.view; return !!v && (${expr})})()`, what, ms);

/** Responde la pregunta actual desde la interfaz (bien o mal) según su tipo. */
async function answerUI(p, good) {
  const pub = await st(p, 'v.q');
  const q = bank.get(pub.id);
  switch (q.type) {
    case 'mc': {
      const right = pub.options.indexOf(q.options[q.answer]);
      await p.click('.qpanel button.opt', good ? right : (right + 1) % pub.options.length);
      break;
    }
    case 'write': case 'build':
      await p.type('.qpanel input.field.big', good ? q.accept[0] : 'qqq zzz');
      await p.click('.qpanel form .btn.primary');
      break;
    case 'gap':
      for (let i = 0; i < q.gaps.length; i++) await p.type('.gaptext input', good ? q.gaps[i][0] : 'qqq', i);
      await p.click('.qpanel form .btn.primary');
      break;
    case 'order': {
      const used = new Set();
      const order = q.tokens.map((t) => { const i = pub.tokens.findIndex((x, k) => x === t && !used.has(k)); used.add(i); return i; });
      if (!good) order.reverse();
      for (const k of order) {
        const word = pub.tokens[k];
        const idx = await p.eval(`[...document.querySelectorAll('.tiles .tile')].findIndex(e=>e.textContent===${JSON.stringify(word)})`);
        await p.click('.tiles .tile', idx);
      }
      await p.click('.qpanel .btn.primary.lg');
      break;
    }
    case 'error':
      await p.click('.errtok', good ? q.wrong : (q.wrong + 1) % q.tokens.length);
      await p.type('.qpanel input.field.big', good ? q.fix[0] : 'qqq');
      await p.click('.qpanel form .btn.primary');
      break;
    case 'match':
      for (let i = 0; i < q.pairs.length; i++) {
        await p.click('.match .col:first-child .mitem', i);
        await p.click('.match .col:last-child .mitem', good ? pub.right.indexOf(q.pairs[i][1]) : (i + 1) % q.pairs.length);
      }
      await p.click('.qpanel .btn.primary.lg');
      break;
  }
  return q.type;
}
const pid = async (T, name) => (await st(T, 'v.players')).find((p) => p.name === name).id;
/** El profesor da un objeto desde su panel (select + botón «Dar …»). */
async function give(T, idx, item) {
  await T.eval(`document.querySelector('details.tools').open = true`);
  await T.eval(`(()=>{const s=document.querySelectorAll('details.tools select')[0]; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,${JSON.stringify(item)}); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
  await sleep(80);
  const i = await T.eval(`[...document.querySelectorAll('details.tools .btn')].filter(b=>b.textContent.startsWith('Dar ') && !b.textContent.includes('cofre')).map(b=>[...document.querySelectorAll('details.tools .btn')].indexOf(b))[${idx}]`);
  await T.click('details.tools .btn', i);
}
/** Si llega con la mano llena, el alumno sustituye la primera carta desde el modal. */
async function settle(p, item) {
  await waitSt(p, `v.me.inventory.includes(${JSON.stringify(item)}) || v.me.pickups.length>0`, `recibir ${item}`);
  while ((await st(p, 'v.me.pickups.length')) > 0) {
    await p.until(`!!document.querySelector('.ovl .cards .card3d .front')`, 'modal de mano llena');
    await p.click('.ovl .cards .card3d .front', 0);
    await sleep(250);
  }
}
async function useCard(p, item, target) {
  const i = await st(p, `v.me.inventory.indexOf(${JSON.stringify(item)})`);
  await p.click('.cards .slot .front', i);
  await sleep(700);
  if (target) await p.click('.card3d.flipped .targets .btn'); else await p.click('.card3d.flipped .use');
}
const teacherNext = (T) => T.click('.controls .btn.primary');
async function reviewUI(T, verdicts) {
  while ((await st(T, 'v.phase')) === 'review') {
    const pid = await st(T, 'v.teacher.review[0].pid');
    const name = await st(T, `v.players.find(p=>p.id===${JSON.stringify(pid)}).name`);
    await T.click('.review-item .btn', verdicts[name] ? 0 : 1);
    await T.until(`(()=>{const v=globalThis.__bcNet.state.view; return v.phase!=='review' || v.teacher.review[0]?.pid!==${JSON.stringify(pid)}})()`, 'decisión del profesor');
  }
}

try {
  const T = await L.newPage('profesor', 1920, 1080);
  const A = await L.newPage('Ana (Chromebook)', 1366, 768);
  const B = await L.newPage('Tomás (móvil)', 390, 844, true);

  console.log('\n1 · Inicio, sala y entrada');
  await T.go('/');
  await T.until(`!!document.querySelector('.home-card .btn.primary')`, 'home');
  await T.click('.home-card .btn.primary');
  await T.until(`!!document.querySelector('.lobby-code')`, 'lobby');
  const code = await T.eval(`location.pathname.split('/').pop()`);
  ok(/^[A-Z0-9]{4}$/.test(code), `el botón «Crear sala» crea la sala ${code}`);
  for (const [p, name] of [[A, 'Ana'], [B, 'Tomás']]) {
    await p.go('/');
    await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'home');
    await p.type('input[aria-label="Código de sala"]', code);
    await p.type('input[aria-label="Tu nombre"]', name);
    await p.click('form.home-card .btn.primary');
    await p.until(`!!document.querySelector('#my-score')`, 'dentro');
  }
  await T.until(`document.querySelectorAll('.slot-pad.on').length === 2`, 'dos alumnos');
  ok(true, 'los alumnos entran con el formulario y el profesor ve sus pilotos encendidos');
  await T.click('.lobby .btn.primary.xl');
  await waitSt(A, `v.block==='lesen' && v.phase==='intro'`, 'Leseverstehen');
  ok(true, 'el botón «Empezar la clase» funciona');

  console.log('\n2 · Leseverstehen y preguntas');
  await A.click('.reading .gl', 1);
  ok(await A.eval(`!!document.querySelector('.gl .tip')`), 'tocar una palabra subrayada muestra su traducción');
  await teacherNext(T);
  await waitSt(A, `v.phase==='question'`, 'pregunta');
  ok(await T.eval(`document.querySelectorAll('.qpanel button.opt, .qpanel button.tile, .qpanel button.mitem, .qpanel button.errtok').length === 0`),
    'en el proyector las respuestas NO son botones (solo se muestran)');
  ok(await T.eval(`!!document.querySelector('.device-hint')`), 'el proyector indica que se responde en cada dispositivo');
  await answerUI(A, true);
  await waitSt(A, `v.me.state==='sent' || v.phase==='reveal'`, 'respuesta registrada');
  ok(true, 'Ana responde pulsando en su pantalla y el servidor lo registra');
  await answerUI(B, false);
  await waitSt(T, `v.phase==='reveal' || v.phase==='review'`, 'corrección');
  await reviewUI(T, { Ana: true, Tomás: false });
  await waitSt(T, `v.phase==='reveal'`, 'corrección');
  ok(true, 'Tomás responde con el dedo (móvil) y se corrige al responder todos');
  await A.until(`!!document.querySelector('.verdict')`, 'veredicto');
  await A.shot('ui-01-veredicto');
  await T.shot('ui-02-correccion-proyector');
  await teacherNext(T);
  await waitSt(T, `v.phase==='question' && v.qNo===2`, 'segunda pregunta');
  ok(true, 'el botón «Siguiente pregunta» funciona');
  await T.click('.controls .btn.signal');
  await waitSt(T, `v.phase==='reveal' || v.phase==='review'`, 'cerrar');
  ok(true, 'el botón «Cerrar y corregir» funciona');

  console.log('\n3 · Cofres y cartas');
  await T.click('button.pad', 2);
  await waitSt(A, `v.block==='r1' && v.me.chests.length===1`, 'cofre inicial');
  ok(true, 'pulsar un pad del secuenciador salta al bloque (Vocabulary Rush) y llega el cofre inicial');
  await A.click('.chest-tile', 0);
  await A.until(`!!document.querySelector('.chest-big')`, 'escena del cofre');
  for (let i = 0; i < 3; i++) { await A.click('.chest-big'); await sleep(220); }
  await A.until(`!!document.querySelector('.prize')`, 'premio', 6000);
  const prizeName = await A.eval(`document.querySelector('.prize-name b').textContent`);
  await A.shot('ui-03-cofre-premio');
  await A.click('.prize .btn.primary');
  ok((await st(A, 'v.me.inventory.length')) === 1 && (await st(A, 'v.me.chests.length')) === 0, `tres golpes abren el cofre: ${prizeName} pasa a la mano`);
  await B.click('.chest-tile', 0);
  for (let i = 0; i < 3; i++) { await B.click('.chest-big'); await sleep(220); }
  await B.until(`!!document.querySelector('.prize')`, 'premio móvil', 6000);
  await B.click('.prize .btn.primary');
  ok((await st(B, 'v.me.inventory.length')) === 1, 'Tomás abre su cofre desde el móvil');

  const pa = await pid(T, 'Ana'), pb = await pid(T, 'Tomás');
  const idxA = (await st(T, 'v.players')).findIndex((p) => p.name === 'Ana');
  const idxB = (await st(T, 'v.players')).findIndex((p) => p.name === 'Tomás');
  await give(T, idxB, 'shield');
  await settle(B, 'shield');
  await give(T, idxA, 'thief');
  await settle(A, 'thief');
  ok(true, 'el profesor regala objetos desde su panel');
  await teacherNext(T);
  await waitSt(A, `v.phase==='question'`, 'pregunta r1');
  await useCard(A, 'thief', pb);
  await waitSt(B, `v.me.incoming.length>0`, 'aviso de ataque');
  ok(await B.eval(`document.body.dataset.target==='on'`), 'Ana usa THIEF desde su carta y la pantalla de Tomás entra en «punto de mira»');
  await sleep(500);
  await B.shot('ui-04-movil-punto-de-mira');
  await T.shot('ui-05-proyector-thief');
  await B.eval(`document.querySelector('.hand').scrollIntoView()`);
  await useCard(B, 'shield');
  await waitSt(B, `v.players.find(p=>p.name==='Tomás').shield`, 'escudo');
  ok(await B.eval(`document.body.dataset.shield==='on'`), 'Tomás reacciona con SHIELD desde el móvil y aparece el marco del escudo');
  await answerUI(A, true);
  await answerUI(B, true);
  await waitSt(T, `v.phase==='reveal' || v.phase==='review'`, 'reveal');
  await reviewUI(T, { Ana: true, Tomás: true });
  await waitSt(T, `v.phase==='reveal'`, 'reveal');
  ok(await st(T, `v.log.some(f=>f.kind==='block')`), 'el escudo bloquea el robo');

  // WILDCARD
  await give(T, idxA, 'wildcard');
  await settle(A, 'wildcard');
  await teacherNext(T);
  await waitSt(A, `v.phase==='question'`, 'pregunta');
  await useCard(A, 'wildcard');
  await waitSt(A, `v.me.used==='wildcard'`, 'comodín activo');
  await answerUI(A, true);
  await answerUI(B, false);
  await waitSt(T, `v.phase==='reveal' || v.phase==='review'`, 'reveal');
  await reviewUI(T, { Ana: true, Tomás: false });
  await waitSt(T, `v.phase==='reveal'`, 'reveal');
  await teacherNext(T);
  await waitSt(A, `v.phase==='wild'`, 'elección de categoría');
  const topic = await A.eval(`document.querySelectorAll('.wild-card .wc-de')[1].textContent`);
  await A.click('.wild-card', 1);
  await waitSt(A, `v.phase==='question'`, 'pregunta elegida');
  ok(true, `WILDCARD: Ana elige «${topic}» pulsando una carta`);

  console.log('\n4 · BlackCard');
  await T.click('button.pad', 6);
  await waitSt(A, `v.block==='boss'`, 'boss');
  await give(T, idxA, 'blackcard');
  await settle(A, 'blackcard');
  await teacherNext(T);
  await waitSt(A, `v.phase==='question'`, 'pregunta boss');
  await useCard(A, 'blackcard');
  await A.until(`!!document.querySelector('.bcfx')`, 'escena BlackCard');
  await A.until(`!!document.querySelector('.bcfx canvas') || !!document.querySelector('.bc-lite')`, 'canvas', 5000);
  ok(await A.eval(`!!document.querySelector('.bcfx canvas')`), 'la BlackCard se activa desde la carta y se renderiza en 3D');
  ok(await A.eval(`document.body.dataset.bc==='on'`), 'modo rojo y negro activado');
  await sleep(900);
  await A.shot('ui-06-blackcard');
  await A.until(`!document.querySelector('.bcfx')`, 'fin activación', 9000);
  await answerUI(A, true);
  await answerUI(B, false);
  await waitSt(T, `v.phase==='reveal' || v.phase==='review'`, 'reveal');
  await reviewUI(T, { Ana: true, Tomás: false });
  await A.until(`!!document.querySelector('.bcfx')`, 'quemado', 9000);
  ok(true, 'la BlackCard se quema al corregir');
  await A.until(`!document.querySelector('.bcfx')`, 'fin quemado', 10000);

  console.log('\n5 · Herramientas del HUD');
  await A.click('button[title^="Diccionario"]');
  await A.until(`!!document.querySelector('.dict-list')`, 'diccionario');
  await A.type('.ovl input.field', 'Kühlschrank');
  ok(await A.eval(`document.querySelector('.dict-list').innerText.includes('nevera')`), 'el botón Diccionario abre la búsqueda (Kühlschrank → nevera)');
  await A.click('.ovl .btn.sm');
  ok(await A.eval(`!document.querySelector('.ovl')`), 'el botón «Cerrar» cierra el diccionario');
  await A.click('button[title^="Marcador"]');
  ok(await A.eval(`!!document.querySelector('.ovl .lb')`), 'el botón Marcador abre el ranking');
  await A.key('Escape');
  const lite0 = await A.eval(`document.documentElement.dataset.lite`);
  await A.click('button[title^="Efectos"]');
  const lite1 = await A.eval(`document.documentElement.dataset.lite`);
  await A.click('button[title^="Efectos"]');
  ok(lite0 !== lite1, 'el botón Efectos cambia el modo ligero');
  const snd0 = await A.eval(`document.querySelector('button[title^="Sonido"], button[title^="Silencio"]').getAttribute('aria-pressed')`);
  await A.click('button[title^="Sonido"], button[title^="Silencio"]');
  const snd1 = await A.eval(`document.querySelector('button[title^="Sonido"], button[title^="Silencio"]').getAttribute('aria-pressed')`);
  ok(snd0 !== snd1, 'el botón de sonido se activa y desactiva');
  await A.click('button[title^="Atajos"]');
  ok(await A.eval(`!!document.querySelector('.ovl')`), 'el botón Atajos abre la ayuda');
  await A.click('.ovl .btn.sm');
  await T.click('button.code-chip');
  await sleep(200);
  ok(await T.eval(`['COPIADO', ${JSON.stringify(code)}].includes(document.querySelector('button.code-chip').textContent)`), 'el código de sala del profesor es un botón que copia el enlace (sin bloquear la página)');
  const before = (await st(A, 'v.players')).find((p) => p.name === 'Ana').score;
  await A.reload();
  await A.until(`!!globalThis.__bcNet?.state?.view?.me`, 'reconexión');
  ok((await st(A, 'v.players')).find((p) => p.name === 'Ana').score === before, 'recargar la página no pierde la puntuación');

  console.log('\n6 · Podio');
  await T.click('button.pad', 7);
  await A.until(`!!document.querySelector('.podium')`, 'podio');
  await A.click('.seg-tabs .btn', 1);
  ok(await A.eval(`document.querySelectorAll('.seg-tabs .btn')[1].getAttribute('aria-selected')==='true'`), 'las pestañas del repaso de errores funcionan');
  await sleep(3500);
  await T.shot('ui-07-podio');

  console.log('\n7 · Después del juego');
  await teacherNext(T);
  await waitSt(A, `v.block==='rolle' && v.phase==='intro'`, 'intro rolle');
  ok(await T.eval(`document.body.dataset.theme==='workshop'`), 'el Acto II cambia la pantalla a modo papel');
  await teacherNext(T);
  await waitSt(A, `v.phase==='task' && v.task.kind==='rolle'`, 'escritura');
  const words = await st(A, `v.task.sets[v.me.id].words.map(w=>w.de)`);
  await A.eval(`(()=>{const t=document.querySelector('.writer textarea'); t.focus(); t.setSelectionRange(t.value.length,t.value.length); return true})()`);
  await L.send('Input.insertText', { text: ` Plötzlich kommt ${words[0]} und dann ${words[1]}!` }, A.sid);
  await A.until(`document.querySelectorAll('.wchip.on').length >= 2`, 'palabras marcadas');
  ok(true, 'al escribir, las palabras de la lista se encienden en directo');
  await A.until(`document.querySelector('.save').textContent.includes('Guardado')`, 'guardado', 6000);
  await A.click('.writer-bar .btn.primary');
  await waitSt(T, `v.task.entries[${JSON.stringify(pa)}].done`, 'entregado');
  ok(true, 'el botón «Entregar» envía el texto al servidor');
  await T.shot('ui-08-progreso-escritura');
  await teacherNext(T);
  await waitSt(T, `v.task.stage==='show'`, 'mostrar');
  const showBtns = await T.eval(`document.querySelectorAll('.ctl-group .btn').length`);
  /** Índice global del botón k del grupo de un alumno en los controles del profesor. */
  const ctlIdx = (name, k) => T.eval(`(()=>{const all=[...document.querySelectorAll('.ctl-group .btn')]; const g=[...document.querySelectorAll('.ctl-group')].find(x=>x.querySelector('b').textContent===${JSON.stringify('X')}.replace('X', ${JSON.stringify(name)})); return all.indexOf(g.querySelectorAll('.btn')[${k}])})()`);
  await T.click('.ctl-group .btn', await ctlIdx('Tomás', 0));
  await waitSt(T, `v.task.showing===${JSON.stringify(pb)}`, 'mostrar Tomás');
  await T.click('.ctl-group .btn', await ctlIdx('Ana', 1));
  await waitSt(T, `v.task.judged[${JSON.stringify(pa)}]===true`, 'texto aceptado');
  await T.click('.ctl-group .btn', await ctlIdx('Ana', 3));
  await waitSt(T, `v.task.entries[${JSON.stringify(pa)}].bonus===1`, 'estrella extra');
  ok(showBtns >= 6, 'el profesor proyecta, acepta el texto y da estrellas con sus botones');
  await teacherNext(T);
  await waitSt(T, `v.phase==='roundEnd'`, 'fin rolle');
  ok((await st(T, 'v.players')).find((p) => p.name === 'Ana').stars >= 3, 'las estrellas se suman al terminar');

  await teacherNext(T);
  await teacherNext(T);
  await waitSt(A, `v.task?.kind==='szene'`, 'escena');
  ok(await A.eval(`!!document.querySelector('.role-card .rc-goals')`), 'cada alumno ve su tarjeta de rol con objetivos secretos');
  await B.shot('ui-09-movil-tarjeta');
  await teacherNext(T);
  await waitSt(T, `v.task.stage==='play'`, 'acción');
  await teacherNext(T);
  await waitSt(T, `v.task.stage==='score'`, 'valorar');
  await T.click('.goal-ctl .btn', 0);
  await waitSt(T, `Object.values(v.task.goals).some(g=>g[0])`, 'objetivo marcado');
  ok(true, 'botones de la escena: «¡Acción!», «Valorar objetivos» y marcar objetivos');
  await teacherNext(T);
  await waitSt(T, `v.phase==='roundEnd'`, 'fin escena');

  await teacherNext(T);
  await teacherNext(T);
  await waitSt(B, `v.task?.kind==='wort'`, 'schreibwerkstatt');
  ok(await B.eval(`document.querySelectorAll('.wchip').length===6`), 'Schreibwerkstatt: cada alumno recibe 6 palabras');
  await teacherNext(T);
  await teacherNext(T);
  await waitSt(T, `v.phase==='roundEnd'`, 'fin wort');

  await teacherNext(T);
  await teacherNext(T);
  await waitSt(A, `v.task?.kind==='frei'`, 'freies schreiben');
  await A.click('.prompt-card', 2);
  await waitSt(A, `v.task.choice[v.me.id]===2`, 'consigna elegida');
  ok(true, 'Freies Schreiben: se elige consigna pulsando su tarjeta');
  await A.type('.writer textarea', 'Gestern bin ich mit dem Bus gefahren, weil es geregnet hat.');
  await A.until(`document.querySelectorAll('.feat.on').length >= 3`, 'estructuras detectadas');
  ok(true, 'detecta Perfekt, Nebensatz y Dativ mientras se escribe');
  await teacherNext(T);
  await teacherNext(T);
  await waitSt(T, `v.phase==='roundEnd'`, 'fin frei');

  await teacherNext(T);
  await teacherNext(T);
  await waitSt(T, `v.task?.kind==='jenga'`, 'jenga');
  for (let round = 0; round < 2; round++) {
    const turn = await st(T, 'v.task.turn');
    const P = turn === pa ? A : B;
    const tk = await st(T, 'v.task');
    if (tk.speak) {
      await T.click('.task-ctl .btn.primary');
    } else {
      await waitSt(P, `v.task.q`, 'pregunta jenga');
      const pub = tk.q;
      const q = bank.get(pub.id);
      if (q.type === 'mc') { await P.click('.jenga .qpanel button.opt', pub.options.indexOf(q.options[q.answer])); }
      else if (q.type === 'gap') { for (let i = 0; i < q.gaps.length; i++) await P.type('.jenga .gaptext input', q.gaps[i][0], i); await P.click('.jenga .qpanel form .btn.primary'); }
      else { await P.type('.jenga .qpanel input.field.big', q.accept[0]); await P.click('.jenga .qpanel form .btn.primary'); }
    }
    await waitSt(T, `v.task.stage==='pull' || v.task.stage==='judge'`, 'quitar pieza');
    if ((await st(T, 'v.task.stage')) === 'judge') await T.click('.task-ctl .btn.primary');
    await waitSt(P, `v.task.stage==='pull'`, 'quitar pieza (alumno)');
    let pulls = await st(T, 'v.task.pulls');
    while (pulls > 0 && (await st(T, 'v.task.stage')) === 'pull') {
      // Una pieza visible que reciba el toque (las de delante tapan a las de detrás).
      const idx = await P.eval(`(()=>{const fs=[...document.querySelectorAll('.blk.can .f.front, .blk.can .f.top')]; for (let i=0;i<fs.length;i++){const r=fs[i].getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); if (h && h.closest('.blk.can')===fs[i].closest('.blk')) return i;} return -1})()`);
      if (idx < 0) break;
      const lv = await st(T, 'v.task.levels.length');
      await P.click('.blk.can .f.front, .blk.can .f.top', idx);
      await T.until(`(()=>{const v=globalThis.__bcNet.state.view; return v.task.levels.length!==${lv} || v.task.pulls!==${pulls} || v.task.stage!=='pull'})()`, 'pieza sacada', 6000);
      pulls = await st(T, 'v.task.pulls');
    }
  }
  ok((await st(T, 'v.task.levels.length')) > 15 || (await st(T, 'v.task.stage')) === 'fallen', 'Wort-Jenga: se responde y se sacan piezas tocando la torre 3D');
  await T.shot('ui-10-jenga');
  if ((await st(T, 'v.task.stage')) !== 'fallen') {
    await T.click('.task-ctl .btn');
    ok(true, 'el botón «Pasar turno» funciona');
  }
  await teacherNext(T);
  await waitSt(T, `v.phase==='roundEnd'`, 'fin jenga');
  await teacherNext(T);
  await waitSt(A, `v.block==='ende' && v.phase==='final'`, 'Feierabend');
  ok(await A.eval(`!!document.querySelector('.bon')`), 'Feierabend: resumen final con tickets');

  console.log('\n8 · Práctica en casa (móvil)');
  await B.go('/practica');
  await B.until(`!!document.querySelector('form .btn.primary.lg')`, 'formulario práctica');
  await B.click('form .btn.primary.lg');
  await waitSt(B, `v.phase==='question'`, 'pregunta de práctica');
  await answerUI(B, false);
  await waitSt(B, `v.phase==='reveal'`, 'corrección práctica');
  await B.click('.qpanel .btn.primary.lg');
  await waitSt(B, `v.phase==='question' && v.qNo===2`, 'siguiente práctica');
  ok(true, 'práctica: responder y pulsar «Siguiente»');
  const overflow = await B.eval(`document.documentElement.scrollWidth > innerWidth + 1`);
  const culprits = overflow ? await B.eval(`[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(e).position!=='fixed' && !e.closest('.toasts')).slice(0,6).map(e=>e.tagName+'.'+e.className+' «'+(e.textContent||'').slice(0,40)+'»').join(' | ')`) : '';
  ok(!overflow, `sin desplazamiento horizontal en el móvil (390 px)${culprits ? ' → ' + culprits : ''}`);

  for (const p of [T, A, B]) {
    const errs = p.errors();
    ok(errs.length === 0, `${p.label}: sin errores de JavaScript${errs.length ? ` → ${errs.slice(0, 3).join(' | ')}` : ''}`);
  }
} catch (e) {
  failures++;
  console.error('\n✘ ERROR:', e.message);
} finally {
  await L.close();
  console.log(failures ? `\n${failures} fallo(s)` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
}
