// Diagnóstico real de Klaus con OpenRouter gratis: arranca el servidor (dist/) con las claves de .env.openrouter,
// crea una cuenta, le da Plus desde Teacher OS y llama a Schreibt (revisión), Unterricht (pregunta libre) y Redet.
// Imprime solo proveedor/fuente/latencia; nunca las claves. Uso: node scripts/klaus-ai-live.mjs [--no-provider-var]
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env = { ...process.env, PORT: '4791', DATA_DIR: mkdtempSync(join(tmpdir(), 'dt-ai-')), TEACHER_PASSWORD: 'diag-' + Date.now() };
for (const line of readFileSync('.env.openrouter', 'utf8').split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim(); }
if (process.argv.includes('--no-provider-var')) delete env.KLAUS_LLM_PROVIDER; else env.KLAUS_LLM_PROVIDER ??= 'openrouter-free';
const B = 'http://127.0.0.1:4791';
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jar = {};
async function call(path, body, who = 'st') {
  const r = await fetch(B + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: B, ...(jar[who] ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? []; if (sc.length) jar[who] = sc.map((c) => c.split(';')[0]).join('; ');
  let j = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, body: j };
}
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
  console.log('health', JSON.stringify((await call('/api/health')).body.klausAi));
  console.log('arranque:', (log.match(/\[klaus-ai\][^\n]*/) ?? [''])[0]);
  const alias = 'Diag' + Date.now().toString(36).slice(-5);
  await call('/api/account/register', { alias, password: 'zorro-azul-mesa-72-lluvia' });
  await call('/api/teacher/login', { key: env.TEACHER_PASSWORD }, 'te');
  const id = (await call('/api/teacher/students', null, 'te')).body.students.find((s) => s.alias === alias).id;
  await call(`/api/teacher/students/${id}`, { plan: 'plus' }, 'te');
  const st = (await call('/api/klaus/status')).body;
  console.log('status', JSON.stringify({ plan: st.plan, llm: st.providers?.llm }));

  for (const [k, txt] of ['Ich wohne in Sevilla und ich gehe jeden Tag mit mein Hund spazieren.', 'Gestern ich habe Fussball gespielt mit meine Freunde.', 'Meine Mutter ist Lehrerin und sie arbeit in eine Schule.'].entries()) {
    const t3 = Date.now(); const r3 = await call('/api/klaus/writing/review', { text: txt, level: 'A2', requestId: 'diag-w' + k + Date.now() });
    console.log('  review', k, r3.status, Math.round((Date.now() - t3) / 1000) + 's', 'source=' + (r3.body?.source ?? r3.body?.review?.source), JSON.stringify(r3.body?.review?.corrections?.map((c) => `${c.original}→${c.suggestion}`) ?? []).slice(0, 120));
  }
  let t = Date.now();
  const rv = await call('/api/klaus/writing/review', { text: 'Hallo uch habe 6 jahre und wil kain kafee trinken', level: 'A1', requestId: 'diag-rev-' + Date.now() });
  console.log('SCHREIBT', rv.status, Math.round((Date.now() - t) / 1000) + 's', 'source=' + (rv.body?.source ?? rv.body?.review?.source), 'issues=' + (rv.body?.review?.issues?.length ?? '?'), JSON.stringify(rv.body).slice(0, 300));

  const lessons = (await call('/api/klaus/klasse/lessons')).body;
  const lid = (lessons.lessons ?? lessons)[0]?.id;
  const ks = await call('/api/klaus/klasse/start', { lessonId: lid, requestId: 'diag-ks-' + Date.now() });
  t = Date.now();
  const sid = ks.body?.view?.sessionId ?? ks.body?.sessionId ?? ks.body?.session?.id;
  const ask = await call('/api/klaus/klasse/ask', { sessionId: sid, question: '¿Por qué se dice "ich bin 14 Jahre alt" y no "ich habe 14 Jahre"?', requestId: 'diag-ask-' + Date.now() });
  for (let k = 0; k < 3; k++) { const t2 = Date.now(); const a2 = await call('/api/klaus/klasse/ask', { sessionId: sid, question: ['¿Qué significa woher?', '¿Cómo digo que hablo inglés?', '¿Por qué kommst y no kommt?'][k], requestId: 'diag-a' + k + Date.now() }); console.log('  ask', k, a2.status, Math.round((Date.now() - t2) / 1000) + 's', 'source=' + a2.body?.source, JSON.stringify(a2.body?.answer?.text ?? '').slice(0, 90)); }
  console.log('UNTERRICHT start', ks.status, 'lesson', lid, '| ask', ask.status, Math.round((Date.now() - t) / 1000) + 's', 'source=' + ask.body?.source, JSON.stringify(ask.body).slice(0, 300));

  t = Date.now();
  const rs = await call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A1' });
  const rd = await call('/api/klaus/redet/turn', { sessionId: rs.body?.session?.id, text: 'Hallo Klaus, ich habe gestern einen Film gesehen.', requestId: 'diag-rd-' + Date.now() });
  console.log('REDET', rd.status, Math.round((Date.now() - t) / 1000) + 's', 'source=' + (rd.body?.source), JSON.stringify(rd.body).slice(0, 300));
} catch (e) { console.log('ERROR', e.message); }
finally { srv.kill(); await sleep(300); const errs = log.split('\n').filter((l) => /error|openrouter|klaus-ai\]/i.test(l)).slice(0, 30).map((l) => l.replace(/sk-or-[\w-]+/g, 'sk-or-***')); if (errs.length) console.log('server log:\n' + errs.join('\n')); }
