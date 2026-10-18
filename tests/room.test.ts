import { describe, expect, it } from 'vitest';
import { Room } from '../server/room.ts';
import type { Player } from '../server/room.ts';
import { BC_BONUS, POINTS } from '../shared/rules.ts';
import type { Question } from '../shared/types.ts';
import { all, bank, correct, find, force, setup, wrong } from './helpers.ts';

function classRoom() {
  const env = setup();
  const a = env.room.join('Ana', 'prof-ana') as Player;
  const b = env.room.join('Tomás', 'prof-tomas') as Player;
  return { ...env, a, b };
}
const ans = (room: Room, p: Player, good: boolean) => {
  const q = room.question as Question;
  return room.answer(p.id, q.id, (good ? correct : wrong)(q, room.s.q!.inst));
};
/** Entra en un bloque con objetos y deja inventarios vacíos (para controlar qué tiene cada uno). */
function intoItemsBlock(env: ReturnType<typeof classRoom>) {
  env.room.startBlock('r2');
  env.a.inv = [];
  env.b.inv = [];
}
const mcEasy = find((q) => q.type === 'mc' && q.diff === 'easy' && q.options.length >= 3);
const mcMedium = find((q) => q.type === 'mc' && q.diff === 'medium' && q.options.length >= 3);
const mcMedium2 = find((q) => q.type === 'mc' && q.diff === 'medium' && q.options.length >= 3 && q.id !== mcMedium.id);
const hardBc = find((q) => q.diff === 'hard' && !!q.why && !q.unlock && q.type === 'write');
const unlockQ = find((q) => !!q.unlock);
const binary = find((q) => q.type === 'mc' && q.options.length === 2);

describe('flujo completo de clase', () => {
  it('profesor crea sala → 2 alumnos → pregunta → respuestas → puntos → ranking', () => {
    const { room, a, b } = classRoom();
    expect(room.s.phase).toBe('lobby');
    expect(room.next().ok).toBe(true);
    expect(room.s.phase).toBe('intro');
    expect(room.s.block).toBe('lesen');
    expect(room.next().ok).toBe(true);
    expect(room.s.phase).toBe('question');
    const q = room.question!;
    expect(ans(room, a, true).ok).toBe(true);
    expect(room.s.phase).toBe('question');
    expect(ans(room, b, false).ok).toBe(true);
    expect(room.s.phase).toBe('reveal');
    expect(a.score).toBe(POINTS[q.diff]);
    expect(b.score).toBe(0);
    const v = room.view({ pid: b.id });
    expect(v.players[0].id).toBe(a.id);
    expect(v.reveal?.results[a.id].status).toBe('correct');
    expect(v.reveal?.results[b.id].status).toBe('wrong');
  });

  it('la vista del alumno no contiene la solución; la del profesor sí', () => {
    const { room, a } = classRoom();
    room.next(); room.next();
    const pv = JSON.stringify(room.view({ pid: a.id }));
    const q = room.question!;
    expect(room.view({ teacher: true }).teacher?.solution).toBeTruthy();
    expect(pv).not.toContain('"answer"');
    expect(pv).not.toContain('"accept"');
    if (q.type === 'write') expect(pv).not.toContain(q.accept[0]);
  });

  it('no se puede responder dos veces ni a una pregunta cerrada', () => {
    const { room, a, b } = classRoom();
    room.next(); room.next();
    expect(ans(room, a, true).ok).toBe(true);
    expect(ans(room, a, true).ok).toBe(false);
    room.lock();
    expect(ans(room, b, true).ok).toBe(false);
  });

  it('el temporizador cierra la pregunta y se puede pausar', () => {
    const { room, a, advance } = classRoom();
    room.next(); room.next();
    const total = room.s.timer!.total;
    expect(room.pause().ok).toBe(true);
    advance(total * 1000 + 5000);
    expect(room.tick()).toBe(false);
    expect(room.resume().ok).toBe(true);
    ans(room, a, true);
    advance(total * 1000 + 10);
    expect(room.tick()).toBe(true);
    expect(room.s.phase).toBe('reveal');
  });

  it('no repite preguntas en una sesión completa', () => {
    const { room, a, b } = classRoom();
    room.next();
    const seen: string[] = [];
    for (let guard = 0; guard < 200 && room.s.phase !== 'final'; guard++) {
      if (room.s.phase === 'question') {
        seen.push(room.question!.id);
        ans(room, a, true); ans(room, b, false);
      }
      if (room.s.phase === 'wild') room.pickWild(room.s.wild!.by, room.s.wild!.options[0]);
      if (room.s.phase === 'review') room.judgeAll(true);
      if ((room.s.phase as string) !== 'final') room.next();
    }
    expect(room.s.phase).toBe('final');
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(40);
  });

  it('cada ronda de juego incluye una Prüfungsfrage y el Final Boss solo trae preguntas con BlackCard', () => {
    const { room } = classRoom();
    for (const blk of ['r2', 'r3', 'r4'] as const) {
      room.startBlock(blk);
      expect(room.s.queue.some((id) => bank.get(id)!.unlock), blk).toBe(true);
    }
    room.startBlock('boss');
    expect(room.s.queue.length).toBe(5);
    for (const id of room.s.queue) {
      const q = bank.get(id)!;
      expect(['hard', 'special']).toContain(q.diff);
      expect(q.why).toBeTruthy();
    }
  });

  it('la lectura reaparece: el calentamiento y la ronda 1 incluyen vocabulario del texto', () => {
    const { room } = classRoom();
    room.startBlock('warmup');
    expect(room.s.queue.filter((id) => bank.get(id)!.tags?.includes('reading')).length).toBeGreaterThanOrEqual(4);
    room.startBlock('r1');
    expect(room.s.queue.filter((id) => bank.get(id)!.tags?.includes('reading')).length).toBeGreaterThanOrEqual(3);
  });

  it('reconexión: el token devuelve el mismo jugador con su puntuación', () => {
    const { room, a } = classRoom();
    a.score = 37;
    room.setConnected(a.id, false);
    const back = room.byToken(a.token)!;
    expect(back.id).toBe(a.id);
    expect(back.score).toBe(37);
    room.setConnected(a.id, true);
    expect(room.view({ teacher: true }).players.find((p) => p.id === a.id)?.connected).toBe(true);
  });

  it('una desconexión no bloquea la pregunta: se cierra cuando responden los conectados', () => {
    const { room, a, b } = classRoom();
    room.next(); room.next();
    ans(room, a, true);
    room.setConnected(b.id, false);
    expect(room.s.phase).toBe('reveal');
  });
});

describe('objetos', () => {
  it('cada alumno recibe 1 objeto al empezar la Ronda 1 (igualdad de oportunidades)', () => {
    const { room, a, b } = classRoom();
    room.startBlock('r1');
    expect(a.inv.length).toBe(1);
    expect(b.inv.length).toBe(1);
  });

  it('BLACKCARD: solo en preguntas difíciles; +10 si acierta, −10 si falla; se consume', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'blackcard');
    room.give(b.id, 'blackcard');
    force(room, mcEasy.id);
    const r = room.useItem(a.id, 'blackcard');
    expect(r.ok).toBe(false);
    room.lock();
    force(room, hardBc.id);
    a.score = 20; b.score = 4;
    expect(room.useItem(a.id, 'blackcard').ok).toBe(true);
    expect(room.useItem(b.id, 'blackcard').ok).toBe(true);
    expect(a.inv).not.toContain('blackcard');
    ans(room, a, true); ans(room, b, false);
    expect(a.score).toBe(20 + POINTS.hard + BC_BONUS);
    expect(b.score).toBe(0); // 4 − 10 → nunca por debajo de 0
    expect(a.bcWon).toBe(1);
    expect(b.bcLost).toBe(1);
  });

  it('BLACKCARD no se combina con Double XP ni Second Chance (1 objeto por pregunta)', () => {
    const env = classRoom();
    const { room, a } = env;
    intoItemsBlock(env);
    room.give(a.id, 'blackcard'); room.give(a.id, 'double'); room.give(a.id, 'second');
    force(room, hardBc.id);
    expect(room.useItem(a.id, 'blackcard').ok).toBe(true);
    expect(room.useItem(a.id, 'double').ok).toBe(false);
    expect(room.useItem(a.id, 'second').ok).toBe(false);
  });

  it('THIEF: roba hasta 5 solo si el ladrón acierta y nunca más de lo que tiene el rival', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'thief'); room.give(a.id, 'thief');
    force(room, mcMedium.id);
    b.score = 3;
    expect(room.useItem(a.id, 'thief', b.id).ok).toBe(true);
    expect(room.view({ pid: b.id }).me?.incoming[0]).toEqual({ kind: 'thief', by: a.id });
    ans(room, a, true); ans(room, b, false);
    expect(b.score).toBe(0);
    expect(a.score).toBe(POINTS.medium + 3);
    // Ladrón que falla: no roba y el objeto se pierde.
    force(room, mcEasy.id);
    b.score = 10;
    room.useItem(a.id, 'thief', b.id);
    ans(room, a, false); ans(room, b, false);
    expect(b.score).toBe(10);
    expect(a.inv).not.toContain('thief');
  });

  it('SHIELD bloquea un robo (también activado como reacción) y se consume', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'thief'); room.give(b.id, 'shield');
    force(room, mcMedium.id);
    b.score = 10;
    room.useItem(a.id, 'thief', b.id);
    ans(room, b, true);
    expect(room.useItem(b.id, 'shield').ok).toBe(true); // reacción tras responder: permitido
    ans(room, a, true);
    expect(b.score).toBe(10 + POINTS.medium);
    expect(a.score).toBe(POINTS.medium);
    expect(b.shield).toBe(false);
  });

  it('SABOTAGE: el siguiente acierto del rival vale la mitad; un SHIELD lo bloquea; caduca al final de ronda', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'sabotage');
    force(room, mcMedium.id);
    room.useItem(a.id, 'sabotage', b.id);
    ans(room, a, false); ans(room, b, false);
    expect(b.sabot).toBe(a.id); // pendiente hasta su próximo acierto
    force(room, mcMedium2.id);
    const q = room.question!;
    ans(room, a, false); ans(room, b, true);
    expect(b.score).toBe(Math.ceil(POINTS[q.diff] / 2));
    expect(b.sabot).toBe(null);
    // Con escudo
    room.give(a.id, 'sabotage'); room.give(b.id, 'shield');
    force(room, mcEasy.id);
    room.useItem(b.id, 'shield');
    room.useItem(a.id, 'sabotage', b.id);
    ans(room, a, false); ans(room, b, false);
    expect(b.sabot).toBe(null);
    expect(b.shield).toBe(false);
    // Caducidad
    room.give(a.id, 'sabotage');
    force(room, hardBc.id);
    room.useItem(a.id, 'sabotage', b.id);
    room.lock();
    expect(b.sabot).toBe(a.id);
    room.s.queue = [];
    room.next();
    expect(room.s.phase).toBe('roundEnd');
    expect(b.sabot).toBe(null);
  });

  it('DOUBLE XP duplica solo los puntos de la pregunta', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'double');
    force(room, mcMedium.id);
    room.useItem(a.id, 'double');
    ans(room, a, true); ans(room, b, true);
    expect(a.score).toBe(POINTS.medium * 2);
    expect(b.score).toBe(POINTS.medium);
  });

  it('SECOND CHANCE: segundo intento con la mitad de puntos; no en Richtig/Falsch', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'second'); room.give(a.id, 'second');
    force(room, binary.id);
    expect(room.useItem(a.id, 'second').ok).toBe(false);
    room.lock();
    force(room, mcMedium.id);
    expect(room.useItem(a.id, 'second').ok).toBe(true);
    const r1 = ans(room, a, false);
    expect(r1).toEqual({ ok: true, retry: true });
    expect(room.view({ pid: a.id }).me?.state).toBe('retry');
    ans(room, b, false);
    expect(room.s.phase).toBe('question'); // espera al segundo intento
    expect(ans(room, a, true).ok).toBe(true);
    expect(a.score).toBe(Math.ceil(POINTS.medium / 2));
  });

  it('evita dobles usos: el objeto se consume, 1 por pregunta y nunca después de responder', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'double'); room.give(a.id, 'thief');
    force(room, mcMedium.id);
    expect(room.useItem(a.id, 'double').ok).toBe(true);
    expect(room.useItem(a.id, 'double').ok).toBe(false);
    expect(room.useItem(a.id, 'thief', b.id).ok).toBe(false);
    room.give(b.id, 'double');
    ans(room, b, true);
    expect(room.useItem(b.id, 'double').ok).toBe(false);
    room.lock();
    expect(room.useItem(a.id, 'thief', b.id).ok).toBe(false); // tras revelar
  });

  it('el profesor puede desactivar objetos (todos o uno)', () => {
    const env = classRoom();
    const { room, a } = env;
    intoItemsBlock(env);
    room.give(a.id, 'double'); room.give(a.id, 'shield');
    force(room, mcMedium.id);
    room.setItems(false, 'double');
    expect(room.useItem(a.id, 'double').ok).toBe(false);
    room.setItems(false);
    expect(room.useItem(a.id, 'shield').ok).toBe(false);
    room.setItems(true);
    expect(room.useItem(a.id, 'shield').ok).toBe(true);
  });

  it('la BlackCard se desbloquea acertando una Prüfungsfrage (no por azar)', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    force(room, unlockQ.id);
    ans(room, a, true); ans(room, b, false);
    expect(a.inv).toContain('blackcard');
    expect(b.inv).not.toContain('blackcard');
  });

  it('inventario máximo 3: el cuarto objeto queda pendiente y el alumno decide', () => {
    const env = classRoom();
    const { room, a } = env;
    intoItemsBlock(env);
    room.give(a.id, 'double'); room.give(a.id, 'thief'); room.give(a.id, 'shield'); room.give(a.id, 'blackcard');
    expect(a.inv.length).toBe(3);
    expect(a.pickups).toEqual(['blackcard']);
    expect(room.resolvePickup(a.id, 1).ok).toBe(true);
    expect(a.inv).toEqual(['double', 'blackcard', 'shield']);
  });

  it('racha de 3 aciertos = objeto nuevo', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    const ids = all.filter((q) => q.type === 'mc' && q.diff === 'easy' && !q.unlock).slice(0, 3).map((q) => q.id);
    for (const id of ids) { force(room, id); ans(room, a, true); ans(room, b, false); }
    expect(a.inv.length).toBe(1);
    expect(b.inv.length).toBe(0);
  });

  it('WILDCARD: el alumno elige entre dos categorías para la siguiente pregunta', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    room.give(a.id, 'wildcard');
    room.next();
    expect(room.useItem(a.id, 'wildcard').ok).toBe(true);
    ans(room, a, true); ans(room, b, true);
    room.next();
    expect(room.s.phase).toBe('wild');
    const w = room.s.wild!;
    expect(w.options.length).toBe(2);
    expect(room.pickWild(b.id, w.options[0]).ok).toBe(false);
    expect(room.pickWild(a.id, w.options[1]).ok).toBe(true);
    expect(room.question!.topic).toBe(w.options[1]);
  });

  it('anular una pregunta devuelve los objetos usados', () => {
    const env = classRoom();
    const { room, a } = env;
    intoItemsBlock(env);
    room.give(a.id, 'double');
    force(room, mcMedium.id);
    room.useItem(a.id, 'double');
    expect(a.inv).toEqual([]);
    room.skip();
    expect(a.inv).toEqual(['double']);
  });

  it('fin de ronda: todos reciben un objeto y caducan los escudos', () => {
    const env = classRoom();
    const { room, a, b } = env;
    intoItemsBlock(env);
    a.shield = true;
    room.s.queue = [];
    room.next();
    expect(room.s.phase).toBe('roundEnd');
    expect(a.inv.length).toBe(1);
    expect(b.inv.length).toBe(1);
    expect(a.shield).toBe(false);
  });
});

describe('revisión del profesor', () => {
  it('respuestas abiertas dudosas pasan a revisión y el profesor decide', () => {
    const { room, a, b } = classRoom();
    const q = find((x) => x.type === 'write' && !x.strict && x.accept[0].length > 20);
    force(room, q.id);
    const typo = q.type === 'write' ? q.accept[0].replace(/e/, 'a') : '';
    room.answer(a.id, q.id, { text: typo });
    ans(room, b, true);
    expect(room.s.phase).toBe('review');
    expect(room.view({ teacher: true }).teacher?.review.length).toBe(1);
    room.judge(a.id, true);
    expect(room.s.phase).toBe('reveal');
    expect(a.score).toBe(POINTS[q.diff]);
  });

  it('el profesor puede asignar puntos manualmente (sin bajar de 0)', () => {
    const { room, a } = classRoom();
    room.points(a.id, 5);
    room.points(a.id, -20);
    expect(a.score).toBe(0);
  });
});

describe('modo práctica', () => {
  it('prioriza preguntas falladas y repite deliberadamente lo fallado en la sesión', () => {
    const env = setup('practice');
    const p = env.room.join('Ana', 'prof-ana') as Player;
    const failed = all.filter((q) => q.topic === 'dativ').slice(0, 5);
    const stats = Object.fromEntries(failed.map((q) => [q.id, { n: 1, wrong: 1, last: 0 as const, at: 1 }]));
    env.room.startPractice(p, ['dativ'], true, stats);
    expect(env.room.s.queue.length + 1).toBe(5);
    const firstId = env.room.question!.id;
    expect(failed.map((q) => q.id)).toContain(firstId);
    ans(env.room, p, false);
    expect(env.room.s.phase).toBe('reveal');
    expect(env.room.s.queue).toContain(firstId);
    expect(env.results.at(-1)).toEqual(['prof-ana', firstId, false]);
  });
});
