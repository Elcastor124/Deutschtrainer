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
/** `metric`: qué mide el servidor para este logro (ver METRICS en server/achievements.ts). Los originales no lo llevan. */
export interface AchievementDef { id: string; name: string; desc: string; tier: AchievementTier; icon: string; goal: number; group: AchievementGroup; metric?: string }
export type AchievementGroup = 'constancia' | 'aprendizaje' | 'juegos' | 'ranking' | 'dominio' | 'temas' | 'habitos';
export interface AchievementState { id: string; unlocked: boolean; at?: number; value: number; goal: number }
/** Catálogo. Las condiciones las evalúa server/achievements.ts sobre eventos validados (nunca el cliente). */
const ACHIEVEMENTS_BASE: AchievementDef[] = [
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

// ───────── Logros ampliados (todos derivados de eventos validados; ver METRICS en server/achievements.ts) ─────────
type T = AchievementTier;
const d = (id: string, name: string, desc: string, tier: T, icon: string, goal: number, group: AchievementGroup, metric: string): AchievementDef =>
  ({ id, name, desc, tier, icon, goal, group, metric });
const TOPIC_NAMES: [string, string, string][] = [
  ['vocab', 'Wortschatz', 'Wortschatz'], ['perfekt', 'Perfekt', 'Perfekt'], ['nebensatz', 'Nebensatz', 'Nebensätze'], ['dativ', 'Dativ', 'Dativ'],
  ['akkusativ', 'Akkusativ', 'Akkusativ'], ['praesens', 'Präsens', 'Präsens'], ['trennbar', 'Trennbar', 'Verbos separables'], ['satzbau', 'Satzbau', 'Satzbau'],
  ['alltag', 'Alltag', 'Alltag'], ['lesen', 'Lese', 'Comprensión lectora'], ['modal', 'Modal', 'Modalverben'], ['possessiv', 'Possessiv', 'Posesivos'],
  ['praep', 'Präpositionen', 'Preposiciones'], ['adjektiv', 'Adjektiv', 'Adjetivos y comparativos'], ['imperativ', 'Imperativ', 'Imperativo'], ['vorstellen', 'Vorstellen', 'Presentarse'],
];
const ACHIEVEMENTS_EXTRA: AchievementDef[] = [
  // Dominio: volumen, precisión y rachas
  d('correct-10', 'Zehn richtige', '10 respuestas correctas.', 'bronze', 'check', 10, 'dominio', 'correct'),
  d('correct-25', 'Fünfundzwanzig', '25 respuestas correctas.', 'bronze', 'check', 25, 'dominio', 'correct'),
  d('correct-50', 'Halbhundert', '50 respuestas correctas.', 'bronze', 'check', 50, 'dominio', 'correct'),
  d('correct-250', 'Zweihundertfünfzig', '250 respuestas correctas.', 'silver', 'check', 250, 'dominio', 'correct'),
  d('correct-750', 'Dreiviertelkönner', '750 respuestas correctas.', 'silver', 'check', 750, 'dominio', 'correct'),
  d('correct-2000', 'Zweitausend', '2000 respuestas correctas.', 'gold', 'medal', 2000, 'dominio', 'correct'),
  d('correct-5000', 'Fünftausend', '5000 respuestas correctas.', 'gold', 'medal', 5000, 'dominio', 'correct'),
  d('answers-10', 'Aufwärmen', '10 respuestas (acertadas o no).', 'bronze', 'spark', 10, 'dominio', 'answers'),
  d('answers-50', 'Im Rhythmus', '50 respuestas.', 'bronze', 'spark', 50, 'dominio', 'answers'),
  d('answers-250', 'Dabei bleiben', '250 respuestas.', 'silver', 'spark', 250, 'dominio', 'answers'),
  d('answers-1000', 'Tausendmal geübt', '1000 respuestas.', 'gold', 'spark', 1000, 'dominio', 'answers'),
  d('answers-2500', 'Unermüdlich lernen', '2500 respuestas.', 'gold', 'spark', 2500, 'dominio', 'answers'),
  d('indep-25', 'Auf eigene Faust', '25 aciertos sin ayuda de Klaus.', 'bronze', 'shield', 25, 'dominio', 'indep'),
  d('indep-100', 'Ohne Hilfe', '100 aciertos sin ayuda.', 'silver', 'shield', 100, 'dominio', 'indep'),
  d('indep-300', 'Selbstständig', '300 aciertos sin ayuda.', 'gold', 'shield', 300, 'dominio', 'indep'),
  d('indep-1000', 'Eigenständig', '1000 aciertos sin ayuda.', 'gold', 'shield', 1000, 'dominio', 'indep'),
  d('points-100', 'Punktesammler', 'Acumula 100 puntos.', 'bronze', 'medal', 100, 'dominio', 'points'),
  d('points-500', 'Fleißige Punkte', 'Acumula 500 puntos.', 'bronze', 'medal', 500, 'dominio', 'points'),
  d('points-1000', 'Tausend Punkte', 'Acumula 1000 puntos.', 'silver', 'medal', 1000, 'dominio', 'points'),
  d('points-2500', 'Punktereich', 'Acumula 2500 puntos.', 'silver', 'medal', 2500, 'dominio', 'points'),
  d('points-5000', 'Goldgrube', 'Acumula 5000 puntos.', 'gold', 'medal', 5000, 'dominio', 'points'),
  d('points-10000', 'Legende der Punkte', 'Acumula 10 000 puntos.', 'gold', 'medal', 10000, 'dominio', 'points'),
  d('run-5', 'Fünf am Stück', '5 aciertos seguidos.', 'bronze', 'bolt', 5, 'dominio', 'run'),
  d('run-10', 'Zehn am Stück', '10 aciertos seguidos.', 'silver', 'bolt', 10, 'dominio', 'run'),
  d('run-25', 'Fünfundzwanzig am Stück', '25 aciertos seguidos.', 'silver', 'bolt', 25, 'dominio', 'run'),
  d('run-50', 'Unbeirrbar', '50 aciertos seguidos.', 'gold', 'bolt', 50, 'dominio', 'run'),
  d('run-100', 'Blitzschnell', '100 aciertos seguidos.', 'gold', 'bolt', 100, 'dominio', 'run'),
  d('dayc-10', 'Guter Tag', '10 respuestas correctas en un mismo día.', 'bronze', 'target', 10, 'dominio', 'dayCorrect'),
  d('dayc-25', 'Starker Tag', '25 respuestas correctas en un mismo día.', 'silver', 'target', 25, 'dominio', 'dayCorrect'),
  d('dayc-50', 'Großer Tag', '50 respuestas correctas en un mismo día.', 'gold', 'target', 50, 'dominio', 'dayCorrect'),
  d('daya-20', 'Intensiv', '20 respuestas en un mismo día.', 'bronze', 'rocket', 20, 'dominio', 'dayAnswers'),
  d('daya-50', 'Marathon', '50 respuestas en un mismo día.', 'silver', 'rocket', 50, 'dominio', 'dayAnswers'),
  d('daya-100', 'Ausdauer', '100 respuestas en un mismo día.', 'gold', 'rocket', 100, 'dominio', 'dayAnswers'),
  // Temas: dominio por tema (30 intentos con un 85 % o más, igual que «Especialista»)
  ...TOPIC_NAMES.map(([id, short, de]) => d(`master-${id}`, `${short}-Profi`, `Domina «${de}»: 30 intentos con un 85 % de acierto o más.`, 'silver', 'star', 1, 'temas', `mastery:${id}`)),
  d('topics-3', 'Neugierig', 'Practica 3 temas distintos (en total).', 'bronze', 'compass', 3, 'temas', 'topics'),
  d('topics-6', 'Vielseitig', 'Practica 6 temas distintos (en total).', 'silver', 'compass', 6, 'temas', 'topics'),
  d('topics-10', 'Weltenbummler', 'Practica 10 temas distintos (en total).', 'gold', 'globe', 10, 'temas', 'topics'),
  d('topics-16', 'Alles gelernt', 'Practica los 16 temas.', 'gold', 'globe', 16, 'temas', 'topics'),
  // Hábitos: constancia, días, misiones y horarios (la hora es la de Madrid)
  d('streak-5', 'Fünf Tage', 'Practica 5 días seguidos.', 'bronze', 'flame', 5, 'habitos', 'streak'),
  d('streak-14', 'Zwei Wochen', 'Practica 14 días seguidos.', 'silver', 'flame', 14, 'habitos', 'streak'),
  d('streak-60', 'Zwei Monate', 'Practica 60 días seguidos.', 'gold', 'flame', 60, 'habitos', 'streak'),
  d('streak-90', 'Drei Monate', 'Practica 90 días seguidos.', 'gold', 'flame', 90, 'habitos', 'streak'),
  d('streak-180', 'Halbjahr', 'Practica 180 días seguidos.', 'gold', 'flame', 180, 'habitos', 'streak'),
  d('streak-365', 'Ein Jahr', 'Practica 365 días seguidos.', 'gold', 'flame', 365, 'habitos', 'streak'),
  d('days-10', 'Zehn Tage', 'Practica en 10 días distintos.', 'bronze', 'calendar', 10, 'habitos', 'days'),
  d('days-30', 'Dreißig Tage', 'Practica en 30 días distintos.', 'silver', 'calendar', 30, 'habitos', 'days'),
  d('days-100', 'Hundert Tage', 'Practica en 100 días distintos.', 'gold', 'calendar', 100, 'habitos', 'days'),
  d('days-200', 'Zweihundert Tage', 'Practica en 200 días distintos.', 'gold', 'calendar', 200, 'habitos', 'days'),
  d('week-3', 'Dreimal in einer Woche', 'Practica 3 días dentro de una misma semana.', 'bronze', 'calendar', 3, 'habitos', 'weekDays'),
  d('week-5', 'Fünf Tage in einer Woche', 'Practica 5 días dentro de una misma semana.', 'silver', 'calendar', 5, 'habitos', 'weekDays'),
  d('week-7', 'Jeden Tag der Woche', 'Practica los 7 días de una misma semana.', 'gold', 'calendar', 7, 'habitos', 'weekDays'),
  d('mission-1', 'Erste Mission', 'Completa tu primera misión diaria.', 'bronze', 'book', 1, 'habitos', 'missions'),
  d('mission-5', 'Fünf Missionen', 'Completa 5 misiones diarias.', 'bronze', 'book', 5, 'habitos', 'missions'),
  d('mission-10', 'Zehn Missionen', 'Completa 10 misiones diarias.', 'silver', 'book', 10, 'habitos', 'missions'),
  d('mission-30', 'Dreißig Missionen', 'Completa 30 misiones diarias.', 'silver', 'book', 30, 'habitos', 'missions'),
  d('mission-60', 'Sechzig Missionen', 'Completa 60 misiones diarias.', 'gold', 'book', 60, 'habitos', 'missions'),
  d('mission-100', 'Hundert Missionen', 'Completa 100 misiones diarias.', 'gold', 'book', 100, 'habitos', 'missions'),
  d('mission-streak-3', 'Drei Tage Mission', 'Completa la misión 3 días seguidos.', 'bronze', 'book', 3, 'habitos', 'missionStreak'),
  d('mission-streak-7', 'Eine Woche Mission', 'Completa la misión 7 días seguidos.', 'silver', 'book', 7, 'habitos', 'missionStreak'),
  d('early-1', 'Frühaufsteher', 'Responde antes de las 8:00 (hora de Madrid).', 'bronze', 'sun', 1, 'habitos', 'early'),
  d('early-10', 'Früh übt sich', '10 respuestas antes de las 8:00.', 'silver', 'sun', 10, 'habitos', 'early'),
  d('early-50', 'Morgenmensch', '50 respuestas antes de las 8:00.', 'gold', 'sun', 50, 'habitos', 'early'),
  d('night-1', 'Nachtschicht', 'Responde después de las 22:00 (hora de Madrid).', 'bronze', 'moon', 1, 'habitos', 'night'),
  d('night-10', 'Nachteule', '10 respuestas después de las 22:00.', 'silver', 'moon', 10, 'habitos', 'night'),
  d('night-50', 'Nachtmensch', '50 respuestas después de las 22:00.', 'gold', 'moon', 50, 'habitos', 'night'),
  d('weekend-1', 'Am Wochenende', 'Practica un sábado o domingo.', 'bronze', 'leaf', 1, 'habitos', 'weekend'),
  d('weekend-10', 'Wochenend-Lernen', '10 respuestas en fin de semana.', 'silver', 'leaf', 10, 'habitos', 'weekend'),
  d('weekend-50', 'Ohne Wochenpause', '50 respuestas en fin de semana.', 'gold', 'leaf', 50, 'habitos', 'weekend'),
  // Juegos
  d('activities-3', 'Drei Aktivitäten', 'Completa 3 actividades.', 'bronze', 'flag', 3, 'juegos', 'activities'),
  d('activities-25', 'Fünfundzwanzig Aktivitäten', 'Completa 25 actividades.', 'silver', 'flag', 25, 'juegos', 'activities'),
  d('activities-100', 'Hundert Aktivitäten', 'Completa 100 actividades.', 'gold', 'flag', 100, 'juegos', 'activities'),
  d('perfect-3', 'Dreimal fehlerfrei', '3 actividades de 10 preguntas o más sin fallos.', 'silver', 'diamond', 3, 'juegos', 'perfect'),
  d('perfect-10', 'Zehnmal fehlerfrei', '10 actividades sin fallos.', 'gold', 'diamond', 10, 'juegos', 'perfect'),
  d('boxer-5', 'Boxkämpfer', 'Termina 5 combates de boxeo.', 'silver', 'glove', 5, 'juegos', 'game:boxing'),
  d('boxer-20', 'Ringlegende', 'Termina 20 combates de boxeo.', 'gold', 'glove', 20, 'juegos', 'game:boxing'),
  d('builder-5', 'Turmfan', 'Completa 5 partidas de Wort-Jenga.', 'silver', 'tower', 5, 'juegos', 'game:jenga'),
  d('builder-20', 'Turmmeister', 'Completa 20 partidas de Wort-Jenga.', 'gold', 'tower', 20, 'juegos', 'game:jenga'),
  d('bc-1', 'BlackCard-Debüt', 'Juega una partida de BlackCard.', 'bronze', 'grid', 1, 'juegos', 'game:blackcard'),
  d('bc-5', 'BlackCard-Fan', 'Juega 5 partidas de BlackCard.', 'silver', 'grid', 5, 'juegos', 'game:blackcard'),
  d('bc-20', 'BlackCard-Profi', 'Juega 20 partidas de BlackCard.', 'gold', 'grid', 20, 'juegos', 'game:blackcard'),
  d('b1-3', 'B1 dreimal', 'Completa 3 actividades de B1 con un 70 % o más.', 'silver', 'mountain', 3, 'juegos', 'b1'),
  d('b1-10', 'B1 zu Hause', 'Completa 10 actividades de B1 con un 70 % o más.', 'gold', 'mountain', 10, 'juegos', 'b1'),
  // Ranking
  d('podium-3', 'Dreimal auf dem Podest', 'Termina 3 semanas entre los 3 primeros del ranking.', 'silver', 'podium', 3, 'ranking', 'podiums'),
  d('podium-10', 'Stammgast im Podest', 'Termina 10 semanas entre los 3 primeros.', 'gold', 'podium', 10, 'ranking', 'podiums'),
  d('champion-2', 'Zweifacher Sieger', 'Gana 2 semanas del ranking.', 'gold', 'crown', 2, 'ranking', 'champions'),
  d('champion-5', 'Serienmeister', 'Gana 5 semanas del ranking.', 'gold', 'crown', 5, 'ranking', 'champions'),
];
/** Catálogo completo (los originales primero; los ampliados al final). */
export const ACHIEVEMENTS: readonly AchievementDef[] = [...ACHIEVEMENTS_BASE, ...ACHIEVEMENTS_EXTRA];


