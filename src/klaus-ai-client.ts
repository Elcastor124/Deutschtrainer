// Cliente de Klaus AI (infraestructura compartida por Schreibt, Redet y Klasse). Solo habla con /api/klaus/*; nunca ve claves ni proveedores.
import { playRequest } from './play-client.ts';
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
