// Smart Learning V1: misión diaria + memoria (Leitner) + Klaus tutor. Todo determinista y sin servicios externos.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QMc } from '../shared/types.ts';
import { loadBank } from '../server/bank/index.ts';
import { buildMission, createLearning, itemStats, LEVEL_TOPICS, LearningStore, topicMastery, INTERVAL_DAYS } from '../server/learning.ts';
import { hintFor, ruleFor, RULES, tutorProvider } from '../server/tutor.ts';
import { ProgressLog, type ProgressEvent } from '../server/progress.ts';
import { AccountStore } from '../server/accounts.ts';

const bank = loadBank();
const DAY = 86_400_000;
const T0 = Date.parse('2026-11-03T15:00:00Z'); // martes por la tarde
const mcs = [...bank.values()].filter((q): q is QMc => q.type === 'mc');
const ev = (qid: string, ok: boolean, at: number, assisted = false): ProgressEvent => ({ at, profile: 'acc_x', kind: 'answer', source: 'practice', qid, topic: bank.get(qid)!.topic, ok, points: 0, ...(assisted ? { assisted: true } : {}) });
const stats = (events: ProgressEvent[]) => itemStats(events, 'acc_x', (q) => bank.get(q)?.topic);

describe('memoria por pregunta (Leitner)', () => {
  const q = mcs.find((x) => x.topic === 'dativ')!.id;
  it('acierto independiente sube caja; con ayuda no; fallo reinicia y cuenta lapso', () => {
    let s = stats([ev(q, true, T0 - 10 * DAY), ev(q, true, T0 - 8 * DAY)]).get(q)!;
    expect(s.box).toBe(2); expect(s.due).toBe(T0 - 8 * DAY + INTERVAL_DAYS[2] * DAY);
    s = stats([ev(q, true, T0 - 10 * DAY), ev(q, true, T0 - 8 * DAY, true)]).get(q)!;
    expect(s.box).toBe(1); expect(s.assisted).toBe(1);
    s = stats([ev(q, true, T0 - 10 * DAY), ev(q, false, T0 - 2 * DAY)]).get(q)!;
    expect(s).toMatchObject({ box: 0, lapses: [T0 - 2 * DAY], lastOk: false });
  });
  it('repetir la misma pregunta el mismo día no infla el dominio', () => {
    const many = Array.from({ length: 20 }, (_, i) => ev(q, true, T0 + i * 1000));
    expect(stats(many).get(q)!.box).toBe(1);
    expect(topicMastery(stats(many), T0)[0].mastery).toBe(0.2);
  });
  it('distingue error aislado y recurrente', () => {
    const one = topicMastery(stats([ev(q, false, T0 - DAY)]), T0)[0];
    const rec = topicMastery(stats([ev(q, false, T0 - 5 * DAY), ev(q, false, T0 - DAY)]), T0)[0];
    expect(one.recurring).toBe(false); expect(rec.recurring).toBe(true); expect(rec.status).toBe('a reforzar');
  });
});

describe('generación de la misión diaria', () => {
  it('sin historial: 5 preguntas distintas, de opción múltiple y SOLO de temas del nivel', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) {
      const m = buildMission({ profile: 'acc_new', day: '2026-11-03', now: T0, level, stats: new Map(), bank });
      expect(m).toHaveLength(5);
      expect(new Set(m.map((x) => x.qid)).size).toBe(5);
      for (const it of m) { expect(bank.get(it.qid)!.type).toBe('mc'); expect(LEVEL_TOPICS[level]).toContain(it.topic); }
    }
    // A1 no recibe Perfekt ni Nebensätze (aún no aprendidos).
    const a1 = buildMission({ profile: 'acc_new', day: '2026-11-03', now: T0, level: 'A1', stats: new Map(), bank });
    expect(a1.some((x) => ['perfekt', 'nebensatz', 'dativ'].includes(x.topic))).toBe(false);
  });
  it('es determinista por alumno y día, y cambia al día siguiente', () => {
    const a = buildMission({ profile: 'acc_x', day: '2026-11-03', now: T0, level: 'A1', stats: new Map(), bank });
    const b = buildMission({ profile: 'acc_x', day: '2026-11-03', now: T0, level: 'A1', stats: new Map(), bank });
    const c = buildMission({ profile: 'acc_x', day: '2026-11-04', now: T0 + DAY, level: 'A1', stats: new Map(), bank });
    expect(a).toEqual(b); expect(c.map((x) => x.qid)).not.toEqual(a.map((x) => x.qid));
  });
  it('prioriza el error reciente y los repasos vencidos', () => {
    const wrong = mcs.find((x) => x.topic === 'akkusativ')!.id;
    const old = mcs.filter((x) => x.topic === 'modal').slice(0, 2).map((x) => x.id);
    const s = stats([ev(old[0], true, T0 - 9 * DAY), ev(old[1], true, T0 - 6 * DAY), ev(wrong, false, T0 - DAY)]);
    const m = buildMission({ profile: 'acc_x', day: '2026-11-03', now: T0, level: 'A1', stats: s, bank });
    expect(m.find((x) => x.slot === 'error')!.qid).toBe(wrong);
    expect(m.filter((x) => x.slot === 'repaso').map((x) => x.qid).sort()).toEqual([...old].sort());
    expect(m.find((x) => x.slot === 'error')!.reason).toMatch(/Error reciente/);
  });
  it('un tema ya practicado entra aunque no sea del nivel, pero nunca Leseverstehen', () => {
    const perf = mcs.find((x) => x.topic === 'perfekt')!.id;
    const m = buildMission({ profile: 'acc_x', day: '2026-11-03', now: T0, level: 'A1', stats: stats([ev(perf, false, T0 - DAY)]), bank });
    expect(m.some((x) => x.topic === 'perfekt')).toBe(true);
    expect(m.some((x) => x.topic === 'lesen')).toBe(false);
  });
});

describe('Klaus tutor (reglas deterministas)', () => {
  it('la pista de nivel 1 nunca dice la respuesta; la de nivel 3 sí, con la explicación verificada del banco', () => {
    for (const q of mcs.filter((x) => x.diff !== 'special')) {
      const correct = q.options[q.answer];
      const h1 = hintFor(q, 1).text;
      if (correct.length >= 3) expect(h1.toLowerCase().split(/[^\p{L}]+/u), q.id).not.toContain(correct.toLowerCase());
      const h3 = hintFor(q, 3);
      expect(h3.solution, q.id).toBe(correct);
      expect(h3.text, q.id).toContain(q.explain.slice(0, 30));
    }
  });
  it('detecta el contexto: «mit ___» → dativo, «für ___» → acusativo, wo/wohin → Wechsel', () => {
    expect(ruleFor({ topic: 'dativ', prompt: 'Ich gehe mit ___ Hund.' })!.id).toBe('dat-prep');
    expect(ruleFor({ topic: 'akkusativ', prompt: 'Das ist für ___ Vater.' })!.id).toBe('akk-prep');
    expect(ruleFor({ topic: 'praep', prompt: 'Wohin legst du das Buch?' })!.id).toBe('wechsel');
    expect(ruleFor({ topic: 'vorstellen', prompt: 'Du ___ aus Spanien. (kommen)' })!.id).toBe('vs-verb');
  });
  it('las reglas de artículos coinciden con las respuestas del banco (ejemplos correctos vs. incorrectos)', () => {
    // dativo tras «mit»: en el banco, toda pregunta de preposición con mit tiene respuesta dem/der/einem/einer/meinem/meiner
    const mit = mcs.filter((q) => q.topic === 'dativ' && /\bmit ___/.test(q.prompt));
    expect(mit.length).toBeGreaterThan(5);
    for (const q of mit) expect(['einen', 'das', 'ein', 'die', 'eine', 'kein', 'keine', 'keinen'], q.id).not.toContain(q.options[q.answer]); // nunca forma de acusativo
    for (const r of RULES) { expect(r.example.ok).not.toBe(r.example.ko); expect(r.hint.length).toBeGreaterThan(10); }
    // ejemplos de las reglas de caso: el correcto usa la forma de la regla y el incorrecto no
    const dp = RULES.find((r) => r.id === 'dat-prep')!; expect(dp.example.ok).toMatch(/mit dem/); expect(dp.example.ko).not.toMatch(/mit dem/);
    const ap = RULES.find((r) => r.id === 'akk-prep')!; expect(ap.example.ok).toMatch(/für den/);
  });
  it('sin regla específica (Leseverstehen) lo reconoce y no inventa', () => {
    const q = [...bank.values()].find((x) => x.topic === 'lesen')!;
    expect(hintFor(q, 1).text).toMatch(/Todavía no tengo una pista específica/);
  });
  it('no hay ningún proveedor de IA activo', () => { expect(tutorProvider).toBeNull(); });
});

// ───────────── HTTP: flujo completo ─────────────
const servers: Server[] = [], dirs: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
async function api(start = T0) {
  let t = start;
  const dir = mkdtempSync(join(tmpdir(), 'dt-learn-')); dirs.push(dir);
  const accounts = new AccountStore(dir); const log = new ProgressLog({ now: () => t });
  const store = new LearningStore(dir);
  const h = createLearning({ accounts, log: () => log, bank, store, now: () => t });
  const server = createServer((req, res) => { if (!h(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, token?: string, body?: unknown) => {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(token ? { 'X-Student-Session': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() as any };
  };
  const reg = async (alias: string) => { const r = await accounts.register(alias, 'correct-horse-battery'); if (!r.ok) throw new Error(); return r; };
  return { call, reg, log, store, dir, advance: (ms: number) => { t += ms; } };
}
const wrongChoice = (item: any) => { const q = bank.get(item.qid) as QMc; return q.options.findIndex((_, i) => i !== q.answer); };
const rightChoice = (item: any) => (bank.get(item.qid) as QMc).answer;

describe('Tägliche Mission (HTTP)', () => {
  it('flujo completo: fallo → Klaus → corrige → termina → historial → la misión siguiente recupera el error', async () => {
    const a = await api(); const ana = await a.reg('Ana_Mission');
    const m = (await a.call('/api/mission', ana.token)).body;
    expect(m.items).toHaveLength(5); expect(m.guest).toBe(false);
    expect(JSON.stringify(m.items[0])).not.toMatch(/"solution"|"explain"/); // sin soluciones antes de responder
    // 1.ª: fallo → Klaus habla, la pregunta sigue abierta
    const first = m.items[0];
    const r1 = (await a.call('/api/mission/answer', ana.token, { id: m.id, qid: first.qid, choice: wrongChoice(first) })).body;
    expect(r1).toMatchObject({ correct: false, final: false }); expect(r1.klaus).toBeTruthy();
    // pistas progresivas: no se puede saltar al nivel 2 sin el 1
    expect((await a.call('/api/mission/hint', ana.token, { id: m.id, qid: first.qid, level: 2 })).status).toBe(400);
    const h1 = (await a.call('/api/mission/hint', ana.token, { id: m.id, qid: first.qid, level: 1 })).body.hint;
    expect(h1.level).toBe(1); expect(h1.solution).toBeUndefined();
    // repetir la misma opción no vale; acertar después cuenta como «con ayuda»
    expect((await a.call('/api/mission/answer', ana.token, { id: m.id, qid: first.qid, choice: wrongChoice(first) })).status).toBe(409);
    const r2 = (await a.call('/api/mission/answer', ana.token, { id: m.id, qid: first.qid, choice: rightChoice(first) })).body;
    expect(r2).toMatchObject({ correct: true, final: true }); expect(r2.item.assisted).toBe(true); expect(r2.item.explain).toBeTruthy();
    // no se puede terminar con preguntas abiertas
    expect((await a.call('/api/mission/complete', ana.token, { id: m.id })).status).toBe(400);
    for (const it of m.items.slice(1)) await a.call('/api/mission/answer', ana.token, { id: m.id, qid: it.qid, choice: rightChoice(it) });
    const done = (await a.call('/api/mission/complete', ana.token, { id: m.id })).body;
    expect(done.summary).toMatchObject({ independent: 4, assisted: 1, wrong: 0, total: 5 });
    // idempotente: completar dos veces no duplica la sesión ni los puntos
    await a.call('/api/mission/complete', ana.token, { id: m.id });
    expect(a.log.events.filter((e) => e.kind === 'session' && e.source === 'mission')).toHaveLength(1);
    // solo la 1.ª respuesta y la corrección con ayuda quedan registradas de la pregunta fallada
    expect(a.log.events.filter((e) => e.qid === first.qid).map((e) => [e.ok, !!e.assisted])).toEqual([[false, false], [true, true]]);
    const hist = (await a.call('/api/mission/history', ana.token)).body;
    expect(hist.completed).toBe(1); expect(hist.missions[0].recover).toEqual([first.topicName]);
    expect(hist.weekDays.filter(Boolean).length).toBe(1);
    // La misma misión el mismo día (no se regenera)
    expect((await a.call('/api/mission', ana.token)).body.id).toBe(m.id);
    // Al día siguiente: la pregunta fallada vuelve como «error»
    a.advance(DAY);
    const next = (await a.call('/api/mission', ana.token)).body;
    expect(next.id).not.toBe(m.id);
    expect(next.items.find((x: any) => x.slot === 'error')?.qid).toBe(first.qid);
  });
  it('la solución (nivel 3) solo tras fallar o pedir las pistas anteriores, y entonces cierra la pregunta sin contar como acierto', async () => {
    const a = await api(); const ben = await a.reg('Ben_Mission');
    const m = (await a.call('/api/mission', ben.token)).body; const it = m.items[1];
    expect((await a.call('/api/mission/hint', ben.token, { id: m.id, qid: it.qid, level: 3 })).status).toBe(400);
    await a.call('/api/mission/answer', ben.token, { id: m.id, qid: it.qid, choice: wrongChoice(it) });
    const h3 = (await a.call('/api/mission/hint', ben.token, { id: m.id, qid: it.qid, level: 3 })).body;
    expect(h3.hint.solution).toBe((bank.get(it.qid) as QMc).options[rightChoice(it)]);
    expect(h3.item).toMatchObject({ final: true, ok: false });
    expect((await a.call('/api/mission/answer', ben.token, { id: m.id, qid: it.qid, choice: rightChoice(it) })).status).toBe(409);
  });
  it('seguridad: nadie toca la misión ni el historial de otro; invitados no guardan nada', async () => {
    const a = await api(); const ana = await a.reg('Ana_Sec'), eva = await a.reg('Eva_Sec');
    const m = (await a.call('/api/mission', ana.token)).body;
    expect((await a.call('/api/mission/answer', eva.token, { id: m.id, qid: m.items[0].qid, choice: 0 })).status).toBe(404);
    expect((await a.call('/api/mission/history')).status).toBe(401);
    expect((await a.call('/api/mission', 'dts_invalid')).status).toBe(401);
    const g = (await a.call('/api/mission')).body;
    expect(g.guest).toBe(true);
    await a.call('/api/mission/answer', undefined, { id: g.id, qid: g.items[0].qid, choice: rightChoice(g.items[0]) });
    expect(a.log.events).toHaveLength(0);
    expect(Object.keys(a.store.data.missions)).toEqual([ana.account.id]);
  });
  it('el estado de las misiones sobrevive a un reinicio (persistencia)', async () => {
    const a = await api(); const ana = await a.reg('Ana_Persist');
    const m = (await a.call('/api/mission', ana.token)).body;
    await a.call('/api/mission/answer', ana.token, { id: m.id, qid: m.items[0].qid, choice: rightChoice(m.items[0]) });
    const again = new LearningStore(a.dir);
    expect(again.of(ana.account.id)[0].state[m.items[0].qid]).toMatchObject({ final: true, ok: true });
  });
  it('funciona sin red: no hace ninguna llamada externa', async () => {
    const a = await api(); const ana = await a.reg('Ana_Offline');
    const spy = vi.spyOn(globalThis, 'fetch');
    const before = spy.mock.calls.length;
    const m = (await a.call('/api/mission', ana.token)).body;
    await a.call(`/api/tutor/hint?qid=${m.items[0].qid}&level=2`, ana.token);
    // las únicas llamadas son las de este test a nuestro propio servidor local
    expect(spy.mock.calls.slice(before).every(([u]) => String(u).startsWith('http://127.0.0.1:'))).toBe(true);
    expect((await a.call(`/api/tutor/hint?qid=${m.items[0].qid}&level=3`, ana.token)).status).toBe(400); // la práctica no revela
  });
});
