// Selección de preguntas: colas por bloque con dificultad progresiva, sin repeticiones en la sesión.
import type { BlockId, Difficulty, Question, QuizBlock, Topic } from '../shared/types.ts';

type Mix = Partial<Record<Difficulty, number>>;
/** Contexto de la sesión: texto de lectura elegido y preguntas que ya vieron estos alumnos en otras partidas. */
export interface SelCtx { reading?: string; seen?: Map<string, number>; /** Temas elegidos por el profesor (vacío = todos). */ topics?: Topic[] }
/** filter: regla normal del bloque · relax: misma forma de ejercicio pero de cualquier tema (para el juego por temas). */
interface Rule { filter: (q: Question, c: SelCtx) => boolean; relax?: (q: Question) => boolean; mix: Mix; prefer?: { reading: true; n: number }; unlock?: boolean }

const GRAMMAR: Topic[] = ['perfekt', 'nebensatz', 'dativ', 'akkusativ', 'praesens', 'trennbar', 'modal', 'possessiv', 'praep', 'adjektiv', 'imperativ'];
const SATZBAU_TYPES = ['order', 'build', 'error'];

/** ¿La pregunta es del texto de lectura de la sesión? (Las preguntas sin etiqueta de texto valen para cualquiera.) */
const ofText = (q: Question, c: SelCtx) => !q.tags?.some((t) => t.startsWith('text:')) || q.tags.includes(`text:${c.reading}`);
export const readingTag = (c: SelCtx) => `reading:${c.reading}`;

// Número de preguntas ajustado al tiempo real de cada bloque (~70 s por pregunta con la corrección).
export const RULES: Record<QuizBlock, Rule> = {
  lesen: { filter: (q, c) => q.topic === 'lesen' && ofText(q, c), mix: { easy: 3, medium: 3 } },
  warmup: {
    filter: (q) => (q.topic === 'vocab' || q.topic === 'alltag') && q.diff === 'easy' && (q.type === 'mc' || q.type === 'match') && !q.tags?.includes('tf'),
    relax: (q) => q.diff !== 'hard' && q.diff !== 'special' && ['mc', 'match', 'gap', 'write'].includes(q.type) && !q.tags?.includes('tf'),
    mix: { easy: 7 }, prefer: { reading: true, n: 3 },
  },
  r1: { filter: (q) => q.topic === 'vocab' || q.topic === 'alltag', relax: () => true, mix: { easy: 3, medium: 5, hard: 1 }, prefer: { reading: true, n: 2 } },
  r2: { filter: (q) => GRAMMAR.includes(q.topic) && !['order', 'build'].includes(q.type), relax: (q) => !['order', 'build'].includes(q.type), mix: { easy: 2, medium: 4, hard: 2 }, unlock: true },
  r3: { filter: (q) => SATZBAU_TYPES.includes(q.type) || !!q.tags?.includes('fix'), relax: (q) => q.type !== 'mc', mix: { easy: 1, medium: 3, hard: 2 }, unlock: true },
  r4: { filter: (q) => q.topic !== 'lesen', mix: { easy: 1, medium: 3, hard: 2, special: 1 }, unlock: true, prefer: { reading: true, n: 1 } },
  // Por temas, si el tema no tiene bastantes difíciles se completa con sus preguntas medias antes que con otros temas.
  boss: { filter: (q) => (q.diff === 'hard' || q.diff === 'special') && !!q.why && !q.unlock, relax: (q) => q.diff === 'medium' && !q.unlock, mix: { special: 11, hard: 9 } },
};
const isQuiz = (b: BlockId): b is QuizBlock => b in RULES;

/** Baraja y deja delante lo que estos alumnos nunca han visto; después, lo visto hace más tiempo. */
export function freshFirst<T extends { id: string }>(list: T[], rand: () => number, seen?: Map<string, number>): T[] {
  const r = shuffle(list, rand);
  if (!seen?.size) return r;
  return r.sort((a, b) => (seen.get(a.id) ?? 0) - (seen.get(b.id) ?? 0));
}

const ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'special'];

function shuffle<T>(a: T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Separa preguntas consecutivas del mismo tema cuando es posible. */
function spread(list: Question[]): Question[] {
  const out = [...list];
  for (let i = 1; i < out.length; i++) {
    if (out[i].topic === out[i - 1].topic && out[i].diff === out[i - 1].diff) {
      const j = out.findIndex((x, k) => k > i && x.diff === out[i].diff && x.topic !== out[i - 1].topic);
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

/** Construye la cola de un bloque. «used» evita repetir preguntas ya vistas en la sesión. */
export function buildQueue(block: BlockId, bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): string[] {
  if (!isQuiz(block)) return [];
  const rule = RULES[block];
  const all = [...bank.values()].filter((q) => rule.filter(q, ctx) && !used.has(q.id));
  // Juego por temas: primero preguntas de esos temas con la forma del bloque; si no llegan, se completa con el bloque normal.
  const topical = topicPool(block, bank, used, ctx);
  const pools = (topical ? [topical, all] : [all]).map((list) => {
    const pool = freshFirst(list, rand, ctx.seen);
    if (block === 'boss') pool.sort((a, b) => Number(!!b.tags?.includes('boss')) - Number(!!a.tags?.includes('boss')));
    return pool;
  });
  const picked: Question[] = [];
  const take = (pool: Question[], pred: (q: Question) => boolean, n: number) => {
    for (const q of pool) {
      if (n <= 0) break;
      if (!picked.includes(q) && pred(q)) { picked.push(q); n--; }
    }
    return n;
  };
  // 1) Prüfungsfrage que desbloquea la BlackCard (ocupa un hueco «hard»).
  const mix: Mix = { ...rule.mix };
  if (rule.unlock && (mix.hard ?? 0) > 0) {
    let left = 1;
    for (const pool of pools) left = take(pool, (q) => !!q.unlock && q.diff === 'hard', left);
    if (left === 0) mix.hard = (mix.hard ?? 0) - 1;
  }
  // 2) Vocabulario de la lectura de la sesión (vuelve a aparecer). En el juego por temas, solo si es de esos temas.
  if (rule.prefer) {
    const tag = readingTag(ctx);
    for (const d of ORDER) {
      const want = Math.min(mix[d] ?? 0, rule.prefer.n - picked.filter((q) => q.tags?.includes(tag)).length);
      if (want > 0) mix[d] = (mix[d] ?? 0) - (want - take(pools[0], (q) => q.diff === d && !!q.tags?.includes(tag) && !q.unlock, want));
    }
  }
  // 3) Resto por dificultad; si falta en un nivel, se completa con el contiguo (y, por temas, después con el banco general).
  for (const pool of pools) {
    for (const d of ORDER) {
      let left = take(pool, (q) => q.diff === d && !q.unlock, mix[d] ?? 0);
      for (const alt of ORDER.filter((x) => x !== d).sort((a, b) => Math.abs(ORDER.indexOf(a) - ORDER.indexOf(d)) - Math.abs(ORDER.indexOf(b) - ORDER.indexOf(d)))) {
        if (left <= 0) break;
        left = take(pool, (q) => q.diff === alt && !q.unlock, left);
      }
      mix[d] = left;
    }
  }
  const sorted = ORDER.flatMap((d) => spread(picked.filter((q) => q.diff === d && !q.unlock)));
  // La Prüfungsfrage va hacia el final de la ronda (penúltima), para que dé tiempo a usar la BlackCard después.
  const unlockQ = picked.find((q) => q.unlock);
  if (unlockQ) sorted.splice(Math.max(0, sorted.length - 1), 0, unlockQ);
  return sorted.map((q) => q.id);
}

/** Preguntas de los temas de la sala con la forma del bloque (null si la sala no tiene temas). La lectura solo en su bloque. */
function topicPool(block: QuizBlock, bank: Map<string, Question>, used: Set<string>, ctx: SelCtx): Question[] | null {
  const topics = ctx.topics?.length ? ctx.topics : null;
  if (!topics) return null;
  const rule = RULES[block];
  return [...bank.values()].filter((q) => topics.includes(q.topic) && !used.has(q.id)
    && (rule.filter(q, ctx) || (!!rule.relax && q.topic !== 'lesen' && rule.relax(q))));
}

/** Temas disponibles para el WILDCARD dentro de las reglas del bloque (en el juego por temas, los de la sala si hay dos). */
export function wildTopics(block: BlockId, bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): Topic[] {
  if (!isQuiz(block)) return [];
  const rule = RULES[block];
  const own = new Set<Topic>();
  for (const q of topicPool(block, bank, used, ctx) ?? []) if (!q.unlock) own.add(q.topic);
  if (own.size >= 2) return shuffle([...own], rand).slice(0, 2);
  const topics = new Set<Topic>();
  for (const q of bank.values()) if (rule.filter(q, ctx) && !used.has(q.id) && !q.unlock) topics.add(q.topic);
  return shuffle([...topics], rand).slice(0, 2);
}

/** Pregunta de un tema concreto para el WILDCARD, cerca de la dificultad prevista. */
export function drawTopic(block: BlockId, topic: Topic, diff: Difficulty, bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): string | null {
  if (!isQuiz(block)) return null;
  const rule = RULES[block];
  const ok = (q: Question) => rule.filter(q, ctx) || (!!ctx.topics?.includes(topic) && !!rule.relax && q.topic !== 'lesen' && rule.relax(q));
  const pool = freshFirst([...bank.values()].filter((q) => ok(q) && q.topic === topic && !used.has(q.id) && !q.unlock), rand, ctx.seen);
  const byDist = pool.sort((a, b) => Math.abs(ORDER.indexOf(a.diff) - ORDER.indexOf(diff)) - Math.abs(ORDER.indexOf(b.diff) - ORDER.indexOf(diff)));
  return byDist[0]?.id ?? null;
}

export interface Stat { n: number; wrong: number; last: 0 | 1; at: number }

/** Longitudes de sesión que ofrece el modo práctica. */
export const PRACTICE_SIZES = [10, 15, 25] as const;
/** Sesiones recientes que se evitan repetir (aprox. «las últimas 3 prácticas»). */
const RECENT_SESSIONS = 3;
/** Parte de la sesión dedicada a repasar errores: práctica normal / «solo lo que he fallado». */
const REVIEW_SHARE = 0.4;
const FOCUS_SHARE = 0.7;
const DAY = 86_400_000;

/** Muestreo ponderado sin reemplazo (Efraimidis–Spirakis): mayor peso → antes. */
function weighted<T>(list: T[], w: (x: T) => number, rand: () => number): T[] {
  return list.map((x) => ({ x, k: Math.pow(rand(), 1 / Math.max(1e-6, w(x))) })).sort((a, b) => b.k - a.k).map((e) => e.x);
}

/**
 * Cola del modo práctica (repaso espaciado):
 * - Preguntas vistas en las últimas ~3 sesiones quedan al final (solo si no hay nada más en esos temas).
 * - Como mucho ~40 % de repaso de errores; el resto, preguntas nuevas (o vistas hace más tiempo).
 * - «focus» (solo lo que he fallado): ~70 % errores, rotando (primero los que hace más que no salen), y se completa con nuevas.
 */
export function practiceQueue(stats: Record<string, Stat>, topics: Topic[], focus: boolean, bank: Map<string, Question>, rand: () => number, n = 15, now = Date.now()): string[] {
  const cand = [...bank.values()].filter((q) => (topics.length ? topics.includes(q.topic) : true));
  const size = Math.max(1, Math.min(n, cand.length));
  // Lo visto más recientemente (≈ las últimas sesiones), según la hora de la última respuesta.
  const seen = Object.entries(stats).filter(([id]) => bank.has(id)).sort((a, b) => b[1].at - a[1].at);
  const recent = new Set(seen.slice(0, RECENT_SESSIONS * n).map(([id]) => id));
  const lastSession = new Set(seen.slice(0, n).map(([id]) => id));
  const age = (s: Stat) => Math.max(0, now - s.at) / DAY;

  const failing = (q: Question) => !!stats[q.id] && stats[q.id].last === 0;
  const fixed = (q: Question) => !!stats[q.id]?.wrong && stats[q.id].last === 1;
  const fresh = cand.filter((q) => !stats[q.id]);
  const picked: Question[] = [];
  const has = new Set<string>();
  const take = (list: Question[], k: number) => {
    for (const q of list) {
      if (k <= 0) break;
      if (!has.has(q.id)) { picked.push(q); has.add(q.id); k--; }
    }
  };

  if (focus) {
    // Errores actuales: primero los que no salieron en la última sesión y los más antiguos (rotación); luego los ya corregidos.
    const errs = weighted(cand.filter(failing), (q) => (lastSession.has(q.id) ? 1 : 6) * (1 + Math.min(10, age(stats[q.id]))) * (1 + 0.3 * stats[q.id].wrong), rand);
    const cap = Math.max(1, Math.ceil(size * FOCUS_SHARE));
    take(errs, cap);
    take(weighted(cand.filter((q) => fixed(q) && !recent.has(q.id)), (q) => 1 + age(stats[q.id]), rand), cap - picked.length);
  } else {
    // Repaso espaciado: errores que no han salido en las últimas sesiones, más peso cuanto más antiguos y más fallados.
    const due = cand.filter((q) => (failing(q) || fixed(q)) && !recent.has(q.id));
    const cap = Math.floor(size * REVIEW_SHARE);
    take(weighted(due, (q) => (failing(q) ? 3 : 1) * (1 + stats[q.id].wrong) * (1 + Math.min(14, age(stats[q.id]))), rand), cap);
  }
  // Resto: nuevas; después lo visto hace más tiempo (fuera de las últimas sesiones); por último, lo reciente (el más antiguo primero).
  take(shuffle(fresh, rand), size - picked.length);
  const older = cand.filter((q) => stats[q.id] && !recent.has(q.id));
  take(weighted(older, (q) => (failing(q) ? 3 : 1) * (1 + age(stats[q.id])), rand), size - picked.length);
  const rest = cand.filter((q) => stats[q.id] && recent.has(q.id)).sort((a, b) => stats[a.id].at - stats[b.id].at);
  take(rest, size - picked.length);
  return picked.sort((a, b) => ORDER.indexOf(a.diff) - ORDER.indexOf(b.diff)).map((q) => q.id);
}

/** Pregunta para el Wort-Jenga: rápida (elegir, escribir o rellenar), fácil o media, sin repetir. */
export function jengaQuestion(bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): string | null {
  const base = (q: Question) => q.topic !== 'lesen' && !used.has(q.id) && !q.tags?.includes('tf');
  const quick = (q: Question) => ['mc', 'write', 'gap'].includes(q.type) && (q.diff === 'easy' || q.diff === 'medium');
  const topics = ctx.topics?.length ? ctx.topics : null;
  // Por temas: rápidas del tema → cualquier otra del tema (ordenar, construir…) → rápidas de cualquier tema.
  const tiers: ((q: Question) => boolean)[] = topics
    ? [(q) => topics.includes(q.topic) && quick(q), (q) => topics.includes(q.topic) && q.diff !== 'special', quick]
    : [quick];
  for (const tier of tiers) {
    const pool = freshFirst([...bank.values()].filter((q) => base(q) && tier(q)), rand, ctx.seen);
    if (pool.length) return pool[0].id;
  }
  return null;
}
