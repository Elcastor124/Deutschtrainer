// Cuentas de ALUMNO del modo libre. Independientes de las credenciales de profesor (server/teacher-auth.ts):
// distinto fichero, distinto prefijo de token (dts_ / dtk_), distinta cabecera (X-Student-Session / X-Teacher-Key) y distinto alcance.
//  - Contraseña con scrypt (sal propia por cuenta); sesiones = token aleatorio de 256 bits del que solo se guarda el hash.
//  - El alias es lo único que puede verse en el ranking, y solo si el alumno lo activa. No se piden ni guardan datos personales.
//  - No hay recuperación de contraseña (no hay correo): se documenta; el alumno puede darse de baja y empezar de nuevo.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASSWORD_MIN } from '../shared/play.ts';

const SESSION_MS = 30 * 24 * 3_600_000;
const MAX_SESSIONS = 5;
const MAX_ACCOUNTS = 20_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const kdf = (pw: string, salt: string) => new Promise<Buffer>((res, rej) => scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'hex'), 32, SCRYPT, (e, k) => (e ? rej(e) : res(k))));

interface SessionRec { h: string; exp: number }
export interface Account {
  id: string; alias: string; aliasKey: string; salt: string; hash: string; createdAt: number;
  rankingOptIn: boolean; aliasStatus: 'approved' | 'blocked'; sessions: SessionRec[];
  /** Desactivada por un profesor: no puede entrar y sus sesiones dejan de valer. Sus datos se conservan. */
  disabled?: boolean;
  /** Alta creada por un profesor (contraseña temporal entregada en mano). */
  createdBy?: 'teacher';
  /** Colección de Klaus: skins ganadas, la equipada, lootboxes por abrir y semanas ganadas ya cobradas. */
  klaus?: { owned: string[]; equipped: string; boxes: number; won: string[] };
}

const RESERVED = ['admin', 'administrador', 'profesor', 'profesora', 'teacher', 'lehrer', 'lehrerin', 'invitado', 'guest', 'gast', 'klaus', 'ashlabs', 'deutschtrainer', 'sistema', 'system', 'moderador', 'root', 'null', 'undefined'];
// Lista mínima y no exhaustiva: la moderación real es el bloqueo manual (scripts/accounts-admin.mjs) y que el ranking sea opcional.
const BAD = ['puta', 'puto', 'mierda', 'joder', 'cabron', 'coño', 'polla', 'pene', 'nazi', 'hitler', 'scheisse', 'scheiße', 'arsch', 'fotze', 'hure', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'nigg', 'porn', 'sex'];
const ALIAS_RE = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,15}$/u;
const COMMON = ['password', 'contraseña', 'passwort', '1234567890', 'qwertyuiop', 'abcdefghij', '0123456789', 'deutschtrainer'];

export const aliasKey = (a: string) => a.normalize('NFKC').toLowerCase();

/** null = válido. */
export function validateAlias(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Escribe un alias.';
  const a = raw.normalize('NFKC').trim();
  if (!ALIAS_RE.test(a)) return 'El alias debe tener de 3 a 16 caracteres: letras, números, punto, guion o guion bajo.';
  const k = aliasKey(a).replace(/[._-]/g, '');
  if ((a.match(/\d/g) ?? []).length >= 7) return 'Un alias no puede parecer un teléfono. Elige otro.';
  if (/\.(com|es|de|net|org|io)$/i.test(a)) return 'Un alias no puede ser una dirección web.';
  if (RESERVED.includes(k) || BAD.some((b) => k.includes(b))) return 'Ese alias no está permitido. Elige otro.';
  return null;
}
export function validatePassword(pw: unknown, alias: string): string | null {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (pw.length > 128) return 'La contraseña es demasiado larga (máximo 128).';
  const l = pw.toLowerCase();
  if (l.includes(aliasKey(alias)) || COMMON.some((c) => l.includes(c)) || /^(.)\1+$/.test(pw)) return 'Esa contraseña es demasiado fácil de adivinar.';
  return null;
}

export type Fail = { ok: false; status: 400 | 401 | 409 | 503; error: string };
export class AccountStore {
  readonly file: string;
  private accounts: Account[] = [];
  private byAlias = new Map<string, Account>();
  private byToken = new Map<string, Account>();
  private now: () => number;
  private dummy: Promise<Buffer>;

  constructor(dataDir: string, now: () => number = Date.now) {
    this.now = now;
    this.file = join(dataDir, 'accounts.json');
    this.dummy = kdf('x', '00'.repeat(16)); // para igualar el tiempo de un alias inexistente (no revela qué alias existen)
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        if (Array.isArray(raw?.accounts)) this.accounts = raw.accounts.filter((a: Account) => a && typeof a.id === 'string' && a.id.startsWith('acc_') && typeof a.hash === 'string');
      }
    } catch (e) { console.error('[accounts] no se pudo leer accounts.json; se empieza vacío:', (e as Error).message); }
    for (const a of this.accounts) { a.sessions ??= []; a.aliasStatus ??= 'approved'; this.index(a); }
  }
  private index(a: Account) {
    this.byAlias.set(a.aliasKey, a);
    for (const s of a.sessions) this.byToken.set(s.h, a);
  }
  private save() {
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, accounts: this.accounts }), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
  get count() { return this.accounts.length; }

  private startSession(a: Account): string {
    const t = this.now();
    a.sessions = a.sessions.filter((s) => s.exp > t);
    while (a.sessions.length >= MAX_SESSIONS) { const old = a.sessions.shift()!; this.byToken.delete(old.h); }
    const token = `dts_${randomBytes(32).toString('base64url')}`;
    const h = sha(token);
    a.sessions.push({ h, exp: t + SESSION_MS });
    this.byToken.set(h, a);
    return token;
  }

  async register(alias: unknown, password: unknown, rankingOptIn = false): Promise<{ ok: true; token: string; account: Account } | Fail> {
    const e = validateAlias(alias);
    if (e) return { ok: false, status: 400, error: e };
    const a = (alias as string).normalize('NFKC').trim();
    const pe = validatePassword(password, a);
    if (pe) return { ok: false, status: 400, error: pe };
    if (this.accounts.length >= MAX_ACCOUNTS) return { ok: false, status: 503, error: 'No se admiten más cuentas ahora mismo.' };
    if (this.byAlias.has(aliasKey(a))) return { ok: false, status: 409, error: 'Ese alias ya está en uso.' };
    const salt = randomBytes(16).toString('hex');
    const hash = (await kdf(password as string, salt)).toString('hex');
    if (this.byAlias.has(aliasKey(a))) return { ok: false, status: 409, error: 'Ese alias ya está en uso.' }; // carrera durante el hash
    const acc: Account = { id: `acc_${randomBytes(16).toString('hex')}`, alias: a, aliasKey: aliasKey(a), salt, hash, createdAt: this.now(), rankingOptIn: !!rankingOptIn, aliasStatus: 'approved', sessions: [] };
    this.accounts.push(acc); this.index(acc);
    const token = this.startSession(acc);
    this.save();
    return { ok: true, token, account: acc };
  }

  async login(alias: unknown, password: unknown): Promise<{ ok: true; token: string; account: Account } | Fail> {
    const bad: Fail = { ok: false, status: 401, error: 'Alias o contraseña incorrectos.' };
    if (typeof alias !== 'string' || typeof password !== 'string' || password.length > 128) return bad;
    const acc = this.byAlias.get(aliasKey(alias.trim()));
    const got = await kdf(password, acc?.salt ?? '00'.repeat(16));
    const expected = acc ? Buffer.from(acc.hash, 'hex') : await this.dummy;
    const same = expected.length === got.length && timingSafeEqual(expected, got);
    if (!acc || !same) return bad;
    if (acc.disabled) return { ok: false, status: 401, error: 'Esta cuenta está desactivada. Habla con tu profesor.' };
    const token = this.startSession(acc);
    this.save();
    return { ok: true, token, account: acc };
  }

  /** Cuenta de una sesión válida (no caducada) o null. Solo acepta tokens `dts_…`: una clave de profesor nunca vale aquí. */
  verify(token: unknown): Account | null {
    if (typeof token !== 'string' || !token.startsWith('dts_') || token.length > 80) return null;
    const a = this.byToken.get(sha(token));
    if (!a) return null;
    const s = a.sessions.find((x) => x.h === sha(token));
    if (!s || s.exp <= this.now() || a.disabled) return null;
    return a;
  }
  logout(token: string) {
    const a = this.verify(token); if (!a) return;
    const h = sha(token);
    a.sessions = a.sessions.filter((s) => s.h !== h); this.byToken.delete(h); this.save();
  }
  /** Guarda cambios hechos sobre la cuenta (p. ej. su colección de Klaus). */
  persist() { this.save(); }
  setRanking(a: Account, on: boolean) { a.rankingOptIn = on; this.save(); }
  /** Cambia la contraseña verificando la actual. Cierra todas las demás sesiones (por si alguien más la conocía). */
  async changePassword(a: Account, current: unknown, next: unknown, keepToken: string): Promise<{ ok: true } | Fail> {
    if (typeof current !== 'string' || current.length > 128) return { ok: false, status: 401, error: 'La contraseña actual no es correcta.' };
    const got = await kdf(current, a.salt); const exp = Buffer.from(a.hash, 'hex');
    if (got.length !== exp.length || !timingSafeEqual(got, exp)) return { ok: false, status: 401, error: 'La contraseña actual no es correcta.' };
    const e = validatePassword(next, a.alias);
    if (e) return { ok: false, status: 400, error: e };
    if (next === current) return { ok: false, status: 400, error: 'La nueva contraseña debe ser distinta de la actual.' };
    a.salt = randomBytes(16).toString('hex');
    a.hash = (await kdf(next as string, a.salt)).toString('hex');
    const keep = sha(keepToken);
    for (const s of a.sessions) if (s.h !== keep) this.byToken.delete(s.h);
    a.sessions = a.sessions.filter((s) => s.h === keep);
    this.save();
    return { ok: true };
  }
  async remove(a: Account, password: unknown): Promise<boolean> {
    if (typeof password !== 'string') return false;
    const got = await kdf(password, a.salt); const exp = Buffer.from(a.hash, 'hex');
    if (got.length !== exp.length || !timingSafeEqual(got, exp)) return false;
    this.accounts = this.accounts.filter((x) => x !== a); this.byAlias.delete(a.aliasKey);
    for (const s of a.sessions) this.byToken.delete(s.h);
    this.save();
    return true;
  }
  /** Baja decidida por el profesor (sin contraseña del alumno). Cierra todas sus sesiones. */
  removeByTeacher(a: Account) {
    this.accounts = this.accounts.filter((x) => x !== a); this.byAlias.delete(a.aliasKey);
    for (const s of a.sessions) this.byToken.delete(s.h);
    this.save();
  }
  /** Moderación: un alias bloqueado deja de mostrarse en el ranking y la cuenta sale de él. */
  setAliasStatus(alias: string, status: 'approved' | 'blocked'): boolean {
    const a = this.byAlias.get(aliasKey(alias)); if (!a) return false;
    a.aliasStatus = status; this.save(); return true;
  }
  byId(id: string) { return this.accounts.find((a) => a.id === id); }
  all(): readonly Account[] { return this.accounts; }
  static readonly SESSION_SECONDS = SESSION_MS / 1000;
  /** Desactivar (o reactivar). Desactivar cierra todas sus sesiones. Solo lo llama la API de profesor. */
  setDisabled(a: Account, disabled: boolean) {
    a.disabled = disabled;
    if (disabled) { for (const s of a.sessions) this.byToken.delete(s.h); a.sessions = []; }
    this.save();
  }
  /** Alta por el profesor: contraseña temporal aleatoria (se muestra una vez). El alumno puede cambiarla en su cuenta. */
  async createByTeacher(alias: unknown): Promise<{ ok: true; account: Account; password: string } | Fail> {
    const words = ['Apfel', 'Brezel', 'Dackel', 'Fahrrad', 'Gurke', 'Kaffee', 'Laterne', 'Mond', 'Nebel', 'Ofen', 'Regen', 'Sonne', 'Tasse', 'Vogel', 'Wolke', 'Zug'];
    const pick = () => words[randomBytes(1)[0] % words.length];
    const password = `${pick()}-${pick()}-${pick()}-${100 + (randomBytes(2).readUInt16BE() % 900)}`;
    const r = await this.register(alias, password, false);
    if (!r.ok) return r;
    r.account.createdBy = 'teacher';
    r.account.sessions = []; this.byToken.forEach((v, k) => { if (v === r.account) this.byToken.delete(k); });
    this.save();
    return { ok: true, account: r.account, password };
  }
  /** El profesor genera una contraseña temporal nueva (p. ej. si el alumno la olvidó). Cierra sus sesiones. */
  async resetByTeacher(a: Account): Promise<string> {
    const password = `Neu-${randomBytes(6).toString('base64url')}`;
    a.salt = randomBytes(16).toString('hex');
    a.hash = (await kdf(password, a.salt)).toString('hex');
    for (const s of a.sessions) this.byToken.delete(s.h);
    a.sessions = [];
    this.save();
    return password;
  }
  /** Cuentas que pueden aparecer en el ranking: lo activó el alumno Y el alias está aprobado. */
  rankable(): Map<string, string> {
    return new Map(this.accounts.filter((a) => a.rankingOptIn && a.aliasStatus === 'approved').map((a) => [a.id, a.alias]));
  }
}
