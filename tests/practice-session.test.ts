// Apertura/reanudación de una práctica: recargar no la pierde y una sala desaparecida (reinicio del servidor) no deja al alumno colgado.
import { describe, expect, it } from 'vitest';
import { Room, type Deps } from '../server/room.ts';
import { openPractice, type PracticeEnv } from '../server/practice-session.ts';
import type { Profile } from '../server/store.ts';
import { bank, seeded } from './helpers.ts';

function env() {
  let t = 1_000_000;
  const profiles: Record<string, Profile> = {};
  const deps: Deps = { bank, now: () => t, rand: seeded(4) };
  const rooms = new Map<string, Room>();
  let n = 0;
  const e: PracticeEnv = {
    rooms, deps,
    newRoomCode: () => `P${String(++n).padStart(5, '0')}`,
    profileByCode: (c) => Object.values(profiles).find((p) => p.code === c),
    ensureProfile: (id, name) => (profiles[id ?? 'anon'] ??= { id: id ?? 'anon', code: `C${Object.keys(profiles).length}`, name, stats: {}, createdAt: 0 }),
  };
  return { e, rooms, profiles, advance: (ms: number) => { t += ms; } };
}

describe('openPractice', () => {
  it('crea una sesión nueva con el tamaño y los temas pedidos', () => {
    const { e } = env();
    const r = openPractice(e, { name: 'Ana', profile: 'profile-ana-1', topics: ['dativ'], size: 10 });
    if (!r.ok) throw new Error(r.error);
    expect(r.resumed).toBe(false);
    expect(r.notice).toBeUndefined();
    const ids = [r.room.s.q!.id, ...r.room.s.queue];
    expect(ids.length).toBe(10);
    expect(ids.every((id) => bank.get(id)!.topic === 'dativ')).toBe(true);
    expect(r.profile.id).toBe('profile-ana-1');
  });

  it('un tamaño no permitido se convierte en 15', () => {
    const { e } = env();
    const r = openPractice(e, { name: 'Ana', profile: 'profile-ana-1', size: 9999 });
    if (!r.ok) throw new Error(r.error);
    expect(r.room.s.queue.length + 1).toBe(15);
  });

  it('reanuda la misma sala con su token (recarga de la página)', () => {
    const { e } = env();
    const a = openPractice(e, { name: 'Ana', profile: 'profile-ana-1' });
    if (!a.ok) throw new Error(a.error);
    const qid = a.room.s.q!.id;
    const b = openPractice(e, { room: a.room.s.code.toLowerCase(), token: a.room.s.players[0].token, profile: 'profile-ana-1' });
    if (!b.ok) throw new Error(b.error);
    expect(b.resumed).toBe(true);
    expect(b.room).toBe(a.room);
    expect(b.room.s.q!.id).toBe(qid);
  });

  it('sala desaparecida (servidor reiniciado): sesión nueva automática, con aviso y SIN perder el perfil ni los temas', () => {
    const { e, profiles } = env();
    profiles['profile-ana-1'] = { id: 'profile-ana-1', code: 'ANA123', name: 'Ana', stats: {}, createdAt: 0 };
    const r = openPractice(e, { room: 'PGONE1', token: 'dead', profile: 'profile-ana-1', name: 'Ana', topics: ['akkusativ'], focus: false, size: 10 });
    if (!r.ok) throw new Error(r.error);
    expect(r.resumed).toBe(false);
    expect(r.notice).toMatch(/nueva/i);
    expect(r.profile.id).toBe('profile-ana-1');
    expect(r.room.s.players[0].name).toBe('Ana');
    expect([r.room.s.q!.id, ...r.room.s.queue].every((id) => bank.get(id)!.topic === 'akkusativ')).toBe(true);
    expect(r.room.s.queue.length + 1).toBe(10);
  });

  it('token equivocado: no entra en la práctica de otro, empieza una nueva', () => {
    const { e } = env();
    const a = openPractice(e, { name: 'Ana', profile: 'profile-ana-1' });
    if (!a.ok) throw new Error(a.error);
    const b = openPractice(e, { room: a.room.s.code, token: 'nope', profile: 'profile-bea-1', name: 'Bea' });
    if (!b.ok) throw new Error(b.error);
    expect(b.room).not.toBe(a.room);
    expect(b.profile.id).toBe('profile-bea-1');
  });

  it('código de alumno desconocido → error claro (no se cuelga)', () => {
    const { e } = env();
    const r = openPractice(e, { name: 'Ana', profileCode: 'ZZZZZZ' });
    expect(r.ok).toBe(false);
  });

  it('al empezar otra práctica se borran las anteriores del mismo alumno que ya no están abiertas', () => {
    const { e, rooms } = env();
    const a = openPractice(e, { name: 'Ana', profile: 'profile-ana-1' });
    if (!a.ok) throw new Error(a.error);
    a.room.setConnected(a.room.s.players[0].id, false);
    const b = openPractice(e, { name: 'Ana', profile: 'profile-ana-1' });
    if (!b.ok) throw new Error(b.error);
    expect(rooms.has(a.room.s.code)).toBe(false);
    expect(rooms.has(b.room.s.code)).toBe(true);
  });
});
