// Cliente del modo libre: cuentas de alumno, catálogo, progreso propio y ranking. La sesión va en `X-Student-Session`.
import type { AccountPub, AchievementState, GameInfo, Level, ProgressSummary, RankingEntry, RankingView, SessionWelcome } from '../shared/play.ts';
import { setStudentSession, store, studentSession } from './util.ts';

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
export const getAchievements = () => playRequest<{ achievements: AchievementState[] }>('/api/account/achievements');
export const getRanking = (which: 'current' | 'previous' = 'current', limit = 50, signal?: AbortSignal) => playRequest<RankingView>(`/api/play/leaderboard?week=${which}&limit=${limit}`, undefined, signal);
export const getMe = () => playRequest<{ account: AccountPub }>('/api/account/me');
export const getProgress = () => playRequest<ProgressSummary>('/api/account/progress');
/** Avisa a la navegación (y a quien escuche) de que la cuenta cambió. El alias se guarda para mostrarlo sin pedirlo al servidor. */
function announce(account: AccountPub | null) {
  if (account) store.set('dt:student-alias', account.alias); else store.del('dt:student-alias');
  dispatchEvent(new CustomEvent('dt:account'));
}
export const cachedAlias = () => store.get('dt:student-alias');
export async function signIn(kind: 'login' | 'register', alias: string, password: string, rankingOptIn = false) {
  const r = await playRequest<SessionWelcome>(`/api/account/${kind}`, { alias, password, ...(kind === 'register' ? { rankingOptIn } : {}) });
  setStudentSession(r.token);
  announce(r.account);
  return r.account;
}
export async function signOut() {
  try { await playRequest('/api/account/logout', {}); } finally { setStudentSession(null); announce(null); }
}
export const changePassword = (current: string, next: string) => playRequest('/api/account/password', { current, next });
/** Comprueba la sesión guardada; si caducó, la olvida. */
export async function refreshAccount(): Promise<AccountPub | null> {
  if (!studentSession()) { if (cachedAlias()) announce(null); return null; }
  try { const a = (await getMe()).account; announce(a); return a; } catch { setStudentSession(null); announce(null); return null; }
}
export const setRanking = (rankingOptIn: boolean) => playRequest<{ account: AccountPub }>('/api/account/settings', { rankingOptIn });
export async function deleteAccount(password: string) { await playRequest('/api/account/delete', { password }); setStudentSession(null); announce(null); }
