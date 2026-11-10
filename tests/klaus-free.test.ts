// Modo libre (Redet + Schreibt), teoría pública de las clases y enlaces de estudio del curso.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FREE_TOPICS, REDET_SCENARIOS } from '../shared/klaus-content.ts';
import { isExercise } from '../shared/lesson.ts';
import { AccountStore } from '../server/accounts.ts';
import { createGuard } from '../server/security.ts';
import { createKlausAi } from '../server/ai/klaus-api.ts';
import { KlausStore } from '../server/ai/klaus-store.ts';
import { AiUsage } from '../server/ai/usage.ts';
import { MockLlm } from '../server/ai/mock-llm.ts';
import { buildProviders, loadAiConfig } from '../server/ai/providers.ts';
import { LESSONS, lessonById, theoryOf } from '../server/ai/lessons.ts';
import { COURSE } from '../src/course.ts';

const dirs: string[] = [], servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function api() {
  const dir = mkdtempSync(join(tmpdir(), 'kl-free-')); dirs.push(dir);
  const accounts = new AccountStore(dir), config = loadAiConfig({} as NodeJS.ProcessEnv), store = new KlausStore(dir);
  const usage = new AiUsage(config, { dataDir: dir });
  const handler = createKlausAi({ accounts, guard: createGuard({ dataDir: dir }), providers: buildProviders(config, new MockLlm()), usage, store });
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, input?: unknown, token?: string) => {
    const res = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Student-Session': token } : {}) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };
  const r = await accounts.register('Ana_Lee', 'zorro-azul-mesa-72-lluvia'); if (!r.ok) throw new Error(r.error);
  usage.setPlan(r.account.id, 'plus'); // Klaus (Redet) es de Plus
  return { call, token: r.token, id: r.account.id, handler };
}

describe('Redet · modo libre', () => {
  it('los temas tienen apertura en alemán y guion propio', () => {
    expect(FREE_TOPICS.length).toBeGreaterThanOrEqual(4);
    for (const t of FREE_TOPICS) { expect(t.opening).toMatch(/\?$/); expect(t.script.length).toBeGreaterThanOrEqual(3); }
    expect(REDET_SCENARIOS.some((s) => s.id === 'libre')).toBe(true);
  });
  it('la conversación no se queda atascada: 15 mensajes seguidos en modo práctica, sin 402 ni despedida en bucle', async () => {
    const s = await api();
    const st = await s.call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A1' }, s.token);
    const replies: string[] = [];
    for (let i = 0; i < 15; i++) {
      const r = await s.call('/api/klaus/redet/turn', { sessionId: st.body.session.id, text: `Ich spiele gern Fußball ${i}.`, requestId: `req-loop-${String(i).padStart(4, '0')}` }, s.token);
      expect(r.status, `mensaje ${i + 1}`).toBe(200); replies.push(r.body.reply);
    }
    const bye = 'Danke für das schöne Gespräch!';
    expect(replies.filter((r) => r === bye).length).toBeLessThanOrEqual(0);
    expect(new Set(replies).size).toBeGreaterThanOrEqual(10);
  });
  it('se ofrecen los temas (sin guion) y empezar con tema usa su apertura y su guion', async () => {
    const s = await api();
    const sc = await s.call('/api/klaus/redet/scenarios', undefined, s.token);
    expect(sc.body.topics.map((t: any) => t.id)).toEqual(FREE_TOPICS.map((t) => t.id));
    expect(sc.body.topics[0].script).toBeUndefined();
    const st = await s.call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A1', topic: 'schule' }, s.token);
    expect(st.status).toBe(200);
    expect(st.body.session).toMatchObject({ topic: 'schule' });
    expect(st.body.session.turns[0].text).toBe(FREE_TOPICS.find((t) => t.id === 'schule')!.opening);
    const turn = await s.call('/api/klaus/redet/turn', { sessionId: st.body.session.id, text: 'Ich habe 15 Jahre und mag Mathe.', requestId: 'req-free-0001' }, s.token);
    expect(turn.status).toBe(200);
    expect(turn.body.reply).toBe(FREE_TOPICS.find((t) => t.id === 'schule')!.script[0]);
    expect(turn.body.corrections[0]).toMatchObject({ suggestion: 'Ich bin 15 Jahre alt' });
    const list = await s.call('/api/klaus/redet/sessions', undefined, s.token);
    expect(list.body.sessions[0].topic).toBe('schule');
    const end = await s.call('/api/klaus/redet/end', { sessionId: st.body.session.id }, s.token);
    expect(end.body.summary.topics[0]).toContain('El instituto');
  });
  it('en blanco sigue funcionando; un tema inventado o un tema en otra situación se rechaza/ignora', async () => {
    const s = await api();
    const blank = await s.call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A2' }, s.token);
    expect(blank.status).toBe(200); expect(blank.body.session.topic).toBeUndefined();
    expect((await s.call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A1', topic: '<script>' }, s.token)).status).toBe(400);
    const other = await s.call('/api/klaus/redet/start', { scenarioId: 'restaurante', level: 'A1', topic: 'schule' }, s.token);
    expect(other.status).toBe(200); expect(other.body.session.topic).toBeUndefined();
  });
  it('una conversación con mensajes cuenta como actividad (para el tablón); empezar sin hablar no', async () => {
    const s = await api();
    const st = await s.call('/api/klaus/redet/start', { scenarioId: 'libre', level: 'A1', topic: 'essen' }, s.token);
    expect(s.handler.active(s.id)).toBe(false);
    await s.call('/api/klaus/redet/turn', { sessionId: st.body.session.id, text: 'Ich esse gern Pizza.', requestId: 'req-free-0002' }, s.token);
    expect(s.handler.active(s.id)).toBe(true);
  });
});

describe('Teoría pública', () => {
  it('solo explicaciones, tablas y comparaciones: nunca ejercicios ni soluciones', () => {
    for (const l of LESSONS) {
      const t = theoryOf(l);
      expect(t.items.length, l.id).toBeGreaterThan(0);
      for (const a of t.items) expect(['theory', 'grammar-table', 'comparison'], `${l.id}/${a.id}`).toContain(a.kind);
      const raw = JSON.stringify(t);
      for (const ex of l.activities.filter(isExercise)) expect(raw, `${l.id}/${ex.id}`).not.toContain(`"${ex.id}"`);
    }
  });
  it('GET /api/klaus/teoria no exige cuenta, acota a 4 lecciones y da 404 si no existe', async () => {
    const s = await api();
    const r = await s.call('/api/klaus/teoria?lecciones=akk-01,dat-01');
    expect(r.status).toBe(200); expect(r.body.lessons.map((l: any) => l.id)).toEqual(['akk-01', 'dat-01']);
    expect((await s.call('/api/klaus/teoria?lecciones=a,b,c,d,akk-01')).status).toBe(404);
    expect((await s.call('/api/klaus/teoria?lecciones=nada')).status).toBe(404);
    // El resto de Klaus sigue exigiendo cuenta.
    expect((await s.call('/api/klaus/klasse/lessons')).status).toBe(401);
  });
});

describe('Curso · teoría y clase con Klaus junto a la presentación', () => {
  it('cada Lektion con presentación enlaza su teoría y una clase de Klaus que existe', () => {
    for (const u of COURSE.filter((x) => !x.exam)) {
      expect(u.klaus?.length, u.id).toBeGreaterThan(0);
      for (const id of u.klaus!) expect(lessonById(id), `${u.id} → ${id}`).not.toBeNull();
      const ver = u.steps.find((s) => s.kind === 'ver')!;
      expect(ver.extra.map((x) => x.href)).toEqual(expect.arrayContaining([`/teoria/${u.id}`, `/unterricht?leccion=${u.klaus![0]}`]));
    }
  });
});
