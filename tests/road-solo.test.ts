// Simulacro individual (sin sala): contenido sin soluciones, corrección SOLO de lo respondido y nota final coherente.
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROAD_LEVEL, ROAD_SECRET } from '../server/road-content.ts';

const servers: Server[] = [], dirs: string[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
async function api() {
  const { createRoadHandler } = await import('../server/road.ts');
  const dataDir = mkdtempSync(join(tmpdir(), 'road-solo-')); dirs.push(dataDir);
  const handler = createRoadHandler({ dataDir });
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/road/`;
  return {
    get: async (p: string) => { const r = await fetch(base + p); return { status: r.status, type: r.headers.get('content-type'), body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; },
    check: async (input: unknown) => (await fetch(base + 'solo/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json(),
  };
}
const reading = ROAD_LEVEL.reading.flatMap((p) => p.questions), listening = ROAD_LEVEL.listening.flatMap((p) => p.questions);

describe('Road · simulacro individual', () => {
  it('sirve el examen sin soluciones ni rúbrica del dictado, y los audios sin sala', async () => {
    const a = await api();
    const level = (await a.get('solo/level')).body;
    expect(level.reading.length).toBeGreaterThan(0);
    const raw = JSON.stringify(level);
    expect(raw).not.toContain(ROAD_SECRET.dictation.slice(0, 40));
    expect(level.dictation.rubric).toEqual([]);
    const audio = await a.get(`solo/audio?id=${ROAD_LEVEL.listening[0].audio.id}`);
    expect([200, 404]).toContain(audio.status); // 404 solo si el mp3 no está en este checkout
    expect((await a.get('solo/audio?id=../road-content')).status).toBe(404);
  });
  it('corrige solo lo respondido; con una respuesta no hay «nota final» rara', async () => {
    const a = await api();
    const q = reading[0];
    const one = await a.check({ answers: { [q.id]: ROAD_SECRET.answers[q.id] } });
    expect(Object.keys(one.results)).toEqual([q.id]);
    expect(one.results[q.id]).toEqual({ ok: true, solution: ROAD_SECRET.answers[q.id] });
    expect(one).toMatchObject({ answered: 1, points: 1, accuracy: 100, final: null, complete: false });
    expect(one.lesen).toEqual({ answered: 1, correct: 1, total: reading.length });
    expect(one.dictationSolution).toBeUndefined();
    // Cinco respuestas (3 bien, 2 mal): 3 puntos sobre 50, 60 % de acierto sobre lo corregido.
    const five = Object.fromEntries(reading.slice(0, 5).map((x, i) => [x.id, i < 3 ? ROAD_SECRET.answers[x.id] : '__mal__']));
    expect(await a.check({ answers: five })).toMatchObject({ answered: 5, points: 3, accuracy: 60, final: null });
    // Terminar con solo eso: lo no respondido cuenta 0 y la nota es sobre 10 (3/50 → 0,6).
    expect((await a.check({ answers: five, finish: true })).final).toEqual({ total: 3, outOf: 50, grade: 0.6, percent: 6, passed: false });
  });
  it('todo bien (preguntas y dictado) da 50/50 y un 10', async () => {
    const a = await api();
    const all = Object.fromEntries([...reading, ...listening].map((x) => [x.id, ROAD_SECRET.answers[x.id]]));
    const r = await a.check({ answers: all, dictation: ROAD_SECRET.dictation, finish: true });
    expect(r.complete).toBe(true);
    expect(r.final).toEqual({ total: 50, outOf: 50, grade: 10, percent: 100, passed: true });
    expect(r.dictationSolution).toBe(ROAD_SECRET.dictation);
  });
});
