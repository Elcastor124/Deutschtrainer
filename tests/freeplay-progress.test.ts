// Progreso educativo del modo libre: puntos validados por el servidor, límites anti-explotación y privacidad del ranking.
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { FREEPLAY, ProgressLog, createProgressHandler, isAccountProfile } from '../server/progress.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 5, 10, 10, 0, 0); // miércoles
const ACC = 'acc_' + 'a'.repeat(32);
const mk = () => { let t = T0; const log = new ProgressLog({ now: () => t }); return { log, advance: (ms: number) => { t += ms; }, get t() { return t; } }; };
const answer = (log: ProgressLog, profile: string, qid: string, ok: boolean, topic = 'dativ') => log.record({ profile, kind: 'answer', source: 'practice', qid, topic, ok });

describe('actividad educativa completada', () => {
  it('puntúa según el nivel y solo con ≥ 8 preguntas y ≥ 40 % de acierto', () => {
    const { log } = mk();
    expect(log.activity(ACC, { game: 'blackcard', level: 'A1', total: 10, correct: 8 })!.points).toBe(4);
    expect(log.activity(ACC, { game: 'jenga', level: 'A2', total: 9, correct: 4 })!.points).toBe(6);
    expect(log.activity(ACC, { game: 'boxing', level: 'B1', total: 8, correct: 8 })!.points).toBe(10);
    expect(log.activity(ACC, { game: 'boxing', level: 'B1', total: 8, correct: 8 })!.points).toBe(0); // la 4ª del día ya no
  });
  it('sin suficientes preguntas, o acertando al azar, no puntúa (pero queda en el historial)', () => {
    const { log } = mk();
    expect(log.activity(ACC, { game: 'blackcard', level: 'B1', total: 7, correct: 7 })!.points).toBe(0);   // muy corta
    expect(log.activity(ACC, { game: 'blackcard', level: 'B1', total: 20, correct: 5 })!.points).toBe(0);  // 25 %: indistinguible del azar
    expect(log.activity(ACC, { game: 'blackcard', level: 'B1', total: 0, correct: 0 })!.points).toBe(0);   // sesión vacía
    expect(log.recentActivities(ACC)).toHaveLength(3);
  });
  it('máximo 3 actividades recompensadas por día; al día siguiente vuelve a puntuar', () => {
    const { log, advance } = mk();
    const pts = () => log.activity(ACC, { game: 'blackcard', level: 'A2', total: 10, correct: 9 })!.points;
    expect([pts(), pts(), pts(), pts(), pts()]).toEqual([6, 6, 6, 0, 0]);
    advance(DAY);
    expect(pts()).toBe(6);
  });
  it('los ejercicios fáciles pagan menos que los difíciles', () => {
    expect(FREEPLAY.levelPoints.A1).toBeLessThan(FREEPLAY.levelPoints.A2);
    expect(FREEPLAY.levelPoints.A2).toBeLessThan(FREEPLAY.levelPoints.B1);
  });
  it('un cliente no puede inventarse puntos: solo `activity`/`answer` calculan, y kind:game acota a 0–50', () => {
    const { log } = mk();
    const ev = log.record({ profile: ACC, kind: 'game', source: 'practice', points: 9999 });
    expect(ev!.points).toBe(50);
    expect(log.record({ profile: ACC, kind: 'answer', source: 'practice', qid: 'q1', ok: true, points: 9999 } as any)!.points).toBeLessThanOrEqual(15);
  });
});

describe('límite diario y anti-explotación', () => {
  it('una cuenta no pasa de 200 puntos al día (lo demás se registra con 0 puntos)', () => {
    const { log } = mk();
    for (let i = 0; i < 60; i++) answer(log, ACC, `q${i}`, true);
    expect(log.weekPoints(ACC)).toBe(FREEPLAY.dailyCap);
    expect(log.events.filter((e) => e.profile === ACC)).toHaveLength(60); // las estadísticas no se pierden
    expect(log.topics(ACC)[0]).toMatchObject({ attempts: 60, correct: 60 });
  });
  it('el límite es diario: al día siguiente se puede volver a puntuar', () => {
    const { log, advance } = mk();
    for (let i = 0; i < 30; i++) answer(log, ACC, `q${i}`, true);
    advance(DAY);
    const before = log.weekPoints(ACC);
    answer(log, ACC, 'nueva', true);
    expect(log.weekPoints(ACC)).toBeGreaterThan(before);
  });
  it('repetir la misma pregunta el mismo día no suma (ejercicio fácil repetido)', () => {
    const { log } = mk();
    answer(log, ACC, 'facil', true);
    const p1 = log.weekPoints(ACC);
    for (let i = 0; i < 20; i++) answer(log, ACC, 'facil', true);
    expect(log.weekPoints(ACC)).toBe(p1);
  });
  it('el límite solo afecta a cuentas: los perfiles de dispositivo existentes siguen como antes', () => {
    const { log } = mk();
    for (let i = 0; i < 60; i++) answer(log, 'device-profile-1', `q${i}`, true);
    expect(log.weekPoints('device-profile-1')).toBeGreaterThan(FREEPLAY.dailyCap);
  });
  it('el tiempo NO es aprendizaje: sin respuestas no hay puntos, pase el tiempo que pase', () => {
    const { log, advance } = mk();
    for (let h = 0; h < 72; h++) { advance(3_600_000); expect(log.weekPoints(ACC)).toBe(0); }
    expect(log.events).toHaveLength(0);
    expect(log.streak(ACC)).toBe(0);
  });
});

describe('resumen educativo', () => {
  it('temas, errores frecuentes, evolución semanal y recomendaciones', () => {
    const { log, advance } = mk();
    for (let w = 0; w < 3; w++) {
      for (let i = 0; i < 4; i++) answer(log, ACC, `d${i}`, i < w + 1, 'dativ');
      answer(log, ACC, 'dificil', false, 'perfekt'); answer(log, ACC, 'dificil', false, 'perfekt');
      advance(7 * DAY);
    }
    const acc = log.accuracyByWeek(ACC, 4);
    expect(acc.filter((a) => a.attempts > 0)).toHaveLength(3);
    expect(acc.filter((a) => a.accuracy !== null).map((a) => a.accuracy)[0]).toBeLessThan(acc.filter((a) => a.accuracy !== null).at(-1)!.accuracy! + 0.5);
    expect(log.frequentErrors(ACC)[0]).toMatchObject({ qid: 'dificil', wrong: 6, topic: 'perfekt' });
    expect(log.recommended(ACC)).toContain('perfekt');
    expect(log.frequentErrors(ACC).every((e) => e.wrong >= 2)).toBe(true);
  });
  it('removeProfile borra todo el historial de la cuenta y solo el suyo', () => {
    const { log } = mk();
    answer(log, ACC, 'q1', true); answer(log, 'other-profile-1', 'q1', true);
    log.removeProfile(ACC);
    expect(log.events.map((e) => e.profile)).toEqual(['other-profile-1']);
  });
});

describe('privacidad: las cuentas no aparecen en las APIs antiguas', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } });
  it('el ranking antiguo no lista cuentas ni por puntos ni por nombre, y /me rechaza ids de cuenta/invitado', async () => {
    const { log } = mk();
    for (let i = 0; i < 5; i++) answer(log, ACC, `q${i}`, true);
    for (let i = 0; i < 2; i++) answer(log, 'device-profile-1', `q${i}`, true);
    const handler = createProgressHandler({ log, profiles: (id) => ({ name: id === ACC ? 'NombreRealDeCuenta' : 'Dispo', code: '' }) });
    const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const lb = await (await fetch(`${base}/api/progress/leaderboard`)).json() as any;
    expect(JSON.stringify(lb)).not.toContain('NombreRealDeCuenta');
    expect(lb.entries).toHaveLength(1);
    expect(lb.entries[0]).toMatchObject({ rank: 1, name: 'Dispo' });
    expect((await fetch(`${base}/api/progress/me?profile=${ACC}`)).status).toBe(400);
    expect((await fetch(`${base}/api/progress/me?profile=guest_${'b'.repeat(32)}`)).status).toBe(400);
    expect((await fetch(`${base}/api/progress/me?profile=device-profile-1`)).status).toBe(200);
    expect(isAccountProfile(ACC)).toBe(true);
  });
});
