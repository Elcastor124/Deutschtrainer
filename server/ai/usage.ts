// Klaus AI · cuotas, presupuesto y métricas. Todo se decide en el SERVIDOR (React solo muestra lo que el servidor dice).
//  · reserve → (llamada al proveedor) → commit | release: una operación fallida NO consume cuota; un requestId repetido NO cobra dos veces.
//  · Tope de operaciones simultáneas por cuenta y límite global por minuto: sin bucles de generación ni sesiones que consuman sin fin.
//  · Métricas por operación SIN texto del alumno ni identificadores directos (cuenta → hash corto).
//  · Retención: registros 90 días; `forget(accountId)` borra contadores y su rastro al eliminar la cuenta.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KlausFeature, KlausPlan } from '../../shared/klaus-ai.ts';
import { madridDay } from '../progress.ts';
import { SlidingLimiter } from '../limits.ts';
import type { KlausAiConfig, Usage } from './providers.ts';

export type Limits = Record<KlausFeature, number>;
export const DEFAULT_LIMITS: Record<KlausPlan, Limits> = {
  // Cifras provisionales (spec §13): editables por entorno sin tocar código.
  // `text` = mensajes/revisiones CON IA al día. Al agotarse, Klaus sigue en modo práctica (local, sin límite), no se corta.
  free: { text: 3, voiceSeconds: 60, ttsChars: 1500, klasseSessions: 1, klasseAsks: 3 },
  plus: { text: 80, voiceSeconds: 1800, ttsChars: 40000, klasseSessions: 20, klasseAsks: 40 },
};
export function loadLimits(env: NodeJS.ProcessEnv = process.env): Record<KlausPlan, Limits> {
  const out = { free: { ...DEFAULT_LIMITS.free }, plus: { ...DEFAULT_LIMITS.plus } };
  for (const plan of ['free', 'plus'] as const) {
    const raw = env[`KLAUS_LIMITS_${plan.toUpperCase()}`];
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as Record<string, unknown>;
      for (const k of Object.keys(out[plan]) as KlausFeature[]) if (typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0) out[plan][k] = Math.floor(v[k]);
    } catch { console.error(`[klaus-ai] KLAUS_LIMITS_${plan.toUpperCase()} no es JSON válido; se usan los valores por defecto.`); }
  }
  return out;
}

export interface UsageRecord {
  at: number; day: string; op: string; feature: KlausFeature | 'none'; who: string; session: string | null;
  provider: string; model: string; real: boolean; aiCall: boolean; cached: boolean;
  inputTokens: number; outputTokens: number; audioSeconds: number; ttsChars: number; latencyMs: number;
  ok: boolean; error: string | null; costEur: number | null;
}
interface Data { version: 1; plans: Record<string, KlausPlan>; counters: Record<string, Record<string, Partial<Record<KlausFeature, number>>>>; records: UsageRecord[] }
const RETENTION_MS = 90 * 86_400_000, MAX_RECORDS = 6000;

export type Admit = { ok: true; ticket: Ticket; cached?: undefined } | { ok: true; cached: unknown; ticket?: undefined } | { ok: false; status: 402 | 429 | 503; error: string; code: 'quota' | 'busy' | 'budget' | 'rate' };
export interface Ticket { accountId: string; feature: KlausFeature; amount: number; day: string; requestId: string | null; done: boolean }

export class AiUsage {
  readonly file: string | null;
  data: Data = { version: 1, plans: {}, counters: {}, records: [] };
  #timer: NodeJS.Timeout | null = null;
  #inflight = new Map<string, number>();
  #results = new Map<string, { at: number; value: unknown }>();
  #pending = new Map<string, Promise<unknown>>();
  #minute: SlidingLimiter;
  readonly limits: Record<KlausPlan, Limits>;
  config: KlausAiConfig;
  constructor(config: KlausAiConfig, opts: { dataDir?: string; now?: () => number; limits?: Record<KlausPlan, Limits>; plusAliases?: string[]; maxInflight?: number; globalPerMinute?: number } = {}) {
    this.config = config;
    this.now = opts.now ?? Date.now;
    this.limits = opts.limits ?? loadLimits();
    this.maxInflight = opts.maxInflight ?? 2;
    this.#minute = new SlidingLimiter(opts.globalPerMinute ?? 60, 60_000, this.now);
    this.plusAliases = new Set((opts.plusAliases ?? (process.env.KLAUS_PLUS_ALIASES ?? '').split(',')).map((s) => s.trim().toLowerCase()).filter(Boolean));
    this.file = opts.dataDir ? join(opts.dataDir, 'ai-usage.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1) this.data = { version: 1, plans: raw.plans ?? {}, counters: raw.counters ?? {}, records: Array.isArray(raw.records) ? raw.records : [] }; }
      catch (e) { console.error('[klaus-ai] no se pudo leer ai-usage.json; se empieza vacío:', (e as Error).message); }
    }
  }
  now: () => number; maxInflight: number; plusAliases: Set<string>;

  // ── Planes: SOLO el servidor decide. Sin pagos reales: alias en KLAUS_PLUS_ALIASES o setPlan() desde código/administración.
  planOf(accountId: string, alias?: string): KlausPlan { return this.data.plans[accountId] ?? (alias && this.plusAliases.has(alias.toLowerCase()) ? 'plus' : 'free'); }
  setPlan(accountId: string, plan: KlausPlan) { this.data.plans[accountId] = plan; this.#save(); }

  used(accountId: string, feature: KlausFeature): number { return this.data.counters[accountId]?.[madridDay(this.now())]?.[feature] ?? 0; }
  remaining(accountId: string, plan: KlausPlan): Record<KlausFeature, { used: number; limit: number }> {
    const out = {} as Record<KlausFeature, { used: number; limit: number }>;
    for (const f of Object.keys(this.limits[plan]) as KlausFeature[]) out[f] = { used: this.used(accountId, f), limit: this.limits[plan][f] };
    return out;
  }
  spentEur(sinceDay?: string): number { return this.data.records.reduce((s, r) => s + (sinceDay && r.day < sinceDay ? 0 : r.costEur ?? 0), 0); }

  /** Comprueba permisos y consumo ANTES de llamar al proveedor y reserva la cantidad. `requestId` repetido devuelve el resultado guardado. */
  admit(o: { accountId: string; alias?: string; feature: KlausFeature; amount: number; requestId?: string | null; real: boolean }): Admit {
    const requestId = o.requestId ? String(o.requestId).slice(0, 64) : null;
    this.#sweepResults();
    if (requestId && this.#results.has(`${o.accountId}:${requestId}`)) return { ok: true, cached: this.#results.get(`${o.accountId}:${requestId}`)!.value };
    const plan = this.planOf(o.accountId, o.alias), limit = this.limits[plan][o.feature], day = madridDay(this.now());
    const used = this.used(o.accountId, o.feature);
    if (used + o.amount > limit) return { ok: false, status: 402, code: 'quota', error: plan === 'free' ? 'Has llegado al límite diario del plan Free. Mañana se renueva; Plus amplía este límite.' : 'Has llegado al límite diario de tu plan. Mañana se renueva.' };
    if ((this.#inflight.get(o.accountId) ?? 0) >= this.maxInflight) return { ok: false, status: 429, code: 'busy', error: 'Ya tienes peticiones en curso. Espera a que terminen.' };
    if (o.real) {
      if (this.spentEur() >= this.config.budgetEur) return { ok: false, status: 503, code: 'budget', error: 'El presupuesto de Klaus AI está agotado. Avisa al profesor.' };
      if (this.spentEur(day) >= this.config.dailyBudgetEur) return { ok: false, status: 503, code: 'budget', error: 'Klaus AI ha alcanzado el límite de gasto de hoy. Inténtalo mañana.' };
    }
    if (!this.#minute.take('*')) return { ok: false, status: 429, code: 'rate', error: 'Klaus está recibiendo demasiadas peticiones. Espera un momento.' };
    this.#inflight.set(o.accountId, (this.#inflight.get(o.accountId) ?? 0) + 1);
    const c = ((this.data.counters[o.accountId] ??= {})[day] ??= {});
    c[o.feature] = (c[o.feature] ?? 0) + o.amount;
    this.#save();
    return { ok: true, ticket: { accountId: o.accountId, feature: o.feature, amount: o.amount, day, requestId, done: false } };
  }
  /** La operación terminó bien: se conserva el consumo y se guarda el resultado para el requestId. */
  commit(t: Ticket, result?: unknown) {
    if (t.done) return; t.done = true; this.#leave(t.accountId);
    if (t.requestId && result !== undefined) this.#results.set(`${t.accountId}:${t.requestId}`, { at: this.now(), value: result });
  }
  /** La operación falló: se devuelve la cantidad reservada (un error del proveedor no cuesta cuota al alumno). */
  release(t: Ticket) {
    if (t.done) return; t.done = true; this.#leave(t.accountId);
    const c = this.data.counters[t.accountId]?.[t.day]; if (c) c[t.feature] = Math.max(0, (c[t.feature] ?? 0) - t.amount);
    this.#save();
  }
  /** Ajusta el consumo real (p. ej. segundos de audio reales frente a los reservados). */
  adjust(t: Ticket, actual: number) {
    const c = this.data.counters[t.accountId]?.[t.day]; if (!c) return;
    c[t.feature] = Math.max(0, (c[t.feature] ?? 0) - t.amount + actual); t.amount = actual; this.#save();
  }
  /** Deduplica peticiones idénticas en vuelo (doble clic / reintento del cliente): comparten una sola llamada. */
  shared<T>(key: string, run: () => Promise<T>): Promise<T> {
    const p = this.#pending.get(key) as Promise<T> | undefined; if (p) return p;
    const np = run().finally(() => this.#pending.delete(key)); this.#pending.set(key, np); return np;
  }
  #leave(accountId: string) { const n = (this.#inflight.get(accountId) ?? 1) - 1; if (n <= 0) this.#inflight.delete(accountId); else this.#inflight.set(accountId, n); }
  #sweepResults() { const cut = this.now() - 600_000; for (const [k, v] of this.#results) if (v.at < cut) this.#results.delete(k); }

  // ── Coste y métricas
  costOf(u: { inputTokens?: number; outputTokens?: number; audioSeconds?: number; ttsChars?: number }, kind: 'llm' | 'stt' | 'tts', real: boolean): number | null {
    if (!real) return 0;
    const p = this.config.prices, usd = kind === 'llm' ? p.llmInPerM !== null && p.llmOutPerM !== null ? ((u.inputTokens ?? 0) * p.llmInPerM + (u.outputTokens ?? 0) * p.llmOutPerM) / 1e6 : null
      : kind === 'stt' ? p.sttPerMinute !== null ? ((u.audioSeconds ?? 0) / 60) * p.sttPerMinute : null
      : p.ttsPer1kChars !== null ? ((u.ttsChars ?? 0) / 1000) * p.ttsPer1kChars : null;
    return usd === null ? null : usd * this.config.eurPerUsd;
  }
  who(accountId: string): string { return createHash('sha256').update(`klaus:${accountId}`).digest('hex').slice(0, 10); }
  record(r: Partial<UsageRecord> & Pick<UsageRecord, 'op' | 'provider' | 'model' | 'real'> & { accountId: string; feature?: KlausFeature; usage?: Usage }) {
    const at = this.now();
    this.data.records.push({
      at, day: madridDay(at), op: r.op, feature: r.feature ?? 'none', who: this.who(r.accountId), session: r.session ?? null,
      provider: r.provider, model: r.model, real: r.real, aiCall: r.aiCall ?? false, cached: r.cached ?? false,
      inputTokens: r.usage?.inputTokens ?? r.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? r.outputTokens ?? 0,
      audioSeconds: r.audioSeconds ?? 0, ttsChars: r.ttsChars ?? 0, latencyMs: r.latencyMs ?? 0, ok: r.ok ?? true, error: r.error ?? null, costEur: r.costEur ?? 0,
    });
    const cut = at - RETENTION_MS;
    if (this.data.records.length > MAX_RECORDS || this.data.records[0]?.at < cut) this.data.records = this.data.records.filter((x) => x.at >= cut).slice(-MAX_RECORDS);
    this.#save();
  }
  /** Resumen agregado para el profesor: sin textos ni identificadores directos. */
  summary() {
    const rs = this.data.records, real = rs.filter((r) => r.real);
    const by = <K extends string>(f: (r: UsageRecord) => K) => { const m: Record<string, { calls: number; ok: number; costEur: number | null; inputTokens: number; outputTokens: number; avgLatencyMs: number }> = {}; for (const r of rs) { const k = f(r); const e = (m[k] ??= { calls: 0, ok: 0, costEur: 0, inputTokens: 0, outputTokens: 0, avgLatencyMs: 0 }); e.calls++; if (r.ok) e.ok++; e.inputTokens += r.inputTokens; e.outputTokens += r.outputTokens; e.avgLatencyMs += r.latencyMs; if (r.costEur === null || e.costEur === null) e.costEur = null; else e.costEur += r.costEur; } for (const e of Object.values(m)) e.avgLatencyMs = e.calls ? Math.round(e.avgLatencyMs / e.calls) : 0; return m; };
    const users = new Set(real.map((r) => r.who)), days = new Set(real.map((r) => r.day));
    const total = real.reduce<number | null>((s, r) => (s === null || r.costEur === null ? null : s + r.costEur), 0);
    return {
      operations: rs.length, aiCalls: rs.filter((r) => r.aiCall).length, withoutAi: rs.filter((r) => !r.aiCall).length, cached: rs.filter((r) => r.cached).length,
      realCalls: real.length, spentEur: total, budgetEur: this.config.budgetEur, byOp: by((r) => r.op), byDay: by((r) => r.day),
      // Proyección SOLO con llamadas reales medidas; con 0 llamadas reales el coste es desconocido (no se inventa).
      costPerActiveUserDayEur: real.length && total !== null && users.size && days.size ? total / users.size / days.size : null,
      note: real.length ? 'Coste medido con llamadas reales.' : 'Sin llamadas reales todavía: el coste por usuario es desconocido.',
    };
  }
  forget(accountId: string) {
    delete this.data.plans[accountId]; delete this.data.counters[accountId];
    const w = this.who(accountId); this.data.records = this.data.records.filter((r) => r.who !== w); this.#save();
  }
  #save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}
