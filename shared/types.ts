// Tipos compartidos entre servidor y cliente. Solo sintaxis "borrable" (Node ejecuta el TS sin compilar).

export type Difficulty = 'easy' | 'medium' | 'hard' | 'special';
export type Topic =
  | 'vocab' | 'perfekt' | 'nebensatz' | 'dativ' | 'akkusativ'
  | 'praesens' | 'trennbar' | 'satzbau' | 'alltag' | 'lesen'
  | 'modal' | 'possessiv' | 'praep' | 'adjektiv' | 'imperativ';
/** Origen real de cada contenido (ver shared/sources.ts). */
export type Source = 'bank' | 'warum' | 'kh' | 'unterwegs' | 'bruecke' | 'trainer' | 'lesen' | 'a1';
export type QType = 'mc' | 'write' | 'gap' | 'order' | 'error' | 'match' | 'build';
export type ItemId = 'blackcard' | 'thief' | 'shield' | 'double' | 'sabotage' | 'second' | 'wildcard';
export type Phase = 'lobby' | 'intro' | 'question' | 'review' | 'reveal' | 'wild' | 'roundEnd' | 'final' | 'task';
export type QuizBlock = 'lesen' | 'warmup' | 'r1' | 'r2' | 'r3' | 'r4' | 'boss';
export type TaskKind = 'rolle' | 'szene' | 'wort' | 'frei' | 'jenga';
export type BlockId = QuizBlock | 'final' | TaskKind | 'ende';
/** Cofres: bronce, plata y oro traen un objeto (y monedas); el negro trae siempre la BlackCard. */
export type ChestTier = 'bronze' | 'silver' | 'gold' | 'black';

// ---------- Preguntas (solo en el servidor) ----------
interface QBase {
  id: string;
  type: QType;
  topic: Topic;
  diff: Difficulty;
  src: Source;
  prompt: string;
  explain: string;
  /** Justificación de dificultad. Obligatoria en hard/special: habilita la BlackCard. */
  why?: string;
  /** Prüfungsfrage: acertarla desbloquea la BlackCard. */
  unlock?: boolean;
  tags?: string[];
  swatch?: string;
  time?: number;
}
export interface QMc extends QBase { type: 'mc'; options: string[]; answer: number; fixed?: boolean }
export interface QWrite extends QBase { type: 'write' | 'build'; accept: string[]; parts?: string[]; strict?: boolean }
export interface QGap extends QBase { type: 'gap'; text: string; gaps: string[][] }
export interface QOrder extends QBase { type: 'order'; tokens: string[]; accept: string[] }
export interface QError extends QBase { type: 'error'; tokens: string[]; wrong: number; fix: string[] }
export interface QMatch extends QBase { type: 'match'; pairs: [string, string][] }
export type Question = QMc | QWrite | QGap | QOrder | QError | QMatch;

// ---------- Lo que ve el alumno (sin soluciones) ----------
export interface PublicQuestion {
  id: string;
  type: QType;
  topic: Topic;
  diff: Difficulty;
  src: Source;
  points: number;
  prompt: string;
  options?: string[];
  text?: string;
  gapCount?: number;
  tokens?: string[];
  left?: string[];
  right?: string[];
  parts?: string[];
  swatch?: string;
  why?: string;
  /** BlackCard utilizable. */
  bc: boolean;
  secondOk: boolean;
  unlock: boolean;
  time: number;
  /** Repetición deliberada de repaso (modo práctica). */
  review?: boolean;
  /** Truhenfrage: acertarla da un cofre de plata. */
  chest?: boolean;
}

export interface Answer {
  choice?: number;
  text?: string;
  gaps?: string[];
  order?: number[];
  index?: number;
  fix?: string;
  pairs?: number[];
}

export type Status = 'correct' | 'wrong' | 'review';

export interface PlayerResult {
  status: 'correct' | 'wrong' | 'none';
  given: string;
  delta: number;
  lines: string[];
  note?: string;
  attempt?: number;
}

export interface RevealView {
  qid: string;
  solution: string;
  explain: string;
  skipped?: boolean;
  results: Record<string, PlayerResult>;
}

export interface Fx {
  id: number;
  kind: 'item' | 'steal' | 'block' | 'fizzle' | 'sabotaged' | 'bc-win' | 'bc-lose' | 'reward' | 'unlock' | 'manual' | 'join' | 'expire' | 'info'
    | 'chest' | 'chest-open' | 'star' | 'jenga-pull' | 'jenga-fall';
  by?: string;
  target?: string;
  item?: ItemId;
  amount?: number;
  tier?: ChestTier;
  text: string;
  at: number;
}

export interface PlayerPub {
  id: string;
  name: string;
  score: number;
  streak: number;
  connected: boolean;
  shield: boolean;
  sabotaged: boolean;
  items: number;
  answered: boolean;
  /** Cofres sin abrir. */
  chests: number;
  /** Estrellas de las actividades después del juego. */
  stars: number;
}

export interface ErrorEntry {
  qid: string;
  prompt: string;
  solution: string;
  explain: string;
  given: string;
  topic: Topic;
  src: Source;
}

export interface FinalPlayer {
  id: string;
  name: string;
  score: number;
  rank: number;
  correct: number;
  total: number;
  best: number;
  bcWon: number;
  bcLost: number;
  itemsUsed: number;
  stolen: number;
  chests: number;
  stars: number;
  errors: ErrorEntry[];
}

export interface FinalView {
  players: FinalPlayer[];
  /** Preguntas más falladas por la clase (para el repaso final). */
  classErrors: (ErrorEntry & { count: number; names: string[] })[];
}

export interface MeView {
  id: string;
  name: string;
  inventory: ItemId[];
  pickups: ItemId[];
  /** idle: sin responder · sent: respuesta final enviada · retry: Second Chance pendiente */
  state: 'idle' | 'sent' | 'retry';
  used: ItemId | null;
  lastQuestion: boolean;
  incoming: { kind: 'thief' | 'sabotage'; by: string }[];
  profileCode: string;
  chests: ChestPub[];
}

export interface ChestPub { id: string; tier: ChestTier; reason: string }

// ---------- Actividades después del juego ----------
export interface VocabWord { de: string; es: string }
export interface WriteEntry {
  text: string;
  words: number;
  /** Palabras de su lista que ya aparecen en el texto. */
  used: string[];
  /** Rasgos gramaticales detectados (freies Schreiben): perfekt, neben, dativ, modal. */
  features: string[];
  stars: number;
  bonus: number;
  done: boolean;
}
export interface TaskWriteView {
  kind: 'rolle' | 'wort' | 'frei';
  stage: 'write' | 'show';
  showing: string | null;
  /** Lista de palabras y consigna de cada alumno (el alumno ve la suya; en «show», todas). */
  sets: Record<string, { words: VocabWord[]; prompt: string; base?: string }>;
  /** Freies Schreiben: consignas para elegir y elección de cada alumno. */
  prompts?: string[];
  choice?: Record<string, number>;
  entries: Record<string, WriteEntry>;
  judged: Record<string, boolean>;
}
export interface RoleCard { role: string; who: string; situation: string; goals: string[]; phrases: string[] }
export interface TaskSceneView {
  kind: 'szene';
  stage: 'prep' | 'play' | 'score';
  scene: { id: string; title: string; place: string; setup: string };
  /** Papel de cada alumno; la tarjeta completa (objetivos secretos) solo la ve su dueño y el profesor. */
  roles: Record<string, { role: string; card?: RoleCard }>;
  goals: Record<string, boolean[]>;
  bonus: Record<string, number>;
}
export interface TaskJengaView {
  kind: 'jenga';
  stage: 'answer' | 'judge' | 'pull' | 'fallen';
  /** Niveles de abajo arriba; cada nivel tiene 3 huecos (1 = pieza). */
  levels: number[][];
  turn: string | null;
  order: string[];
  pulls: number;
  q: PublicQuestion | null;
  speak: string | null;
  last: { pid: string; ok: boolean; given: string; solution: string } | null;
  lastPull: { level: number; slot: number; by: string } | null;
  loser: string | null;
  games: number;
  /** Probabilidad de que la torre se tambalee y caiga en la próxima extracción. */
  risk: number;
  /** Respuesta dudosa pendiente de que el profesor decida. */
  judge?: { given: string; expected: string };
}
export type TaskView = TaskWriteView | TaskSceneView | TaskJengaView;

export interface TeacherView {
  solution: string;
  answers: Record<string, { given: string; status: Status; note?: string; final: boolean; attempt: number }>;
  review: { pid: string; given: string; expected: string; note?: string }[];
  inventories: Record<string, ItemId[]>;
  queueLeft: number;
  usedCount: number;
  bankSize: number;
}

export interface RoomView {
  code: string;
  mode: 'class' | 'practice';
  phase: Phase;
  block: BlockId | null;
  blockStartedAt: number | null;
  startedAt: number | null;
  serverNow: number;
  timer: { endsAt: number | null; left: number | null; total: number } | null;
  q: PublicQuestion | null;
  qNo: number;
  qTotal: number;
  players: PlayerPub[];
  me?: MeView;
  reveal: RevealView | null;
  itemsOn: boolean;
  itemsOff: ItemId[];
  blockItems: boolean;
  uses: { by: string; item: ItemId; target?: string }[];
  wild: { by: string; options: Topic[]; endsAt: number } | null;
  wildPending: string | null;
  roundEnd: { block: BlockId; rewards: { pid: string; tier: ChestTier }[]; stars?: { pid: string; n: number }[] } | null;
  log: Fx[];
  /** Texto de lectura de esta sesión. */
  reading: string;
  task: TaskView | null;
  teacher?: TeacherView;
  final?: FinalView;
  practice?: { topics: Topic[]; done: number; correct: number };
}

// ---------- Protocolo ----------
export type ClientMsg =
  | { t: 'hello'; role: 'teacher'; create?: boolean; room?: string; token?: string }
  | { t: 'hello'; role: 'player'; room: string; token?: string; name?: string; profile?: string }
  | { t: 'hello'; role: 'practice'; room?: string; token?: string; profile?: string; profileCode?: string; name?: string; topics?: Topic[]; focus?: boolean }
  | { t: 'answer'; id: number; qid: string; a: Answer }
  | { t: 'item'; id: number; item: ItemId; target?: string }
  | { t: 'wild'; id: number; topic: Topic }
  | { t: 'pickup'; id: number; discard: number }
  | { t: 'pnext'; id: number }
  | { t: 'open'; id: number; chest: string }
  | { t: 'text'; id: number; text: string; done?: boolean }
  | { t: 'pick'; id: number; n: number }
  | { t: 'pull'; id: number; level: number; slot: number }
  | { t: 'ctl'; id: number; a: CtlAction };

export type CtlAction =
  | { k: 'block'; block: BlockId }
  | { k: 'next' }
  | { k: 'pause' }
  | { k: 'resume' }
  | { k: 'addTime'; s: number }
  | { k: 'lock' }
  | { k: 'skip' }
  | { k: 'judge'; pid: string; ok: boolean }
  | { k: 'judgeAll'; ok: boolean }
  | { k: 'points'; pid: string; delta: number }
  | { k: 'items'; on: boolean; item?: ItemId }
  | { k: 'give'; pid: string; item: ItemId }
  | { k: 'chest'; pid: string; tier: ChestTier }
  | { k: 'kick'; pid: string }
  | { k: 'task'; op: 'show' | 'star' | 'judgeText' | 'goal' | 'reroll' | 'judge' | 'reset' | 'skip'; pid?: string; n?: number; ok?: boolean };

export type ServerMsg =
  | { t: 'welcome'; role: 'teacher' | 'player' | 'practice'; room: string; token: string; pid?: string; profile?: string; profileCode?: string }
  | { t: 'state'; s: RoomView }
  | { t: 'ack'; id: number; ok: boolean; error?: string; retry?: boolean }
  | { t: 'err'; msg: string; fatal?: boolean };
