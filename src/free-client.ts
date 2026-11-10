// Estado de los límites del plan Free (lo decide el servidor: GET /api/free/status).
export interface FreeStatus {
  plan: 'free' | 'plus' | null; enabled: boolean;
  limits: { lektionenPerDay: number; practicePerDay: number };
  lektionen?: { opened: string[]; today: string[]; left: number | null };
  practice?: { used: number; left: number | null };
}
export async function freeStatus(): Promise<FreeStatus> {
  const r = await fetch('/api/free/status', { headers: { 'x-student-session': 'cookie' }, credentials: 'same-origin' });
  if (!r.ok) throw new Error('No se pudo leer tu plan.');
  return r.json();
}
/** ¿Puede abrir ya la Lektion n sin gastar cupo? (ya abierta o Plus). null = sin cuenta. */
export function lektionState(st: FreeStatus | null, unitN: number): 'open' | 'new' | 'blocked' | 'account' {
  if (!st || st.plan === null) return 'account';
  if (st.plan === 'plus' || !st.enabled) return 'open';
  if (st.lektionen?.opened.includes(String(unitN))) return 'open';
  return (st.lektionen?.left ?? 0) > 0 ? 'new' : 'blocked';
}
