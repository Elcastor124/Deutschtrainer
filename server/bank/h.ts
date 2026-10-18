// Constructores compactos para el banco de preguntas. Los IDs son estables (hash del contenido)
// para que el historial de errores del modo práctica sobreviva a reinicios del servidor.
import type { Difficulty, QError, QGap, QMatch, QMc, QOrder, QWrite, Source, Topic } from '../../shared/types.ts';

export interface Meta {
  t: Topic;
  d: Difficulty;
  s: Source;
  /** Explicación que se muestra al corregir. */
  x: string;
  why?: string;
  unlock?: boolean;
  tags?: string[];
  time?: number;
}

export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function rng(seed: string): () => number {
  let a = parseInt(hash(seed), 36) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function base<T extends string>(type: T, m: Meta, prompt: string, key: string) {
  return {
    id: `${m.s}-${type}-${hash(`${type}|${prompt}|${key}`)}`,
    type,
    topic: m.t,
    diff: m.d,
    src: m.s,
    prompt,
    explain: m.x,
    ...(m.why ? { why: m.why } : {}),
    ...(m.unlock ? { unlock: true } : {}),
    ...(m.tags ? { tags: m.tags } : {}),
    ...(m.time ? { time: m.time } : {}),
  };
}

const arr = (a: string | string[]) => (Array.isArray(a) ? a : [a]);

/** Elección múltiple. La opción correcta es options[0] salvo que se indique; se barajan al presentarla. */
export const mc = (m: Meta, prompt: string, options: string[], o: { answer?: number; fixed?: boolean; swatch?: string } = {}): QMc => ({
  ...base('mc', m, prompt, options.join('/')),
  options,
  answer: o.answer ?? 0,
  ...(o.fixed ? { fixed: true } : {}),
  ...(o.swatch ? { swatch: o.swatch } : {}),
});

/** Richtig / Falsch (orden fijo). */
export const tf = (m: Meta, statement: string, isTrue: boolean): QMc =>
  mc({ ...m, tags: [...(m.tags ?? []), 'tf'] }, statement, ['Richtig', 'Falsch'], { answer: isTrue ? 0 : 1, fixed: true });

/** Respuesta escrita. accept[0] es la solución modelo; el resto, alternativas válidas. */
export const wr = (m: Meta, prompt: string, accept: string | string[], o: { strict?: boolean } = {}): QWrite => ({
  ...base('write', m, prompt, arr(accept)[0]),
  accept: arr(accept),
  ...(o.strict ? { strict: true } : {}),
});

/** Construir una frase a partir de piezas. */
export const bd = (m: Meta, prompt: string, parts: string[], accept: string | string[]): QWrite => ({
  ...base('build', m, prompt, parts.join('/')),
  accept: arr(accept),
  parts,
});

/** Huecos: cada ___ del texto corresponde a una entrada de gaps (con alternativas). */
export const gp = (m: Meta, prompt: string, text: string, gaps: (string | string[])[]): QGap => {
  const n = text.split('___').length - 1;
  if (n !== gaps.length) throw new Error(`gap mismatch (${n} vs ${gaps.length}): ${text}`);
  return { ...base('gap', m, prompt, text), text, gaps: gaps.map(arr) };
};

const LOWER_FIRST = /^(ich|du|er|sie|es|wir|ihr|weil|obwohl|wenn|dass|deshalb|deswegen|am|im|nach|heute|gestern|mein|meine|die|der|das|ein|eine|haben|hast|hat|ist|sind|bin|kommst|kann|wie|wo|was|warum|wann|mit|zuerst|danach|dann|bei|seit|von|zu|aus|in|auf|unterschreiben|nehmen|brauchen|glaubst)$/i;

/** Ordenar palabras. Las fichas salen de la frase modelo, sin puntuación. */
export const od = (m: Meta, prompt: string, sentence: string, alts: string[] = []): QOrder => {
  const tokens = sentence.replace(/[.,?!„“"]/g, '').split(/\s+/).filter(Boolean);
  if (LOWER_FIRST.test(tokens[0])) tokens[0] = tokens[0].toLowerCase();
  return { ...base('order', m, prompt, sentence), tokens, accept: [sentence, ...alts] };
};

/** Fehlerjagd: la palabra errónea va marcada como [error|corrección/alternativa]. */
export const er = (m: Meta, prompt: string, marked: string): QError => {
  const raw = marked.split(' ');
  let wrong = -1;
  let fix: string[] = [];
  const tokens = raw.map((tok, i) => {
    const mm = /^\[([^|\]]+)\|([^\]]+)\](.*)$/.exec(tok);
    if (!mm) return tok;
    wrong = i;
    fix = mm[2].split('/');
    return mm[1] + mm[3];
  });
  if (wrong < 0) throw new Error(`error marker missing: ${marked}`);
  return { ...base('error', m, prompt, marked), tokens, wrong, fix };
};

/** Relacionar parejas (izquierda en orden, derecha barajada al presentarla). */
export const mt = (m: Meta, prompt: string, pairs: [string, string][]): QMatch => ({
  ...base('match', m, prompt, pairs.map((p) => p.join('=')).join(';')),
  pairs,
});
