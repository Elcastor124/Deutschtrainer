// Política de seguridad del servidor: límites de creación, intentos fallidos y credenciales de profesor.
// Un único objeto (`Guard`) que comparten el WebSocket y los manejadores HTTP; todo en memoria, por proceso.
import type { IncomingMessage } from 'node:http';
import { SlidingLimiter, clientIp, envInt } from './limits.ts';
import { TeacherDirectory, parseMode, type TeacherAuthMode } from './teacher-auth.ts';

export type RoomKind = 'class' | 'practice' | 'road' | 'boxing';
/** Partidas del modo libre: las crea un alumno (o invitado) con endpoints de jugador; NUNCA dan permisos de profesor. */
export type FreeKind = 'solo' | 'private';
export type Admission = { ok: true; owner?: string } | { ok: false; status: 401 | 429 | 503; error: string };
export type FreeAdmission = { ok: true } | { ok: false; status: 429 | 503; error: string };

const HOUR = 3_600_000;
const MIN = 60_000;
const wait = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} minutos` : `${s} segundos`);

export interface Guard {
  mode: TeacherAuthMode;
  teachers: TeacherDirectory;
  ip(req: Pick<IncomingMessage, 'headers' | 'socket'>): string;
  /** ¿Se puede crear otra sala de este tipo? `count` = salas existentes. Registra la creación si se admite. */
  admitCreate(kind: RoomKind, ip: string, count: number, teacherKey?: unknown): Admission;
  /** Crear una partida del modo libre: límite por IP y por cuenta, y tope global (independientes de las salas de profesor). */
  admitFree(kind: FreeKind, ip: string, count: number, accountId?: string): FreeAdmission;
  /** Cuentas de alumno: registro y acceso con límite de intentos (por IP y por alias). Devuelven un mensaje si hay que denegar. */
  registerBlocked(ip: string): string | null;
  loginBlocked(ip: string, aliasKey: string): string | null;
  loginFailed(ip: string, aliasKey: string): void;
  /** Verifica una clave de profesor (con límite de intentos fallidos por IP). */
  teacherFor(key: unknown, ip: string): { ok: true; id: string } | { ok: false; error: string };
  /** Adivinar códigos de sala: `roomLookupBlocked` se consulta ANTES de buscar; `roomMiss` registra un código inexistente. */
  roomLookupBlocked(ip: string): boolean;
  roomMiss(ip: string): void;
  /** Intentos de código de alumno: `attempt` registra un fallo; `locked` dice si hay que denegar sin mirar. */
  codeLocked(ip: string): string | null;
  codeFailed(ip: string): void;
  /** Cuenta de conexiones WS por IP. */
  wsOpen(ip: string): boolean;
  wsClose(ip: string): void;
  allow(kind: 'progress', ip: string): boolean;
  caps: Record<RoomKind, number>;
  stats(): { mode: TeacherAuthMode; teachers: number; legacyRoomCreates: number };
  sweep(): void;
}

export function createGuard({ dataDir, env = process.env, now = Date.now }: { dataDir: string; env?: NodeJS.ProcessEnv; now?: () => number }): Guard {
  const trust = envInt('TRUST_PROXY', 0, env);
  const mode = parseMode(env.TEACHER_AUTH);
  const teachers = new TeacherDirectory(dataDir);
  const effective = mode;
  // FAIL-CLOSED: con `required` y sin ningún profesor registrado NO se crean salas de profesor (en vez de abrirlas a todos).
  // Las salas ya creadas, el modo libre y los alumnos no se ven afectados.
  if (mode === 'required' && teachers.activeCount === 0) console.error('[auth] TEACHER_AUTH=required y no hay profesores registrados: la creación de salas de profesor queda BLOQUEADA hasta registrar uno (npm run teacher -- add <nombre>).');
  const caps: Record<RoomKind, number> = {
    class: envInt('MAX_CLASS_ROOMS', 300, env), practice: envInt('MAX_PRACTICE_ROOMS', 3000, env),
    road: envInt('MAX_ROAD_ROOMS', 300, env), boxing: envInt('MAX_BOXING_ROOMS', 300, env),
  };
  const perHour = envInt('ROOM_CREATE_PER_HOUR', 30, env);
  const create: Record<RoomKind, SlidingLimiter> = {
    class: new SlidingLimiter(perHour, HOUR, now), road: new SlidingLimiter(perHour, HOUR, now), boxing: new SlidingLimiter(perHour, HOUR, now),
    // La práctica la abre cada alumno (y un colegio comparte IP): umbral alto, solo frena el abuso masivo.
    practice: new SlidingLimiter(envInt('PRACTICE_OPEN_PER_HOUR', 300, env), HOUR, now),
  };
  const roomMissLimiter = new SlidingLimiter(envInt('ROOM_MISS_PER_10MIN', 120, env), 10 * MIN, now);
  const codeIp = new SlidingLimiter(envInt('CODE_FAILS_PER_IP', 8, env), 15 * MIN, now);
  const codeAll = new SlidingLimiter(envInt('CODE_FAILS_GLOBAL_PER_HOUR', 200, env), HOUR, now);
  const keyFails = new SlidingLimiter(envInt('TEACHER_KEY_FAILS_PER_IP', 10, env), 15 * MIN, now);
  const progress = new SlidingLimiter(envInt('PROGRESS_PER_MIN', 120, env), MIN, now);
  const free: Record<FreeKind, SlidingLimiter> = {
    solo: new SlidingLimiter(envInt('FREE_SOLO_PER_HOUR', 60, env), HOUR, now),
    private: new SlidingLimiter(envInt('FREE_PRIVATE_PER_HOUR', 20, env), HOUR, now),
  };
  const freeAcc = new SlidingLimiter(envInt('FREE_PER_ACCOUNT_HOUR', 60, env), HOUR, now);
  const maxFree = envInt('MAX_FREE_ROOMS', 1500, env);
  const regIp = new SlidingLimiter(envInt('REGISTER_PER_IP_HOUR', 8, env), HOUR, now);
  const loginIp = new SlidingLimiter(envInt('LOGIN_FAILS_PER_IP', 10, env), 15 * MIN, now);
  const loginAlias = new SlidingLimiter(envInt('LOGIN_FAILS_PER_ALIAS', 6, env), 15 * MIN, now);
  const maxWs = envInt('MAX_WS_PER_IP', 200, env);
  const ws = new Map<string, number>();
  let legacy = 0;

  const teacherFor: Guard['teacherFor'] = (key, ip) => {
    if (keyFails.blocked(ip)) return { ok: false, error: `Demasiados intentos con clave de profesor no válida. Espera ${wait(keyFails.retryAfter(ip))}.` };
    const id = teachers.verify(key);
    if (!id) { keyFails.record(ip); return { ok: false, error: 'Clave de profesor no válida.' }; }
    return { ok: true, id };
  };

  return {
    mode: effective, teachers, caps,
    ip: (req) => clientIp(req, trust),
    admitCreate(kind, ip, count, key) {
      let owner: string | undefined;
      const hasKey = key !== undefined && key !== null && key !== '';
      if (kind !== 'practice' && effective === 'required' && teachers.activeCount === 0) return { ok: false, status: 503, error: 'La creación de salas de profesor está bloqueada: no hay profesores registrados en el servidor.' };
      if (kind !== 'practice' && effective !== 'off') {
        if (hasKey) {
          const t = teacherFor(key, ip);
          if (!t.ok) return { ok: false, status: 401, error: t.error };
          owner = t.id;
        } else if (effective === 'required') {
          return { ok: false, status: 401, error: 'Para crear salas hace falta la clave de profesor.' };
        }
      }
      if (count >= caps[kind]) return { ok: false, status: 503, error: 'El servidor ha alcanzado el máximo de salas. Inténtalo más tarde.' };
      const lim = create[kind];
      if (lim.blocked(ip)) return { ok: false, status: 429, error: `Demasiadas salas creadas desde tu red. Espera ${wait(lim.retryAfter(ip))}.` };
      lim.record(ip);
      if (kind !== 'practice' && !owner) legacy++;
      return owner ? { ok: true, owner } : { ok: true };
    },
    admitFree(kind, ip, count, accountId) {
      if (count >= maxFree) return { ok: false, status: 503, error: 'El servidor tiene demasiadas partidas libres ahora mismo. Inténtalo más tarde.' };
      const keys = [free[kind], ...(accountId ? [freeAcc] : [])];
      const ids = [ip, ...(accountId ? [accountId] : [])];
      for (let i = 0; i < keys.length; i++) if (keys[i].blocked(ids[i])) return { ok: false, status: 429, error: `Has creado muchas partidas seguidas. Espera ${wait(keys[i].retryAfter(ids[i]))}.` };
      for (let i = 0; i < keys.length; i++) keys[i].record(ids[i]);
      return { ok: true };
    },
    registerBlocked(ip) { if (regIp.blocked(ip)) return `Demasiados registros desde tu red. Espera ${wait(regIp.retryAfter(ip))}.`; regIp.record(ip); return null; },
    loginBlocked(ip, key) {
      if (loginIp.blocked(ip)) return `Demasiados intentos fallidos. Espera ${wait(loginIp.retryAfter(ip))}.`;
      if (loginAlias.blocked(key)) return `Esta cuenta está bloqueada unos minutos por intentos fallidos. Espera ${wait(loginAlias.retryAfter(key))}.`;
      return null;
    },
    loginFailed(ip, key) { loginIp.record(ip); loginAlias.record(key); },
    teacherFor,
    roomLookupBlocked: (ip) => roomMissLimiter.blocked(ip),
    roomMiss: (ip) => roomMissLimiter.record(ip),
    codeLocked: (ip) => {
      if (codeIp.blocked(ip)) return `Demasiados códigos de alumno incorrectos. Espera ${wait(codeIp.retryAfter(ip))} o empieza sin código.`;
      if (codeAll.blocked('*')) return 'La recuperación por código está pausada unos minutos. Empieza sin código o inténtalo más tarde.';
      return null;
    },
    codeFailed: (ip) => { codeIp.record(ip); codeAll.record('*'); },
    wsOpen: (ip) => { const n = ws.get(ip) ?? 0; if (n >= maxWs) return false; ws.set(ip, n + 1); return true; },
    wsClose: (ip) => { const n = (ws.get(ip) ?? 1) - 1; if (n <= 0) ws.delete(ip); else ws.set(ip, n); },
    allow: (_k, ip) => progress.take(ip),
    stats: () => ({ mode: effective, teachers: teachers.activeCount, legacyRoomCreates: legacy }),
    sweep() { for (const l of [...Object.values(create), ...Object.values(free), freeAcc, regIp, loginIp, loginAlias, roomMissLimiter, codeIp, codeAll, keyFails, progress]) l.sweep(); },
  };
}
