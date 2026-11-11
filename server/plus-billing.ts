// Suscripción Plus mes a mes (sin pasarela de pago): el alumno paga (se acuerda por WhatsApp) y el profesor confirma «Pago recibido»
// en Teacher OS, que suma 1 mes de Plus. Prueba gratis de 3 días que el alumno activa él mismo, una vez por cuenta.
// Plus con fecha caduca solo (vuelve a Free); Plus «sin fecha» (activado a mano antes de esto) no caduca.
// Se guarda en DATA_DIR/plus-billing.json (cloud-sync lo sube como el resto de *.json). El servidor decide.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLUS_PRICE_EUR = 12.5;
export const TRIAL_DAYS = 3;
const DAY = 86_400_000;

export interface Payment { at: number; months: number; eur: number; /** «manual»: confirmado por el profesor. «bizum» = registros antiguos. */ method: 'manual' | 'bizum' }
/** Días regalados (invitar a un amigo). No son pagos: no cuentan como ingresos. */
export interface Bonus { at: number; days: number; reason: 'referral'; ref?: string }
export interface Sub { until: number | null; trialAt?: number; trialUntil?: number; payments: Payment[]; bonuses?: Bonus[] }
interface Data { version: 1; subs: Record<string, Sub> }

export interface PlusInfo { until: number | null; trial: boolean; trialUsed: boolean; payments: Payment[]; paidEur: number; bonusDays: number }

/** Suma meses de calendario (31 ene + 1 mes = último día de febrero). */
export function addMonths(at: number, months: number): number {
  const d = new Date(at); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

export class PlusBilling {
  data: Data = { version: 1, subs: {} };
  readonly file: string | null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(opts: { dataDir?: string; now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
    this.file = opts.dataDir ? join(opts.dataDir, 'plus-billing.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1 && raw.subs) this.data = { version: 1, subs: raw.subs }; }
      catch (e) { console.error('[plus] no se pudo leer plus-billing.json; se empieza vacío:', (e as Error).message); }
    }
  }
  now: () => number;

  /** Fin de Plus con fecha, o null si no hay fecha (Free o Plus sin fecha). */
  untilOf(id: string): number | null { return this.data.subs[id]?.until ?? null; }
  /** ¿Plus caducado? (solo aplica a Plus con fecha). */
  expired(id: string): boolean { const u = this.untilOf(id); return u !== null && u <= this.now(); }

  info(id: string): PlusInfo {
    const s = this.data.subs[id];
    const until = s?.until ?? null, t = this.now();
    return {
      until, trial: !!(s?.trialUntil && until !== null && until === s.trialUntil && until > t), trialUsed: !!s?.trialAt,
      payments: [...(s?.payments ?? [])].sort((a, b) => b.at - a.at), paidEur: (s?.payments ?? []).reduce((n, p) => n + p.eur, 0),
      bonusDays: (s?.bonuses ?? []).reduce((n, b) => n + b.days, 0),
    };
  }

  /** «Pago recibido»: +N meses desde hoy o desde el final actual si aún no ha caducado. */
  pay(id: string, months = 1, method: Payment['method'] = 'manual'): PlusInfo {
    const s = (this.data.subs[id] ??= { until: null, payments: [] }), t = this.now();
    const base = s.until !== null && s.until > t ? s.until : t;
    s.until = addMonths(base, months);
    s.payments.push({ at: t, months, eur: Math.round(PLUS_PRICE_EUR * months * 100) / 100, method });
    this.#save();
    return this.info(id);
  }
  /** Deshace el último pago (error al pulsar). Resta sus meses. */
  undoPayment(id: string): PlusInfo {
    const s = this.data.subs[id]; const p = s?.payments.pop();
    if (s && p && s.until !== null) s.until = Math.max(this.now(), addMonths(s.until, -p.months));
    this.#save();
    return this.info(id);
  }

  /** Regala días de Plus (invitar a un amigo): se suman desde hoy o desde el final actual si aún no ha caducado.
   * Quien tiene Plus «sin fecha» (activado a mano, no caduca) no lo necesita: no se toca (si no, empezaría a caducar). */
  grantDays(id: string, days: number, reason: Bonus['reason'], ref?: string, hasUndatedPlus = false): { granted: boolean; until: number | null } {
    const s = (this.data.subs[id] ??= { until: null, payments: [] }), t = this.now();
    if (hasUndatedPlus && s.until === null) return { granted: false, until: null };
    const base = s.until !== null && s.until > t ? s.until : t;
    s.until = base + days * DAY;
    (s.bonuses ??= []).push({ at: t, days, reason, ...(ref ? { ref } : {}) });
    this.#save();
    return { granted: true, until: s.until };
  }
  /** Quita días regalados (el profesor anula una invitación premiada). Nunca deja la fecha antes de hoy. */
  revokeDays(id: string, ref: string): number {
    const s = this.data.subs[id]; const i = s?.bonuses?.findIndex((b) => b.ref === ref) ?? -1;
    if (!s || i < 0) return 0;
    const [b] = s.bonuses!.splice(i, 1);
    if (s.until !== null) s.until = Math.max(this.now(), s.until - b.days * DAY);
    this.#save();
    return b.days;
  }

  /** Prueba gratis de 3 días: una vez por cuenta y solo si ahora no tiene Plus. */
  startTrial(id: string, hasPlusNow: boolean): { ok: true; info: PlusInfo } | { ok: false; error: string } {
    const s = (this.data.subs[id] ??= { until: null, payments: [] }), t = this.now();
    if (s.trialAt) return { ok: false, error: 'Ya usaste tu prueba gratis de Plus.' };
    if (hasPlusNow) return { ok: false, error: 'Ya tienes Plus.' };
    s.trialAt = t; s.trialUntil = t + TRIAL_DAYS * DAY; s.until = s.trialUntil;
    this.#save();
    return { ok: true, info: this.info(id) };
  }

  /** El profesor quita Plus: se acaba ya (los pagos quedan en el historial). Plus «sin fecha»: until = null. */
  stop(id: string) { const s = this.data.subs[id]; if (s) { s.until = null; this.#save(); } }

  /** Resumen para Teacher OS. `planOf` = plan efectivo; `alias` para mostrar. */
  summary(ids: { id: string; alias: string; plus: boolean }[], monthKey: (at: number) => string) {
    const t = this.now(), month = monthKey(t);
    const active = ids.filter((a) => a.plus).map((a) => ({ id: a.id, alias: a.alias, ...this.info(a.id) }));
    const paying = active.filter((a) => a.until !== null && !a.trial);
    let incomeMonth = 0, incomeTotal = 0;
    for (const s of Object.values(this.data.subs)) for (const p of s.payments) { incomeTotal += p.eur; if (monthKey(p.at) === month) incomeMonth += p.eur; }
    return {
      price: PLUS_PRICE_EUR, month,
      plus: active.length, paying: paying.length, trials: active.filter((a) => a.trial).length, noDate: active.filter((a) => a.until === null).length,
      mrrEur: Math.round(paying.length * PLUS_PRICE_EUR * 100) / 100,
      incomeMonthEur: Math.round(incomeMonth * 100) / 100, incomeTotalEur: Math.round(incomeTotal * 100) / 100,
      expiringSoon: active.filter((a) => a.until !== null && a.until - t <= 5 * DAY).sort((a, b) => a.until! - b.until!)
        .map((a) => ({ id: a.id, alias: a.alias, until: a.until!, trial: a.trial })),
      subscribers: active.sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity))
        .map((a) => ({ id: a.id, alias: a.alias, until: a.until, trial: a.trial, paidEur: a.paidEur, since: a.payments.at(-1)?.at ?? null })),
    };
  }

  forget(id: string) { delete this.data.subs[id]; this.#save(); }
  #save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}
