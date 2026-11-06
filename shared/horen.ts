// Hörverstehen — shared transport types only. Keys, transcripts and evidence live in server/horen/.
export type HorenQuestionType = 'choice' | 'truefalse' | 'matching';
export interface HorenOption { id: string; text: string }
export interface HorenQuestion { id: string; number: number; type: HorenQuestionType; prompt: string; options: HorenOption[] }
export interface HorenPart { id: string; n: number; title: string; minutes: number; instruction: string[]; audioId: string; questions: HorenQuestion[]; bank?: HorenOption[] }
export interface HorenExam { id: string; version: string; title: string; subtitle: string; disclaimer: string; general: string[]; reviewMinutes: number; maxPoints: number; parts: HorenPart[] }
export interface HorenTurn { speaker: string; text: string; voice: string; pitch: string }
export interface HorenSegment { label: string | null; turns: HorenTurn[] }
export interface HorenSecret { answers: Record<string, string>; evidence: Record<string, string[]>; scripts: Record<string, HorenSegment[]>; spokenInstructions: Record<string, string> }

/** One step of the class timeline. Audio steps play `audioId`; the others are silent work time. */
export type HorenStepKind = 'intro' | 'instruction' | 'read' | 'listen1' | 'work' | 'listen2' | 'answer' | 'review' | 'done';
export interface HorenStep { kind: HorenStepKind; part: number; ms: number; audioId?: string; budgetOver?: boolean }
export interface HorenAudioInfo { id: string; duration: number }

/** Exam timeline from REAL audio durations. Silent steps absorb the remainder of each part's budget. */
export function buildTimeline(exam: Pick<HorenExam, 'parts' | 'reviewMinutes'>, audio: Record<string, number>, opts: { readMin?: number; workShare?: number } = {}): { steps: HorenStep[]; warnings: string[] } {
  const steps: HorenStep[] = []; const warnings: string[] = [];
  for (const [i, p] of exam.parts.entries()) {
    const instr = Math.ceil((audio[`i${p.n}`] ?? 0) * 1000), text = Math.ceil((audio[p.audioId] ?? 0) * 1000);
    const budget = p.minutes * 60_000, audioMs = instr + 2 * text;
    const free = budget - audioMs;
    const minimum = 3 * 30_000; // read, work and answer: at least 30 s each
    let read: number, work: number, answer: number;
    if (free < minimum) {
      warnings.push(`Teil ${p.n}: el audio (${Math.round(audioMs / 1000)} s) deja ${Math.max(0, Math.round(free / 1000))} s de trabajo en un presupuesto de ${p.minutes} min; se amplían las pausas a 30 s cada una. Sugerencia: sube Teil ${p.n} a ${Math.ceil((audioMs + minimum) / 60_000)} min (y baja otra parte si quieres mantener 60).`);
      read = work = answer = 30_000;
    } else {
      read = Math.max(30_000, Math.min(opts.readMin ?? 90_000, Math.round(free * 0.3)));
      const rest = free - read; work = Math.round(rest * (opts.workShare ?? 0.4)); answer = rest - work;
    }
    const over = free < minimum;
    steps.push({ kind: 'instruction', part: i, ms: instr, audioId: `i${p.n}`, ...(over ? { budgetOver: true } : {}) });
    steps.push({ kind: 'read', part: i, ms: read });
    steps.push({ kind: 'listen1', part: i, ms: text, audioId: p.audioId });
    steps.push({ kind: 'work', part: i, ms: work });
    steps.push({ kind: 'listen2', part: i, ms: text, audioId: p.audioId });
    steps.push({ kind: 'answer', part: i, ms: answer });
  }
  steps.push({ kind: 'review', part: exam.parts.length - 1, ms: exam.reviewMinutes * 60_000 });
  steps.push({ kind: 'done', part: exam.parts.length - 1, ms: 0 });
  return { steps, warnings };
}

export interface HorenScore { points: number; outOf: number; byPart: { part: number; points: number; outOf: number }[]; grade20: number }
export interface HorenPlayerPublic { id: string; name: string; connected: boolean; answered: number; finished: boolean; answers?: Record<string, string>; score?: HorenScore }
export interface HorenReviewItem { id: string; number: number; own: string | null; key: string; ok: boolean; evidence: string[] }
/** Room snapshot. `clock` lets clients render the shared timeline locally between polls. */
export interface HorenView {
  code: string; role: 'teacher' | 'player'; me?: string; exam: HorenExam;
  status: 'lobby' | 'running' | 'paused' | 'finished';
  step: number; stepElapsedMs: number; serverNow: number; steps: HorenStep[]; warnings: string[]; audio: HorenAudioInfo[];
  players: HorenPlayerPublic[];
  ownAnswers?: Record<string, string>; ownScore?: HorenScore; review?: HorenReviewItem[];
  transcripts?: Record<string, HorenSegment[]>;
  /** Teacher only, after the exam: answer key + transcript evidence for the error analysis. */
  key?: Record<string, string>; evidence?: Record<string, string[]>;
}
export type HorenAction =
  | { type: 'start' } | { type: 'pause' } | { type: 'resume' } | { type: 'next' } | { type: 'prev' } | { type: 'finish' }
  | { type: 'adjust'; part: number; minutes: number }
  | { type: 'answer'; questionId: string; value: string | null };

/** Score out of the exam's points and scaled to 20 (DSD-style /20 for the class grade book). */
export function scoreOf(exam: Pick<HorenExam, 'parts' | 'maxPoints'>, answers: Record<string, string>, key: Record<string, string>): HorenScore {
  const byPart = exam.parts.map((p, i) => ({ part: i, points: p.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] === key[q.id]).length, outOf: p.questions.length }));
  const points = byPart.reduce((s, p) => s + p.points, 0);
  return { points, outOf: exam.maxPoints, byPart, grade20: Math.round((points / exam.maxPoints) * 20 * 10) / 10 };
}
