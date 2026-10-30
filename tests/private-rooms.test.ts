// Salas privadas del modo libre (BlackCard y Wort-Jenga): sala de clase SIN profesor que avanza sola.
import { describe, expect, it } from 'vitest';
import { PRIVATE_BLOCKS, PRIVATE_WAIT, Room, type Deps } from '../server/room.ts';
import { freshTower, unstable } from '../server/tasks.ts';
import { bank, correct, find, seeded } from './helpers.ts';

function privateRoom(game: 'blackcard' | 'jenga' = 'blackcard', names = ['Ana', 'Ben']) {
  let t = 1_000_000;
  const activity: { profile: string; game: string; total: number; correct: number }[] = [];
  const deps: Deps = { bank, now: () => t, rand: seeded(3), onActivity: (profile, a) => activity.push({ profile, ...a }) };
  const room = Room.create(deps, 'PRIV');
  room.s.private = { host: '', game, ready: [] };
  if (game === 'jenga') room.s.start = 'jenga';
  const ps = names.map((n, i) => { const p = room.join(n, `profile-${n}-000`); if ('ok' in p) throw new Error(); return p; });
  room.s.private.host = ps[0].id;
  const advance = (ms: number) => { t += ms; room.tick(); room.tick(); };
  return { room, ps, activity, advance };
}

/** Responde bien todos los jugadores a la pregunta abierta. */
function answerAll(room: Room, ok = true) {
  const q = room.question!;
  for (const p of room.s.players) room.answer(p.id, q.id, ok ? correct(q, room.s.q!.inst) : {});
}

describe('vestíbulo sin profesor', () => {
  it('empieza solo cuando TODOS los conectados (mínimo 2) pulsan «listo»', () => {
    const { room, ps } = privateRoom('blackcard', ['Ana', 'Ben', 'Cris']);
    expect(room.privateVote(ps[0].id).ok).toBe(true);
    expect(room.privateVote(ps[1].id).ok).toBe(true);
    expect(room.s.phase).toBe('lobby');                       // falta Cris
    room.setConnected(ps[2].id, false);
    expect(room.privateVote(ps[0].id).ok).toBe(true);         // Cris se fue: los presentes están listos
    expect(room.s.phase).toBe('intro');
    expect(room.s.block).toBe(PRIVATE_BLOCKS[0]);
  });
  it('una persona sola no puede empezar', () => {
    const { room, ps } = privateRoom('blackcard', ['Ana']);
    room.privateVote(ps[0].id);
    expect(room.s.phase).toBe('lobby');
  });
  it('el anfitrión puede expulsar antes de empezar; nadie más, y nunca durante la partida', () => {
    const { room, ps } = privateRoom('blackcard', ['Ana', 'Ben', 'Cris']);
    expect(room.privateKick(ps[1].id, ps[2].id).ok).toBe(false); // no es anfitrión
    expect(room.privateKick(ps[0].id, ps[0].id).ok).toBe(false);
    expect(room.privateKick(ps[0].id, ps[2].id).ok).toBe(true);
    expect(room.s.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
    room.privateVote(ps[0].id); room.privateVote(ps[1].id);
    expect(room.privateKick(ps[0].id, ps[1].id).ok).toBe(false);
  });
});

describe('BlackCard privada: el servidor hace lo que hacía el profesor', () => {
  it('intro → pregunta → resultado → siguiente, solo con el tiempo', () => {
    const { room, ps, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id));
    expect(room.s.phase).toBe('intro');
    advance(PRIVATE_WAIT.intro - 500); expect(room.s.phase).toBe('intro');
    advance(1000); expect(room.s.phase).toBe('question');
    answerAll(room);
    expect(room.s.phase).toBe('reveal');
    const q1 = room.s.q!.id;
    advance(PRIVATE_WAIT.reveal + 100);
    expect(room.s.phase).toBe('question');
    expect(room.s.q!.id).not.toBe(q1);
  });
  it('si todos votan «listo para seguir», avanza sin esperar', () => {
    const { room, ps, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id)); advance(PRIVATE_WAIT.intro + 100);
    answerAll(room); advance(10);
    room.privateVote(ps[0].id); expect(room.s.phase).toBe('reveal');
    room.privateVote(ps[1].id); expect(room.s.phase).toBe('question');
  });
  it('nunca se queda en «revisión del profesor»: una respuesta abierta se corrige sola', () => {
    const { room, ps, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id)); advance(PRIVATE_WAIT.intro + 100);
    const w = find((q) => q.type === 'write' && q.topic !== 'lesen');
    answerAll(room);                                   // cierra la pregunta actual con el flujo normal
    room.s.queue.unshift(w.id);
    ps.forEach((p) => room.privateVote(p.id));          // todos listos: pasa a la pregunta abierta
    expect(room.question!.id).toBe(w.id);
    for (const p of room.s.players) room.answer(p.id, w.id, { text: 'algo casi bien escrito' });
    expect(room.s.phase).toBe('reveal');
  });
  it('si nadie responde, el tiempo cierra la pregunta y sigue (nadie bloquea la partida)', () => {
    const { room, ps, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id)); advance(PRIVATE_WAIT.intro + 100);
    const total = room.s.timer!.total * 1000;
    advance(total + 100);
    expect(room.s.phase).toBe('reveal');
    advance(PRIVATE_WAIT.reveal + 100);
    expect(room.s.phase).toBe('question');
  });
  it('partida completa hasta el final, con un único informe de actividad por jugador', () => {
    const { room, ps, activity, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id));
    for (let k = 0; k < 400 && room.s.phase !== 'final'; k++) {
      if (room.s.phase === 'question') answerAll(room, k % 4 !== 0);
      advance(11_000);
    }
    expect(room.s.phase).toBe('final');
    expect(activity).toHaveLength(2);
    expect(activity.every((a) => a.game === 'blackcard' && a.total >= 8 && a.correct <= a.total)).toBe(true);
    advance(60_000); expect(activity).toHaveLength(2);
    expect(room.next().ok).toBe(false);
  });
  it('la vista de un jugador no lleva soluciones ni datos de profesor, pero sí el estado privado', () => {
    const { room, ps, advance } = privateRoom();
    ps.forEach((p) => room.privateVote(p.id)); advance(PRIVATE_WAIT.intro + 100);
    const v = room.view({ pid: ps[1].id });
    expect(v.teacher).toBeUndefined();
    expect(v.private).toMatchObject({ host: ps[0].id, game: 'blackcard' });
    expect(JSON.stringify(v)).not.toContain(room.s.teacherToken);
  });
});

describe('Wort-Jenga privado', () => {
  it('sin preguntas orales; turnos entre jugadores; quien no saca pieza a tiempo no bloquea (pieza segura)', () => {
    const { room, ps, advance } = privateRoom('jenga');
    ps.forEach((p) => room.privateVote(p.id));
    expect(room.s.phase).toBe('task');
    const t = () => room.s.task as Extract<NonNullable<Room['s']['task']>, { kind: 'jenga' }>;
    const turns = new Set<string>();
    for (let k = 0; k < 12; k++) {
      expect(t().speak).toBeNull();
      turns.add(t().turn!);
      const q = bank.get(t().q!.id)!;
      room.answer(t().turn!, q.id, correct(q, t().q!.inst));
      expect(t().stage).toBe('pull');
      advance(PRIVATE_WAIT.pull + 100);                   // nadie saca: el servidor saca una pieza segura
      if (t().stage === 'fallen') break;
      expect(unstable(t().levels)).toBe(false);
    }
    expect(turns.size).toBe(2);
    expect(t().levels.length).toBeGreaterThanOrEqual(freshTower().length);
  });
  it('al caer la torre, la partida termina sola y se informa por jugador', () => {
    const { room, ps, activity, advance } = privateRoom('jenga');
    ps.forEach((p) => room.privateVote(p.id));
    const t = room.s.task as any;
    const q = bank.get(t.q.id)!;
    const who = room.player(t.turn)!.profile;
    room.answer(t.turn, q.id, correct(q, t.q.inst));
    t.levels[0] = [1, 0, 0]; // fuerza la caída en la siguiente pieza
    t.stage = 'fallen'; room.touch(); // como hace collapse()
    advance(PRIVATE_WAIT.fallen + 100);
    expect(room.s.phase).toBe('final');
    expect(activity.map((a) => a.game)).toEqual(['jenga', 'jenga']);
    expect(activity.find((a) => a.profile === who)).toMatchObject({ total: 1, correct: 1 });
    expect(activity.find((a) => a.profile !== who)).toMatchObject({ total: 0, correct: 0 });
  });
});
