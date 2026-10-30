// Logros e insignias del alumno (cuentas). Se DERIVAN en el servidor del historial de eventos validados (progress.json):
// no hay nada que el cliente pueda enviar para desbloquearlos, ni un almacén aparte que se pueda desincronizar.
// Puro: recibe los eventos y devuelve el estado de cada logro con su fecha de desbloqueo y su progreso.
import type { ProgressEvent } from './progress.ts';
import { isoWeek, madridDay, nextWeekStart } from './progress.ts';
import type { AchievementState } from '../shared/play.ts';
import { ACHIEVEMENTS } from '../shared/play.ts';

const DAY = 86_400_000;
const prevDay = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - DAY).toISOString().slice(0, 10);

/**
 * @param events eventos de ESTE perfil, en cualquier orden.
 * @param podium puestos en semanas ya cerradas (ver weeklyPlaces): para los logros de ranking.
 */
export function computeAchievements(events: readonly ProgressEvent[], podium: { week: string; rank: number; at: number }[] = []): AchievementState[] {
  const evs = [...events].sort((a, b) => a.at - b.at);
  const got = new Map<string, number>();                      // id → instante de desbloqueo
  const val = new Map<string, number>();                      // id → progreso actual
  const hit = (id: string, at: number) => { if (!got.has(id)) got.set(id, at); };
  let answers = 0, correct = 0, activities = 0, streak = 0, bestStreak = 0, lastDay = '';
  const topic = new Map<string, { n: number; ok: number }>();
  const games = new Set<string>();
  const weekTopics = new Map<string, Set<string>>();
  let mastered = 0;
  for (const e of evs) {
    const day = madridDay(e.at);
    if (day !== lastDay) { streak = lastDay && prevDay(day) === lastDay ? streak + 1 : 1; lastDay = day; bestStreak = Math.max(bestStreak, streak); }
    if (streak >= 3) hit('streak-3', e.at);
    if (streak >= 7) hit('streak-7', e.at);
    if (streak >= 30) hit('streak-30', e.at);
    if (e.kind === 'answer' && typeof e.ok === 'boolean') {
      answers++; if (e.ok) correct++;
      hit('first-answer', e.at);
      if (correct >= 100) hit('correct-100', e.at);
      if (correct >= 500) hit('correct-500', e.at);
      if (correct >= 1000) hit('correct-1000', e.at);
      if (e.topic) {
        const t = topic.get(e.topic) ?? { n: 0, ok: 0 }; t.n++; if (e.ok) t.ok++; topic.set(e.topic, t);
        const wk = isoWeek(e.at); const set = weekTopics.get(wk) ?? new Set(); set.add(e.topic); weekTopics.set(wk, set);
        if (set.size >= 5) hit('explorer', e.at);
        mastered = [...topic.values()].filter((x) => x.n >= 30 && x.ok / x.n >= 0.85).length;
        if (mastered >= 1) hit('master-1', e.at);
        if (mastered >= 3) hit('master-3', e.at);
      }
    }
    if (e.kind === 'game' && e.game && e.total !== undefined) {
      activities++;
      hit('first-activity', e.at);
      if (activities >= 10) hit('activities-10', e.at);
      if (activities >= 50) hit('activities-50', e.at);
      games.add(e.game);
      if (e.game === 'boxing') hit('boxer', e.at);
      if (e.game === 'jenga') hit('builder', e.at);
      if (games.size >= 3) hit('all-games', e.at);
      if (e.total >= 10 && e.correct === e.total) hit('perfect', e.at);
      if (e.level === 'B1' && e.total >= 8 && (e.correct ?? 0) / e.total >= 0.7) hit('b1-ready', e.at);
    }
  }
  for (const p of podium) { if (p.rank <= 3) hit('podium', p.at); if (p.rank === 1) hit('champion', p.at); }
  val.set('first-answer', answers); val.set('correct-100', correct); val.set('correct-500', correct); val.set('correct-1000', correct);
  val.set('streak-3', bestStreak); val.set('streak-7', bestStreak); val.set('streak-30', bestStreak);
  val.set('first-activity', activities); val.set('activities-10', activities); val.set('activities-50', activities);
  val.set('all-games', games.size); val.set('master-1', mastered); val.set('master-3', mastered);
  val.set('explorer', Math.max(0, ...[...weekTopics.values()].map((s) => s.size)));
  val.set('boxer', games.has('boxing') ? 1 : 0); val.set('builder', games.has('jenga') ? 1 : 0);
  val.set('podium', podium.some((p) => p.rank <= 3) ? 1 : 0); val.set('champion', podium.some((p) => p.rank === 1) ? 1 : 0);
  return ACHIEVEMENTS.map((a) => {
    const at = got.get(a.id);
    return { id: a.id, unlocked: at !== undefined, ...(at !== undefined ? { at } : {}), value: Math.min(a.goal, val.get(a.id) ?? (at !== undefined ? a.goal : 0)), goal: a.goal };
  });
}

/** Puesto del perfil en cada semana YA CERRADA, entre las cuentas del ranking (las mismas reglas que /api/play/leaderboard). */
export function weeklyPlaces(events: readonly ProgressEvent[], profile: string, include: (p: string) => boolean, now: number) {
  const current = isoWeek(now);
  const byWeek = new Map<string, Map<string, number>>();
  const endOf = new Map<string, number>();
  for (const e of events) {
    if (!include(e.profile)) continue;
    const w = isoWeek(e.at); if (w === current) continue;
    const m = byWeek.get(w) ?? new Map(); m.set(e.profile, (m.get(e.profile) ?? 0) + e.points); byWeek.set(w, m);
    if (!endOf.has(w)) endOf.set(w, nextWeekStart(e.at));
  }
  const out: { week: string; rank: number; at: number }[] = [];
  for (const [w, m] of byWeek) {
    const mine = m.get(profile); if (!mine) continue;
    const rank = 1 + [...m.values()].filter((p) => p > mine).length;
    out.push({ week: w, rank, at: endOf.get(w)! });
  }
  return out;
}
