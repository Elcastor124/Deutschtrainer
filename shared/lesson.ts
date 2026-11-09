// Klasse mit Klaus · tipos del Lesson Engine (datos estructurados, sin código ejecutable) y proyección PÚBLICA.
// El cliente recibe `PublicActivity`: nunca las soluciones. La corrección autoritativa vive en el servidor (server/ai/lessons.ts).
import type { AiLevel } from './klaus-ai.ts';

export interface SpeechSegment { text: string; lang: 'de' | 'es'; /** Id de celda/elemento a resaltar mientras suena este segmento. */ focus?: string }
interface Base { id: string; title: string; /** Texto hablado en segmentos (si falta, se habla `text`). */ speech?: SpeechSegment[] }

export interface TheoryActivity extends Base { kind: 'theory'; text: string; example?: { de: string; es: string }; /** Id de regla verificada del banco del profesor (server/tutor.ts). Sin él, el texto lo redactó el autor de la lección. */ ruleId?: string }
export interface GrammarTableActivity extends Base { kind: 'grammar-table'; columns: string[]; rows: { id: string; label: string; cells: string[] }[]; /** Pasos de resaltado: «fila:columna». */ steps: { focus: string; note: string }[] }
export interface ComparisonActivity extends Base { kind: 'comparison'; left: { title: string; items: { de: string; es: string; mark?: string }[] }; right: { title: string; items: { de: string; es: string; mark?: string }[] } }
export interface DialogueActivity extends Base { kind: 'dialogue'; lines: { who: string; de: string; es: string; mark?: string }[] }
interface Exercise extends Base { hint: string; explain: string; ruleId?: string }
export interface MultipleChoiceActivity extends Exercise { kind: 'multiple-choice'; prompt: string; options: string[]; answer: number }
export interface FillBlankActivity extends Exercise { kind: 'fill-blank'; prompt: string; /** Respuestas aceptadas (comparación sin mayúsculas ni espacios sobrantes). */ answers: string[] }
export interface SentenceBuilderActivity extends Exercise { kind: 'sentence-builder'; prompt: string; words: string[]; solutions: string[][] }
export interface MatchingActivity extends Exercise { kind: 'matching'; prompt: string; pairs: { left: string; right: string }[] }
export interface ListeningActivity extends Exercise { kind: 'listening'; prompt: string; /** Archivo previamente generado en server/klaus-audio/<audio>.mp3. Si no existe, la actividad se omite del plan. */ audio: string; options: string[]; answer: number }
export interface CheckpointActivity extends Base { kind: 'checkpoint'; text: string; /** Ratio mínimo de aciertos (0–1) de los ejercicios previos. */ pass: number }

export type Activity = TheoryActivity | GrammarTableActivity | ComparisonActivity | DialogueActivity | MultipleChoiceActivity | FillBlankActivity | SentenceBuilderActivity | MatchingActivity | ListeningActivity | CheckpointActivity;
export type ExerciseActivity = MultipleChoiceActivity | FillBlankActivity | SentenceBuilderActivity | MatchingActivity | ListeningActivity;
export const isExercise = (a: Activity): a is ExerciseActivity => ['multiple-choice', 'fill-blank', 'sentence-builder', 'matching', 'listening'].includes(a.kind);

export interface Lesson {
  id: string; unit: string; level: AiLevel; title: string; objectives: string[];
  /** Reglas verificadas del profesor en las que se apoya la lección. */ ruleRefs: string[];
  activities: Activity[]; /** Ejercicios extra que se añaden si el checkpoint no se supera (una sola vez). */ remedial: Activity[];
  progression: { maxTries: number }; completion: { minRatio: number };
  /** Contenido revisado por el autor (true) o generado por IA sin revisar (false). */ verified: boolean;
}

// ── Proyección pública
export type PublicActivity =
  | { kind: 'theory'; id: string; title: string; text: string; example?: { de: string; es: string }; verified: boolean; speech?: SpeechSegment[] }
  | { kind: 'grammar-table'; id: string; title: string; columns: string[]; rows: { id: string; label: string; cells: string[] }[]; steps: { focus: string; note: string }[]; speech?: SpeechSegment[] }
  | { kind: 'comparison'; id: string; title: string; left: ComparisonActivity['left']; right: ComparisonActivity['right']; speech?: SpeechSegment[] }
  | { kind: 'dialogue'; id: string; title: string; lines: DialogueActivity['lines']; speech?: SpeechSegment[] }
  | { kind: 'multiple-choice'; id: string; title: string; prompt: string; options: string[] }
  | { kind: 'fill-blank'; id: string; title: string; prompt: string }
  | { kind: 'sentence-builder'; id: string; title: string; prompt: string; words: string[] }
  | { kind: 'matching'; id: string; title: string; prompt: string; left: string[]; right: string[] }
  | { kind: 'listening'; id: string; title: string; prompt: string; options: string[]; audioUrl: string }
  | { kind: 'checkpoint'; id: string; title: string; text: string };

export type AnswerPayload = { choice: number } | { text: string } | { order: string[] } | { pairs: number[] };
export interface AnswerResult { ok: boolean; tries: number; /** Feedback predefinido (no generado por IA). */ feedback: string; hint: string | null; reveal: { answer: string } | null; done: boolean }

export interface KlasseView {
  sessionId: string; lessonId: string; title: string; level: AiLevel; objectives: string[]; step: number; total: number;
  activity: PublicActivity | null; finished: boolean; verified: boolean;
  answered: Record<string, { ok: boolean; tries: number }>; asks: number; asksLeft: number;
  summary: null | { correct: number; total: number; passed: boolean; recommendation: string };
}
