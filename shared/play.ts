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

// ───────────── Logros e insignias ─────────────
export type AchievementTier = 'bronze' | 'silver' | 'gold';
export interface AchievementDef { id: string; name: string; desc: string; tier: AchievementTier; icon: string; goal: number; group: 'constancia' | 'aprendizaje' | 'juegos' | 'ranking' }
export interface AchievementState { id: string; unlocked: boolean; at?: number; value: number; goal: number }
/** Catálogo. Las condiciones las evalúa server/achievements.ts sobre eventos validados (nunca el cliente). */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-answer', name: 'Los geht\'s!', desc: 'Responde tu primera pregunta.', tier: 'bronze', icon: 'spark', goal: 1, group: 'aprendizaje' },
  { id: 'correct-100', name: 'Hundert', desc: '100 respuestas correctas.', tier: 'bronze', icon: 'check', goal: 100, group: 'aprendizaje' },
  { id: 'correct-500', name: 'Fünfhundert', desc: '500 respuestas correctas.', tier: 'silver', icon: 'check', goal: 500, group: 'aprendizaje' },
  { id: 'correct-1000', name: 'Tausend', desc: '1000 respuestas correctas.', tier: 'gold', icon: 'check', goal: 1000, group: 'aprendizaje' },
  { id: 'master-1', name: 'Especialista', desc: 'Domina un tema: 30 intentos con un 85 % de acierto o más.', tier: 'silver', icon: 'star', goal: 1, group: 'aprendizaje' },
  { id: 'master-3', name: 'Profi', desc: 'Domina tres temas distintos.', tier: 'gold', icon: 'star', goal: 3, group: 'aprendizaje' },
  { id: 'explorer', name: 'Entdecker', desc: 'Practica 5 temas distintos en una misma semana.', tier: 'bronze', icon: 'compass', goal: 5, group: 'aprendizaje' },
  { id: 'b1-ready', name: 'Auf dem Weg zu B1', desc: 'Completa una actividad de B1 Training con un 70 % o más.', tier: 'gold', icon: 'mountain', goal: 1, group: 'aprendizaje' },
  { id: 'streak-3', name: 'Dranbleiben', desc: 'Practica 3 días seguidos.', tier: 'bronze', icon: 'flame', goal: 3, group: 'constancia' },
  { id: 'streak-7', name: 'Eine Woche', desc: 'Practica 7 días seguidos.', tier: 'silver', icon: 'flame', goal: 7, group: 'constancia' },
  { id: 'streak-30', name: 'Unaufhaltsam', desc: 'Practica 30 días seguidos.', tier: 'gold', icon: 'flame', goal: 30, group: 'constancia' },
  { id: 'first-activity', name: 'Geschafft', desc: 'Completa tu primera actividad.', tier: 'bronze', icon: 'flag', goal: 1, group: 'constancia' },
  { id: 'activities-10', name: 'Fleißig', desc: 'Completa 10 actividades.', tier: 'silver', icon: 'flag', goal: 10, group: 'constancia' },
  { id: 'activities-50', name: 'Unermüdlich', desc: 'Completa 50 actividades.', tier: 'gold', icon: 'flag', goal: 50, group: 'constancia' },
  { id: 'perfect', name: 'Fehlerfrei', desc: 'Una actividad de 10 preguntas o más sin un solo fallo.', tier: 'silver', icon: 'diamond', goal: 1, group: 'juegos' },
  { id: 'boxer', name: 'Ringfrei', desc: 'Termina un combate de boxeo.', tier: 'bronze', icon: 'glove', goal: 1, group: 'juegos' },
  { id: 'builder', name: 'Turmbauer', desc: 'Completa una partida de Wort-Jenga.', tier: 'bronze', icon: 'tower', goal: 1, group: 'juegos' },
  { id: 'all-games', name: 'Allrounder', desc: 'Completa actividades en BlackCard, Wort-Jenga y Boxeo.', tier: 'silver', icon: 'grid', goal: 3, group: 'juegos' },
  { id: 'podium', name: 'Auf dem Podest', desc: 'Termina una semana entre los 3 primeros del ranking.', tier: 'silver', icon: 'podium', goal: 1, group: 'ranking' },
  { id: 'champion', name: 'Wochensieger', desc: 'Gana una semana del ranking.', tier: 'gold', icon: 'crown', goal: 1, group: 'ranking' },
];
