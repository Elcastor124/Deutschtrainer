// Juegos de clase por temas: BlackCard (colas de cada ronda) y Wort-Jenga respetan los temas elegidos por el profesor.
import { describe, expect, it } from 'vitest';
import { PLAN } from '../shared/rules.ts';
import type { BlockId, QuizBlock, Topic } from '../shared/types.ts';
import { buildQueue, jengaQuestion, wildTopics } from '../server/select.ts';
import type { Player } from '../server/room.ts';
import { bank, seeded, setup } from './helpers.ts';

const QUIZ: QuizBlock[] = ['warmup', 'r1', 'r2', 'r3', 'r4', 'boss'];
const topicOf = (id: string) => bank.get(id)!.topic;

describe('buildQueue con temas', () => {
  for (const topics of [['dativ'], ['akkusativ', 'possessiv'], ['perfekt', 'nebensatz'], ['vocab']] as Topic[][]) {
    it(`${topics.join('+')}: cada ronda tiene preguntas y casi todas son de esos temas`, () => {
      const used = new Set<string>();
      for (const b of QUIZ) {
        const q = buildQueue(b, bank, used, seeded(9), { topics });
        const full = buildQueue(b, bank, new Set(), seeded(9), {});
        q.forEach((id) => used.add(id));
        expect(q.length, b).toBe(full.length);
        expect(new Set(q).size, b).toBe(q.length);
        const inTopic = q.filter((id) => topics.includes(topicOf(id))).length;
        expect(inTopic / q.length, `${b}: ${inTopic}/${q.length}`).toBeGreaterThanOrEqual(0.6);
      }
    });
  }
  it('sin temas se comporta igual que antes (mismo resultado con la misma semilla)', () => {
    for (const b of QUIZ) expect(buildQueue(b, bank, new Set(), seeded(3), { topics: [] })).toEqual(buildQueue(b, bank, new Set(), seeded(3), {}));
  });
  it('el comodín ofrece temas de la sala cuando hay al menos dos', () => {
    const t = wildTopics('r2', bank, new Set(), seeded(1), { topics: ['dativ', 'akkusativ'] });
    expect(t.sort()).toEqual(['akkusativ', 'dativ']);
  });
});

describe('jengaQuestion con temas', () => {
  it('saca preguntas solo de los temas elegidos y, si se acaban las rápidas, sigue con otras del mismo tema', () => {
    const used = new Set<string>();
    const rand = seeded(5);
    for (let k = 0; k < 40; k++) {
      const id = jengaQuestion(bank, used, rand, { topics: ['satzbau'] });
      expect(id).toBeTruthy();
      used.add(id!);
      expect(topicOf(id!)).toBe('satzbau');
    }
  });
  it('cuando el tema está agotado, vuelve al banco general en lugar de quedarse sin preguntas', () => {
    const used = new Set([...bank.values()].filter((q) => q.topic === 'possessiv').map((q) => q.id));
    expect(jengaQuestion(bank, used, seeded(2), { topics: ['possessiv'] })).toBeTruthy();
  });
});

describe('Room con temas y arranque directo', () => {
  it('BlackCard por temas: «empezar» abre el Calentamiento (sin lectura si no se eligió Leseverstehen) y las preguntas siguen los temas', () => {
    const { room } = setup();
    room.configure({ topics: ['dativ', 'praep'] });
    room.join('Ana', 'prof-a');
    expect(room.next().ok).toBe(true);
    expect(room.s.block).toBe('warmup');
    room.startBlock('r2');
    const ids = room.s.queue;
    expect(ids.filter((id) => ['dativ', 'praep'].includes(topicOf(id))).length).toBeGreaterThanOrEqual(Math.ceil(ids.length * 0.6));
    expect(room.view({ teacher: true }).topics).toEqual(['dativ', 'praep']);
  });
  it('con Leseverstehen entre los temas sí empieza por la lectura', () => {
    const { room } = setup();
    room.configure({ topics: ['lesen', 'vocab'] });
    room.join('Ana', 'prof-a');
    room.next();
    expect(room.s.block).toBe(PLAN[0].id as BlockId);
  });
  it('Wort-Jenga directo: del lobby pasa a la torre con preguntas del tema', () => {
    const { room } = setup();
    room.configure({ topics: ['perfekt'], start: 'jenga' });
    const a = room.join('Ana', 'prof-a') as Player;
    room.join('Bea', 'prof-b');
    expect(room.view({ pid: a.id }).start).toBe('jenga');
    expect(room.next().ok).toBe(true);
    expect(room.s.phase).toBe('task');
    expect(room.s.block).toBe('jenga');
    expect(room.s.task?.kind).toBe('jenga');
    const t = room.s.task as { q: { id: string } | null; speak: string | null };
    if (t.q) expect(topicOf(t.q.id)).toBe('perfekt');
    else expect(t.speak).toBeTruthy();
  });
  it('configure limpia temas desconocidos y duplicados', () => {
    const { room } = setup();
    room.configure({ topics: ['dativ', 'dativ', 'nope' as Topic, '__proto__' as Topic] });
    expect(room.s.topics).toEqual(['dativ']);
  });
});
