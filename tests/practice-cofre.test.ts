// Reporte de un alumno: en la práctica de Nebensätze salía «Prüfungsfrage · cofre negro», escribió la frase con «das»
// en vez de «dass», le salió «Falsch» con un «Casi: compárala con…» en el que no se veía la diferencia, no recibió cofre
// y luego la pregunta volvió (repaso) y la dio por buena. En práctica no hay cofres: la etiqueta ya no sale ahí.
import { describe, expect, it } from 'vitest';
import { Room, type Deps } from '../server/room.ts';
import { openPractice, type PracticeEnv } from '../server/practice-session.ts';
import { grade, nearNote } from '../server/grade.ts';
import type { Profile } from '../server/store.ts';
import { bank, seeded } from './helpers.ts';

const DASS = [...bank.values()].find((q) => q.unlock && q.type === 'write' && q.accept[0] === 'Die Bankangestellte sagt, dass ich hier unterschreiben muss.')!;

function env() {
  const profiles: Record<string, Profile> = {};
  const deps: Deps = { bank, now: () => 1_000_000, rand: seeded(4) };
  let n = 0;
  const e: PracticeEnv = {
    rooms: new Map<string, Room>(), deps, newRoomCode: () => `P${String(++n).padStart(5, '0')}`,
    profileByCode: (c) => Object.values(profiles).find((p) => p.code === c),
    ensureProfile: (id, name) => (profiles[id ?? 'anon'] ??= { id: id ?? 'anon', code: 'C1', name, stats: {}, createdAt: 0 }),
  };
  return e;
}

describe('cofre negro y práctica', () => {
  it('la pregunta del reporte existe y es Prüfungsfrage', () => { expect(DASS?.unlock).toBe(true); });

  it('en práctica la Prüfungsfrage NO promete cofre negro (no hay cofres en práctica) y acertarla no da cofres', () => {
    const r = openPractice(env(), { name: 'Robe', profile: 'p-robe', topics: ['nebensatz'], size: 22 });
    if (!r.ok) throw new Error(r.error);
    const room = r.room;
    // Forzamos la pregunta del reporte.
    room.s.q = { id: DASS.id, inst: { } as never };
    const pid = room.s.players[0].id;
    expect(room.view({ pid }).q?.unlock).toBe(false);
    expect(room.view({ teacher: true }).q?.unlock).toBe(false);
    expect(room.s.players[0].chests).toEqual([]);
  });

  it('«das» en vez de «dass»: falla en práctica, pero la nota señala la palabra exacta', () => {
    const g = grade(DASS, {} as never, { text: 'Die Bankangestellte sagt, das ich hier unterschreiben muss' }, true);
    expect(g.status).toBe('wrong');
    expect(g.note).toContain('«das» → «dass»');
    expect(g.note).toContain('doble s');
    expect(grade(DASS, {} as never, { text: 'Die Bankangestellte sagt, dass ich hier unterschreiben muss' }, true).status).toBe('correct');
  });

  it('nearNote sin diferencias de palabra (p. ej. letras) cae al mensaje genérico', () => {
    expect(nearNote('Ich gehe zur Bnak', 'Ich gehe zur Bank')).toContain('«Bnak» → «Bank»');
    expect(nearNote('a b c', 'a b c d')).toBe('Casi: compárala con «a b c d».');
  });
});
