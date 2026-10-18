import type { BlockId, ChestTier, Difficulty, ItemId, Phase, PublicQuestion, QType, Source, Topic } from './types.ts';

export const POINTS: Record<Difficulty, number> = { easy: 2, medium: 5, hard: 10, special: 15 };
export const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Media', hard: 'Difícil', special: 'Reto especial' };
export const BC_BONUS = 10;
export const THIEF_MAX = 5;
export const MAX_INV = 3;
export const STREAK_REWARD = 3;

export const SOURCES: Record<Source, { name: string; file: string }> = {
  bank: { name: 'Auf der Bank', file: 'Clase - Auf der Bank.pdf' },
  warum: { name: 'weil · obwohl · deshalb + Perfekt', file: 'Clase - weil obwohl deshalb + Perfekt.pdf' },
  kh: { name: 'Im Krankenhaus', file: 'Clase - Im Krankenhaus (Nebensätze).pdf' },
  unterwegs: { name: 'Unterwegs · Dativ + Perfekt', file: 'Clase - Unterwegs (Dativ + Perfekt).pdf' },
  bruecke: { name: 'Brücke A1', file: 'index.html' },
  trainer: { name: 'Sprache in Bewegung', file: 'deutsch-trainer-120.html' },
  lesen: { name: 'Lectura de clase', file: 'textos originales de esta app (shared/reading.ts)' },
  a1: { name: 'A1 general', file: 'contenido nuevo de nivel A1–A2' },
};

export const TOPICS: Record<Topic, { de: string; es: string }> = {
  vocab: { de: 'Wortschatz', es: 'Vocabulario' },
  perfekt: { de: 'Perfekt', es: 'Pasado: haben/sein + Partizip II' },
  nebensatz: { de: 'Nebensätze', es: 'weil · obwohl · dass · wenn · deshalb' },
  dativ: { de: 'Dativ', es: 'Artículos y preposiciones con dativo' },
  akkusativ: { de: 'Akkusativ & kein', es: 'einen · keinen · keine' },
  praesens: { de: 'Präsens', es: 'Conjugación en presente' },
  trennbar: { de: 'Trennbare Verben', es: 'Verbos separables' },
  satzbau: { de: 'Satzbau', es: 'Orden de la frase' },
  alltag: { de: 'Alltag', es: 'Números, horas, colores, diálogos' },
  lesen: { de: 'Leseverstehen', es: 'Comprensión lectora' },
  modal: { de: 'Modalverben', es: 'können · müssen · wollen · dürfen · möchten' },
  possessiv: { de: 'Possessivartikel', es: 'mein · dein · sein · ihr · unser' },
  praep: { de: 'Präpositionen', es: 'für · ohne · in · auf · unter… ¿dónde o adónde?' },
  adjektiv: { de: 'Adjektive & Komparativ', es: 'groß · größer · am größten · als / wie' },
  imperativ: { de: 'Imperativ', es: 'Komm! · Kommt! · Kommen Sie!' },
};

export const TYPE_LABEL: Record<QType, string> = {
  mc: 'Elige', write: 'Escribe', gap: 'Rellena', order: 'Ordena', error: 'Fehlerjagd', match: 'Relaciona', build: 'Construye',
};

export function timeFor(type: QType, diff: Difficulty): number {
  const base: Record<QType, number> = { mc: 20, write: 40, gap: 35, order: 50, error: 40, match: 45, build: 75 };
  const f: Record<Difficulty, number> = { easy: 1, medium: 1.25, hard: 1.5, special: 1.75 };
  return Math.round((base[type] * f[diff]) / 5) * 5;
}

// ---------- Objetos ----------
export interface ItemDef { name: string; tag: string; short: string; rule: string; kind: 'self' | 'attack' | 'defense' | 'meta'; target?: boolean }
export const ITEMS: Record<ItemId, ItemDef> = {
  blackcard: {
    name: 'BLACKCARD', tag: 'RISK OR REWARD', short: '+10 si aciertas · −10 si fallas', kind: 'self',
    rule: 'Solo en preguntas difíciles marcadas ◆. Actívala antes de responder. No se combina con Double XP ni Second Chance. Se quema al resolverse.',
  },
  thief: {
    name: 'THIEF', tag: 'ROBO DE PUNTOS', short: 'Roba hasta 5 pts si aciertas', kind: 'attack', target: true,
    rule: 'Elige rival antes de responder. Solo roba si aciertas ESTA pregunta y nunca más puntos de los que tenga. Un SHIELD lo bloquea.',
  },
  shield: {
    name: 'SHIELD', tag: 'ESCUDO', short: 'Bloquea el próximo ataque', kind: 'defense',
    rule: 'Actívalo durante cualquier pregunta, también como reacción a un ataque. Bloquea 1 robo o sabotaje. Caduca al terminar la ronda.',
  },
  double: {
    name: 'DOUBLE XP', tag: 'PUNTOS ×2', short: 'Duplica los puntos de la pregunta', kind: 'self',
    rule: 'Actívalo antes de responder. Duplica solo los puntos normales de la pregunta: no multiplica bonus ni robos.',
  },
  sabotage: {
    name: 'SABOTAGE', tag: '½ AL RIVAL', short: 'Su próximo acierto vale la mitad', kind: 'attack', target: true,
    rule: 'El rival gana la mitad de los puntos en su siguiente acierto (como mucho hasta el final de la ronda). No le quita puntos ya ganados. Un SHIELD lo bloquea.',
  },
  second: {
    name: 'SECOND CHANCE', tag: '2º INTENTO', short: 'Otro intento a mitad de puntos', kind: 'self',
    rule: 'Actívalo antes de responder. Si fallas, puedes volver a intentarlo por la mitad de puntos. No vale en Richtig/Falsch, retos especiales ni con BlackCard.',
  },
  wildcard: {
    name: 'WILDCARD', tag: 'COMODÍN', short: 'Tú eliges la categoría de la siguiente', kind: 'meta',
    rule: 'Actívalo durante una pregunta. Al pasar a la siguiente, eliges entre dos categorías.',
  },
};
export const COMMON_ITEMS: ItemId[] = ['thief', 'shield', 'double', 'sabotage', 'second', 'wildcard'];

export interface UseCtx {
  phase: Phase;
  blockItems: boolean;
  itemsOn: boolean;
  itemsOff: ItemId[];
  q: PublicQuestion | null;
  inventory: ItemId[];
  used: ItemId | null;
  state: 'idle' | 'sent' | 'retry';
  shield: boolean;
  wildPending: boolean;
  lastQuestion: boolean;
  self: string;
  rivals: { id: string; sabotaged: boolean; targeted: boolean }[];
}

/** Devuelve el motivo por el que NO se puede usar el objeto, o null si se puede. Lo usan servidor (autoridad) y cliente (UI). */
export function checkUse(c: UseCtx, item: ItemId, target?: string): string | null {
  if (!c.blockItems) return 'En este bloque no se usan objetos.';
  if (!c.itemsOn || c.itemsOff.includes(item)) return 'El profesor ha desactivado este objeto.';
  if (c.phase !== 'question' || !c.q) return 'Solo se pueden usar mientras la pregunta está abierta.';
  if (!c.inventory.includes(item)) return 'No tienes este objeto.';
  if (item === 'shield') return c.shield ? 'Ya tienes un escudo activo.' : null;
  if (c.used) return 'Solo 1 objeto por pregunta (el escudo es la única excepción).';
  if (c.state !== 'idle') return 'Hay que activarlo antes de responder.';
  if (item === 'blackcard' && !c.q.bc) return 'La BlackCard solo vale en preguntas difíciles marcadas ◆.';
  if (item === 'second' && !c.q.secondOk) return 'Second Chance no está disponible en esta pregunta.';
  if (ITEMS[item].target) {
    const r = c.rivals.find((x) => x.id === target);
    if (!target || target === c.self || !r) return 'Elige un rival.';
    if (r.targeted) return 'Ese rival ya está recibiendo un ataque en esta pregunta.';
    if (item === 'sabotage' && r.sabotaged) return 'Ese rival ya está saboteado.';
  }
  if (item === 'wildcard') {
    if (c.wildPending) return 'Ya hay un comodín preparado para la siguiente pregunta.';
    if (c.lastQuestion) return 'Es la última pregunta de la ronda.';
  }
  return null;
}

// ---------- Cofres ----------
export const CHESTS: Record<ChestTier, { name: string; de: string; coins: number; desc: string }> = {
  bronze: { name: 'Cofre de bronce', de: 'Bronzetruhe', coins: 0, desc: 'Un objeto.' },
  silver: { name: 'Cofre de plata', de: 'Silbertruhe', coins: 2, desc: 'Un objeto y 2 puntos.' },
  gold: { name: 'Cofre de oro', de: 'Goldtruhe', coins: 5, desc: 'Un objeto de ataque o Double XP y 5 puntos.' },
  black: { name: 'Cofre negro', de: 'Schwarze Truhe', coins: 0, desc: 'La BLACKCARD. Solo se gana con una Prüfungsfrage.' },
};
/** Objetos del cofre de oro (los más potentes). */
export const GOLD_ITEMS: ItemId[] = ['thief', 'double', 'sabotage'];

// ---------- Plan de clase (120 min: el juego y, después, «Nach dem Spiel») ----------
export interface BlockDef {
  id: BlockId;
  name: string;
  sub: string;
  min: number;
  /** 1 = el juego · 2 = actividades después del juego */
  act: 1 | 2;
  kind: 'quiz' | 'final' | 'task';
  items: boolean;
  reward: boolean;
  theme?: 'reading' | 'boss' | 'final' | 'workshop';
  brief: string[];
}

export const PLAN: BlockDef[] = [
  {
    id: 'lesen', name: 'Leseverstehen', sub: 'Lectura interactiva A1–A2', min: 10, act: 1, kind: 'quiz', items: false, reward: false, theme: 'reading',
    brief: ['Lee el texto (4 min). Pulsa las palabras subrayadas para ver la traducción.', 'Después: 6 preguntas de comprensión. El texto sigue visible.', 'Fíjate en el vocabulario: volverá a salir en el juego.'],
  },
  {
    id: 'warmup', name: 'Calentamiento', sub: 'Wortschatz · vocabulario', min: 7, act: 1, kind: 'quiz', items: false, reward: false,
    brief: ['Preguntas rápidas de vocabulario de todas las presentaciones.', 'Sustantivos SIEMPRE con artículo: der, die, das.', 'Truco: -ung, -e, -schrift → casi siempre DIE.'],
  },
  {
    id: 'r1', name: 'Vocabulary Rush', sub: 'Ronda 1 · vocabulario y día a día', min: 12, act: 1, kind: 'quiz', items: true, reward: true,
    brief: ['Empieza el juego estratégico: cada uno recibe un cofre de bronce.', '3 aciertos seguidos = otro cofre. Máximo 3 objetos en la mano.', 'Truhenfrage: acertarla da un cofre de plata.'],
  },
  {
    id: 'r2', name: 'Grammar Arena', sub: 'Ronda 2 · Perfekt, Dativ, Nebensätze…', min: 12, act: 1, kind: 'quiz', items: true, reward: true,
    brief: ['Perfekt: haben/sein en posición 2 + Partizip II al final.', 'weil, obwohl, dass, wenn → el verbo se va al FINAL.', 'Dativ: der→dem, die→der, das→dem, die (pl.)→den +n.', 'Prüfungsfrage ◆: acertarla da el cofre negro con la BLACKCARD.'],
  },
  {
    id: 'r3', name: 'Satzbau Challenge', sub: 'Ronda 3 · ordenar, construir, corregir', min: 9, act: 1, kind: 'quiz', items: true, reward: true,
    brief: ['Hauptsatz: el verbo conjugado en posición 2.', 'deshalb ocupa la posición 1 → Deshalb bleibe ich…', 'Nebensatz delante → verbo, verbo: Weil ich krank bin, bleibe ich…'],
  },
  {
    id: 'r4', name: 'Mixed Challenge', sub: 'Ronda 4 · todo mezclado', min: 9, act: 1, kind: 'quiz', items: true, reward: true,
    brief: ['Cualquier tema, cualquier tipo de ejercicio.', 'Reto especial de +15: si lo aciertas, cofre de oro.', 'Última oportunidad para ganar la BlackCard.'],
  },
  {
    id: 'boss', name: 'BlackCard Championship', sub: 'Final Boss · solo preguntas difíciles', min: 7, act: 1, kind: 'quiz', items: true, reward: false, theme: 'boss',
    brief: ['Todas las preguntas son difíciles ◆: la BlackCard está permitida.', 'Retos especiales +15. Un error con BlackCard cuesta −10.', 'Piensa antes de arriesgar.'],
  },
  {
    id: 'final', name: 'Siegerehrung', sub: 'Podio y repaso de errores', min: 5, act: 1, kind: 'final', items: false, reward: false, theme: 'final',
    brief: ['Podio final y estadísticas.', 'Repaso de las preguntas más falladas, con explicación.'],
  },
  {
    id: 'rolle', name: 'Mach es lustiger!', sub: 'Rollenspiel I · reescribe la lectura', min: 11, act: 2, kind: 'task', items: false, reward: false, theme: 'workshop',
    brief: ['Cada uno recibe 8 palabras aprendidas distintas.', 'Reescribe el texto para que sea muy gracioso y usa todas las palabras que puedas.', 'Después lo leéis en voz alta, interpretando a Pablo. ★ por palabra usada.'],
  },
  {
    id: 'szene', name: 'Szenen', sub: 'Rollenspiel II · tarjetas secretas', min: 8, act: 2, kind: 'task', items: false, reward: false, theme: 'workshop',
    brief: ['Cada uno recibe un papel con 3 objetivos secretos.', 'Preparad 1 minuto e interpretad la escena en alemán.', 'El profesor marca los objetivos cumplidos: ★ por objetivo.'],
  },
  {
    id: 'wort', name: 'Schreibwerkstatt', sub: 'Escritura · tus palabras, tu historia', min: 10, act: 2, kind: 'task', items: false, reward: false, theme: 'workshop',
    brief: ['Cada uno recibe una lista de palabras distinta y un tema.', 'Escribe una historia de al menos 40 palabras que las use todas.', 'La app marca en directo las palabras que ya has usado.'],
  },
  {
    id: 'frei', name: 'Freies Schreiben', sub: 'Escritura libre', min: 8, act: 2, kind: 'task', items: false, reward: false, theme: 'workshop',
    brief: ['Elige una de las tres consignas.', 'Escribe libremente: 30, 50 y 80 palabras dan ★.', 'Más ★ si usas Perfekt, un Nebensatz, el Dativ y conectores de orden.'],
  },
  {
    id: 'jenga', name: 'Wort-Jenga', sub: 'La torre de preguntas', min: 10, act: 2, kind: 'task', items: false, reward: false, theme: 'workshop',
    brief: ['Por turnos: responde una pregunta en alemán.', 'Bien → quitas 1 pieza. Mal o sin respuesta → quitas 2.', 'Quien derriba la torre pierde. Los demás ganan ★★★.'],
  },
  {
    id: 'ende', name: 'Feierabend', sub: 'Cierre de la clase', min: 2, act: 2, kind: 'final', items: false, reward: false, theme: 'final',
    brief: ['Resumen del día: puntos del juego y estrellas del taller.'],
  },
];

export const blockDef = (id: BlockId | null): BlockDef | undefined => PLAN.find((b) => b.id === id);
export const PLAN_MIN = PLAN.reduce((a, b) => a + b.min, 0);
