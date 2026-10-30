// Expiración de salas por inactividad. Pura: se prueba con un reloj falso.
/**
 * Códigos de las salas cuya última actividad es anterior a `at - ttlMs`.
 * Las salas sin marca de actividad (guardadas por una versión anterior) reciben `at` como marca: tienen un TTL completo de gracia
 * en lugar de borrarse al instante, así una actualización del servidor nunca elimina una partida en curso.
 */
export function roomsToExpire<R>(rooms: Record<string, R>, last: (r: R) => number | undefined, stamp: (r: R, at: number) => void, at: number, ttlMs: number | ((r: R) => number)): string[] {
  const gone: string[] = [];
  for (const [code, room] of Object.entries(rooms)) {
    const l = last(room);
    if (typeof l !== 'number' || !Number.isFinite(l)) { stamp(room, at); continue; }
    if (at - l > (typeof ttlMs === 'function' ? ttlMs(room) : ttlMs)) gone.push(code);
  }
  return gone;
}

export const CLASS_ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const PRACTICE_ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 3;

/** Salas BlackCard/Jenga/práctica caducadas: sin actividad más allá de su TTL Y sin ningún cliente conectado. */
/** Una práctica/solitario ya TERMINADA no tiene nada que reanudar: se cierra a la hora. */
export const FINISHED_PRACTICE_TTL_MS = 60 * 60 * 1000;
/** Sala privada del modo libre: abandonada a las 2 h, terminada a los 10 min. */
export const PRIVATE_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
export const PRIVATE_FINISHED_TTL_MS = 10 * 60 * 1000;
export function staleRooms(rooms: Iterable<[string, { mode: 'class' | 'practice'; updatedAt: number; phase?: string; private?: unknown }]>, hasClients: (code: string) => boolean, at: number): string[] {
  const out: string[] = [];
  for (const [code, s] of rooms) {
    const ttl = s.private ? (s.phase === 'final' ? PRIVATE_FINISHED_TTL_MS : PRIVATE_IDLE_TTL_MS) : s.mode === 'practice' ? (s.phase === 'final' ? FINISHED_PRACTICE_TTL_MS : PRACTICE_ROOM_TTL_MS) : CLASS_ROOM_TTL_MS;
    if (at - s.updatedAt > ttl && !hasClients(code)) out.push(code);
  }
  return out;
}
