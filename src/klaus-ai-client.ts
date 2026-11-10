// Cliente de Klaus AI (infraestructura compartida por Schreibt, Redet y Klasse). Solo habla con /api/klaus/*; nunca ve claves ni proveedores.
import { playRequest } from './play-client.ts';
import type { AnswerPayload, AnswerResult, KlasseView } from '../shared/lesson.ts';
import type { AiLevel, KlausFeature, KlausPlan, WritingReview } from '../shared/klaus-ai.ts';
import type { WritingTask } from '../shared/klaus-content.ts';

export interface KlausStatus {
  plan: KlausPlan; quota: Record<KlausFeature, { used: number; limit: number }>;
  providers: { llm: { provider: string; real: boolean; note: string | null }; stt: { provider: string; real: boolean }; tts: { provider: string; real: boolean } };
}
export interface DraftReviewView { id: string; at: number; review: WritingReview; resolved: string[]; textSnapshot: string }
export interface DraftView { id: string; title: string; text: string; level: AiLevel; taskId: string | null; updatedAt: number; reviews: DraftReviewView[] }

/** Identificador de intento: reintentar con el mismo id no vuelve a gastar cuota (el servidor devuelve el resultado guardado). */
export const newRequestId = () => `req-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

export const klausStatus = () => playRequest<KlausStatus>('/api/klaus/status');
export const writingTasks = () => playRequest<{ tasks: WritingTask[] }>('/api/klaus/writing/tasks');
export const writingDrafts = () => playRequest<{ drafts: DraftView[] }>('/api/klaus/writing/drafts');
export const saveDraft = (d: { id?: string; title: string; text: string; level: AiLevel; taskId?: string | null }) => playRequest<{ draft: DraftView }>('/api/klaus/writing/draft', d);
export const deleteDraft = (id: string) => playRequest<{ ok: true }>('/api/klaus/writing/draft/delete', { id });
export const reviewWriting = (b: { text: string; level: AiLevel; draftId?: string | null; requestId: string }, signal?: AbortSignal) =>
  playRequest<{ review: WritingReview; reviewId: string | null }>('/api/klaus/writing/review', b, signal);
export const resolveCorrection = (draftId: string, reviewId: string, correctionId: string) =>
  playRequest<{ resolved: string[] }>('/api/klaus/writing/review/resolve', { draftId, reviewId, correctionId });

export const quotaLeft = (s: KlausStatus | null, f: KlausFeature) => (s ? Math.max(0, s.quota[f].limit - s.quota[f].used) : null);

// ── Unterricht mit Klaus: lección determinista; solo /klasse/ask puede usar IA (con cuota). ──
export interface KlasseLessonInfo { id: string; unit: string; level: AiLevel; title: string; objectives: string[]; verified: boolean; steps: number }
export interface KlasseSessionInfo { sessionId: string; lessonId: string; finished: boolean; step: number; total: number; updatedAt: number }
export interface KlasseAskAnswer { answer: { action: string; activityId: string | null; text: string; example: { de: string; es: string } | null }; source: 'ai' | 'mock'; asksLeft: number }
export const klasseLessons = () => playRequest<{ lessons: KlasseLessonInfo[]; sessions: KlasseSessionInfo[] }>('/api/klaus/klasse/lessons');
export const klasseSession = (id: string) => playRequest<{ view: KlasseView }>(`/api/klaus/klasse/session?id=${encodeURIComponent(id)}`);
export const klasseStart = (lessonId: string) => playRequest<{ view: KlasseView; resumed: boolean }>('/api/klaus/klasse/start', { lessonId });
export const klasseAnswer = (sessionId: string, answer: AnswerPayload) => playRequest<{ result: AnswerResult; view: KlasseView }>('/api/klaus/klasse/answer', { sessionId, answer });
export const klasseNext = (sessionId: string) => playRequest<{ view: KlasseView }>('/api/klaus/klasse/next', { sessionId });
export const klasseAsk = (sessionId: string, question: string, requestId: string, signal?: AbortSignal) =>
  playRequest<KlasseAskAnswer>('/api/klaus/klasse/ask', { sessionId, question, requestId }, signal);
