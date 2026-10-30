// Cliente de /api/progress (puntos semanales). Solo pide el resumen del propio perfil del dispositivo.
import { profileId, store, studentSession } from './util.ts';
import type { ProgressSummary, RankingView } from '../shared/play.ts';

export interface WeekPoints { week: string; points: number }
export interface TopicStat { topic: string; attempts: number; correct: number; accuracy: number }
export interface MyProgress {
  known: boolean; name: string; code: string; week: string; weekPoints: number;
  rank: number | null; players: number; streak: number;
  history: WeekPoints[]; topics: TopicStat[]; recommended: string[];
}
export interface LeaderboardEntry { rank: number; name: string; points: number }
export interface Leaderboard { week: string; entries: LeaderboardEntry[] }
export type Result<T> = { ok: true; data: T } | { ok: false; offline: boolean };

async function getJson<T>(path: string, signal?: AbortSignal): Promise<Result<T>> {
  let res: Response;
  try { res = await fetch(path, { cache: 'no-store', signal, headers: { Accept: 'application/json' } }); } catch { return { ok: false, offline: true }; }
  // Un hosting estático devuelve el index.html: eso equivale a «sin servidor».
  if (!(res.headers.get('content-type') ?? '').includes('json')) return { ok: false, offline: true };
  if (!res.ok) return { ok: false, offline: false };
  try { return { ok: true, data: (await res.json()) as T }; } catch { return { ok: false, offline: true }; }
}

export const fetchMyProgress = (profile: string = profileId(), signal?: AbortSignal) =>
  getJson<MyProgress>(`/api/progress/me?profile=${encodeURIComponent(profile)}`, signal);
export const fetchLeaderboard = (signal?: AbortSignal) => getJson<Leaderboard>('/api/progress/leaderboard', signal);

/**
 * Con sesión de alumno, los puntos y el ranking son los de la CUENTA (la práctica va por la cuenta): mismo formato que el widget
 * ya entiende. Sin sesión, los del perfil de este dispositivo, como siempre.
 */
export async function fetchWeekly(signal?: AbortSignal, withBoard = true): Promise<{ me: Result<MyProgress>; board: Result<Leaderboard> | null }> {
  const session = studentSession();
  if (!session) return { me: await fetchMyProgress(undefined, signal), board: withBoard ? await fetchLeaderboard(signal) : null };
  const get = async <T,>(path: string): Promise<Result<T>> => {
    try {
      const r = await fetch(path, { cache: 'no-store', signal, headers: { Accept: 'application/json', 'X-Student-Session': session } });
      if (!(r.headers.get('content-type') ?? '').includes('json')) return { ok: false, offline: true };
      return r.ok ? { ok: true, data: await r.json() as T } : { ok: false, offline: false };
    } catch { return { ok: false, offline: true }; }
  };
  const [p, rk] = await Promise.all([get<ProgressSummary>('/api/account/progress'), get<RankingView>('/api/play/leaderboard?limit=10')]);
  if (!p.ok) return { me: p, board: null };
  const alias = store.get('dt:student-alias') ?? '';
  const me: MyProgress = { known: true, name: alias, code: '', week: p.data.week, weekPoints: p.data.weekPoints, rank: p.data.rank, players: rk.ok ? rk.data.players : 0,
    streak: p.data.streak, history: p.data.history ?? [], topics: p.data.topics, recommended: p.data.recommended };
  const board: Result<Leaderboard> | null = withBoard && rk.ok ? { ok: true, data: { week: rk.data.week, entries: rk.data.entries.map((e) => ({ rank: e.rank, name: e.alias, points: e.points })) } } : null;
  return { me: { ok: true, data: me }, board };
}

/** '2026-W43' → 'S43' (S = semana). */
export const weekLabel = (week: string) => `S${week.split('-W')[1] ?? '?'}`;
