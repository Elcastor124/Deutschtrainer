import type { Answer, Question } from '../shared/types.ts';
import { loadBank } from '../server/bank/index.ts';
import type { Instance } from '../server/grade.ts';
import { Room, type Deps } from '../server/room.ts';

export const bank = loadBank();
export const all = [...bank.values()];

export function seeded(seed = 7) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(mode: 'class' | 'practice' = 'class') {
  let t = 1_000_000;
  const results: [string, string, boolean][] = [];
  const deps: Deps = { bank, now: () => t, rand: seeded(), onResult: (p, q, ok) => results.push([p, q, ok]) };
  const room = Room.create(deps, 'TEST', mode);
  return { room, deps, results, advance: (ms: number) => { t += ms; }, now: () => t };
}

/** Respuesta correcta para la pregunta presentada con un barajado concreto. */
export function correct(q: Question, inst: Instance): Answer {
  switch (q.type) {
    case 'mc': return { choice: inst.opt!.indexOf(q.answer) };
    case 'write': case 'build': return { text: q.accept[0] };
    case 'gap': return { gaps: q.gaps.map((g) => g[0]) };
    case 'order': return { order: q.tokens.map((_, i) => inst.tok!.indexOf(i)) };
    case 'error': return { index: q.wrong, fix: q.fix[0] };
    case 'match': return { pairs: q.pairs.map((_, i) => inst.right!.indexOf(i)) };
  }
}

export function wrong(q: Question, inst: Instance): Answer {
  switch (q.type) {
    case 'mc': return { choice: inst.opt!.findIndex((o) => o !== q.answer) };
    case 'write': case 'build': return { text: 'qqq zzz' };
    case 'gap': return { gaps: q.gaps.map(() => 'qqq') };
    case 'order': return { order: q.tokens.map((_, i) => i).reverse().map((i) => inst.tok!.indexOf(i)) };
    case 'error': return { index: (q.wrong + 1) % q.tokens.length, fix: 'qqq' };
    case 'match': return { pairs: q.pairs.map(() => 0) };
  }
}

/** Fuerza la siguiente pregunta (solo tests). */
export function force(room: Room, id: string) {
  if (room.s.phase === 'lobby') room.startBlock('r2');
  room.s.queue.unshift(id);
  const r = room.next();
  if (!r.ok) throw new Error(r.error);
  return room.question as Question;
}

export const find = (pred: (q: Question) => boolean) => {
  const q = all.find(pred);
  if (!q) throw new Error('pregunta no encontrada');
  return q;
};
