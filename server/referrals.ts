// «Invita a un amigo y ganáis una semana de Plus». Lo decide el servidor:
//  - Cada cuenta tiene un código propio (/i/CODIGO). El amigo lo usa al crear su cuenta (o en las 48 h siguientes desde /invitar).
//  - La semana NO se da al registrarse: se da cuando el amigo completa su primera actividad real (práctica, misión, Klaus…),
//    para que no salga a cuenta crear cuentas vacías. Entonces AMBOS reciben +7 días de Plus (se suman a lo que ya tengan).
//  - Antiabuso: no vale tu propio código, un solo código por cuenta, solo cuentas nuevas (≤ 48 h), máx. 3 altas con código
//    por IP y día, máx. 10 semanas ganadas por quien invita (MAX_REWARDS), y el profesor puede anular una invitación desde Teacher OS.
// Se guarda en DATA_DIR/referrals.json (cloud-sync lo sube como el resto de *.json).
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const REFERRAL_DAYS = 7;
export const MAX_REWARDS = 10;
export const CLAIM_WINDOW_MS = 48 * 3_600_000;
export const IP_PER_DAY = 3;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I: se dicta sin errores

export type RefStatus = 'pending' | 'rewarded' | 'cancelled';
export interface Referral { invitee: string; inviter: string; code: string; at: number; status: RefStatus; rewardedAt?: number; cancelledAt?: number; ipKey?: string }
interface Data { version: 1; codes: Record<string, string>; byInvitee: Record<string, Referral>; ipDay: Record<string, number> }

export type ClaimError = 'code' | 'self' | 'already' | 'old' | 'ip' | 'invitee-has-code';
const MSG: Record<ClaimError, string> = {
  code: 'Ese código de invitación no existe.',
  self: 'No puedes usar tu propio código.',
  already: 'Tu cuenta ya tiene un código de invitación.',
  old: 'Los códigos de invitación solo valen para cuentas nuevas (las primeras 48 horas).',
  ip: 'Demasiadas cuentas nuevas con invitación desde esta conexión hoy. Prueba mañana.',
  'invitee-has-code': 'Tu cuenta ya tiene un código de invitación.',
};

export class Referrals {
  data: Data = { version: 1, codes: {}, byInvitee: {}, ipDay: {} };
  readonly file: string | null;
  now: () => number;
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(opts: { dataDir?: string; now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
    this.file = opts.dataDir ? join(opts.dataDir, 'referrals.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1) this.data = { version: 1, codes: raw.codes ?? {}, byInvitee: raw.byInvitee ?? {}, ipDay: raw.ipDay ?? {} }; }
      catch (e) { console.error('[referrals] no se pudo leer referrals.json; se empieza vacío:', (e as Error).message); }
    }
  }

  /** Código de la cuenta (se crea la primera vez). */
  codeOf(accountId: string): string {
    const found = Object.entries(this.data.codes).find(([, id]) => id === accountId);
    if (found) return found[0];
    let code = '';
    do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (this.data.codes[code]);
    this.data.codes[code] = accountId; this.#save();
    return code;
  }
  /** Normaliza lo que escribe el alumno (minúsculas, espacios, guiones). */
  static clean(code: unknown): string { return typeof code === 'string' ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) : ''; }
  ownerOf(code: unknown): string | null { return this.data.codes[Referrals.clean(code)] ?? null; }

  /** El amigo usa un código. `createdAt` de su cuenta; `ipKey` = IP (para el tope diario); `day` = día de Madrid. */
  claim(invitee: { id: string; createdAt: number }, rawCode: unknown, ipKey: string, day: string): { ok: true; ref: Referral } | { ok: false; code: ClaimError; error: string } {
    const no = (c: ClaimError) => ({ ok: false as const, code: c, error: MSG[c] });
    const code = Referrals.clean(rawCode), inviter = this.data.codes[code];
    if (!inviter) return no('code');
    if (inviter === invitee.id) return no('self');
    if (this.data.byInvitee[invitee.id]) return no('already');
    if (this.now() - invitee.createdAt > CLAIM_WINDOW_MS) return no('old');
    const k = `${day}|${ipKey}`;
    if ((this.data.ipDay[k] ?? 0) >= IP_PER_DAY) return no('ip');
    this.data.ipDay[k] = (this.data.ipDay[k] ?? 0) + 1;
    for (const key of Object.keys(this.data.ipDay)) if (!key.startsWith(day)) delete this.data.ipDay[key];
    const ref: Referral = { invitee: invitee.id, inviter, code, at: this.now(), status: 'pending' };
    this.data.byInvitee[invitee.id] = ref; this.#save();
    return { ok: true, ref };
  }

  /** Primera actividad real del amigo: si tiene invitación pendiente y quien invita no ha llegado al tope → se premia.
   * Devuelve a quién dar +7 días (el amigo siempre; quien invita solo si no superó MAX_REWARDS). */
  activate(inviteeId: string): { invitee: string; inviter: string | null } | null {
    const r = this.data.byInvitee[inviteeId];
    if (!r || r.status !== 'pending') return null;
    r.status = 'rewarded'; r.rewardedAt = this.now(); this.#save();
    return { invitee: r.invitee, inviter: this.rewardsOf(r.inviter) <= MAX_REWARDS ? r.inviter : null };
  }
  rewardsOf(inviterId: string): number { return Object.values(this.data.byInvitee).filter((r) => r.inviter === inviterId && r.status === 'rewarded').length; }

  /** Profesor: anula una invitación (si ya estaba premiada, el que llama resta los días). */
  cancel(inviteeId: string): Referral | null {
    const r = this.data.byInvitee[inviteeId]; if (!r || r.status === 'cancelled') return null;
    const was = { ...r }; r.status = 'cancelled'; r.cancelledAt = this.now(); this.#save();
    return was;
  }

  /** Lo que ve el alumno en /invitar. `alias` resuelve el nombre de sus amigos. */
  mine(accountId: string, alias: (id: string) => string | null) {
    const mineAsInviter = Object.values(this.data.byInvitee).filter((r) => r.inviter === accountId && r.status !== 'cancelled').sort((a, b) => b.at - a.at);
    const asInvitee = this.data.byInvitee[accountId];
    return {
      code: this.codeOf(accountId), days: REFERRAL_DAYS, max: MAX_REWARDS,
      rewarded: mineAsInviter.filter((r) => r.status === 'rewarded').length,
      friends: mineAsInviter.map((r) => ({ alias: alias(r.invitee) ?? 'Cuenta borrada', status: r.status as 'pending' | 'rewarded', at: r.at })),
      invitedBy: asInvitee && asInvitee.status !== 'cancelled' ? { alias: alias(asInvitee.inviter) ?? '—', status: asInvitee.status } : null,
    };
  }

  /** Teacher OS: todas las invitaciones, más recientes primero. */
  all(): Referral[] { return Object.values(this.data.byInvitee).sort((a, b) => b.at - a.at); }

  /** Al borrar una cuenta: fuera su código y sus invitaciones como amigo (las que hizo como anfitrión se conservan). */
  forget(id: string) {
    for (const [c, owner] of Object.entries(this.data.codes)) if (owner === id) delete this.data.codes[c];
    delete this.data.byInvitee[id]; this.#save();
  }

  #save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}
