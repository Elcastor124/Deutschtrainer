// Abrir o reanudar una práctica individual («modo repaso»). Pura respecto a la red: se prueba sin WebSocket.
import type { Topic } from '../shared/types.ts';
import { LEVEL_DIFFS, isLevel } from '../shared/play.ts';
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
  /** Perfil de una sala que se REANUDA con su token (de confianza: el token ya demostró que es suya). Por defecto, ensureProfile. */
  resumeProfile?: (id: string) => Profile;
  /**
   * MODO LIBRE: perfil de la cuenta (sesión de alumno válida) o de invitado (transitorio, sin persistencia ni progreso).
   * Devuelve un error si se aportó una sesión caducada o inválida: nunca se degrada en silencio a invitado.
   */
  freeProfile?: (m: PracticeHello, name: string) => Profile | { error: string };
}

export interface PracticeHello {
  room?: unknown; token?: unknown; profile?: unknown; profileCode?: unknown; name?: unknown; topics?: unknown; focus?: unknown; size?: unknown;
  /** Modo libre (ver docs/FREE_PLAY.md). Sin `free`, el comportamiento es el de siempre (perfil de dispositivo). */
  free?: unknown; session?: unknown; game?: unknown; level?: unknown;
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
    const prof = (env.resumeProfile ?? env.ensureProfile)(mine.s.players[0].profile, '');
    return { ok: true, room: mine, profile: prof, resumed: true };
  }
  let prof: Profile | undefined;
  const free = m.free === true && !!env.freeProfile;
  if (free) {
    const fp = env.freeProfile!(m, str(m.name).slice(0, 16));
    if ('error' in fp) return { ok: false, error: fp.error };
    prof = fp;
  }
  const pcode = free ? '' : str(m.profileCode).trim().toUpperCase();
  if (pcode) {
    prof = env.profileByCode(pcode);
    if (!prof) return { ok: false, error: 'No encuentro ese código de alumno. Revísalo o déjalo vacío.' };
  }
  // Cuenta del modo libre: se muestra siempre su alias, nunca un nombre escrito en el momento.
  const name = free && prof?.id.startsWith('acc_') ? prof.name : str(m.name).slice(0, 16);
  prof ??= env.ensureProfile(str(m.profile) || undefined, name || 'Alumno');
  const topics = cleanTopics(m.topics);
  const focus = !!m.focus;
  const size = cleanSize(m.size);
  const level = free && isLevel(m.level) ? m.level : undefined;
  const game = free && m.game === 'jenga' ? 'jenga' : 'blackcard';
  if (free) {
    // Combinación sin preguntas suficientes (p. ej. un tema con poco B1): se avisa en vez de empezar una sesión vacía.
    const diffs = level ? LEVEL_DIFFS[level] : undefined;
    const pool = [...env.deps.bank.values()].filter((q) => (!topics.length || topics.includes(q.topic)) && (!diffs || diffs.includes(q.diff)) && (game !== 'jenga' || q.topic !== 'lesen')).length;
    if (pool < 5) return { ok: false, error: 'Hay muy pocas preguntas para esa combinación de nivel y temas. Elige más temas u otro nivel.' };
  }
  // Prácticas anteriores de este alumno que ya nadie tiene abiertas: fuera (no se acumulan en memoria ni en disco).
  for (const [k, r] of env.rooms) {
    if (r.s.mode === 'practice' && r.s.players[0]?.profile === prof.id && !r.s.players[0].connected) env.rooms.delete(k);
  }
  const room = Room.create(env.deps, env.newRoomCode(), 'practice');
  const joined = room.join(name || prof.name || 'Alumno', prof.id);
  if ('ok' in joined) return { ok: false, error: 'No se pudo crear la práctica.' };
  env.rooms.set(room.s.code, room);
  if (game === 'jenga') room.startSoloJenga(joined, topics, level);
  else room.startPractice(joined, topics, focus, prof.stats, size, level);
  const notice = code ? 'Tu práctica anterior ya no estaba disponible (el servidor se reinició): empezamos una nueva.' : undefined;
  return { ok: true, room, profile: prof, resumed: false, ...(notice ? { notice } : {}) };
}
