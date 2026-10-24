// Abrir o reanudar una práctica individual («modo repaso»). Pura respecto a la red: se prueba sin WebSocket.
import type { Topic } from '../shared/types.ts';
import { TOPICS } from '../shared/rules.ts';
import { Room, type Deps } from './room.ts';
import { PRACTICE_SIZES } from './select.ts';
import type { Profile } from './store.ts';

export interface PracticeEnv {
  rooms: Map<string, Room>;
  deps: Deps;
  newRoomCode: () => string;
  profileByCode: (code: string) => Profile | undefined;
  ensureProfile: (id: string | undefined, name: string) => Profile;
}

export interface PracticeHello {
  room?: unknown; token?: unknown; profile?: unknown; profileCode?: unknown; name?: unknown; topics?: unknown; focus?: unknown; size?: unknown;
}

export type PracticeOpen =
  | { ok: true; room: Room; profile: Profile; resumed: boolean; notice?: string }
  | { ok: false; error: string };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
export const cleanTopics = (v: unknown): Topic[] => (Array.isArray(v) ? [...new Set(v.filter((t): t is Topic => typeof t === 'string' && Object.hasOwn(TOPICS, t)))] : []);
export const cleanSize = (v: unknown): number => ((PRACTICE_SIZES as readonly number[]).includes(Number(v)) ? Number(v) : 15);

/**
 * Reanuda la práctica de la sala/token guardados o empieza otra.
 * Si la sala guardada ya no existe (p. ej. el servidor se ha reiniciado) se empieza una nueva automáticamente con un aviso,
 * conservando perfil, temas y tamaño: el alumno nunca se queda en una pantalla muerta.
 */
export function openPractice(env: PracticeEnv, m: PracticeHello): PracticeOpen {
  const code = str(m.room).toUpperCase();
  const token = str(m.token);
  const prev = code ? env.rooms.get(code) : undefined;
  const mine = prev && prev.s.mode === 'practice' && token && prev.s.players[0]?.token === token ? prev : undefined;
  if (mine && mine.s.players[0]) {
    const prof = env.ensureProfile(mine.s.players[0].profile, '');
    return { ok: true, room: mine, profile: prof, resumed: true };
  }
  let prof: Profile | undefined;
  const pcode = str(m.profileCode).trim().toUpperCase();
  if (pcode) {
    prof = env.profileByCode(pcode);
    if (!prof) return { ok: false, error: 'No encuentro ese código de alumno. Revísalo o déjalo vacío.' };
  }
  const name = str(m.name).slice(0, 16);
  prof ??= env.ensureProfile(str(m.profile) || undefined, name || 'Alumno');
  const topics = cleanTopics(m.topics);
  const focus = !!m.focus;
  const size = cleanSize(m.size);
  // Prácticas anteriores de este alumno que ya nadie tiene abiertas: fuera (no se acumulan en memoria ni en disco).
  for (const [k, r] of env.rooms) {
    if (r.s.mode === 'practice' && r.s.players[0]?.profile === prof.id && !r.s.players[0].connected) env.rooms.delete(k);
  }
  const room = Room.create(env.deps, env.newRoomCode(), 'practice');
  const joined = room.join(name || prof.name || 'Alumno', prof.id);
  if ('ok' in joined) return { ok: false, error: 'No se pudo crear la práctica.' };
  env.rooms.set(room.s.code, room);
  room.startPractice(joined, topics, focus, prof.stats, size);
  const notice = code ? 'Tu práctica anterior ya no estaba disponible (el servidor se reinició): empezamos una nueva.' : undefined;
  return { ok: true, room, profile: prof, resumed: false, ...(notice ? { notice } : {}) };
}
