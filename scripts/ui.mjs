// Prueba de interfaz con navegadores reales: Edge headless, 3 contextos aislados (profesor + 2 alumnos).
// Juega desde la UI (clics, arrastre, teclado), comprueba errores de consola y guarda capturas.
// Uso: npm run build && node scripts/ui.mjs [carpeta-capturas]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadBank } from '../server/bank/index.ts';

const SHOTS = resolve(process.argv[2] ?? 'shots');
mkdirSync(SHOTS, { recursive: true });
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const PORT = 4100 + Math.floor(Math.random() * 80);
const DBG = 9600 + Math.floor(Math.random() * 80);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = mkdtempSync(join(tmpdir(), 'bc-ui-'));
const PROFILE = mkdtempSync(join(tmpdir(), 'bc-edge-'));
const bank = loadBank();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failures++; };

const server = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: 'ignore' });
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--hide-scrollbars',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

async function waitHttp(url) {
  for (let i = 0; i < 80; i++) { try { const r = await fetch(url); if (r.ok) return r; } catch { /* aún no */ } await sleep(200); }
  throw new Error(`no responde ${url}`);
}

// ── CDP mínimo con sesiones ──
let ws, seq = 0;
const pending = new Map();
const pageErrors = new Map();
function send(method, params = {}, sessionId) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej, method }));
}

// Nota: «eval» es solo un envoltorio de Runtime.evaluate (CDP) sobre las páginas locales de esta prueba.
class Page {
  constructor(label, sid, w, h) { this.label = label; this.sid = sid; this.w = w; this.h = h; pageErrors.set(sid, []); }
  async eval(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, this.sid);
    if (r.exceptionDetails) throw new Error(`${this.label}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }
  async until(expr, what, ms = 8000) {
    const t = Date.now();
    while (Date.now() - t < ms) { try { if (await this.eval(expr)) return; } catch { /* reintenta */ } await sleep(120); }
    throw new Error(`${this.label}: timeout esperando ${what}`);
  }
  go(path) { return send('Page.navigate', { url: BASE + path }, this.sid); }
  state() { return this.eval('globalThis.__bcNet?.state?.view ?? null'); }
  async rect(sel, i = 0) {
    return this.eval(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  }
  async click(sel, i = 0) {
    const p = await this.rect(sel, i);
    if (!p) throw new Error(`${this.label}: no encuentro ${sel}[${i}]`);
    if (this.touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }, this.sid);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, this.sid);
    } else {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }, this.sid);
    }
    await sleep(80);
  }
  async drag(fromSel, fi, toSel) {
    const a = await this.rect(fromSel, fi);
    const b = await this.eval(`(()=>{const r=document.querySelector(${JSON.stringify(toSel)}).getBoundingClientRect();return {x:r.right-12,y:r.top+r.height/2}})()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y }, this.sid);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 }, this.sid);
    for (let k = 1; k <= 8; k++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8, button: 'left' }, this.sid);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 }, this.sid);
    await sleep(80);
  }
  async type(sel, text, i = 0) {
    await this.eval(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; e.focus(); e.select?.(); return true})()`);
    await send('Input.insertText', { text }, this.sid);
    await sleep(40);
  }
  async key(key) {
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key.length === 1 ? key : undefined }, this.sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }, this.sid);
    await sleep(80);
  }
  async shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png' }, this.sid);
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
  }
}

async function newPage(label, w, h, mobile = false) {
  const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }, sessionId);
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
  const page = new Page(label, sessionId, w, h);
  page.touch = mobile;
  return page;
}

/** Responde la pregunta actual desde la interfaz (correcta o incorrecta) según su tipo. */
async function answerUI(p, good, opts = {}) {
  const v = await p.state();
  const pub = v.q;
  const q = bank.get(pub.id);
  switch (q.type) {
    case 'mc': {
      const right = pub.options.indexOf(q.options[q.answer]);
      const idx = good ? right : pub.options.findIndex((_, i) => i !== right);
      if (opts.keyboard) await p.key(String(idx + 1)); else await p.click('.opt', idx);
      break;
    }
    case 'write': case 'build':
      await p.type('input.field.big', good ? q.accept[0] : 'qqq zzz');
      await p.click('form .btn.primary');
      break;
    case 'gap':
      for (let i = 0; i < q.gaps.length; i++) await p.type('.gaptext input', good ? q.gaps[i][0] : 'qqq', i);
      await p.click('.btn.primary');
      break;
    case 'order': {
      const used = new Set();
      const order = q.tokens.map((t) => { const i = pub.tokens.findIndex((x, k) => x === t && !used.has(k)); used.add(i); return i; });
      if (!good) order.reverse();
      // Las fichas pendientes se reindexan al colocarlas: se busca por texto.
      for (let k = 0; k < order.length; k++) {
        const word = pub.tokens[order[k]];
        const idx = await p.eval(`[...document.querySelectorAll('.tiles .tile')].findIndex(e=>e.textContent===${JSON.stringify(word)})`);
        if (k === 0 && opts.drag) await p.drag('.tiles .tile', idx, '.drop');
        else await p.click('.tiles .tile', idx);
      }
      await p.click('.btn.primary.lg');
      break;
    }
    case 'error':
      await p.click('.errtok', good ? q.wrong : (q.wrong + 1) % q.tokens.length);
      await p.type('input.field.big', good ? q.fix[0] : 'qqq');
      await p.click('form .btn.primary');
      break;
    case 'match':
      for (let i = 0; i < q.pairs.length; i++) {
        await p.click('.match .col:first-child .mitem', i);
        await p.click('.match .col:last-child .mitem', good ? pub.right.indexOf(q.pairs[i][1]) : (i + 1) % q.pairs.length);
      }
      await p.click('.btn.primary.lg');
      break;
  }
  return q.type;
}

let T, A, B;
const typesSeen = new Set();
try {
  await waitHttp(`${BASE}/api/health`);
  const ver = await (await waitHttp(`http://127.0.0.1:${DBG}/json/version`)).json();
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.get(m.sessionId)?.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.get(m.sessionId)?.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };

  T = await newPage('profesor', 1920, 1080);
  A = await newPage('Ana (Chromebook)', 1366, 768);
  B = await newPage('Tomás (móvil)', 390, 844, true);

  console.log('\n1 · Inicio, sala y entrada de alumnos');
  await T.go('/');
  await T.until(`!!document.querySelector('.home-title')`, 'home');
  await T.shot('01-home-1920');
  await T.click('.home-card .btn.primary');
  await T.until(`/^\\/t\\/[A-Z0-9]{4}$/.test(location.pathname) && !!document.querySelector('.lobby-code')`, 'lobby');
  const code = await T.eval(`document.querySelector('.lobby-code').textContent`);
  ok(/^[A-Z0-9]{4}$/.test(code), `sala creada: ${code}`);
  for (const [p, name] of [[A, 'Ana'], [B, 'Tomás']]) {
    await p.go('/');
    await p.until(`!!document.querySelector('.home-title')`, 'home');
    await p.type('input[aria-label="Código de sala"]', code);
    await p.type('input[aria-label="Tu nombre"]', name);
    await p.click('form.home-card .btn.primary');
    await p.until(`!!document.querySelector('#my-score')`, 'dentro de la sala');
  }
  await T.until(`document.querySelectorAll('.lb .r').length === 2`, 'dos alumnos en el ranking');
  ok(true, 'los dos alumnos entran desde la interfaz');
  await B.shot('02-alumno-lobby-movil');
  await T.shot('03-profesor-lobby');

  console.log('\n2 · Leseverstehen');
  await T.key(' ');
  await A.until(`!!document.querySelector('.reading .gl')`, 'texto de lectura');
  await A.click('.reading .gl', 3);
  ok(await A.eval(`!!document.querySelector('.gl .tip')`), 'pulsar una palabra subrayada muestra la traducción');
  await A.shot('04-alumno-lectura-chromebook');
  await T.shot('05-profesor-lectura');
  await T.key(' ');
  await A.until(`!!document.querySelector('.qhead')`, 'pregunta');
  await B.until(`!!document.querySelector('.qhead')`, 'pregunta');
  await A.shot('06-alumno-pregunta-lectura');
  typesSeen.add(await answerUI(A, true, { keyboard: true }));
  await A.until(`document.body.innerText.includes('Respuesta recibida') || !!document.querySelector('.verdict')`, 'confirmación del servidor');
  ok(true, 'la confirmación llega del servidor (no es local)');
  typesSeen.add(await answerUI(B, false));
  await A.until(`!!document.querySelector('.verdict')`, 'corrección');
  await sleep(500);
  await A.shot('07-alumno-correccion');
  await B.shot('08-movil-correccion');
  await T.shot('09-profesor-correccion');
  const sv = await T.state();
  ok(sv.players[0].name === 'Ana' && sv.players[0].score > 0, 'ranking: Ana primera con puntos');

  console.log('\n3 · Rondas con objetos: jugar varias preguntas de cada tipo');
  const playBlock = async (block, n, extra) => {
    await T.eval(`document.querySelectorAll('.seq button.step')[${['lesen', 'warmup', 'r1', 'r2', 'r3', 'r4', 'boss', 'final'].indexOf(block)}].click()`);
    await A.until(`globalThis.__bcNet.state.view?.block === ${JSON.stringify(block)} && globalThis.__bcNet.state.view?.phase === 'intro'`, `intro ${block}`);
    for (let i = 0; i < n; i++) {
      await T.key(' ');
      await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta');
      await B.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta');
      if (extra) await extra(i);
      typesSeen.add(await answerUI(A, true, { drag: i === 0 }));
      typesSeen.add(await answerUI(B, i % 2 === 0));
      await T.until(`['reveal','review'].includes(globalThis.__bcNet.state.view?.phase)`, 'corrección');
      if ((await T.state()).phase === 'review') { await T.shot(`10-profesor-revision-${block}`); await T.click('.review-item .btn.primary'); }
      await T.until(`globalThis.__bcNet.state.view?.phase === 'reveal'`, 'reveal');
    }
  };
  await playBlock('r3', 3, async (i) => { if (i === 0) { await A.shot('11-alumno-ordenar'); await B.shot('12-movil-ordenar'); } });
  await A.shot('13-alumno-reveal-satzbau');
  await playBlock('r1', 4, async (i) => { if (i === 1) await T.shot('14-profesor-pregunta-r1'); });

  console.log('\n4 · Objetos desde la interfaz');
  // El profesor da objetos con su panel
  await T.eval(`document.querySelector('details.tools').open = true`);
  const give = async (pi, item) => {
    await T.eval(`(()=>{const s=document.querySelector('details.tools select'); const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,${JSON.stringify(item)}); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
    await sleep(80);
    const idx = await T.eval(`[...document.querySelectorAll('details.tools .btn')].findIndex((b,i,arr)=>b.textContent.startsWith('Dar ') && arr.filter(x=>x.textContent.startsWith('Dar ')).indexOf(b)===${pi})`);
    await T.click('details.tools .btn', idx);
  };
  /** Si el inventario está lleno, el alumno cambia el primer objeto por el nuevo desde el modal. */
  let pickShot = false;
  const settle = async (pg, item) => {
    await pg.until(`(()=>{const m=globalThis.__bcNet.state.view.me; return m.inventory.includes(${JSON.stringify(item)}) || m.pickups.length>0})()`, `recibir ${item}`);
    while ((await pg.state()).me.pickups.length) {
      await pg.until(`!!document.querySelector('.ovl .cards .card3d .front')`, 'modal inventario lleno');
      if (!pickShot) { pickShot = true; await pg.shot('14b-inventario-lleno'); }
      await pg.click('.ovl .cards .card3d .front', 0);
      await sleep(250);
    }
  };
  const aIdx = (await T.state()).players.findIndex((p) => p.name === 'Ana');
  const bIdx = (await T.state()).players.findIndex((p) => p.name === 'Tomás');
  await give(bIdx, 'shield');
  await settle(B, 'shield');
  await give(aIdx, 'thief');
  await settle(A, 'thief');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta');
  const invA = (await A.state()).me.inventory;
  ok(invA.includes('thief'), `Ana tiene THIEF (inventario: ${invA.join(', ')})`);
  const ti = invA.indexOf('thief');
  await A.click('.cards .card3d .front', ti);
  await sleep(650);
  await A.shot('15-alumno-carta-girada');
  await A.click('.card3d.flipped .targets .btn');
  await B.until(`!!document.querySelector('.alert')`, 'aviso de ataque');
  await sleep(500);
  await B.shot('16-movil-ataque-recibido');
  await T.shot('17-profesor-animacion-objeto');
  const shIdx = (await B.state()).me.inventory.indexOf('shield');
  if (shIdx >= 0) {
    await B.eval(`document.querySelector('.tray').scrollIntoView()`);
    await B.click('.cards .card3d .front', shIdx);
    await sleep(650);
    await B.click('.card3d.flipped .use');
  }
  await B.until(`globalThis.__bcNet.state.view.players.find(p=>p.name==='Tomás').shield === true`, 'escudo activo');
  ok(true, 'Tomás activa SHIELD como reacción desde su móvil');
  typesSeen.add(await answerUI(A, true));
  typesSeen.add(await answerUI(B, true));
  await T.until(`globalThis.__bcNet.state.view?.phase === 'reveal'`, 'reveal');
  ok((await T.state()).log.some((f) => f.kind === 'block'), 'el escudo bloquea el robo');

  console.log('\n5 · BlackCard (Final Boss)');
  await T.eval(`document.querySelectorAll('.seq button.step')[6].click()`);
  await A.until(`globalThis.__bcNet.state.view?.block === 'boss'`, 'boss');
  await T.eval(`document.querySelector('details.tools').open = true`);
  await give(aIdx, 'blackcard');
  await settle(A, 'blackcard');
  await T.key(' ');
  await A.until(`globalThis.__bcNet.state.view?.phase === 'question'`, 'pregunta boss');
  await A.shot('18-alumno-boss');
  const bi = (await A.state()).me.inventory.indexOf('blackcard');
  await A.click('.cards .card3d .front', bi);
  await sleep(650);
  await A.click('.card3d.flipped .use');
  await A.until(`!!document.querySelector('.bcfx')`, 'escena BlackCard');
  await A.until(`!!document.querySelector('.bcfx canvas') || !!document.querySelector('.bc-lite')`, 'canvas BlackCard', 4000);
  ok(await A.eval(`!!document.querySelector('.bcfx canvas')`), 'la BlackCard se renderiza en 3D (WebGL)');
  await sleep(900);
  await A.shot('19-blackcard-activacion');
  await T.shot('20-profesor-blackcard-activacion');
  ok(await A.eval(`document.body.dataset.bc === 'on'`), 'modo rojo y negro activado en la pantalla de Ana');
  await A.until(`!document.querySelector('.bcfx')`, 'fin activación', 8000);
  typesSeen.add(await answerUI(A, true));
  typesSeen.add(await answerUI(B, false));
  await T.until(`['reveal','review'].includes(globalThis.__bcNet.state.view?.phase)`, 'corrección');
  if ((await T.state()).phase === 'review') await T.click('.review-item .btn.primary');
  await A.until(`!!document.querySelector('.bcfx')`, 'quemado', 8000);
  await sleep(2200);
  await A.shot('21-blackcard-quemandose');
  await T.shot('22-profesor-blackcard-quemandose');
  await A.until(`!document.querySelector('.bcfx')`, 'fin quemado', 9000);

  console.log('\n6 · Diccionario, marcador, reconexión, pantallas pequeñas');
  await A.key('d');
  await A.until(`!!document.querySelector('.dict-list')`, 'diccionario');
  await A.type('.ovl input.field', 'Notaufnahme');
  ok(await A.eval(`document.querySelector('.dict-list').innerText.includes('urgencias')`), 'el diccionario (tecla D) encuentra «Notaufnahme» → urgencias');
  await A.shot('23-diccionario');
  await A.key('Escape');
  await B.key('p');
  await B.until(`!!document.querySelector('.ovl .lb')`, 'marcador');
  await B.shot('24-movil-marcador');
  await B.key('Escape');
  const before = (await A.state()).players.find((p) => p.name === 'Ana').score;
  await send('Page.reload', {}, A.sid);
  await A.until(`!!globalThis.__bcNet?.state?.view?.me`, 'reconexión tras recargar');
  const after = (await A.state()).players.find((p) => p.name === 'Ana').score;
  ok(after === before && (await A.state()).players.length === 2, `recargar la página no pierde la puntuación (${after})`);
  const overflow = await B.eval(`document.documentElement.scrollWidth > innerWidth + 1`);
  const culprits = overflow ? await B.eval(`[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && !e.closest('.toasts')).slice(0,6).map(e=>e.tagName+'.'+e.className).join(' | ')`) : '';
  ok(!overflow, `sin desplazamiento horizontal en el móvil (390 px)${culprits ? ' → ' + culprits : ''}`);

  console.log('\n7 · Resultados');
  await T.eval(`document.querySelectorAll('.seq button.step')[7].click()`);
  await A.until(`!!document.querySelector('.podium')`, 'podio');
  await sleep(2600);
  await T.shot('25-profesor-final');
  await A.shot('26-alumno-final');
  await B.shot('27-movil-final');

  console.log('\n8 · Modo práctica (móvil)');
  await B.go('/practica');
  await B.until(`!!document.querySelector('.chips')`, 'formulario práctica');
  await B.shot('28-practica-inicio');
  await B.click('form .btn.primary.lg');
  await B.until(`globalThis.__bcNet?.state?.view?.phase === 'question'`, 'pregunta de práctica');
  typesSeen.add(await answerUI(B, false));
  await B.until(`!!document.querySelector('.verdict')`, 'corrección práctica');
  await B.shot('29-practica-correccion');
  ok(true, 'práctica individual: corrección y explicación');

  ok(['mc', 'write', 'gap', 'order', 'error', 'match', 'build'].filter((t) => typesSeen.has(t)).length >= 4, `tipos de ejercicio jugados por la UI: ${[...typesSeen].join(', ')}`);
  for (const p of [T, A, B]) {
    const errs = pageErrors.get(p.sid).filter((e) => !/WebSocket|ERR_CONNECTION|favicon/.test(e));
    ok(errs.length === 0, `${p.label}: sin errores de JavaScript${errs.length ? ` → ${errs.slice(0, 3).join(' | ')}` : ''}`);
  }
} catch (e) {
  failures++;
  console.error('\n✘ ERROR:', e.message);
  for (const [p, n] of [[T, 'x-profesor'], [A, 'x-ana'], [B, 'x-tomas']]) { try { await p?.shot(n); } catch { /* ignorar */ } }
} finally {
  try { ws?.close(); } catch { /* ignorar */ }
  edge.kill();
  server.kill();
  await sleep(600);
  for (const d of [DATA, PROFILE]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* Edge puede tardar en soltarlo */ } }
  console.log(failures ? `\n${failures} fallo(s) · capturas en ${SHOTS}` : `\nTodo correcto · capturas en ${SHOTS}`);
  process.exit(failures ? 1 : 0);
}
