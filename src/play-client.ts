// Cliente del modo libre: cuentas de alumno, catálogo, progreso propio y ranking. La sesión va en `X-Student-Session`.
import type { AccountPub, GameInfo, Level, ProgressSummary, RankingEntry, SessionWelcome } from '../shared/play.ts';
import { setStudentSession, studentSession } from './util.ts';

export interface Catalog {
  games: GameInfo[];
  levels: { id: Level; label: string; diffs: string[] }[];
  topics: { id: string; de: string; es: string; pool: Record<Level, number> }[];
  boxingTopics: { id: string; name: string; pool: number }[];
}

export async function playRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const session = studentSession();
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(session ? { 'X-Student-Session': session } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data: unknown;
  try { data = await res.json(); } catch { throw new Error('El servidor no ha respondido correctamente. Reintenta en unos segundos.'); }
  if (!res.ok) {
    // Sesión caducada: se olvida para no seguir enviándola.
    if (res.status === 401 && session && path.startsWith('/api/account/') && !path.endsWith('/login')) setStudentSession(null);
    throw new Error(typeof (data as { error?: unknown })?.error === 'string' ? (data as { error: string }).error : 'No se pudo completar la acción.');
  }
  return data as T;
}

export const getCatalog = () => playRequest<Catalog>('/api/play/catalog');
export const getLeaderboard = () => playRequest<{ week: string; entries: RankingEntry[] }>('/api/play/leaderboard');
export const getMe = () => playRequest<{ account: AccountPub }>('/api/account/me');
export const getProgress = () => playRequest<ProgressSummary>('/api/account/progress');
export async function signIn(kind: 'login' | 'register', alias: string, password: string, rankingOptIn = false) {
  const r = await playRequest<SessionWelcome>(`/api/account/${kind}`, { alias, password, ...(kind === 'register' ? { rankingOptIn } : {}) });
  setStudentSession(r.token);
  return r.account;
}
export async function signOut() {
  try { await playRequest('/api/account/logout', {}); } finally { setStudentSession(null); }
}
export const setRanking = (rankingOptIn: boolean) => playRequest<{ account: AccountPub }>('/api/account/settings', { rankingOptIn });
export async function deleteAccount(password: string) { await playRequest('/api/account/delete', { password }); setStudentSession(null); }
