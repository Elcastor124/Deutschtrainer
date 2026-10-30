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
  { id: 'blackcard', name: 'BlackCard', available: true, modes: ['solo', 'private'], levels: LEVELS, solo: 'Solo: sesiones con corrección y explicación. Con amigos: dos rondas con cofres y objetos.', note: 'Los objetos solo existen con rivales (sala privada). La BlackCard se desbloquea con preguntas de examen: solo en B1 Training.' },
  { id: 'jenga', name: 'Wort-Jenga', available: true, modes: ['solo', 'private'], levels: LEVELS, solo: 'Aciertas y quitas 1 pieza, fallas y quitas 2. Solo o por turnos con amigos: si cae, acaba la partida.' },
  { id: 'boxing', name: 'Boxeo', available: true, modes: ['solo', 'private'], levels: ['A2'], solo: 'Combate contra un sparring del sistema con reglas fijas, o contra un amigo con código.', note: 'Su banco propio (casos A2) no tiene niveles: solo A2.' },
  { id: 'deck', name: 'Deutsch Deck', available: false, modes: [], levels: [], solo: 'Próximamente.', note: 'Este juego aún no existe en la plataforma.' },
];

/** Reglas de alias (público en el ranking si el alumno lo activa). */
export const ALIAS_RULES = 'De 3 a 16 caracteres: letras, números, punto, guion o guion bajo. No uses tu nombre real, correo ni teléfono.';
export const PASSWORD_MIN = 10;

export interface AccountPub { alias: string; rankingOptIn: boolean }
export interface SessionWelcome { token: string; account: AccountPub }
export interface RankingEntry { rank: number; alias: string; points: number }
/** GET /api/play/leaderboard?week=current|previous&limit=n — solo alias que activaron el ranking. */
export interface RankingView {
  week: string; which: 'current' | 'previous';
  range: { from: string; to: string };
  /** Instante (ms) en que se reinicia la semana actual (lunes 00:00, hora de Madrid). */
  resetsAt: number;
  /** Cuentas con puntos en el ranking esa semana. */
  players: number;
  entries: RankingEntry[];
  /** Solo con sesión de alumno: tus puntos de esa semana y tu puesto (si apareces en el ranking). */
  me?: { alias: string; points: number; rank: number | null; optedIn: boolean };
}
export interface ProgressSummary {
  week: string; weekPoints: number; streak: number; rank: number | null; rankingOptIn: boolean;
  /** Puntos de las últimas 8 semanas (de la más antigua a la actual). */
  history: { week: string; points: number }[];
  activities: { at: number; game: PlayGame; level: Level | null; correct: number; total: number }[];
  topics: { topic: string; attempts: number; correct: number; accuracy: number }[];
  frequentErrors: { qid: string; prompt: string; topic: string; wrong: number; attempts: number }[];
  accuracy: { week: string; attempts: number; accuracy: number | null }[];
  recommended: string[];
  advice: string[];
}

/** Reglas de puntos, en palabras para el alumno (las aplica server/progress.ts: POINTS y FREEPLAY). */
export const FREEPLAY_RULES: readonly { points: string; title: string; text: string }[] = [
  { points: '+10', title: 'Respuesta correcta', text: 'Cada pregunta puntúa una vez al día: repetir la misma no suma.' },
  { points: '+2', title: 'Intento', text: 'Equivocarse también cuenta: es parte de aprender.' },
  { points: '+5', title: 'Primera respuesta del día', text: '+10 si llevas 3 días o más seguidos practicando.' },
  { points: '+4–10', title: 'Actividad completada', text: 'A1 / A2 / B1 (la práctica de /practica cuenta como A2), con 8 preguntas o más y al menos un 40 % de acierto. Hasta 3 al día.' },
  { points: '200', title: 'Máximo por día', text: 'Para que gane quien practica a menudo, no quien se queda horas.' },
];
