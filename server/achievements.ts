// Logros e insignias del alumno (cuentas). Se DERIVAN en el servidor del historial de eventos validados (progress.json):
// no hay nada que el cliente pueda enviar para desbloquearlos, ni un almacén aparte que se pueda desincronizar.
// Puro: recibe los eventos y devuelve el estado de cada logro con su fecha de desbloqueo y su progreso.
import type { ProgressEvent } from './progress.ts';
import { isoWeek, madridDay, nextWeekStart } from './progress.ts';
import type { AchievementState } from '../shared/play.ts';
import { ACHIEVEMENTS } from '../shared/play.ts';

const DAY = 86_400_000;
const prevDay = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - DAY).toISOString().slice(0, 10);

/** Hora y día de la semana en Madrid (los horarios de los logros son los de la academia). */
const madridParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false, weekday: 'short' });
function madridHourWeekday(at: number): { hour: number; weekend: boolean } {
  const parts = Object.fromEntries(madridParts.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { hour: Number(parts.hour) % 24, weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun' };
}

/** Acumuladores para los logros con `metric` (ver shared/play.ts). Se actualizan evento a evento. */
interface Stats {
  answers: number; correct: number; indep: number; points: number; run: number; bestRun: number;
  dayCorrect: Map<string, number>; dayAnswers: Map<string, number>;
  topic: Map<string, { n: number; ok: number }>; days: Set<string>; weekDays: Map<string, Set<string>>;
  missions: number; missionRun: number; bestMissionRun: number; lastMissionDay: string;
  early: number; night: number; weekend: number; activities: number; perfect: number; games: Map<string, number>; b1: number;
  streak: number;
}
const isMastered = (t?: { n: number; ok: number }) => (!!t && t.n >= 30 && t.ok / t.n >= 0.85 ? 1 : 0);
/** Valor actual de una métrica (los puestos en el ranking se cuentan aparte, en computeAchievements). */
function metricOf(metric: string, S: Stats): number {
  if (metric.startsWith('mastery:')) return isMastered(S.topic.get(metric.slice(8)));
  if (metric.startsWith('game:')) return S.games.get(metric.slice(5)) ?? 0;
  switch (metric) {
    case 'correct': return S.correct;
    case 'answers': return S.answers;
    case 'indep': return S.indep;
    case 'points': return S.points;
    case 'run': return S.bestRun;
    case 'dayCorrect': return Math.max(0, ...S.dayCorrect.values());
    case 'dayAnswers': return Math.max(0, ...S.dayAnswers.values());
    case 'topics': return S.topic.size;
    case 'streak': return S.streak;
    case 'days': return S.days.size;
    case 'weekDays': return Math.max(0, ...[...S.weekDays.values()].map((x) => x.size));
    case 'missions': return S.missions;
    case 'missionStreak': return S.bestMissionRun;
    case 'early': return S.early;
    case 'night': return S.night;
    case 'weekend': return S.weekend;
    case 'activities': return S.activities;
    case 'perfect': return S.perfect;
    case 'b1': return S.b1;
    default: return 0;
  }
}
const PODIUM_METRICS = new Set(['podiums', 'champions']);

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
  const S: Stats = {
    answers: 0, correct: 0, indep: 0, points: 0, run: 0, bestRun: 0, dayCorrect: new Map(), dayAnswers: new Map(), topic, days: new Set(),
    weekDays: new Map(), missions: 0, missionRun: 0, bestMissionRun: 0, lastMissionDay: '', early: 0, night: 0, weekend: 0,
    activities: 0, perfect: 0, games: new Map(), b1: 0, streak: 0,
  };
  const GENERIC = ACHIEVEMENTS.filter((a) => a.metric && !PODIUM_METRICS.has(a.metric));
  for (const e of evs) {
    const day = madridDay(e.at);
    if (day !== lastDay) { streak = lastDay && prevDay(day) === lastDay ? streak + 1 : 1; lastDay = day; bestStreak = Math.max(bestStreak, streak); }
    S.streak = bestStreak; S.days.add(day);
    S.points += e.points;
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
      // acumuladores de los logros ampliados
      S.answers++; if (e.ok) S.correct++;
      if (e.ok && !e.assisted) S.indep++;
      S.run = e.ok ? S.run + 1 : 0; S.bestRun = Math.max(S.bestRun, S.run);
      S.dayAnswers.set(day, (S.dayAnswers.get(day) ?? 0) + 1);
      if (e.ok) S.dayCorrect.set(day, (S.dayCorrect.get(day) ?? 0) + 1);
      const { hour, weekend } = madridHourWeekday(e.at);
      if (hour < 8) S.early++;
      if (hour >= 22) S.night++;
      if (weekend) S.weekend++;
      const wk = isoWeek(e.at); const wd = S.weekDays.get(wk) ?? new Set(); wd.add(day); S.weekDays.set(wk, wd);
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
      S.activities++; S.games.set(e.game, (S.games.get(e.game) ?? 0) + 1);
      if (e.total >= 10 && e.correct === e.total) S.perfect++;
      if (e.level === 'B1' && e.total >= 8 && (e.correct ?? 0) / e.total >= 0.7) S.b1++;
    }
    // misión diaria completada: una por día; racha de días seguidos con misión
    if (e.kind === 'session' && e.source === 'mission') {
      S.missions++;
      if (S.lastMissionDay !== day) {
        S.missionRun = S.lastMissionDay && prevDay(day) === S.lastMissionDay ? S.missionRun + 1 : 1;
        S.lastMissionDay = day; S.bestMissionRun = Math.max(S.bestMissionRun, S.missionRun);
      }
    }
    for (const def of GENERIC) if (!got.has(def.id) && metricOf(def.metric!, S) >= def.goal) hit(def.id, e.at);
  }
  for (const p of podium) { if (p.rank <= 3) hit('podium', p.at); if (p.rank === 1) hit('champion', p.at); }
  // Ranking: cada semana en el podio o ganada cuenta en el instante en que se cerró.
  let podiums = 0, champions = 0;
  for (const p of [...podium].sort((a, b) => a.at - b.at)) {
    if (p.rank <= 3) podiums++;
    if (p.rank === 1) champions++;
    for (const def of ACHIEVEMENTS) {
      if (got.has(def.id) || !def.metric) continue;
      if (def.metric === 'podiums' && podiums >= def.goal) hit(def.id, p.at);
      if (def.metric === 'champions' && champions >= def.goal) hit(def.id, p.at);
    }
  }
  val.set('first-answer', answers); val.set('correct-100', correct); val.set('correct-500', correct); val.set('correct-1000', correct);
  val.set('streak-3', bestStreak); val.set('streak-7', bestStreak); val.set('streak-30', bestStreak);
  val.set('first-activity', activities); val.set('activities-10', activities); val.set('activities-50', activities);
  val.set('all-games', games.size); val.set('master-1', mastered); val.set('master-3', mastered);
  val.set('explorer', Math.max(0, ...[...weekTopics.values()].map((s) => s.size)));
  val.set('boxer', games.has('boxing') ? 1 : 0); val.set('builder', games.has('jenga') ? 1 : 0);
  val.set('podium', podium.some((p) => p.rank <= 3) ? 1 : 0); val.set('champion', podium.some((p) => p.rank === 1) ? 1 : 0);
  for (const def of ACHIEVEMENTS) {
    if (!def.metric) continue;
    val.set(def.id, def.metric === 'podiums' ? podiums : def.metric === 'champions' ? champions : metricOf(def.metric, S));
  }
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
