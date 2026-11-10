// Prueba de navegador: modo voz de Redet y conversación sin atascos.
// El navegador de prueba (Edge headless) no tiene micrófono: se sustituye SpeechRecognition por un simulador que
// «dice» frases. Así se prueba el bucle real de la app (escuchar → enviar → Klaus responde → volver a escuchar),
// no el motor de voz de Google/Microsoft (eso solo se puede probar con un micro de verdad).
import { mkdirSync } from 'node:fs';
import { plusAll } from './helpers/plus-browser.mjs';
import { launch, sleep } from '../scripts/cdp.mjs';
const OUT = 'shots/redet-voice'; mkdirSync(OUT, { recursive: true });
const L = await launch({ shots: OUT });
const fails = [];
const waitFor = async (P, js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await P.eval(js)) return true; await sleep(150); } return false; };
const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;
const check = (ok, msg) => { console.log(`${ok ? 'OK ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const FAKE = `(() => {
  window.__said = ['Ich heiße Ana.', 'Ich komme aus Spanien.', 'Ich spiele gern Fußball.'];
  window.__recs = 0;
  class FakeRec {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      window.__recs++; window.__lang = this.lang;
      const phrase = window.__said.shift();
      if (!phrase) return; // nada más que decir: se queda escuchando
      setTimeout(() => {
        this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: phrase }], { isFinal: true })] });
      }, 300);
    }
    stop() { setTimeout(() => this.onend?.(), 20); }
    abort() { this.onresult = null; setTimeout(() => { const e = this.onend; this.onend = null; e?.(); }, 0); }
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  // Voz de Klaus: se simula que termina enseguida (no hay altavoces en la prueba)
  window.speechSynthesis.speak = (u) => { window.__spoken = (window.__spoken || 0) + 1; setTimeout(() => { u.onstart?.(); u.onend?.(); }, 50); };
  return true;
})()`;
try {
  const P = await L.newPage('vc', 1440, 900);
  await L.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE }, P.sid);
  await P.go('/?intro=0'); await sleep(400);
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'Vc'+Date.now().toString(36).slice(-6),password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  check(st === 200, `alta (${st})`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); true`); await plusAll(L.base);
  await P.go('/hablar?intro=0');
  check(await waitFor(P, has('[data-redet-free] .rd-topic')), 'modo libre visible');
  // Conversación libre «En blanco»
  await P.eval(`[...document.querySelectorAll('[data-redet-free] .rd-topic')].at(-1).click(); true`);
  check(await waitFor(P, has('[data-voice-start]')), 'conversación libre: botón «Hablar con Klaus»');
  check(await P.eval(`!document.querySelector('#rd-input').disabled`), 'el teclado está activo (no «Conversación cerrada»)');
  await P.eval(`document.querySelector('[data-voice-start]').click(); true`);
  check(await waitFor(P, has('[data-voice-phase]')), 'modo voz activado');
  check(await P.eval(`window.__lang`) === 'de-DE', 'reconoce en alemán (de-DE)');
  // Tres turnos hablados sin tocar nada
  check(await waitFor(P, `document.querySelectorAll('.rd-msg.is-student').length >= 3 && document.querySelectorAll('.rd-msg.is-klaus').length >= 4`, 30000), 'tres turnos por voz seguidos: Klaus contesta a cada uno');
  const said = await P.eval(`[...document.querySelectorAll('.rd-msg.is-student > p[lang=de]')].map(p => p.textContent).join('|')`);
  check(said === 'Ich heiße Ana.|Ich komme aus Spanien.|Ich spiele gern Fußball.', `lo dicho llega como mensajes (${said})`);
  check(await P.eval(`(window.__spoken || 0) >= 3`), 'Klaus responde en voz alta en cada turno');
  check(await waitFor(P, `document.querySelector('[data-voice-phase]')?.dataset.voicePhase === 'listening'`), 'tras responder vuelve a escuchar solo');
  await P.shot('voice');
  // Volver al teclado
  await P.eval(`document.querySelector('[data-voice-stop]').click(); true`);
  check(await waitFor(P, `!!document.querySelector('#rd-input') && !document.querySelector('[data-voice-phase]')`), '«Teclado» vuelve a escribir');
  // Sin atascos: muchos mensajes escritos seguidos
  const setVal = (t) => P.eval(`(() => { const i = document.querySelector('#rd-input'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, ${JSON.stringify(t)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  for (let i = 0; i < 8; i++) {
    const n = await P.eval(`document.querySelectorAll('.rd-msg.is-klaus').length`);
    await setVal(`Das ist Satz ${i}.`); await P.eval(`document.querySelector('.rd-compose button[type=submit]').click(); true`);
    if (!(await waitFor(P, `document.querySelectorAll('.rd-msg.is-klaus').length > ${n}`))) { check(false, `mensaje escrito ${i + 1} sin respuesta`); break; }
  }
  check(await P.eval(`document.querySelectorAll('.rd-msg.is-student').length`) >= 11, '11 mensajes seguidos sin bloquearse');
  check(await P.eval(`!document.querySelector('#rd-input').disabled && !document.body.innerText.includes('Conversación cerrada')`), 'el campo sigue abierto');
  await P.shot('long');
} catch (e) { check(false, String(e?.message ?? e)); }
finally { await L.close(); }
if (fails.length) { console.log(`${fails.length} fallos`); process.exit(1); }
console.log('redet-voice OK');
