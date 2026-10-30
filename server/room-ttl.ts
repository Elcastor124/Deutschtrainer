// Expiración de salas por inactividad. Pura: se prueba con un reloj falso.
/**
 * Códigos de las salas cuya última actividad es anterior a `at - ttlMs`.
 * Las salas sin marca de actividad (guardadas por una versión anterior) reciben `at` como marca: tienen un TTL completo de gracia
 * en lugar de borrarse al instante, así una actualización del servidor nunca elimina una partida en curso.
 */
export function roomsToExpire<R>(rooms: Record<string, R>, last: (r: R) => number | undefined, stamp: (r: R, at: number) => void, at: number, ttlMs: number): string[] {
  const gone: string[] = [];
  for (const [code, room] of Object.entries(rooms)) {
    const l = last(room);
    if (typeof l !== 'number' || !Number.isFinite(l)) { stamp(room, at); continue; }
    if (at - l > ttlMs) gone.push(code);
  }
  return gone;
}

export const CLASS_ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const PRACTICE_ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 3;

/** Salas BlackCard/Jenga/práctica caducadas: sin actividad más allá de su TTL Y sin ningún cliente conectado. */
export function staleRooms(rooms: Iterable<[string, { mode: 'class' | 'practice'; updatedAt: number }]>, hasClients: (code: string) => boolean, at: number): string[] {
  const out: string[] = [];
  for (const [code, s] of rooms) {
    const ttl = s.mode === 'practice' ? PRACTICE_ROOM_TTL_MS : CLASS_ROOM_TTL_MS;
    if (at - s.updatedAt > ttl && !hasClients(code)) out.push(code);
  }
  return out;
}
