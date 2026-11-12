// Leseverstehen — tipos compartidos (transporte) y cálculo de nota. Las claves y explicaciones viven SOLO en server/lesen/.
export type LesenQuestionType = 'truefalse' | 'choice' | 'matching';
export interface LesenOption { id: string; text: string }
export interface LesenQuestion { id: string; number: number; type: LesenQuestionType; prompt: string; options: LesenOption[] }
/** Bloques del texto de lectura (se pintan tal cual; sin HTML). */
export type LesenBlock =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'meta'; rows: [string, string][] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'ad'; id: string; title: string; lines: string[] };
export interface LesenPart { id: string; n: number; title: string; minutes: number; kind: string; instruction: string[]; textTitle: string; text: LesenBlock[]; questions: LesenQuestion[] }
export interface LesenExam { id: string; version: string; title: string; subtitle: string; level: string; minutes: number; maxPoints: number; disclaimer: string; parts: LesenPart[] }
export interface LesenSecret { answers: Record<string, string>; explain: Record<string, string>; tags: Record<string, string[]> }

export interface LesenScore { points: number; outOf: number; percent: number; byPart: { part: number; points: number; outOf: number }[] }
export interface LesenReviewItem { id: string; number: number; part: number; own: string | null; key: string; ok: boolean; explain: string; tags: string[] }
export interface LesenResult { score: LesenScore; review: LesenReviewItem[]; repasar: { tag: string; wrong: number; of: number }[]; saved: boolean; at: number }

/** Un punto por respuesta correcta, sin penalización. */
export function scoreOf(exam: Pick<LesenExam, 'parts' | 'maxPoints'>, answers: Record<string, string>, key: Record<string, string>): LesenScore {
  const byPart = exam.parts.map((p, i) => ({ part: i, points: p.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] === key[q.id]).length, outOf: p.questions.length }));
  const points = byPart.reduce((s, p) => s + p.points, 0);
  return { points, outOf: exam.maxPoints, percent: Math.round((points / exam.maxPoints) * 100), byPart };
}

/** Teil 3: un anuncio (A–H) solo se puede usar una vez; «0» (ninguno) puede repetirse. */
export function matchingConflict(part: Pick<LesenPart, 'questions'>, answers: Record<string, string>, questionId: string, value: string | null): boolean {
  if (!value || value === '0') return false;
  return part.questions.some((q) => q.type === 'matching' && q.id !== questionId && answers[q.id] === value);
}

export interface LesenPlayerPublic { id: string; name: string; connected: boolean; answered: number; answers?: Record<string, string>; score?: LesenScore }
export interface LesenView {
  code: string; role: 'teacher' | 'player'; me?: string; exam: LesenExam;
  status: 'lobby' | 'running' | 'finished'; startedAt: number | null; finishedAt: number | null; serverNow: number;
  players: LesenPlayerPublic[];
  ownAnswers?: Record<string, string>; result?: LesenResult;
  /** Solo profesor y solo al terminar: clave + explicaciones para el análisis por pregunta. */
  key?: Record<string, string>; explain?: Record<string, string>;
}
export type LesenAction = { type: 'start' } | { type: 'finish' } | { type: 'answer'; questionId: string; value: string | null };
