// Hörverstehen 001: content integrity against the teacher's spec, server-only keys, authoritative class flow.
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOREN_EXAM, HOREN_SECRET, HOREN_SPEC_SHA256 } from '../server/horen/content-001.ts';
import { buildTimeline, scoreOf } from '../shared/horen.ts';

const spec = readFileSync(join(import.meta.dirname, '../server/horen/spec-001.md'));
const specText = spec.toString('utf8').replace(/\r\n/g, '\n');
const questions = HOREN_EXAM.parts.flatMap((p) => p.questions);
const flat = (id: string) => HOREN_SECRET.scripts[id].flatMap((s) => s.turns.map((t) => t.text)).join(' ');

describe('Hörverstehen 001 · contenido', () => {
  it('está generado del documento del profesor sin cambios', () => {
    expect(createHash('sha256').update(spec).digest('hex')).toBe(HOREN_SPEC_SHA256);
  });
  it('tiene 30 preguntas numeradas 1–30 en 5 partes y 60 minutos', () => {
    expect(questions.map((q) => q.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(HOREN_EXAM.parts.map((p) => p.minutes)).toEqual([9, 11, 12, 13, 12]);
    expect(HOREN_EXAM.parts.reduce((s, p) => s + p.minutes, 0) + HOREN_EXAM.reviewMinutes).toBe(60);
  });
  it('la clave coincide exactamente con el Lösungsschlüssel del documento', () => {
    const table = Object.fromEntries([...specText.matchAll(/^\| (\d+) \| (\w+) \|$/gm)].map((m) => [`q${m[1]}`, m[2]]));
    expect(HOREN_SECRET.answers).toEqual(table);
    for (const q of questions) expect(q.options.map((o) => o.id)).toContain(HOREN_SECRET.answers[q.id]);
  });
  it('cada pregunta y opción aparece literal en el documento', () => {
    for (const q of questions) {
      expect(specText).toContain(q.prompt);
      if (q.type === 'choice') for (const o of q.options) expect(specText).toContain(`${o.id}) ${o.text}`);
    }
  });
  it('cada solución está respaldada por una frase literal de SU audio', () => {
    for (const p of HOREN_EXAM.parts) for (const q of p.questions) {
      const ev = HOREN_SECRET.evidence[q.id]; expect(ev.length).toBeGreaterThan(0);
      for (const e of ev) expect(flat(p.audioId)).toContain(e);
    }
  });
  it('las transcripciones son las del documento, sin etiquetas, títulos ni soluciones en lo hablado', () => {
    for (const p of HOREN_EXAM.parts) for (const seg of HOREN_SECRET.scripts[p.audioId]) for (const t of seg.turns) {
      expect(specText).toContain(t.text);
      expect(t.text).not.toMatch(/\*\*|^#|Aufgabe|Lösung|Gespräch \d|Person \d/);
      expect(t.text.startsWith(`${t.speaker}:`)).toBe(false);
    }
    // In each dialogue, neighbouring speakers have different voices.
    for (const segs of Object.values(HOREN_SECRET.scripts)) for (const s of segs) for (let i = 1; i < s.turns.length; i++) {
      if (s.turns[i].speaker !== s.turns[i - 1].speaker) expect(s.turns[i].voice).not.toBe(s.turns[i - 1].voice);
    }
  });
  it('Teil 4: seis claves distintas y dos hobbys sobrantes', () => {
    const keys = HOREN_EXAM.parts[3].questions.map((q) => HOREN_SECRET.answers[q.id]);
    expect(new Set(keys).size).toBe(6);
    expect(HOREN_EXAM.parts[3].bank!.filter((b) => !keys.includes(b.id)).map((b) => b.id)).toEqual(['F', 'G']);
  });
  it('puntuación sobre 20', () => {
    expect(scoreOf(HOREN_EXAM, HOREN_SECRET.answers, HOREN_SECRET.answers)).toMatchObject({ points: 30, grade20: 20 });
    expect(scoreOf(HOREN_EXAM, {}, HOREN_SECRET.answers)).toMatchObject({ points: 0, grade20: 0 });
    const half = Object.fromEntries(questions.slice(0, 15).map((q) => [q.id, HOREN_SECRET.answers[q.id]]));
    expect(scoreOf(HOREN_EXAM, half, HOREN_SECRET.answers).grade20).toBe(10);
  });
});

describe('Hörverstehen 001 · cronograma desde la duración real', () => {
  it('7 pasos por parte (instrucción, lectura, 1ª, trabajo, 2ª, respuesta) y cabe en el presupuesto', () => {
    const d = { a1: 120, a2: 150, a3: 140, a4: 160, a5: 260, i1: 8, i2: 8, i3: 8, i4: 10, i5: 9 };
    const { steps, warnings } = buildTimeline(HOREN_EXAM, d);
    expect(warnings).toEqual([]);
    expect(steps.filter((s) => s.part === 0 && s.kind !== 'review' && s.kind !== 'done').map((s) => s.kind)).toEqual(['instruction', 'read', 'listen1', 'work', 'listen2', 'answer']);
    for (const [i, p] of HOREN_EXAM.parts.entries()) {
      const own = steps.filter((s) => s.part === i && !['review', 'done'].includes(s.kind));
      expect(Math.abs(own.reduce((a, s) => a + s.ms, 0) - p.minutes * 60_000)).toBeLessThan(5);
      expect(own.find((s) => s.kind === 'listen1')!.ms).toBe(Math.ceil(d[p.audioId as keyof typeof d] * 1000));
    }
    expect(steps.reduce((a, s) => a + s.ms, 0)).toBeCloseTo(60 * 60_000, -2);
  });
  it('avisa si el audio no cabe en el presupuesto de la parte', () => {
    const { warnings } = buildTimeline(HOREN_EXAM, { a1: 280, i1: 10 });
    expect(warnings.some((w) => w.startsWith('Teil 1'))).toBe(true);
  });
});

// ── HTTP: authoritative rooms ──
const servers: Server[] = []; const dirs: string[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
async function api(clock = { t: 1_000_000 }) {
  const { createHorenHandler } = await import('../server/horen.ts');
  const dataDir = mkdtempSync(join(tmpdir(), 'horen-')); dirs.push(dataDir);
  const handler = createHorenHandler({ dataDir, now: () => clock.t });
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/horen/`;
  const call = async (path: string, body?: unknown, token?: string) => {
    const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const type = r.headers.get('content-type') ?? '';
    return { status: r.status, body: type.includes('json') ? await r.json() : await r.arrayBuffer(), type };
  };
  return { call, clock, dataDir };
}
const secretBits = () => [HOREN_SECRET.evidence.q1[0], HOREN_SECRET.scripts.a2[0].turns[0].text, '"answers"'];

describe('Hörverstehen 001 · servidor', () => {
  it('el examen público no contiene claves, transcripciones ni frases de evidencia', async () => {
    const { call } = await api();
    const r = await call('exam'); expect(r.status).toBe(200);
    const raw = JSON.stringify(r.body);
    for (const s of secretBits()) expect(raw).not.toContain(s);
    expect(r.body.exam.parts).toHaveLength(5);
  });
  it('la práctica solo corrige al terminar y entonces devuelve revisión con evidencias', async () => {
    const { call } = await api();
    expect((await call('practice/check', { answers: { q1: 'B' } })).status).toBe(400);
    const r = await call('practice/check', { answers: { q1: 'B', q2: 'A', q7: 'Falsch', q99: 'A', q3: 'Z' }, finish: true });
    expect(r.status).toBe(200);
    expect(r.body.score.points).toBe(2);
    expect(r.body.review.find((x: { id: string }) => x.id === 'q2')).toMatchObject({ ok: false, key: 'B', own: 'A' });
    expect(r.body.review.find((x: { id: string }) => x.id === 'q3')).toMatchObject({ own: null });
  });
  it('audio: solo ids conocidos; nunca rutas', async () => {
    const { call } = await api();
    expect((await call('audio?id=../horen/content-001')).status).toBe(404);
    expect((await call('audio?id=a9')).status).toBe(404);
    const audioDir = join(import.meta.dirname, '../server/horen/audio');
    if (existsSync(join(audioDir, 'a1.mp3'))) { const r = await call('audio?id=a1'); expect(r.status).toBe(200); expect(r.type).toBe('audio/mpeg'); }
  });
  it('sala: profesor controla; dos alumnos responden a la vez; sin soluciones hasta el final', async () => {
    const { call, clock } = await api();
    const t = (await call('create', {})).body; expect(t.role).toBe('teacher');
    const a = (await call('join', { code: t.code, name: 'Ana' })).body;
    const b = (await call('join', { code: t.code, name: 'Ben' })).body;
    // Students cannot drive the exam or answer before start.
    expect((await call('action', { code: t.code, action: { type: 'start' } }, a.token)).status).toBe(403);
    expect((await call('action', { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'B' } }, a.token)).status).toBe(409);
    // Timing can be adjusted only in the lobby.
    expect((await call('action', { code: t.code, action: { type: 'adjust', part: 0, minutes: 10 } }, t.token)).status).toBe(200);
    expect((await call('action', { code: t.code, action: { type: 'start' } }, t.token)).status).toBe(200);
    expect((await call('action', { code: t.code, action: { type: 'adjust', part: 0, minutes: 9 } }, t.token)).status).toBe(409);
    // Simultaneous answers from both devices.
    const [ra, rb] = await Promise.all([
      call('action', { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'B' } }, a.token),
      call('action', { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'A' } }, b.token),
    ]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect((await call('action', { code: t.code, action: { type: 'answer', questionId: 'q1', value: 'X' } }, a.token)).status).toBe(400);
    // During the exam: no keys, transcripts or evidence for students; the teacher sees answers + progress.
    const sa = (await call(`state?code=${t.code}`, undefined, a.token)).body;
    for (const s of secretBits().slice(0, 2)) expect(JSON.stringify(sa)).not.toContain(s);
    expect(sa.review).toBeUndefined(); expect(sa.transcripts).toBeUndefined(); expect(sa.players[0].answers).toBeUndefined();
    const st = (await call(`state?code=${t.code}`, undefined, t.token)).body;
    expect(st.players.map((p: { name: string; answered: number }) => [p.name, p.answered])).toEqual([['Ana', 1], ['Ben', 1]]);
    expect(st.players[0].answers).toEqual({ q1: 'B' });
    expect(st.key).toBeUndefined();
    // Pause freezes the shared clock and blocks answers.
    clock.t += 5000; await call('action', { code: t.code, action: { type: 'pause' } }, t.token);
    const p1 = (await call(`state?code=${t.code}`, undefined, a.token)).body;
    clock.t += 60_000;
    const p2 = (await call(`state?code=${t.code}`, undefined, a.token)).body;
    expect(p2.stepElapsedMs).toBe(p1.stepElapsedMs);
    expect((await call('action', { code: t.code, action: { type: 'answer', questionId: 'q2', value: 'B' } }, a.token)).status).toBe(409);
    await call('action', { code: t.code, action: { type: 'resume' } }, t.token);
    // Teacher advances; finish locks answers and reveals the review with transcript evidence.
    const n = (await call('action', { code: t.code, action: { type: 'next' } }, t.token)).body; expect(n.step).toBe(p2.step + 1);
    await call('action', { code: t.code, action: { type: 'finish' } }, t.token);
    expect((await call('action', { code: t.code, action: { type: 'answer', questionId: 'q2', value: 'B' } }, a.token)).status).toBe(409);
    const fa = (await call(`state?code=${t.code}`, undefined, a.token)).body;
    expect(fa.status).toBe('finished');
    expect(fa.ownScore).toMatchObject({ points: 1, outOf: 30 });
    expect(fa.review.find((r: { id: string }) => r.id === 'q1')).toMatchObject({ ok: true, evidence: HOREN_SECRET.evidence.q1 });
    expect(fa.key).toBeUndefined();
    const ft = (await call(`state?code=${t.code}`, undefined, t.token)).body;
    expect(ft.key.q1).toBe('B'); expect(ft.players[1].score.points).toBe(0);
  });
  it('el reloj avanza solo y la sala sobrevive a un reinicio del servidor', async () => {
    const clock = { t: 5_000_000 };
    const first = await api(clock);
    const t = (await first.call('create', {})).body; await first.call('join', { code: t.code, name: 'Ana' });
    await first.call('action', { code: t.code, action: { type: 'start' } }, t.token);
    clock.t += 200_000; // 200 s later the instruction + reading steps are long over
    const s = (await first.call(`state?code=${t.code}`, undefined, t.token)).body;
    expect(s.step).toBeGreaterThan(0);
    const { createHorenHandler } = await import('../server/horen.ts');
    const again = createHorenHandler({ dataDir: first.dataDir, now: () => clock.t });
    const server = createServer((req, res) => { if (!again(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const r = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/horen/state?code=${t.code}`, { headers: { Authorization: `Bearer ${t.token}` } });
    expect((await r.json()).step).toBe(s.step);
    expect(statSync(join(first.dataDir, 'horen.json')).isFile()).toBe(true);
  });
});

describe('Hörverstehen 001 · nada secreto en el cliente', () => {
  it('ningún fichero de src/ importa contenido del servidor', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
    for (const f of walk(join(import.meta.dirname, '../src')).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/server\/horen|horen\/content-001/);
    }
  });
});
