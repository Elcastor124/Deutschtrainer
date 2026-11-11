// Estado de los límites del plan Free (lo decide el servidor: GET /api/free/status).
export interface FreeStatus {
  plan: 'free' | 'plus' | null; enabled: boolean;
  limits: { lektionenPerDay: number; practicePerDay: number };
  lektionen?: { opened: string[]; today: string[]; left: number | null };
  practice?: { used: number; left: number | null };
}
const CACHE = 'dt:free-status';
export async function freeStatus(): Promise<FreeStatus> {
  const r = await fetch('/api/free/status', { headers: { 'x-student-session': 'cookie' }, credentials: 'same-origin' });
  if (!r.ok) throw new Error('No se pudo leer tu plan.');
  const st = await r.json() as FreeStatus;
  try { localStorage.setItem(CACHE, JSON.stringify({ alias: localStorage.getItem('dt:student-alias'), st })); } catch { /* sin almacenamiento */ }
  return st;
}
/** Estado para el PRIMER pintado (sin esperar a la red, así la página no salta al llegar la respuesta):
 * sin cuenta → «sin cuenta» (se sabe ya); con cuenta → lo último que dijo el servidor para ESA cuenta, o null. */
export function initialFreeStatus(alias: string | null): FreeStatus | null {
  if (!alias) return { plan: null, enabled: true, limits: { lektionenPerDay: 2, practicePerDay: 2 } };
  try { const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null'); return c && c.alias === alias ? c.st as FreeStatus : null; } catch { return null; }
}
/** ¿Puede abrir ya la Lektion n sin gastar cupo? (ya abierta o Plus). null = sin cuenta. */
export function lektionState(st: FreeStatus | null, unitN: number): 'open' | 'new' | 'blocked' | 'account' {
  if (!st || st.plan === null) return 'account';
  if (st.plan === 'plus' || !st.enabled) return 'open';
  if (st.lektionen?.opened.includes(String(unitN))) return 'open';
  return (st.lektionen?.left ?? 0) > 0 ? 'new' : 'blocked';
}
