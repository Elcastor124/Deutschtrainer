// Logros: se derivan solo de eventos validados por el servidor; fechas de desbloqueo exactas; sin atajos por tiempo.
import { describe, expect, it } from 'vitest';
import { computeAchievements, weeklyPlaces } from '../server/achievements.ts';
import { ACHIEVEMENTS } from '../shared/play.ts';
import type { ProgressEvent } from '../server/progress.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 10); // lunes 5 oct 2026, 12:00 Madrid
const P = 'acc_' + 'a'.repeat(32);
const ans = (at: number, ok: boolean, topic = 'dativ', qid = `q${at}`): ProgressEvent => ({ at, profile: P, kind: 'answer', source: 'practice', qid, topic, ok, points: ok ? 10 : 2 });
const act = (at: number, game: string, total: number, correct: number, level?: string): ProgressEvent => ({ at, profile: P, kind: 'game', source: 'practice', points: 4, game, total, correct, ...(level ? { level } : {}) });
const get = (list: ReturnType<typeof computeAchievements>, id: string) => list.find((a) => a.id === id)!;

describe('logros', () => {
  it('sin actividad no hay ningún logro (el tiempo no cuenta)', () => {
    const r = computeAchievements([]);
    expect(r).toHaveLength(ACHIEVEMENTS.length);
    expect(r.every((a) => !a.unlocked && a.value === 0)).toBe(true);
  });
  it('primera respuesta y respuestas correctas, con la fecha exacta del desbloqueo', () => {
    const evs = Array.from({ length: 120 }, (_, i) => ans(T0 + i * 1000, i % 6 !== 0));
    const r = computeAchievements(evs);
    expect(get(r, 'first-answer')).toMatchObject({ unlocked: true, at: T0 });
    const c100 = get(r, 'correct-100');
    expect(c100.unlocked).toBe(true);
    expect(evs.filter((e) => e.ok && e.at <= c100.at!).length).toBe(100);
    expect(get(r, 'correct-500')).toMatchObject({ unlocked: false, value: 100, goal: 500 });
  });
  it('rachas por días seguidos (hora de Madrid); un día sin practicar la corta', () => {
    const days = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10];
    const r = computeAchievements(days.map((d) => ans(T0 + d * DAY, true)));
    expect(get(r, 'streak-3')).toMatchObject({ unlocked: true, at: T0 + 2 * DAY });
    expect(get(r, 'streak-7')).toMatchObject({ unlocked: true, at: T0 + 10 * DAY });
    expect(get(r, 'streak-30')).toMatchObject({ unlocked: false, value: 7 });
  });
  it('dominar un tema exige volumen y precisión; explorar 5 temas en una semana', () => {
    const many = Array.from({ length: 30 }, (_, i) => ans(T0 + i, i < 26, 'perfekt'));
    expect(get(computeAchievements(many), 'master-1').unlocked).toBe(true);
    const few = Array.from({ length: 20 }, (_, i) => ans(T0 + i, true, 'perfekt'));
    expect(get(computeAchievements(few), 'master-1').unlocked).toBe(false);          // 100 % pero pocas
    const sloppy = Array.from({ length: 40 }, (_, i) => ans(T0 + i, i % 2 === 0, 'perfekt'));
    expect(get(computeAchievements(sloppy), 'master-1').unlocked).toBe(false);       // mucho volumen pero 50 %
    const five = ['dativ', 'akkusativ', 'perfekt', 'modal', 'praep'].map((t, i) => ans(T0 + i * DAY / 10, true, t));
    expect(get(computeAchievements(five), 'explorer').unlocked).toBe(true);
    const spread = ['dativ', 'akkusativ', 'perfekt', 'modal', 'praep'].map((t, i) => ans(T0 + i * 8 * DAY, true, t));
    expect(get(computeAchievements(spread), 'explorer').unlocked).toBe(false);      // repartidos en semanas distintas
  });
  it('actividades y juegos: sin fallos, boxeo, Jenga, los tres juegos y B1', () => {
    const r = computeAchievements([act(T0, 'boxing', 8, 5), act(T0 + 1, 'jenga', 8, 6), act(T0 + 2, 'blackcard', 10, 10), act(T0 + 3, 'blackcard', 8, 6, 'B1')]);
    for (const id of ['first-activity', 'boxer', 'builder', 'all-games', 'perfect', 'b1-ready']) expect(get(r, id).unlocked, id).toBe(true);
    expect(get(r, 'activities-10')).toMatchObject({ unlocked: false, value: 4 });
    const r2 = computeAchievements([act(T0, 'blackcard', 9, 9), act(T0 + 1, 'blackcard', 8, 5, 'B1')]);
    expect(get(r2, 'perfect').unlocked).toBe(false);   // < 10 preguntas
    expect(get(r2, 'b1-ready').unlocked).toBe(false);  // < 70 %
  });
  it('ranking: podio y campeón solo en semanas cerradas y entre cuentas del ranking', () => {
    const other = 'acc_' + 'b'.repeat(32), hidden = 'acc_' + 'c'.repeat(32);
    const ev = (profile: string, at: number, points: number): ProgressEvent => ({ at, profile, kind: 'game', source: 'practice', points });
    const events = [ev(P, T0, 30), ev(other, T0, 20), ev(hidden, T0, 99), ev(P, T0 + 7 * DAY, 10), ev(other, T0 + 7 * DAY, 40)];
    const now = T0 + 8 * DAY; // la segunda semana sigue abierta
    const places = weeklyPlaces(events, P, (p) => p !== hidden, now);
    expect(places).toEqual([{ week: '2026-W41', rank: 1, at: expect.any(Number) }]);   // el oculto no cuenta; la semana en curso tampoco
    const r = computeAchievements(events.filter((e) => e.profile === P), places);
    expect(get(r, 'champion').unlocked).toBe(true); expect(get(r, 'podium').unlocked).toBe(true);
  });
  it('el catálogo tiene ids únicos y metas positivas', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.goal > 0 && a.name && a.desc)).toBe(true);
  });
});

describe('logros ampliados', () => {
  const at = (h: number, dayOffset = 0) => Date.UTC(2026, 9, 5 + dayOffset, h - 2); // h en hora de Madrid (CEST = UTC+2)
  const mission = (t: number): ProgressEvent => ({ at: t, profile: P, kind: 'session', source: 'mission', points: 5 });
  it('el catálogo amplía a unos 100 logros, al final, con grupos y métricas válidos', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(115);
    const originals = ACHIEVEMENTS.slice(0, 20).map((a) => a.id);
    expect(originals[0]).toBe('first-answer');
    expect(originals.at(-1)).toBe('champion');
    const groups = new Set(['aprendizaje', 'constancia', 'juegos', 'ranking', 'dominio', 'temas', 'habitos']);
    for (const a of ACHIEVEMENTS.slice(20)) { expect(groups.has(a.group), a.id).toBe(true); expect(a.metric, a.id).toBeTruthy(); }
    expect(ACHIEVEMENTS.slice(20).filter((a) => a.group === 'temas')).toHaveLength(20); // 16 dominios por tema + 4 de variedad
  });
  it('umbral exacto: correct-25 se desbloquea en la respuesta 25.ª correcta, no antes', () => {
    const evs = Array.from({ length: 30 }, (_, i) => ans(T0 + i * 1000, true));
    const c = get(computeAchievements(evs), 'correct-25');
    expect(c).toMatchObject({ unlocked: true, at: T0 + 24 * 1000 });
    expect(get(computeAchievements(evs.slice(0, 24)), 'correct-25')).toMatchObject({ unlocked: false, value: 24 });
  });
  it('dominio de tema: 30 intentos con un 85 % o más; con 84 % no', () => {
    const ok = Array.from({ length: 30 }, (_, i) => ans(T0 + i, i < 26, 'dativ'));  // 26/30 = 86,7 %
    const no = Array.from({ length: 30 }, (_, i) => ans(T0 + i, i < 25, 'dativ'));  // 25/30 = 83,3 %
    expect(get(computeAchievements(ok), 'master-dativ').unlocked).toBe(true);
    expect(get(computeAchievements(no), 'master-dativ').unlocked).toBe(false);
    expect(get(computeAchievements(ok), 'master-perfekt').unlocked).toBe(false);
  });
  it('horarios de Madrid: antes de las 8 y después de las 22', () => {
    expect(get(computeAchievements([ans(at(7), true)]), 'early-1').unlocked).toBe(true);   // 07:00 Madrid
    expect(get(computeAchievements([ans(at(9), true)]), 'early-1').unlocked).toBe(false);  // 09:00 Madrid
    expect(get(computeAchievements([ans(at(23), true)]), 'night-1').unlocked).toBe(true);  // 23:00 Madrid
    expect(get(computeAchievements([ans(at(21), true)]), 'night-1').unlocked).toBe(false); // 21:00 Madrid
  });
  it('racha de misiones: una misión por día, días seguidos', () => {
    const three = [0, 1, 2].map((d) => mission(at(18, d)));
    expect(get(computeAchievements(three), 'mission-streak-3').unlocked).toBe(true);
    const gap = [mission(at(18, 0)), mission(at(18, 1)), mission(at(18, 3))];   // hueco el día 2
    expect(get(computeAchievements(gap), 'mission-streak-3').unlocked).toBe(false);
    expect(get(computeAchievements([mission(at(18, 0)), mission(at(19, 0))]), 'mission-1').value).toBe(1); // dos misiones el mismo día cuentan como una racha
  });
  it('aciertos con ayuda no cuentan como aciertos independientes', () => {
    const helped = Array.from({ length: 25 }, (_, i) => ({ ...ans(T0 + i, true), assisted: true }) as ProgressEvent);
    expect(get(computeAchievements(helped), 'indep-25')).toMatchObject({ unlocked: false, value: 0 });
    const alone = Array.from({ length: 25 }, (_, i) => ans(T0 + i, true));
    expect(get(computeAchievements(alone), 'indep-25').unlocked).toBe(true);
  });
  it('racha de aciertos seguidos se corta con un fallo', () => {
    const evs = [...Array.from({ length: 4 }, (_, i) => ans(T0 + i, true)), ans(T0 + 4, false), ...Array.from({ length: 5 }, (_, i) => ans(T0 + 5 + i, true))];
    expect(get(computeAchievements(evs), 'run-5')).toMatchObject({ unlocked: true, at: T0 + 9 });
    expect(get(computeAchievements(evs.slice(0, 8)), 'run-5').unlocked).toBe(false);
  });
  it('ranking: 3 semanas en el podio desbloquean podium-3 en la tercera', () => {
    const p = (week: number, rank: number) => ({ week: `w${week}`, rank, at: T0 + week * DAY });
    const r = computeAchievements([], [p(1, 2), p(2, 3), p(3, 1), p(4, 5)]);
    expect(get(r, 'podium-3')).toMatchObject({ unlocked: true, at: T0 + 3 * DAY });
    expect(get(r, 'podium-10')).toMatchObject({ unlocked: false, value: 3 });
    expect(get(r, 'champion-2')).toMatchObject({ unlocked: false, value: 1 });
  });
});
