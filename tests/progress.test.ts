import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { madridDay, isoWeek } from '../server/progress.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
export const tempDir = () => { const d = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'progress-test-')); dirs.push(d); return d; };

describe('Europe/Madrid calendar', () => {
  it('uses the Madrid local day, not UTC (summer CEST = UTC+2)', () => {
    // 2026-06-07 22:30Z is Monday 00:30 in Madrid.
    expect(madridDay(Date.UTC(2026, 5, 7, 22, 30))).toBe('2026-06-08');
    expect(madridDay(Date.UTC(2026, 5, 7, 21, 59))).toBe('2026-06-07');
  });
  it('switches ISO week at Madrid midnight on Monday in summer and winter', () => {
    expect(isoWeek(Date.UTC(2026, 5, 7, 21, 59))).toBe('2026-W23');
    expect(isoWeek(Date.UTC(2026, 5, 7, 22, 0))).toBe('2026-W24');
    // Winter (CET = UTC+1): Monday 2026-11-02 00:00 Madrid = 2026-11-01 23:00Z.
    expect(isoWeek(Date.UTC(2026, 10, 1, 22, 59))).toBe('2026-W44');
    expect(isoWeek(Date.UTC(2026, 10, 1, 23, 0))).toBe('2026-W45');
  });
  it('handles the DST change weekend (last Sunday of October) and year-crossing ISO weeks', () => {
    // 2026-10-25 is the DST switch Sunday; Monday 26 starts at 23:00Z on the 25th (already CET).
    expect(isoWeek(Date.UTC(2026, 9, 25, 22, 59))).toBe('2026-W43');
    expect(isoWeek(Date.UTC(2026, 9, 25, 23, 0))).toBe('2026-W44');
    // Spring switch: Monday 2026-03-30 00:00 CEST = 2026-03-29 22:00Z.
    expect(isoWeek(Date.UTC(2026, 2, 29, 21, 59))).toBe('2026-W13');
    expect(isoWeek(Date.UTC(2026, 2, 29, 22, 0))).toBe('2026-W14');
    // 2027-01-01 (Friday) belongs to 2026-W53.
    expect(isoWeek(Date.UTC(2027, 0, 1, 12))).toBe('2026-W53');
    expect(isoWeek(Date.UTC(2027, 0, 4, 12))).toBe('2027-W01');
  });
});

// Martes 2026-10-20 10:00 Madrid (CEST) — semana 2026-W43.
const T0 = Date.UTC(2026, 9, 20, 8, 0);
const H = 3_600_000, D = 24 * H;
async function log(start = T0) {
  const { ProgressLog } = await import('../server/progress.ts');
  let time = start;
  const dataDir = tempDir();
  const p = new ProgressLog({ dataDir, now: () => time });
  return { p, dataDir, ProgressLog, at: (t: number) => { time = t; }, advance: (ms: number) => { time += ms; }, now: () => time };
}
const answer = (profile: string, qid: string, ok: boolean, topic = 'Dativ') => ({ profile, kind: 'answer' as const, source: 'practice' as const, qid, topic, ok });

describe('weekly points', () => {
  it('gives +10 per correct, +2 per wrong attempt and a +5 first-answer-of-the-day bonus', async () => {
    const { p } = await log();
    expect(p.record(answer('alumno-aaaa', 'q1', true))?.points).toBe(15);
    expect(p.record(answer('alumno-aaaa', 'q2', false))?.points).toBe(2);
    expect(p.record(answer('alumno-aaaa', 'q3', true))?.points).toBe(10);
    expect(p.summary('alumno-aaaa').weekPoints).toBe(27);
  });
  it('anti-farming: the same question scores once per Madrid day (correct and attempt separately)', async () => {
    const { p, advance } = await log();
    p.record(answer('alumno-aaaa', 'q1', false));
    expect(p.record(answer('alumno-aaaa', 'q1', false))?.points).toBe(0);
    expect(p.record(answer('alumno-aaaa', 'q1', true))?.points).toBe(10);
    expect(p.record(answer('alumno-aaaa', 'q1', true))?.points).toBe(0);
    advance(D); // next day the question may score again (spaced repetition is good)
    expect(p.record(answer('alumno-aaaa', 'q1', true))?.points).toBe(15);
  });
  it('raises the daily bonus to +10 from a 3-day streak and reports the streak', async () => {
    const { p, advance } = await log();
    p.record(answer('alumno-aaaa', 'q1', true)); advance(D);
    p.record(answer('alumno-aaaa', 'q2', true)); advance(D);
    expect(p.record(answer('alumno-aaaa', 'q3', true))?.points).toBe(20);
    expect(p.summary('alumno-aaaa').streak).toBe(3);
    advance(D); // not active yet today: streak still alive
    expect(p.summary('alumno-aaaa').streak).toBe(3);
    advance(D); // a whole missed day breaks it
    expect(p.summary('alumno-aaaa').streak).toBe(0);
  });
  it('resets weekly points at Monday 00:00 Madrid and keeps an 8-week history', async () => {
    // Domingo 2026-10-25 23:30 Madrid (ya CET) = 22:30Z
    const { p, at } = await log(Date.UTC(2026, 9, 25, 22, 30));
    p.record(answer('alumno-aaaa', 'q1', true));
    at(Date.UTC(2026, 9, 25, 23, 5)); // lunes 00:05 Madrid
    p.record(answer('alumno-aaaa', 'q2', true));
    const s = p.summary('alumno-aaaa');
    expect(s.week).toBe('2026-W44');
    expect(s.weekPoints).toBe(15);
    expect(s.history).toHaveLength(8);
    expect(s.history.at(-1)).toEqual({ week: '2026-W44', points: 15 });
    expect(s.history.at(-2)).toEqual({ week: '2026-W43', points: 15 });
  });
  it('clamps external game awards and ignores invalid input', async () => {
    const { p } = await log();
    expect(p.award('alumno-aaaa', 'boxing', 999, 'ROOM1')?.points).toBe(50);
    expect(p.award('alumno-aaaa', 'road', -5)?.points).toBe(0);
    expect(p.record({ profile: 'bad id!', kind: 'answer', source: 'practice', qid: 'q', ok: true })).toBeNull();
    expect(p.record({ profile: 'alumno-aaaa', kind: 'nope' as never, source: 'practice' })).toBeNull();
  });
});

describe('topics, persistence and retention', () => {
  it('computes per-topic accuracy and recommends the weakest topics first', async () => {
    const { p, advance } = await log();
    const id = 'alumno-aaaa';
    for (let i = 0; i < 4; i++) p.record(answer(id, `d${i}`, i === 0, 'Dativ'));
    for (let i = 0; i < 4; i++) p.record(answer(id, `a${i}`, i < 3, 'Akkusativ'));
    for (let i = 0; i < 3; i++) p.record(answer(id, `v${i}`, true, 'Verben'));
    p.record(answer(id, 'x1', false, 'Uhrzeit')); // a single attempt is not enough evidence
    advance(H);
    const topics = p.topics(id);
    expect(topics.find((t) => t.topic === 'Dativ')).toEqual({ topic: 'Dativ', attempts: 4, correct: 1, accuracy: 0.25 });
    expect(p.recommended(id)).toEqual(['Dativ', 'Akkusativ']);
  });
  it('persists events atomically and restores them after a restart', async () => {
    const { p, dataDir, ProgressLog, now } = await log();
    p.record(answer('alumno-aaaa', 'q1', true));
    p.award('alumno-aaaa', 'boxing', 30, 'BOX1');
    p.flush();
    const again = new ProgressLog({ dataDir, now });
    expect(again.events).toHaveLength(2);
    expect(again.summary('alumno-aaaa').weekPoints).toBe(45);
    // anti-farming survives restart
    expect(again.record(answer('alumno-aaaa', 'q1', true))?.points).toBe(0);
  });
  it('debounces writes and survives a corrupt file', async () => {
    const { writeFileSync, existsSync } = await import('node:fs');
    const { ProgressLog } = await import('../server/progress.ts');
    const dataDir = tempDir();
    writeFileSync(join(dataDir, 'progress.json'), '{broken');
    const p = new ProgressLog({ dataDir, now: () => T0, saveDelay: 10 });
    expect(p.events).toEqual([]);
    p.record(answer('alumno-aaaa', 'q1', true));
    await new Promise((r) => setTimeout(r, 60));
    expect(existsSync(join(dataDir, 'progress.json'))).toBe(true);
    expect(new ProgressLog({ dataDir, now: () => T0 }).events).toHaveLength(1);
  });
  it('keeps only the last 180 days', async () => {
    const { p, dataDir, ProgressLog, advance, now } = await log();
    p.record(answer('alumno-aaaa', 'old', true));
    advance(181 * D);
    p.record(answer('alumno-aaaa', 'new', true));
    p.flush();
    expect(new ProgressLog({ dataDir, now }).events.map((e) => e.qid)).toEqual(['new']);
  });
});

describe('progress HTTP API', () => {
  const servers: import('node:http').Server[] = [];
  afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } });
  async function api() {
    const { createServer } = await import('node:http');
    const { createProgressHandler } = await import('../server/progress.ts');
    const people: Record<string, { name: string; code: string }> = {
      'alumno-aaaa': { name: 'Ana', code: 'ANA123' }, 'alumno-bbbb': { name: 'Ben', code: 'BEN456' }, 'alumno-cccc': { name: 'Cleo', code: 'CLE789' },
    };
    let time = T0;
    const handler = createProgressHandler({ dataDir: tempDir(), now: () => time, profiles: (id) => people[id] });
    const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(418); res.end(); } }); servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const get = async (path: string, method = 'GET') => { const r = await fetch(`http://127.0.0.1:${port}${path}`, { method }); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; };
    return { handler, log: handler.log, get, advance: (ms: number) => { time += ms; } };
  }

  it('returns only the caller’s own summary with rank, streak, topics and recommendations', async () => {
    const { log, get } = await api();
    log.record(answer('alumno-aaaa', 'q1', true, 'Dativ'));
    log.record(answer('alumno-aaaa', 'q2', false, 'Dativ'));
    log.record(answer('alumno-aaaa', 'q3', false, 'Dativ'));
    log.record(answer('alumno-bbbb', 'q1', true)); log.record(answer('alumno-bbbb', 'q2', true)); log.record(answer('alumno-bbbb', 'q3', true));
    const { status, body } = await get('/api/progress/me?profile=alumno-aaaa');
    expect(status).toBe(200);
    expect(body).toMatchObject({ known: true, name: 'Ana', code: 'ANA123', weekPoints: 19, rank: 2, players: 2, streak: 1, recommended: ['Dativ'] });
    expect(body.history).toHaveLength(8);
    expect(body.topics[0]).toEqual({ topic: 'Dativ', attempts: 3, correct: 1, accuracy: 0.33 });
    expect(JSON.stringify(body)).not.toContain('BEN456');
    expect(JSON.stringify(body)).not.toContain('alumno-bbbb');
  });
  it('treats a valid but inactive profile as a fresh start and rejects malformed ids', async () => {
    const { get } = await api();
    const fresh = await get('/api/progress/me?profile=alumno-zzzz');
    expect(fresh.status).toBe(200);
    expect(fresh.body).toMatchObject({ known: false, weekPoints: 0, rank: null, streak: 0, recommended: [] });
    expect((await get('/api/progress/me')).status).toBe(400);
    expect((await get('/api/progress/me?profile=../../etc')).status).toBe(400);
  });
  it('leaderboard exposes only display names and points for this week — no ids or codes', async () => {
    const { log, get, advance } = await api();
    log.record(answer('alumno-aaaa', 'q1', true));
    log.record(answer('alumno-bbbb', 'q1', true)); log.record(answer('alumno-bbbb', 'q2', true));
    log.record(answer('alumno-unknown1', 'q1', false));
    const { status, body } = await get('/api/progress/leaderboard');
    expect(status).toBe(200);
    expect(body.week).toBe('2026-W43');
    expect(body.entries).toEqual([{ rank: 1, name: 'Ben', points: 25 }, { rank: 2, name: 'Ana', points: 15 }, { rank: 3, name: 'Alumno', points: 7 }]);
    const raw = JSON.stringify(body);
    for (const secret of ['alumno-', 'ANA123', 'BEN456']) expect(raw).not.toContain(secret);
    advance(7 * D);
    expect((await get('/api/progress/leaderboard')).body.entries).toEqual([]);
  });
  it('rejects wrong methods, 404s unknown progress routes and ignores other paths', async () => {
    const { get } = await api();
    expect((await get('/api/progress/leaderboard', 'POST')).status).toBe(405);
    expect((await get('/api/progress/me?profile=alumno-aaaa', 'DELETE')).status).toBe(405);
    expect((await get('/api/progress/teacher')).status).toBe(404);
    expect((await get('/api/progress')).status).toBe(404);
    expect((await get('/api/progressive')).status).toBe(418);
    expect((await get('/api/health')).status).toBe(418);
  });
});

describe('teacher model (pure, not exposed yet)', () => {
  const ev = (day: number, qid: string, ok: boolean, topic: string, room = 'CLASE1', source: 'class' | 'practice' = 'class') =>
    ({ at: T0 + day * D, profile: 'alumno-aaaa', kind: 'answer' as const, source, qid, topic, ok, points: 0, room });

  it('groups events into per-class sessions by room and Madrid day', async () => {
    const { groupSessions } = await import('../server/progress.ts');
    const sessions = groupSessions([ev(0, 'a', true, 'Dativ'), ev(0, 'b', false, 'Dativ'), ev(7, 'c', true, 'Verben', 'CLASE2'), { ...ev(7, 'd', true, 'Verben', '', 'practice'), room: undefined }]);
    expect(sessions.map((s) => [s.day, s.room, s.answers, s.correct])).toEqual([['2026-10-20', 'CLASE1', 2, 1], ['2026-10-27', 'CLASE2', 1, 1], ['2026-10-27', null, 1, 1]]);
  });
  it('predicts with low confidence and no risks when there is no history', async () => {
    const { predictNext } = await import('../server/progress.ts');
    expect(predictNext([])).toEqual({ sessions: 0, predictedAccuracy: null, confidence: 'low', participation: { trend: 'flat', expectedAnswers: 0 }, riskTopics: [] });
  });
  it('weights recent classes more (EMA) and flags weak topics and dropping participation', async () => {
    const { predictNext } = await import('../server/progress.ts');
    const events = [
      // clase 1: 10 respuestas, 90 % aciertos (Verben)
      ...Array.from({ length: 10 }, (_, i) => ev(0, `v${i}`, i !== 0, 'Verben')),
      // clase 2: 6 respuestas, 50 %
      ...Array.from({ length: 6 }, (_, i) => ev(7, `m${i}`, i % 2 === 0, i < 3 ? 'Verben' : 'Dativ', 'CLASE2')),
      // clase 3: 4 respuestas de Dativ, 25 %
      ...Array.from({ length: 4 }, (_, i) => ev(14, `d${i}`, i === 0, 'Dativ', 'CLASE3')),
    ];
    const p = predictNext(events);
    expect(p.sessions).toBe(3);
    // EMA α=0.5 over 0.9, 0.5, 0.25 → 0.9 → 0.7 → 0.475
    expect(p.predictedAccuracy).toBeCloseTo(0.48, 2);
    expect(p.participation.trend).toBe('down');
    expect(p.participation.expectedAnswers).toBeLessThan(6);
    expect(p.riskTopics.map((r) => r.topic)).toEqual(['Dativ']);
    expect(p.riskTopics[0].predicted).toBeLessThan(0.6);
    expect(p.confidence).toBe('medium');
  });
});

describe('integration hook', () => {
  it('recordEvent/awardPoints write into the log created by createProgressHandler', async () => {
    const { createProgressHandler, recordEvent, awardPoints } = await import('../server/progress.ts');
    const h = createProgressHandler({ dataDir: tempDir(), now: () => T0 });
    expect(recordEvent(answer('alumno-aaaa', 'q1', true))?.points).toBe(15);
    awardPoints('alumno-aaaa', 'boxing', 20, 'BOX1');
    expect(recordEvent({ profile: '', kind: 'answer', source: 'class' })).toBeNull();
    expect(h.log.summary('alumno-aaaa').weekPoints).toBe(35);
  });
});
