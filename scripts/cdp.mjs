// Mini cliente CDP para pruebas con navegadores reales: Edge/Chrome headless, contextos aislados por alumno.
// Lo usan scripts/ui.mjs y los escenarios de scripts/scene.mjs.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);

async function waitHttp(url) {
  for (let i = 0; i < 80; i++) { try { const r = await fetch(url); if (r.ok) return r; } catch { /* aún no */ } await sleep(200); }
  throw new Error(`no responde ${url}`);
}

/**
 * Arranca un servidor de juego (salvo que se pase base) y un navegador headless.
 * Devuelve { base, newPage, errors, close }.
 */
export async function launch({ shots = 'shots', base } = {}) {
  const SHOTS = resolve(shots);
  mkdirSync(SHOTS, { recursive: true });
  const port = 4100 + Math.floor(Math.random() * 80);
  const dbg = 9600 + Math.floor(Math.random() * 80);
  const BASE = base ?? `http://127.0.0.1:${port}`;
  const data = mkdtempSync(join(tmpdir(), 'bc-ui-'));
  const profile = mkdtempSync(join(tmpdir(), 'bc-edge-'));
  const server = base ? null : spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'],
    { env: { ...process.env, PORT: String(port), DATA_DIR: data }, stdio: 'ignore' });
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });

  await waitHttp(`${BASE}/api/health`);
  const ver = await (await waitHttp(`http://127.0.0.1:${dbg}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let seq = 0;
  const pending = new Map();
  const pageErrors = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.get(m.sessionId)?.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.get(m.sessionId)?.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}, sessionId) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((res, rej) => pending.set(id, { res, rej, method }));
  };

  // Nota: «eval» es solo un envoltorio de Runtime.evaluate (CDP) sobre las páginas de esta prueba.
  class Page {
    constructor(label, sid, w, h, touch) { this.label = label; this.sid = sid; this.w = w; this.h = h; this.touch = touch; pageErrors.set(sid, []); }
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
    reload() { return send('Page.reload', {}, this.sid); }
    state() { return this.eval('globalThis.__bcNet?.state?.view ?? null'); }
    /** Centro del elemento, esperando a que deje de moverse (desplazamientos suaves, animaciones de entrada). */
    async rect(sel, i = 0) {
      const measure = () => this.eval(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!e) return null; const r=e.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) { e.scrollIntoView({block:'center', behavior:'instant'}); } const q=e.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()`);
      let a = await measure();
      for (let k = 0; k < 12 && a; k++) {
        await sleep(60);
        const b = await measure();
        if (b && Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1) return b;
        a = b;
      }
      return a;
    }
    /** Elemento que de verdad recibiría un clic en el centro de sel[i] (para detectar capas que tapan). */
    hitTest(sel, i = 0) {
      return this.eval(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!e) return 'missing'; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return h===e||e.contains(h)?'ok':(h?h.tagName+'.'+h.className:'none')})()`);
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
    async hover(sel, i = 0) {
      const p = await this.rect(sel, i);
      if (p) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }, this.sid);
      await sleep(60);
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
    errors() { return pageErrors.get(this.sid).filter((e) => !/WebSocket|ERR_CONNECTION|favicon/.test(e)); }
  }

  async function newPage(label, w, h, mobile = false) {
    const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }, sessionId);
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
    return new Page(label, sessionId, w, h, mobile);
  }

  async function close() {
    try { ws.close(); } catch { /* ignorar */ }
    edge.kill();
    server?.kill();
    await sleep(600);
    for (const d of [data, profile]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* Edge puede tardar en soltarlo */ } }
  }

  return { base: BASE, shots: SHOTS, newPage, send, close };
}

/** Crea una sala desde la interfaz del profesor y mete a los alumnos por la portada. Devuelve el código. */
export async function openRoom(T, students) {
  await T.go('/');
  await T.until(`!!document.querySelector('.home-card .btn.primary')`, 'home');
  await T.click('.home-card .btn.primary');
  await T.until(`/^\\/t\\/[A-Z0-9]{4}$/.test(location.pathname) && !!document.querySelector('.lobby-code')`, 'lobby');
  const code = await T.eval(`document.querySelector('.lobby-code').textContent`);
  for (const [p, name] of students) {
    await p.go('/');
    await p.until(`!!document.querySelector('input[aria-label="Código de sala"]')`, 'home');
    await p.type('input[aria-label="Código de sala"]', code);
    await p.type('input[aria-label="Tu nombre"]', name);
    await p.click('form.home-card .btn.primary');
    await p.until(`!!document.querySelector('#my-score')`, 'dentro de la sala');
  }
  return code;
}
