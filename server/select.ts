// Selección de preguntas: colas por bloque con dificultad progresiva, sin repeticiones en la sesión.
import type { BlockId, Difficulty, Question, QuizBlock, Topic } from '../shared/types.ts';

type Mix = Partial<Record<Difficulty, number>>;
/** Contexto de la sesión: texto de lectura elegido y preguntas que ya vieron estos alumnos en otras partidas. */
export interface SelCtx { reading?: string; seen?: Map<string, number> }
interface Rule { filter: (q: Question, c: SelCtx) => boolean; mix: Mix; prefer?: { reading: true; n: number }; unlock?: boolean }

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
    mix: { easy: 7 }, prefer: { reading: true, n: 3 },
  },
  r1: { filter: (q) => q.topic === 'vocab' || q.topic === 'alltag', mix: { easy: 3, medium: 5, hard: 1 }, prefer: { reading: true, n: 2 } },
  r2: { filter: (q) => GRAMMAR.includes(q.topic) && !['order', 'build'].includes(q.type), mix: { easy: 2, medium: 4, hard: 2 }, unlock: true },
  r3: { filter: (q) => SATZBAU_TYPES.includes(q.type) || !!q.tags?.includes('fix'), mix: { easy: 1, medium: 3, hard: 2 }, unlock: true },
  r4: { filter: (q) => q.topic !== 'lesen', mix: { easy: 1, medium: 3, hard: 2, special: 1 }, unlock: true, prefer: { reading: true, n: 1 } },
  boss: { filter: (q) => (q.diff === 'hard' || q.diff === 'special') && !!q.why && !q.unlock, mix: { special: 11, hard: 9 } },
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
  const pool = freshFirst([...bank.values()].filter((q) => rule.filter(q, ctx) && !used.has(q.id)), rand, ctx.seen);
  if (block === 'boss') pool.sort((a, b) => Number(!!b.tags?.includes('boss')) - Number(!!a.tags?.includes('boss')));
  const picked: Question[] = [];
  const take = (pred: (q: Question) => boolean, n: number) => {
    for (const q of pool) {
      if (n <= 0) break;
      if (!picked.includes(q) && pred(q)) { picked.push(q); n--; }
    }
    return n;
  };
  // 1) Prüfungsfrage que desbloquea la BlackCard (ocupa un hueco «hard»).
  const mix: Mix = { ...rule.mix };
  if (rule.unlock && (mix.hard ?? 0) > 0 && take((q) => !!q.unlock && q.diff === 'hard', 1) === 0) mix.hard = (mix.hard ?? 0) - 1;
  // 2) Vocabulario de la lectura de la sesión (vuelve a aparecer).
  if (rule.prefer) {
    const tag = readingTag(ctx);
    for (const d of ORDER) {
      const want = Math.min(mix[d] ?? 0, rule.prefer.n - picked.filter((q) => q.tags?.includes(tag)).length);
      if (want > 0) mix[d] = (mix[d] ?? 0) - (want - take((q) => q.diff === d && !!q.tags?.includes(tag) && !q.unlock, want));
    }
  }
  // 3) Resto por dificultad; si falta en un nivel, se completa con el contiguo.
  for (const d of ORDER) {
    let left = take((q) => q.diff === d && !q.unlock, mix[d] ?? 0);
    for (const alt of ORDER.filter((x) => x !== d).sort((a, b) => Math.abs(ORDER.indexOf(a) - ORDER.indexOf(d)) - Math.abs(ORDER.indexOf(b) - ORDER.indexOf(d)))) {
      if (left <= 0) break;
      left = take((q) => q.diff === alt && !q.unlock, left);
    }
  }
  const sorted = ORDER.flatMap((d) => spread(picked.filter((q) => q.diff === d && !q.unlock)));
  // La Prüfungsfrage va hacia el final de la ronda (penúltima), para que dé tiempo a usar la BlackCard después.
  const unlockQ = picked.find((q) => q.unlock);
  if (unlockQ) sorted.splice(Math.max(0, sorted.length - 1), 0, unlockQ);
  return sorted.map((q) => q.id);
}

/** Temas disponibles para el WILDCARD dentro de las reglas del bloque. */
export function wildTopics(block: BlockId, bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): Topic[] {
  if (!isQuiz(block)) return [];
  const rule = RULES[block];
  const topics = new Set<Topic>();
  for (const q of bank.values()) if (rule.filter(q, ctx) && !used.has(q.id) && !q.unlock) topics.add(q.topic);
  return shuffle([...topics], rand).slice(0, 2);
}

/** Pregunta de un tema concreto para el WILDCARD, cerca de la dificultad prevista. */
export function drawTopic(block: BlockId, topic: Topic, diff: Difficulty, bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): string | null {
  if (!isQuiz(block)) return null;
  const rule = RULES[block];
  const pool = freshFirst([...bank.values()].filter((q) => rule.filter(q, ctx) && q.topic === topic && !used.has(q.id) && !q.unlock), rand, ctx.seen);
  const byDist = pool.sort((a, b) => Math.abs(ORDER.indexOf(a.diff) - ORDER.indexOf(diff)) - Math.abs(ORDER.indexOf(b.diff) - ORDER.indexOf(diff)));
  return byDist[0]?.id ?? null;
}

export interface Stat { n: number; wrong: number; last: 0 | 1; at: number }

/** Cola del modo práctica: prioriza lo fallado (y lo no visto), sin repetir. */
export function practiceQueue(stats: Record<string, Stat>, topics: Topic[], focus: boolean, bank: Map<string, Question>, rand: () => number, n = 15): string[] {
  let cand = [...bank.values()].filter((q) => (topics.length ? topics.includes(q.topic) : true));
  if (focus) {
    const failed = cand.filter((q) => stats[q.id]?.wrong);
    if (failed.length) cand = failed;
  }
  const weight = (q: Question) => {
    const s = stats[q.id];
    if (!s) return 1.5;
    if (s.last === 0) return 8 + 2 * s.wrong;
    return s.wrong ? 2 : 0.3;
  };
  const items = cand.map((q) => ({ q, k: Math.pow(rand(), 1 / weight(q)) })).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.q);
  return items.sort((a, b) => ORDER.indexOf(a.diff) - ORDER.indexOf(b.diff)).map((q) => q.id);
}

/** Pregunta para el Wort-Jenga: rápida (elegir, escribir o rellenar), fácil o media, sin repetir. */
export function jengaQuestion(bank: Map<string, Question>, used: Set<string>, rand: () => number, ctx: SelCtx = {}): string | null {
  const pool = freshFirst([...bank.values()].filter((q) => ['mc', 'write', 'gap'].includes(q.type) && (q.diff === 'easy' || q.diff === 'medium')
    && q.topic !== 'lesen' && !used.has(q.id) && !q.tags?.includes('tf')), rand, ctx.seen);
  return pool[0]?.id ?? null;
}
