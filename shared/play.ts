// Contrato del MODO LIBRE (práctica sin profesor). Solo tipos y constantes: lo comparten servidor y cliente.
import type { Difficulty } from './types.ts';

export const LEVELS = ['A1', 'A2', 'B1'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { A1: 'A1', A2: 'A2', B1: 'B1 Training' };

/**
 * El banco no trae etiquetas CEFR: el nivel es una BANDA DE DIFICULTAD del banco existente (easy/medium/hard/special).
 * A1 = fácil · A2 = fácil + media · B1 Training = media + difícil + especial («Prüfungsfragen»). Ver docs/FREE_PLAY.md.
 */
export const LEVEL_DIFFS: Record<Level, readonly Difficulty[]> = {
  A1: ['easy'],
  A2: ['easy', 'medium'],
  B1: ['medium', 'hard', 'special'],
};
export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);

/** Temas del boxeo (su banco propio; ids de cliente → nombre del banco). */
export const BOXING_TOPICS = { akkusativ: 'Akkusativ', dativ: 'Dativ', praep: 'Präpositionen', pronomen: 'Pronomen', wowohin: 'Wo/Wohin' } as const;
export type BoxingTopic = keyof typeof BOXING_TOPICS;

export type PlayGame = 'blackcard' | 'jenga' | 'boxing' | 'deck';
export type PlayMode = 'solo' | 'private';
export interface GameInfo {
  id: PlayGame;
  name: string;
  available: boolean;
  modes: readonly PlayMode[];
  levels: readonly Level[];
  /** Cómo se juega sin profesor (una línea, para la interfaz). */
  solo: string;
  note?: string;
}
export const GAMES: readonly GameInfo[] = [
  { id: 'blackcard', name: 'BlackCard', available: true, modes: ['solo'], levels: LEVELS, solo: 'Sesiones de preguntas con corrección y explicación; repasa lo que fallaste.', note: 'Los objetos y la BlackCard son mecánicas de clase: en solitario se juega el núcleo educativo.' },
  { id: 'jenga', name: 'Wort-Jenga', available: true, modes: ['solo'], levels: LEVELS, solo: 'Una torre para ti: aciertas y quitas 1 pieza, fallas y quitas 2. Si cae, acaba la partida.' },
  { id: 'boxing', name: 'Boxeo', available: true, modes: ['solo', 'private'], levels: ['A2'], solo: 'Combate contra un sparring del sistema con reglas fijas, o contra un amigo con código.', note: 'Su banco propio (casos A2) no tiene niveles: solo A2.' },
  { id: 'deck', name: 'Deutsch Deck', available: false, modes: [], levels: [], solo: 'Próximamente.', note: 'Este juego aún no existe en la plataforma.' },
];

/** Reglas de alias (público en el ranking si el alumno lo activa). */
export const ALIAS_RULES = 'De 3 a 16 caracteres: letras, números, punto, guion o guion bajo. No uses tu nombre real, correo ni teléfono.';
export const PASSWORD_MIN = 10;

export interface AccountPub { alias: string; rankingOptIn: boolean }
export interface SessionWelcome { token: string; account: AccountPub }
export interface RankingEntry { rank: number; alias: string; points: number }
export interface ProgressSummary {
  week: string; weekPoints: number; streak: number; rank: number | null; rankingOptIn: boolean;
  activities: { at: number; game: PlayGame; level: Level | null; correct: number; total: number }[];
  topics: { topic: string; attempts: number; correct: number; accuracy: number }[];
  frequentErrors: { qid: string; prompt: string; topic: string; wrong: number; attempts: number }[];
  accuracy: { week: string; attempts: number; accuracy: number | null }[];
  recommended: string[];
  advice: string[];
}
