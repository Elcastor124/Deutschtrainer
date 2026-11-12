// Leseverstehen 001: integridad del contenido frente al documento del profesor, clave solo en el servidor, corrección y no duplicar.
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LESEN_EXAM, LESEN_SECRET, LESEN_SPEC_SHA256 } from '../server/lesen/content-001.ts';
import { matchingConflict, scoreOf } from '../shared/lesen.ts';
import { cleanAnswers, createLesenHandler } from '../server/lesen.ts';

const spec = readFileSync(join(import.meta.dirname, '../server/lesen/spec-001.md'));
const specText = spec.toString('utf8').replace(/\r\n/g, '\n');
const questions = LESEN_EXAM.parts.flatMap((p) => p.questions);
const KEY_FROM_DOC = (() => {
  const sect = specText.slice(specText.indexOf('# 3. LÖSUNGSSCHLÜSSEL'), specText.indexOf('# 4. RESULTADOS'));
  const map: Record<string, string> = {};
  for (const m of sect.matchAll(/^(\d+): (\S+)$/gm)) map[`q${m[1]}`] = m[2] === 'Richtig' ? 'R' : m[2] === 'Falsch' ? 'F' : m[2];
  return map;
})();

describe('Leseverstehen 001 · contenido', () => {
  it('está copiado del documento del profesor sin cambios', () => {
    expect(createHash('sha256').update(specText).digest('hex')).toBe(LESEN_SPEC_SHA256); // normalizado a LF: igual en Windows (autocrlf) y en Linux
  });
  it('25 preguntas numeradas 1–25, 25 puntos, 5 Teile con sus tiempos (8+8+10+10+9 = 45 min)', () => {
    expect(questions.map((q) => q.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(LESEN_EXAM.maxPoints).toBe(25);
    expect(LESEN_EXAM.parts.map((p) => [p.minutes, p.questions.length])).toEqual([[8, 5], [8, 5], [10, 6], [10, 5], [9, 4]]);
    expect(LESEN_EXAM.parts.reduce((s, p) => s + p.minutes, 0)).toBe(LESEN_EXAM.minutes);
    expect(LESEN_EXAM.minutes).toBe(45);
  });
  it('la clave coincide exactamente con el Lösungsschlüssel del documento', () => {
    expect(Object.keys(KEY_FROM_DOC)).toHaveLength(25);
    expect(LESEN_SECRET.answers).toEqual(KEY_FROM_DOC);
    for (const q of questions) expect(q.options.map((o) => o.id)).toContain(LESEN_SECRET.answers[q.id]);
  });
  it('la clave también coincide con la «Respuesta correcta» de cada pregunta en el cuerpo del documento', () => {
    const body = [...specText.matchAll(/^(\d+)\. [\s\S]*?Respuesta correcta: ([^.\n]+)\./gm)].map((m) => [m[1], m[2].trim()] as const);
    const map = Object.fromEntries(body.map(([n, v]) => [`q${n}`, v === 'Richtig' ? 'R' : v === 'Falsch' ? 'F' : v]));
    expect(map).toEqual(LESEN_SECRET.answers);
  });
  it('cada texto, pregunta y opción aparece literal en el documento', () => {
    for (const p of LESEN_EXAM.parts) {
      expect(specText).toContain(p.textTitle);
      for (const l of p.instruction) expect(specText).toContain(l);
      for (const b of p.text) {
        const parts = b.t === 'p' || b.t === 'h' ? [b.text] : b.t === 'ad' ? [b.title, ...b.lines] : b.t === 'meta' ? b.rows.map(([k, v]) => `${k}: ${v}`) : b.rows.map((r) => `| ${r.join(' | ')} |`);
        for (const s of parts) expect(specText, s).toContain(s);
      }
      for (const q of p.questions) {
        expect(specText).toContain(`${q.number}. ${q.prompt}`);
        if (q.type === 'choice') for (const o of q.options) expect(specText, `${q.number}${o.id}`).toContain(`${o.id}) ${o.text}`);
      }
    }
  });
  it('los cinco textos están completos: todas las frases del documento están en la web', () => {
    // Para cada Teil: las líneas de texto entre «## Text…»/«## Anzeigen» y «## Aufgaben»/«## Situationen» del documento.
    const web = LESEN_EXAM.parts.map((p) => p.text.flatMap((b) => b.t === 'p' || b.t === 'h' ? [b.text] : b.t === 'ad' ? [b.title, ...b.lines] : b.t === 'meta' ? b.rows.map(([k, v]) => `${k}: ${v}`) : [b.head.join(' | '), ...b.rows.map((r) => r.join(' | '))]).join('\n'));
    const docTexts = [...specText.matchAll(/## (?:Text: [^\n]+|Anzeigen)\n([\s\S]*?)\n## (?:Aufgaben|Situationen)/g)].map((m) => m[1]);
    expect(docTexts).toHaveLength(5);
    docTexts.forEach((t, i) => {
      for (const raw of t.split('\n')) {
        const line = raw.replace(/^#+ /, '').replace(/^Anzeige [A-H] — /, '').replace(/^\| |\ \|$/g, '').replace(/ \| /g, ' | ').trim();
        if (!line || /^\|?-+/.test(line) || line.startsWith('|---')) continue;
        expect(web[i], `Teil ${i + 1}: ${line}`).toContain(line);
      }
    });
  });
  it('sin ambigüedad: cada pregunta tiene una sola clave, opciones distintas y Teil 3 usa cada anuncio como mucho una vez', () => {
    for (const q of questions) expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    const t3 = LESEN_EXAM.parts[2].questions.map((q) => LESEN_SECRET.answers[q.id]);
    const ads = t3.filter((x) => x !== '0');
    expect(new Set(ads).size).toBe(ads.length);
    expect(t3.filter((x) => x === '0')).toHaveLength(1);
    expect(LESEN_SECRET.answers.q16).toBe('0');
  });
  it('cada pregunta tiene explicación y categorías', () => {
    for (const q of questions) { expect(LESEN_SECRET.explain[q.id]?.length).toBeGreaterThan(10); expect(LESEN_SECRET.tags[q.id]?.length).toBeGreaterThan(0); }
  });
  it('la parte pública no contiene la clave ni las explicaciones', () => {
    const pub = JSON.stringify(LESEN_EXAM);
    expect(pub).not.toMatch(/Respuesta correcta|answers|explain|Lösung/);
    for (const e of Object.values(LESEN_SECRET.explain)) expect(pub).not.toContain(e);
  });
});

describe('Leseverstehen 001 · nota', () => {
  it('todo bien = 25; nada = 0; sin penalización', () => {
    expect(scoreOf(LESEN_EXAM, LESEN_SECRET.answers, LESEN_SECRET.answers)).toMatchObject({ points: 25, percent: 100, byPart: [{ points: 5 }, { points: 5 }, { points: 6 }, { points: 5 }, { points: 4 }] });
    expect(scoreOf(LESEN_EXAM, {}, LESEN_SECRET.answers).points).toBe(0);
    const allWrong = Object.fromEntries(questions.map((q) => [q.id, q.options.find((o) => o.id !== LESEN_SECRET.answers[q.id])!.id]));
    expect(scoreOf(LESEN_EXAM, allWrong, LESEN_SECRET.answers).points).toBe(0);
  });
  it('por Teil: 3 bien en Teil 1 y 2 en Teil 3 → 5 puntos, 20 %', () => {
    const a = { q1: 'F', q2: 'R', q3: 'F', q4: 'R', q11: 'B', q12: 'C', q13: 'A' };
    const s = scoreOf(LESEN_EXAM, a, LESEN_SECRET.answers);
    expect(s.byPart.map((b) => b.points)).toEqual([3, 0, 2, 0, 0]); expect(s.points).toBe(5); expect(s.percent).toBe(20);
  });
  it('Teil 3: un anuncio no se repite; «0» sí', () => {
    const t3 = LESEN_EXAM.parts[2];
    expect(matchingConflict(t3, { q11: 'B' }, 'q12', 'B')).toBe(true);
    expect(matchingConflict(t3, { q11: 'B' }, 'q11', 'B')).toBe(false);
    expect(matchingConflict(t3, { q11: '0' }, 'q12', '0')).toBe(false);
    expect(cleanAnswers({ q11: 'B', q12: 'B', q13: '0', q14: '0', q1: 'X', q6: 'b' })).toEqual({ q11: 'B', q13: '0', q14: '0', q6: 'b' });
  });
});

// ───────── servidor ─────────
let servers: Server[] = []; const dirs: string[] = [];
afterEach(() => { for (const s of servers) s.close(); servers = []; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
async function boot(opts: { account?: (req: IncomingMessage) => string | null } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'lesen-')); dirs.push(dataDir);
  const results: { id: string; correct: number; room?: string }[] = [];
  const handler = createLesenHandler({ dataDir, accountOf: opts.account ?? ((req) => (req.headers['x-acc'] as string) || null), onResult: (id, r) => results.push({ id, correct: r.correct, room: r.room }) });
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/lesen/`;
  const call = async (path: string, init: { body?: unknown; token?: string; acc?: string; method?: string } = {}) => {
    const r = await fetch(base + path, { method: init.method ?? (init.body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(init.acc ? { 'x-acc': init.acc } : {}) }, ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }) });
    return { status: r.status, data: await r.json() as any };
  };
  return { call, results, dataDir, handler };
}

describe('Leseverstehen 001 · API', () => {
  it('GET exam no expone ninguna solución', async () => {
    const { call } = await boot();
    const r = await call('exam');
    expect(r.status).toBe(200);
    const txt = JSON.stringify(r.data);
    expect(txt).not.toMatch(/"answers"|"explain"|"key"|"tags"/);
    for (const e of Object.values(LESEN_SECRET.explain)) expect(txt).not.toContain(e);
    expect(r.data.exam.parts.flatMap((p: any) => p.questions)).toHaveLength(25);
  });
  it('no corrige sin terminar ni sin intento válido', async () => {
    const { call } = await boot();
    expect((await call('practice/check', { body: { answers: { q1: 'F' }, attempt: 'abcdefgh1' } })).status).toBe(400);
    expect((await call('practice/check', { body: { answers: { q1: 'F' }, finish: true } })).status).toBe(400);
    expect((await call('practice/check', { method: 'GET' })).status).toBe(405);
  });
  it('invitado: corrige pero no guarda', async () => {
    const { call, results } = await boot();
    const r = await call('practice/check', { body: { attempt: 'guest-attempt-1', answers: LESEN_SECRET.answers, finish: true } });
    expect(r.status).toBe(200); expect(r.data.score.points).toBe(25); expect(r.data.saved).toBe(false); expect(r.data.repasar).toEqual([]);
    expect(r.data.review).toHaveLength(25); expect(r.data.review[0]).toMatchObject({ number: 1, key: 'F', ok: true });
    expect(results).toHaveLength(0);
    expect((await call('mine')).status).toBe(401);
  });
  it('con cuenta: guarda UNA vez por intento; reenviar (refrescar) no duplica ni cambia la nota', async () => {
    const { call, results, dataDir } = await boot();
    const a = { q1: 'F', q2: 'R', q6: 'b', q11: 'B', q16: '0' };
    const r1 = await call('practice/check', { acc: 'acc_alumno1', body: { attempt: 'attempt-0001', answers: a, finish: true } });
    expect(r1.data).toMatchObject({ saved: true, score: { points: 5 } });
    const r2 = await call('practice/check', { acc: 'acc_alumno1', body: { attempt: 'attempt-0001', answers: LESEN_SECRET.answers, finish: true } });
    expect(r2.data.score.points).toBe(5);
    expect(results).toEqual([{ id: 'acc_alumno1', correct: 5, room: undefined }]);
    expect((await call('mine', { acc: 'acc_alumno1' })).data.results).toHaveLength(1);
    // Un intento nuevo sí cuenta.
    await call('practice/check', { acc: 'acc_alumno1', body: { attempt: 'attempt-0002', answers: LESEN_SECRET.answers, finish: true } });
    const mine = (await call('mine', { acc: 'acc_alumno1' })).data.results;
    expect(mine.map((x: any) => x.points)).toEqual([25, 5]);
    expect(results).toHaveLength(2);
    // Persistido en disco y otro alumno no ve nada.
    expect(JSON.parse(readFileSync(join(dataDir, 'lesen.json'), 'utf8')).results.acc_alumno1).toHaveLength(2);
    expect((await call('mine', { acc: 'acc_otro' })).data.results).toEqual([]);
  });
  it('repasar señala las categorías falladas', async () => {
    const { call } = await boot();
    const a = { ...LESEN_SECRET.answers, q9: 'b', q21: 'a' }; // dos de Modalverben + Zeitangaben
    const r = await call('practice/check', { body: { attempt: 'attempt-rep1', answers: a, finish: true } });
    expect(r.data.score.points).toBe(23);
    const tags = r.data.repasar.map((x: any) => x.tag);
    expect(tags).toContain('Modalverben'); expect(tags).toContain('Zeitangaben'); expect(tags).not.toContain('Globalverstehen');
  });
  it('clase: el alumno no ve claves ni notas hasta que el profesor termina; luego se guarda una vez', async () => {
    const { call, results } = await boot();
    const t = (await call('create', { body: {} })).data;
    const p = (await call('join', { acc: 'acc_clase1', body: { code: t.code, name: 'Ana' } })).data;
    const g = (await call('join', { body: { code: t.code, name: 'Invitado' } })).data;
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'F' } } })).status).toBe(409);
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'start' } } })).status).toBe(403);
    await call('action', { token: t.token, body: { code: t.code, action: { type: 'start' } } });
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'F' } } })).status).toBe(200);
    await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q11', value: 'B' } } });
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q12', value: 'B' } } })).status).toBe(409);
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q2', value: 'X' } } })).status).toBe(400);
    const during = await call(`state?code=${t.code}`, { token: p.token });
    expect(during.data.ownAnswers).toEqual({ q1: 'F', q11: 'B' });
    expect(JSON.stringify(during.data)).not.toMatch(/"key"|"explain"|"result"|"score"/);
    const teacherDuring = await call(`state?code=${t.code}`, { token: t.token });
    expect(teacherDuring.data.players.find((x: any) => x.name === 'Ana').answers).toEqual({ q1: 'F', q11: 'B' });
    expect(teacherDuring.data.key).toBeUndefined();
    await call('action', { token: t.token, body: { code: t.code, action: { type: 'finish' } } });
    const after = await call(`state?code=${t.code}`, { token: p.token });
    expect(after.data.result.score.points).toBe(2); expect(after.data.result.saved).toBe(true);
    expect((await call(`state?code=${t.code}`, { token: g.token })).data.result.saved).toBe(false);
    expect((await call('action', { token: p.token, body: { code: t.code, action: { type: 'answer', questionId: 'q2', value: 'R' } } })).status).toBe(409);
    expect((await call(`state?code=${t.code}`, { token: t.token })).data.key.q1).toBe('F');
    // Terminar otra vez no duplica.
    await call('action', { token: t.token, body: { code: t.code, action: { type: 'finish' } } });
    expect(results).toEqual([{ id: 'acc_clase1', correct: 2, room: t.code }]);
  });
  it('olvidar una cuenta borra sus resultados', async () => {
    const { call, handler } = await boot();
    await call('practice/check', { acc: 'acc_x', body: { attempt: 'attempt-x001', answers: {}, finish: true } });
    expect(handler.results('acc_x')).toHaveLength(1);
    handler.forget('acc_x'); expect(handler.results('acc_x')).toHaveLength(0);
  });
});
