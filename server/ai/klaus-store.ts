// Klaus AI · persistencia (JSON atómico en DATA_DIR/klaus-ai.json, modo 0600). Todo se indexa por cuenta VERIFICADA en el servidor.
// Retención: sesiones de conversación y de clase 30 días; borradores hasta que el alumno los borre; NUNCA se guarda audio.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { AI_LIMITS, type AiLevel, type RedetCorrection, type RedetExpression, type WritingReview } from '../../shared/klaus-ai.ts';

export interface DraftReview { id: string; at: number; textSnapshot: string; review: WritingReview; resolved: string[] }
export interface Draft { id: string; title: string; text: string; level: AiLevel; taskId: string | null; updatedAt: number; reviews: DraftReview[] }
export interface RedetTurn { role: 'student' | 'klaus'; text: string; at: number }
export interface RedetSummary { topics: string[]; expressions: RedetExpression[]; mistakes: RedetCorrection[]; suggestions: string[]; source: 'mock' | 'ai' }
export interface RedetSession { id: string; scenarioId: string; /** Tema del modo libre (FREE_TOPICS). */ topic?: string; level: AiLevel; startedAt: number; endedAt: number | null; turns: RedetTurn[]; corrections: RedetCorrection[]; expressions: RedetExpression[]; summary: RedetSummary | null }
export interface KlasseProgress { lessonId: string; level: AiLevel; startedAt: number; updatedAt: number; step: number; plan: string[]; remedialAdded: boolean; answers: Record<string, { choice: string; ok: boolean; tries: number }>; asks: number; finished: boolean; digest: string; sessionId: string }
interface Data { version: 1; drafts: Record<string, Draft[]>; redet: Record<string, RedetSession[]>; klasse: Record<string, KlasseProgress[]> }

export const RETENTION = { redetDays: Number(process.env.KLAUS_REDET_RETENTION_DAYS ?? 30) || 30, klasseDays: Number(process.env.KLAUS_KLASSE_RETENTION_DAYS ?? 30) || 30 };
const DAY = 86_400_000, MAX_REDET = 10, MAX_KLASSE = 20;
export const newId = (p: string) => `${p}_${randomBytes(9).toString('base64url')}`;

export class KlausStore {
  readonly file: string | null;
  data: Data = { version: 1, drafts: {}, redet: {}, klasse: {} };
  #timer: NodeJS.Timeout | null = null;
  private now: () => number;
  constructor(dataDir?: string, now: () => number = Date.now) {
    this.now = now;
    this.file = dataDir ? join(dataDir, 'klaus-ai.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1) this.data = { version: 1, drafts: raw.drafts ?? {}, redet: raw.redet ?? {}, klasse: raw.klasse ?? {} }; }
      catch (e) { console.error('[klaus-ai] no se pudo leer klaus-ai.json; se empieza vacío:', (e as Error).message); }
    }
  }
  // ── Borradores
  drafts(a: string): Draft[] { return (this.data.drafts[a] ??= []); }
  draft(a: string, id: string): Draft | null { return this.drafts(a).find((d) => d.id === id) ?? null; }
  saveDraft(a: string, input: { id?: string; title: string; text: string; level: AiLevel; taskId: string | null }): Draft | { error: string } {
    const list = this.drafts(a);
    let d = input.id ? list.find((x) => x.id === input.id) : undefined;
    if (!d) {
      if (list.length >= AI_LIMITS.draftsMax) return { error: `Tienes el máximo de ${AI_LIMITS.draftsMax} borradores. Borra alguno para crear otro.` };
      d = { id: newId('dr'), title: '', text: '', level: input.level, taskId: input.taskId, updatedAt: 0, reviews: [] }; list.unshift(d);
    }
    d.title = input.title; d.text = input.text; d.level = input.level; d.taskId = input.taskId; d.updatedAt = this.now(); this.save();
    return d;
  }
  deleteDraft(a: string, id: string): boolean { const l = this.drafts(a), i = l.findIndex((d) => d.id === id); if (i < 0) return false; l.splice(i, 1); this.save(); return true; }
  addReview(a: string, id: string, textSnapshot: string, review: WritingReview): DraftReview | null {
    const d = this.draft(a, id); if (!d) return null;
    const r: DraftReview = { id: newId('rv'), at: this.now(), textSnapshot, review, resolved: [] };
    d.reviews.unshift(r); d.reviews = d.reviews.slice(0, AI_LIMITS.reviewsPerDraftMax); d.updatedAt = this.now(); this.save(); return r;
  }
  // ── Conversaciones
  redetList(a: string): RedetSession[] { return (this.data.redet[a] ??= []); }
  redet(a: string, id: string): RedetSession | null { return this.redetList(a).find((s) => s.id === id) ?? null; }
  startRedet(a: string, scenarioId: string, level: AiLevel, opening: string, topic?: string): RedetSession {
    const list = this.redetList(a);
    const s: RedetSession = { id: newId('rd'), scenarioId, ...(topic ? { topic } : {}), level, startedAt: this.now(), endedAt: null, turns: [{ role: 'klaus', text: opening, at: this.now() }], corrections: [], expressions: [], summary: null };
    list.unshift(s); this.data.redet[a] = list.slice(0, MAX_REDET); this.save(); return s;
  }
  // ── Clases
  klasseList(a: string): KlasseProgress[] { return (this.data.klasse[a] ??= []); }
  klasse(a: string, sessionId: string): KlasseProgress | null { return this.klasseList(a).find((s) => s.sessionId === sessionId) ?? null; }
  addKlasse(a: string, p: KlasseProgress) { const l = this.klasseList(a); l.unshift(p); this.data.klasse[a] = l.slice(0, MAX_KLASSE); this.save(); }
  // ── Mantenimiento y privacidad
  sweep(): number {
    const at = this.now(); let n = 0;
    for (const a of Object.keys(this.data.redet)) { const keep = this.data.redet[a].filter((s) => at - (s.endedAt ?? s.turns.at(-1)?.at ?? s.startedAt) < RETENTION.redetDays * DAY); n += this.data.redet[a].length - keep.length; this.data.redet[a] = keep; }
    for (const a of Object.keys(this.data.klasse)) { const keep = this.data.klasse[a].filter((s) => at - s.updatedAt < RETENTION.klasseDays * DAY); n += this.data.klasse[a].length - keep.length; this.data.klasse[a] = keep; }
    if (n) this.save(); return n;
  }
  forget(a: string) { delete this.data.drafts[a]; delete this.data.redet[a]; delete this.data.klasse[a]; this.save(); }
  save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}
