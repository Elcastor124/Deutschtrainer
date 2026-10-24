// Cliente de /api/progress (puntos semanales). Solo pide el resumen del propio perfil del dispositivo.
import { profileId } from './util.ts';

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

/** '2026-W43' → 'S43' (S = semana). */
export const weekLabel = (week: string) => `S${week.split('-W')[1] ?? '?'}`;
