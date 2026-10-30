// Credenciales de profesor respaldadas por el servidor (transición desde el token de sala).
//  - Las claves son aleatorias (256 bits), se generan en el servidor con `npm run teacher -- add <nombre>` y se muestran UNA vez.
//  - Solo se guarda su hash salado (DATA_DIR/teachers.json, modo 0600). Nada en el código ni en variables de entorno.
//  - TEACHER_AUTH = off | optional (por defecto) | required.
//      optional: crear sala sin clave sigue funcionando (compatibilidad); con clave válida la sala queda ligada al profesor
//                y este puede recuperarla sin el token de la sala. Las creaciones «legacy» se cuentan en /api/health.
//      required: crear sala exige clave válida. Entrar en salas ya creadas (token de sala) NO cambia.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type TeacherAuthMode = 'off' | 'optional' | 'required';
interface TeacherRecord { id: string; name: string; salt: string; hash: string; createdAt: number; revokedAt?: number; sessions?: { h: string; exp: number }[] }
const TEACHER_SESSION_MS = 12 * 3_600_000;
const KEY_RE = /^dtk_([0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
const hash = (salt: string, secret: string) => createHash('sha256').update(salt).update(secret).digest('hex');

export function parseMode(v: string | undefined): TeacherAuthMode {
  return v === 'off' || v === 'required' ? v : 'optional';
}

export class TeacherDirectory {
  private teachers: TeacherRecord[] = [];
  private stamp = '';
  readonly file: string;
  constructor(dataDir: string) {
    this.file = join(dataDir, 'teachers.json');
    this.load();
  }
  /** Huella del fichero (mtime+tamaño+inodo): detecta cambios hechos por el CLI, que es otro proceso. */
  private fingerprint() { try { const st = statSync(this.file); return `${st.mtimeMs}:${st.size}:${st.ino}`; } catch { return ''; } }
  /** Recarga desde disco si el fichero cambió: una clave nueva o una revocación valen sin reiniciar el servidor. */
  refresh() { if (this.fingerprint() !== this.stamp) this.load(); }
  load() {
    this.stamp = this.fingerprint();
    try {
      if (!existsSync(this.file)) { this.teachers = []; return; }
      const raw = JSON.parse(readFileSync(this.file, 'utf8'));
      this.teachers = Array.isArray(raw?.teachers) ? raw.teachers.filter((t: TeacherRecord) => t && typeof t.id === 'string' && typeof t.salt === 'string' && typeof t.hash === 'string') : [];
    } catch (e) {
      console.error('[teachers] no se pudo leer teachers.json; se ignora (ningún profesor registrado):', (e as Error).message);
      this.teachers = [];
    }
  }
  private save() {
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, teachers: this.teachers }), { mode: 0o600 });
    renameSync(tmp, this.file);
    this.stamp = this.fingerprint();
  }
  get activeCount() { this.refresh(); return this.teachers.filter((t) => !t.revokedAt).length; }
  list() { return this.teachers.map(({ id, name, createdAt, revokedAt }) => ({ id, name, createdAt, ...(revokedAt ? { revokedAt } : {}) })); }

  /** Crea un profesor. Devuelve la clave en claro: es la única vez que existe fuera de la memoria de quien la recibe. */
  issue(name: string, now = Date.now()): { id: string; key: string } {
    this.load();
    const id = randomBytes(6).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const salt = randomBytes(16).toString('hex');
    this.teachers.push({ id, name: name.trim().slice(0, 40) || 'Profesor', salt, hash: hash(salt, secret), createdAt: now });
    this.save();
    return { id, key: `dtk_${id}.${secret}` };
  }
  /** Profesor ligado a TEACHER_PASSWORD (variable de entorno del servidor; nunca en el repositorio). */
  ensurePasswordTeacher(): string {
    this.refresh();
    const t = this.teachers.find((x) => x.name === 'Profesor (contraseña)' && !x.revokedAt);
    return t ? t.id : this.issue('Profesor (contraseña)').id;
  }
  revoke(id: string, now = Date.now()): boolean {
    this.load();
    const t = this.teachers.find((x) => x.id === id && !x.revokedAt);
    if (!t) return false;
    t.revokedAt = now;
    this.save();
    return true;
  }
  /** Sesión de Teacher OS tras verificar la clave (cookie HttpOnly). 12 h; solo se guarda el hash. */
  startSession(id: string, now = Date.now()): string {
    this.load();
    const t = this.teachers.find((x) => x.id === id && !x.revokedAt);
    if (!t) throw new Error('profesor desconocido');
    const token = `dtt_${randomBytes(32).toString('base64url')}`;
    t.sessions = (t.sessions ?? []).filter((s) => s.exp > now).slice(-4);
    t.sessions.push({ h: createHash('sha256').update(token).digest('hex'), exp: now + TEACHER_SESSION_MS });
    this.save();
    return token;
  }
  static readonly SESSION_SECONDS = TEACHER_SESSION_MS / 1000;
  /** id del profesor de una sesión válida (no caducada, no revocada) o null. Solo tokens `dtt_`. */
  verifySession(token: unknown, now = Date.now()): string | null {
    if (typeof token !== 'string' || !token.startsWith('dtt_') || token.length > 80) return null;
    this.refresh();
    const h = createHash('sha256').update(token).digest('hex');
    const t = this.teachers.find((x) => !x.revokedAt && x.sessions?.some((s) => s.h === h && s.exp > now));
    return t ? t.id : null;
  }
  endSession(token: string) {
    this.load();
    const h = createHash('sha256').update(token).digest('hex');
    for (const t of this.teachers) if (t.sessions?.some((s) => s.h === h)) { t.sessions = t.sessions.filter((s) => s.h !== h); this.save(); }
  }
  nameOf(id: string) { return this.teachers.find((t) => t.id === id)?.name ?? ''; }

  /** id del profesor si la clave es válida y no está revocada. Comparación en tiempo constante. */
  verify(key: unknown): string | null {
    if (typeof key !== 'string') return null;
    const m = KEY_RE.exec(key);
    if (!m) return null;
    this.refresh();
    const t = this.teachers.find((x) => x.id === m[1]);
    const salt = t?.salt ?? '0'.repeat(32);
    const expected = Buffer.from(t?.hash ?? '0'.repeat(64), 'hex');
    const got = Buffer.from(hash(salt, m[2]), 'hex');
    const same = expected.length === got.length && timingSafeEqual(expected, got);
    return t && same && !t.revokedAt ? t.id : null;
  }
}
