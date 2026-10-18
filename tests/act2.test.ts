import { describe, expect, it } from 'vitest';
import type { Player } from '../server/room.ts';
import { Room } from '../server/room.ts';
import { grade } from '../server/grade.ts';
import { freshTower, maxPullLevel, unstable, type JengaTask, type SceneTask, type WriteTask } from '../server/tasks.ts';
import { FEATURES, LEARNED, countWords, features, usedWords } from '../shared/activities.ts';
import { PLAN, PLAN_MIN } from '../shared/rules.ts';
import type { Question, TaskJengaView, TaskSceneView, TaskWriteView } from '../shared/types.ts';
import { all, bank, correct, find, force, setup, wrong } from './helpers.ts';

function classRoom(seen?: Map<string, number>) {
  const env = setup();
  if (seen) env.deps.seen = () => seen;
  const a = env.room.join('Ana', 'prof-ana') as Player;
  const b = env.room.join('Tomás', 'prof-tomas') as Player;
  return { ...env, a, b };
}
const ans = (room: Room, p: Player, good: boolean) => {
  const q = room.question as Question;
  const result = room.answer(p.id, q.id, (good ? correct : wrong)(q, room.s.q!.inst));
  if (room.s.phase === 'review') {
    for (const [pid, rec] of Object.entries(room.s.answers)) {
      if (rec.status === 'review') room.judge(pid, grade(q, room.s.q!.inst, rec.a, true).status === 'correct');
    }
  }
  return result;
};
const special = find((q) => q.diff === 'special');

describe('plan de clase (2 horas)', () => {
  it('suma 120 minutos: el juego y después las actividades', () => {
    expect(PLAN_MIN).toBe(120);
    const ids = PLAN.map((b) => b.id);
    expect(ids.indexOf('final')).toBeLessThan(ids.indexOf('rolle'));
    expect(PLAN.filter((b) => b.act === 2).map((b) => b.id)).toEqual(['rolle', 'szene', 'wort', 'frei', 'jenga', 'ende']);
  });

  it('después del podio, «Siguiente» empieza las actividades', () => {
    const { room } = classRoom();
    room.startBlock('final');
    expect(room.s.phase).toBe('final');
    expect(room.next().ok).toBe(true);
    expect(room.s.block).toBe('rolle');
    expect(room.s.phase).toBe('intro');
    expect(room.next().ok).toBe(true);
    expect(room.s.phase).toBe('task');
  });
});

describe('cofres', () => {
  it('el contenido lo decide el servidor y el alumno no lo ve hasta abrirlo', () => {
    const { room, a } = classRoom();
    room.startBlock('r1');
    const v = JSON.stringify(room.view({ pid: a.id }).me?.chests);
    expect(v).toContain('bronze');
    expect(v).not.toContain(a.chests[0].item);
  });

  it('reto especial → cofre de oro con un objeto potente y 5 puntos', () => {
    const { room, a, b } = classRoom();
    room.startBlock('r4');
    room.s.chestQs = [];
    a.chests = []; b.chests = [];
    force(room, special.id);
    ans(room, a, true); ans(room, b, false);
    expect(a.chests.map((c) => c.tier)).toEqual(['gold']);
    const before = a.score;
    room.openChest(a.id, a.chests[0].id);
    expect(['thief', 'double', 'sabotage']).toContain(a.inv[0]);
    expect(a.score).toBe(before + 5);
  });

  it('cada ronda con objetos tiene una Truhenfrage: acertarla da un cofre de plata', () => {
    const { room, a, b } = classRoom();
    for (const blk of ['r1', 'r2', 'r3', 'r4'] as const) {
      room.startBlock(blk);
      expect(room.s.chestQs.length, blk).toBe(1);
      expect(room.s.queue).toContain(room.s.chestQs[0]);
    }
    room.startBlock('r1');
    a.chests = []; b.chests = [];
    const qid = room.s.chestQs[0];
    room.s.queue = [qid, ...room.s.queue.filter((x) => x !== qid)];
    room.next();
    expect(room.view({ pid: a.id }).q?.chest).toBe(true);
    ans(room, a, true); ans(room, b, false);
    expect(a.chests.map((c) => c.tier)).toEqual(['silver']);
    expect(b.chests).toEqual([]);
  });

  it('solo puede haber una BlackCard: un segundo cofre negro se convierte en plata', () => {
    const { room, a } = classRoom();
    room.startBlock('r2');
    a.chests = [];
    a.inv = ['blackcard'];
    room.grant(a, 'black', 'test');
    expect(a.chests[0].tier).toBe('silver');
  });

  it('si la mano está llena, el objeto del cofre queda pendiente para elegir', () => {
    const { room, a } = classRoom();
    room.startBlock('r1');
    a.inv = ['shield', 'double', 'thief'];
    room.openChest(a.id, a.chests[0].id);
    expect(a.inv.length).toBe(3);
    expect(a.pickups.length).toBe(1);
  });
});

describe('sin repetir entre partidas', () => {
  it('prefiere preguntas que estos alumnos no han visto en otras partidas', () => {
    const r1Pool = all.filter((q) => q.topic === 'vocab' || q.topic === 'alltag');
    const fresh = new Set(r1Pool.slice(0, 40).map((q) => q.id));
    const seen = new Map(all.filter((q) => !fresh.has(q.id)).map((q) => [q.id, 5] as [string, number]));
    const { room } = classRoom(seen);
    room.startBlock('r1');
    const unseen = room.s.queue.filter((id) => !seen.has(id)).length;
    expect(unseen).toBeGreaterThanOrEqual(room.s.queue.length - 2);
  });
});

describe('actividades de escritura', () => {
  it('Mach es lustiger!: cada alumno recibe 8 palabras distintas y el texto de la lectura', () => {
    const { room, a, b } = classRoom();
    room.startBlock('rolle');
    room.next();
    const t = room.s.task as WriteTask;
    expect(t.kind).toBe('rolle');
    expect(t.sets[a.id].words.length).toBe(8);
    expect(t.sets[a.id].words.filter((w) => t.sets[b.id].words.includes(w))).toEqual([]);
    expect(t.texts[a.id].text).toContain('Pablo');
    // Las palabras de la lista no aparecen ya en el texto original (hay que añadirlas).
    expect(usedWords(t.texts[a.id].text, t.sets[a.id].words.map((w) => LEARNED[w]))).toEqual([]);
  });

  it('las estrellas cuentan las palabras usadas y el alumno no ve el texto del otro mientras escribe', () => {
    const { room, a, b } = classRoom();
    room.startBlock('rolle');
    room.next();
    const t = room.s.task as WriteTask;
    const [w1, w2] = t.sets[a.id].words;
    const text = `${t.texts[a.id].text} Plötzlich kommt ${w1} und dann ${w2}!`;
    expect(room.view({ pid: a.id }).task?.kind).toBe('rolle');
    expect(t.stage).toBe('write');
    expect(taskText(room, a.id, text, true).ok).toBe(true);
    const va = room.view({ pid: a.id }).task as TaskWriteView;
    expect(va.entries[a.id].used.length).toBeGreaterThanOrEqual(2);
    const vb = room.view({ pid: b.id }).task as TaskWriteView;
    expect(vb.entries[a.id].text).toBe('');
    expect(vb.sets[a.id]).toBeUndefined();
    room.next(); // → mostrar
    expect((room.view({ pid: b.id }).task as TaskWriteView).entries[a.id].text).toBe(text);
    expect(a.stars).toBe(0);
    expect(room.next().ok).toBe(false); // no se avanza sin decisión del profesor
    expect(ctl(room, 'judgeText', a.id, undefined, true)).toBe(true);
    room.next(); // → fin
    expect(room.s.phase).toBe('roundEnd');
    expect(a.stars).toBeGreaterThanOrEqual(2);
  });

  it('Schreibwerkstatt: temas distintos para cada alumno', () => {
    const { room, a, b } = classRoom();
    room.startBlock('wort');
    room.next();
    const t = room.s.task as WriteTask;
    expect(t.sets[a.id].words.length).toBe(6);
    expect(t.sets[a.id].prompt).not.toBe(t.sets[b.id].prompt);
  });

  it('Freies Schreiben: hay que elegir consigna; detecta Perfekt, Nebensatz y Dativ', () => {
    const { room, a } = classRoom();
    room.startBlock('frei');
    room.next();
    expect(taskTextOk(room, a.id, 'Hallo')).toBe(false);
    expect(pick(room, a.id, 1)).toBe(true);
    const text = 'Gestern bin ich mit dem Bus zur Schule gefahren, weil mein Fahrrad kaputt war. Zuerst habe ich Kaffee getrunken.';
    expect(taskTextOk(room, a.id, text)).toBe(true);
    const e = (room.view({ pid: a.id }).task as TaskWriteView).entries[a.id];
    expect(e.features).toEqual(expect.arrayContaining(['perfekt', 'neben', 'dativ', 'zeit']));
    expect(e.stars).toBe(4);
  });

  it('el profesor puede rechazar un texto libre y no se conceden estrellas', () => {
    const { room, a } = classRoom();
    room.startBlock('frei');
    room.next();
    expect(pick(room, a.id, 0)).toBe(true);
    expect(taskText(room, a.id, 'Gestern habe ich viel gelernt, weil es geregnet hat.', true).ok).toBe(true);
    room.next();
    expect(room.next().ok).toBe(false);
    expect(ctl(room, 'judgeText', a.id, undefined, false)).toBe(true);
    expect(room.next().ok).toBe(true);
    expect(a.stars).toBe(0);
  });

  it('detección: verbos separables y palabras con umlaut', () => {
    expect(usedWords('Mein Arm tut sehr weh.', [LEARNED.wehtun])).toEqual(['wehtun']);
    expect(usedWords('Ich steige am Bahnhof um.', [LEARNED.umsteigen])).toEqual(['umsteigen']);
    expect(usedWords('Die Prüfung war schwer.', [LEARNED['die Prüfung']])).toEqual(['die Prüfung']);
    expect(usedWords('Er hat sein Geld abgehoben.', [LEARNED['Geld abheben']])).toEqual(['Geld abheben']);
    expect(countWords('Ich bin müde, aber glücklich!')).toBe(5);
    expect(features('Ich habe Pizza gegessen.')).toEqual(['perfekt']);
    expect(FEATURES.length).toBe(4);
  });

  it('solo un jugador de la sala puede elegir consigna', () => {
    const { room } = classRoom();
    room.startBlock('frei');
    room.next();
    const before = JSON.stringify(room.s.task);
    expect(pick(room, 'desconocido', 0)).toBe(false);
    expect(JSON.stringify(room.s.task)).toBe(before);
  });

  it('prepara al alumno que entra tarde sin alterar el estado al consultar vistas', () => {
    const { room } = classRoom();
    room.startBlock('rolle');
    room.next();
    const late = room.join('Lena', 'prof-lena') as Player;
    const t = room.s.task as WriteTask;
    expect(t.sets[late.id].words).toHaveLength(8);
    const before = JSON.stringify(room.s.task);
    expect((room.view({ pid: late.id }).task as TaskWriteView).sets[late.id]).toBeDefined();
    expect(JSON.stringify(room.s.task)).toBe(before);
  });
});

describe('escenas de rol', () => {
  it('cada alumno ve solo su tarjeta secreta; el profesor marca objetivos y dan estrellas', () => {
    const { room, a, b } = classRoom();
    room.startBlock('szene');
    room.next();
    const t = room.s.task as SceneTask;
    expect(new Set(Object.values(t.roles)).size).toBe(2);
    const va = room.view({ pid: a.id }).task as TaskSceneView;
    expect(va.roles[a.id].card?.goals.length).toBe(3);
    expect(va.roles[b.id].card).toBeUndefined();
    expect((room.view({ teacher: true }).task as TaskSceneView).roles[b.id].card).toBeTruthy();
    room.next(); // prep → play
    room.next(); // play → score
    expect((room.view({ pid: a.id }).task as TaskSceneView).roles[b.id].card).toBeTruthy(); // se revelan al final
    expect(ctl(room, 'goal', a.id, 0)).toBe(true);
    expect(ctl(room, 'goal', a.id, 2)).toBe(true);
    room.next();
    expect(a.stars).toBe(2);
    expect(b.stars).toBe(0);
  });
});

describe('Wort-Jenga', () => {
  const startJenga = () => {
    const env = classRoom();
    env.room.startBlock('jenga');
    env.room.next();
    return { ...env, t: () => env.room.s.task as JengaTask };
  };
  /** Responde la pregunta del turno (si es oral, decide el profesor). */
  const answerTurn = (room: Room, t: JengaTask, good: boolean) => {
    const pid = t.turn!;
    if (t.speak) return ctl(room, 'judge', undefined, undefined, good);
    const q = bank.get(t.q!.id)!;
    return room.answer(pid, q.id, (good ? correct : wrong)(q, t.q!.inst)).ok;
  };

  it('acertar = quitar 1 pieza; fallar = quitar 2; solo juega quien tiene el turno', () => {
    const { room, a, b, t } = startJenga();
    const first = t().turn!;
    const other = first === a.id ? b.id : a.id;
    expect(t().stage).toBe('answer');
    if (!t().speak) expect(room.answer(other, t().q!.id, {}).ok).toBe(false);
    expect(answerTurn(room, t(), true)).toBe(true);
    expect(t().stage).toBe('pull');
    expect(t().pulls).toBe(1);
    expect(room.player(first)!.stars).toBe(1);
    room.d.rand = () => 0.99; // sin tambaleo
    expect(pullAny(room, other)).toBe(false);
    expect(pullAny(room, first)).toBe(true);
    expect(t().turn).toBe(other);
    expect(answerTurn(room, t(), false)).toBe(true);
    expect(t().pulls).toBe(2);
    expect(pullAny(room, other)).toBe(true);
    expect(t().pulls).toBe(1);
    expect(pullAny(room, other)).toBe(true);
    expect(t().turn).toBe(first);
  });

  it('las piezas sacadas se colocan arriba y no se puede sacar de los pisos superiores', () => {
    const { room, t } = startJenga();
    room.d.rand = () => 0.99;
    answerTurn(room, t(), true);
    const top = t().levels.length - 1;
    expect(maxPullLevel(t().levels)).toBe(top - 1);
    expect(jengaPull(room, t().turn!, top, 0)).toBe(false);
    expect(jengaPull(room, t().turn!, 0, 1)).toBe(true);
    expect(t().levels.length).toBe(16);
    expect(t().levels[15]).toEqual([1, 0, 0]);
  });

  it('si queda una sola pieza lateral en un piso, la torre cae: pierde quien la tira y los demás ganan 3 ★', () => {
    const { room, a, b, t } = startJenga();
    room.d.rand = () => 0.99;
    const pid = t().turn!;
    const other = pid === a.id ? b : a;
    answerTurn(room, t(), false); // 2 piezas
    expect(jengaPull(room, pid, 2, 1)).toBe(true); // quita la del centro
    expect(jengaPull(room, pid, 2, 0)).toBe(true); // queda solo un lateral → cae
    expect(t().stage).toBe('fallen');
    expect(t().loser).toBe(pid);
    expect(other.stars).toBe(3);
    expect(ctl(room, 'reset')).toBe(true);
    expect(t().levels.length).toBe(15);
    expect(t().turn).toBe(pid);
    expect(t().games).toBe(2);
  });

  it('sin respuesta a tiempo = 2 piezas; las preguntas orales las decide el profesor', () => {
    const { room, t, advance } = startJenga();
    if (t().speak) {
      expect(ctl(room, 'judge', undefined, undefined, true)).toBe(true);
      expect(t().pulls).toBe(1);
    } else {
      advance(60_000);
      expect(room.tick()).toBe(true);
      expect(t().pulls).toBe(2);
      expect(t().last?.ok).toBe(false);
    }
    const v = room.view({ pid: t().turn! }).task as TaskJengaView;
    expect(v.kind).toBe('jenga');
    expect(v.levels.length).toBe(15);
  });

  it('reglas de estabilidad de la torre', () => {
    const tower = freshTower();
    expect(unstable(tower)).toBe(false);
    tower[3] = [0, 1, 0];
    expect(unstable(tower)).toBe(false);
    tower[4] = [1, 0, 1];
    expect(unstable(tower)).toBe(false);
    tower[5] = [1, 0, 0];
    expect(unstable(tower)).toBe(true);
  });
});

// ── utilidades ──
import { jengaPull as jp, taskCtl, taskPick, taskText } from '../server/tasks.ts';
function taskTextOk(room: Room, pid: string, text: string) { return taskText(room, pid, text, false).ok; }
function pick(room: Room, pid: string, n: number) { return taskPick(room, pid, n).ok; }
function ctl(room: Room, op: string, pid?: string, n?: number, ok?: boolean) { return taskCtl(room, op, pid, n, ok).ok; }
function jengaPull(room: Room, pid: string, level: number, slot: number) { return jp(room, pid, level, slot).ok; }
function pullAny(room: Room, pid: string) {
  const t = room.s.task as JengaTask;
  for (let l = 0; l <= maxPullLevel(t.levels); l++) {
    if (t.levels[l][0]) return jengaPull(room, pid, l, 0);
  }
  return false;
}
