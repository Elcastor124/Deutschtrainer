// Presentación (barajado) y corrección de preguntas. Solo en el servidor.
import { POINTS, timeFor } from '../shared/rules.ts';
import type { Answer, PublicQuestion, Question, Status } from '../shared/types.ts';

/** Barajado concreto de una pregunta presentada: índice mostrado → índice original. */
export interface Instance { opt?: number[]; tok?: number[]; right?: number[] }

function perm(n: number, rand: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const notIdentity = (a: number[]) => a.some((v, i) => v !== i);

export function makeInstance(q: Question, rand: () => number): Instance {
  if (q.type === 'mc') return { opt: q.fixed ? q.options.map((_, i) => i) : perm(q.options.length, rand) };
  if (q.type === 'order') {
    let p = perm(q.tokens.length, rand);
    for (let k = 0; k < 8 && !notIdentity(p); k++) p = perm(q.tokens.length, rand);
    return { tok: p };
  }
  if (q.type === 'match') {
    let p = perm(q.pairs.length, rand);
    for (let k = 0; k < 8 && !notIdentity(p); k++) p = perm(q.pairs.length, rand);
    return { right: p };
  }
  return {};
}

export const isBinary = (q: Question) => q.type === 'mc' && q.options.length <= 2;

export function publicView(q: Question, inst: Instance): PublicQuestion {
  const v: PublicQuestion = {
    id: q.id, type: q.type, topic: q.topic, diff: q.diff, src: q.src, points: POINTS[q.diff], prompt: q.prompt,
    bc: (q.diff === 'hard' || q.diff === 'special') && !!q.why,
    secondOk: !isBinary(q) && q.diff !== 'special',
    unlock: !!q.unlock,
    time: q.time ?? timeFor(q.type, q.diff),
  };
  if (q.why) v.why = q.why;
  if (q.swatch) v.swatch = q.swatch;
  if (q.type === 'mc') v.options = (inst.opt ?? []).map((i) => q.options[i]);
  if (q.type === 'gap') { v.text = q.text; v.gapCount = q.gaps.length; }
  if (q.type === 'order') v.tokens = (inst.tok ?? []).map((i) => q.tokens[i]);
  if (q.type === 'error') v.tokens = q.tokens;
  if (q.type === 'match') { v.left = q.pairs.map((p) => p[0]); v.right = (inst.right ?? []).map((i) => q.pairs[i][1]); }
  if (q.type === 'build' && q.parts) v.parts = q.parts;
  return v;
}

// ---------- Normalización ----------
const QUOTES = /[„“”"«»‚‘’`´]/g;
export function clean(s: string): string {
  return s.normalize('NFC').replace(QUOTES, '').replace(/[–—]/g, '-').replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ').trim().replace(/[.!?;:]+$/, '').trim();
}
const loose = (s: string) => clean(s).replace(/[.,!?;:¿¡]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
export const fold = (s: string) => loose(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const words = (s: string) => fold(s).split(' ').filter(Boolean).sort().join(' ');

export function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

type Level = 'exact' | 'loose' | 'fold' | 'near' | 'reorder' | 'none';
interface Match { level: Level; target: string; note?: string }

/** Compara un texto con las respuestas aceptadas y devuelve el mejor nivel de coincidencia. */
export function compare(given: string, accept: string[], fuzzy: boolean): Match {
  const g = given ?? '';
  for (const a of accept) if (clean(g) === clean(a)) return { level: 'exact', target: a };
  for (const a of accept) {
    if (loose(g) === loose(a)) {
      const caseOnly = clean(g).toLowerCase() === clean(a).toLowerCase();
      return { level: 'loose', target: a, note: caseOnly ? 'Ojo con las mayúsculas: en alemán los sustantivos van con mayúscula.' : 'Ojo con la puntuación (la coma antes de weil, dass, obwohl…).' };
    }
  }
  for (const a of accept) if (fold(g) === fold(a)) return { level: 'fold', target: a, note: `Escribe con ä, ö, ü, ß: «${a}».` };
  for (const a of accept) {
    const [art, ...rest] = a.split(' ');
    if (['der', 'die', 'das'].includes(art) && rest.length && fold(g) === fold(rest.join(' '))) {
      return { level: 'none', target: a, note: `Falta el artículo: ${art} ${rest.join(' ')}.` };
    }
  }
  if (fuzzy) {
    const fg = fold(g);
    for (const a of accept) {
      const fa = fold(a);
      const thr = fa.length >= 14 ? 2 : fa.length >= 6 ? 1 : 0;
      if (thr && lev(fg, fa) <= thr) return { level: 'near', target: a };
    }
    for (const a of accept) if (fg.includes(' ') && words(g) === words(a)) return { level: 'reorder', target: a };
  }
  return { level: 'none', target: accept[0] };
}

const OK_LEVELS: Level[] = ['exact', 'loose', 'fold'];

export interface Graded { status: Status; given: string; note?: string }

/** Corrige una respuesta. «review» = dudosa → la decide el profesor (en práctica cuenta como fallo con pista). */
export function grade(q: Question, inst: Instance, a: Answer, practice: boolean): Graded {
  const given = describe(q, inst, a);
  const review = (note: string): Graded => (practice ? { status: 'wrong', given, note } : { status: 'review', given, note });
  switch (q.type) {
    case 'mc': {
      const orig = inst.opt?.[a.choice ?? -1];
      return { status: orig === q.answer ? 'correct' : 'wrong', given };
    }
    case 'write':
    case 'build': {
      const m = compare(a.text ?? '', q.accept, !q.strict);
      if (OK_LEVELS.includes(m.level)) return { status: 'correct', given, note: m.note };
      if (m.level === 'near') return review(`Casi: compárala con «${m.target}».`);
      if (m.level === 'reorder') return review('Mismas palabras en otro orden: ¿es una variante válida?');
      return { status: 'wrong', given, note: m.note };
    }
    case 'gap': {
      const gs = a.gaps ?? [];
      const notes: string[] = [];
      let ok = gs.length === q.gaps.length;
      q.gaps.forEach((acc, i) => {
        const m = compare(gs[i] ?? '', acc, false);
        if (!OK_LEVELS.includes(m.level)) ok = false;
        else if (m.note) notes.push(m.note);
      });
      return { status: ok ? 'correct' : 'wrong', given, note: ok ? notes[0] : undefined };
    }
    case 'order': {
      const ids = a.order ?? [];
      if (ids.length !== q.tokens.length || new Set(ids).size !== ids.length) {
        return { status: 'wrong', given, note: ids.length < q.tokens.length ? 'Faltan fichas por colocar.' : undefined };
      }
      const sentence = ids.map((i) => q.tokens[inst.tok?.[i] ?? -1] ?? '').join(' ');
      const ok = q.accept.some((x) => loose(x) === loose(sentence));
      return { status: ok ? 'correct' : 'wrong', given };
    }
    case 'error': {
      if (a.index !== q.wrong) return { status: 'wrong', given, note: `El error estaba en «${q.tokens[q.wrong]}».` };
      const m = compare((a.fix ?? '').replace(/[.,!?]/g, ''), q.fix, false);
      if (OK_LEVELS.includes(m.level)) return { status: 'correct', given, note: m.note };
      return { status: 'wrong', given, note: 'Has encontrado el error, pero la corrección no es correcta.' };
    }
    case 'match': {
      const p = a.pairs ?? [];
      const right = q.pairs.filter((_, i) => inst.right?.[p[i] ?? -1] === i).length;
      return { status: right === q.pairs.length ? 'correct' : 'wrong', given, note: right < q.pairs.length ? `${right} de ${q.pairs.length} parejas bien.` : undefined };
    }
  }
}

/** Texto legible de la respuesta dada (para profesor, revisión y repaso). */
export function describe(q: Question, inst: Instance, a: Answer): string {
  switch (q.type) {
    case 'mc': return q.options[inst.opt?.[a.choice ?? -1] ?? -1] ?? '—';
    case 'write': case 'build': return (a.text ?? '').trim() || '—';
    case 'gap': return (a.gaps ?? []).map((g) => g.trim() || '…').join(' · ') || '—';
    case 'order': return (a.order ?? []).map((i) => q.tokens[inst.tok?.[i] ?? -1] ?? '?').join(' ') || '—';
    case 'error': return a.index === undefined ? '—' : `«${q.tokens[a.index] ?? '?'}» → ${a.fix?.trim() || '…'}`;
    case 'match': return q.pairs.map((pr, i) => `${pr[0]} → ${q.pairs[inst.right?.[a.pairs?.[i] ?? -1] ?? -1]?.[1] ?? '?'}`).join(' · ');
  }
}

/** Solución modelo legible. */
export function solution(q: Question): string {
  switch (q.type) {
    case 'mc': return q.options[q.answer];
    case 'write': case 'build': return q.accept[0];
    case 'gap': { let k = 0; return q.text.replace(/___/g, () => q.gaps[k++][0]); }
    case 'order': return q.accept[0];
    case 'error': return `«${q.tokens[q.wrong].replace(/[.,!?]$/, '')}» → ${q.fix[0]}: ${q.tokens.map((t, i) => (i === q.wrong ? t.replace(/^[^.,!?]+/, q.fix[0]) : t)).join(' ')}`;
    case 'match': return q.pairs.map((p) => `${p[0]} = ${p[1]}`).join(' · ');
  }
}
