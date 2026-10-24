// Modo práctica («repaso»): las sesiones consecutivas de un mismo alumno no deben repetir el mismo bloque de preguntas.
import { describe, expect, it } from 'vitest';
import { practiceQueue, type Stat } from '../server/select.ts';
import type { Topic } from '../shared/types.ts';
import { all, bank, seeded } from './helpers.ts';

const MIN = 60_000;

/** Simula N sesiones seguidas del mismo perfil. «ok(id, k)» decide si acierta; se registra como en el servidor. */
function sessions(opts: { count: number; topics?: Topic[]; focus?: (i: number) => boolean; n?: number; gap?: number; ok?: (id: string, k: number) => boolean; seed?: number }) {
  const rand = seeded(opts.seed ?? 11);
  const stats: Record<string, Stat> = {};
  let now = 1_700_000_000_000;
  const out: string[][] = [];
  for (let i = 0; i < opts.count; i++) {
    const q = practiceQueue(stats, opts.topics ?? [], opts.focus?.(i) ?? false, bank, rand, opts.n ?? 15, now);
    out.push(q);
    q.forEach((id, k) => {
      now += 20_000;
      const good = opts.ok ? opts.ok(id, k) : false;
      const s = (stats[id] ??= { n: 0, wrong: 0, last: 1, at: 0 });
      s.n++; if (!good) s.wrong++; s.last = good ? 1 : 0; s.at = now;
    });
    now += opts.gap ?? 10 * MIN;
  }
  return { out, stats };
}
const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

describe('practiceQueue · variedad entre sesiones', () => {
  it('sin «solo errores»: sesiones consecutivas comparten como mucho el 20 % aunque se falle todo', () => {
    const { out } = sessions({ count: 6 });
    for (let i = 1; i < out.length; i++) expect(overlap(out[i - 1], out[i]), `sesión ${i}`).toBeLessThanOrEqual(3);
    for (const q of out) expect(new Set(q).size).toBe(15);
  });

  it('las preguntas de las últimas 3 sesiones quedan muy por detrás de las nuevas (penalización por recencia)', () => {
    const { out } = sessions({ count: 4, topics: ['perfekt'], ok: (_id, k) => k % 2 === 0 });
    const last3 = new Set(out.slice(0, 3).flat());
    expect(out[3].filter((id) => last3.has(id)).length).toBeLessThanOrEqual(3);
  });

  it('mezcla repaso espaciado: vuelve a sacar errores antiguos, pero como máximo ~40 % de la sesión', () => {
    const { out, stats } = sessions({ count: 5 });
    const failedBefore = new Set(out.slice(0, 3).flat());
    const review = out[4].filter((id) => failedBefore.has(id)).length;
    expect(review).toBeGreaterThan(0);
    expect(review).toBeLessThanOrEqual(6);
    expect(Object.keys(stats).length).toBeGreaterThan(60);
  });

  it('respeta el filtro de temas y sigue rotando dentro de un tema pequeño', () => {
    const topics: Topic[] = ['dativ'];
    const { out } = sessions({ count: 5, topics, ok: (_id, k) => k % 3 === 0 });
    for (const q of out) for (const id of q) expect(bank.get(id)?.topic).toBe('dativ');
    for (let i = 1; i < out.length; i++) expect(overlap(out[i - 1], out[i]), `sesión ${i}`).toBeLessThanOrEqual(3);
  });

  it('con varios temas solo salen esos temas', () => {
    const topics: Topic[] = ['akkusativ', 'possessiv'];
    const { out } = sessions({ count: 3, topics });
    expect(out.flat().every((id) => topics.includes(bank.get(id)!.topic))).toBe(true);
  });

  it('acepta otras longitudes de sesión (10 y 25)', () => {
    expect(new Set(sessions({ count: 1, n: 10 }).out[0]).size).toBe(10);
    expect(new Set(sessions({ count: 1, n: 25 }).out[0]).size).toBe(25);
  });

  it('un tema con menos preguntas que la sesión no se rompe: devuelve lo que hay sin duplicados', () => {
    const tiny = all.filter((q) => q.topic === 'possessiv').length;
    const q = practiceQueue({}, ['possessiv'], false, bank, seeded(3), 40, 0);
    expect(q.length).toBe(Math.min(40, tiny));
    expect(new Set(q).size).toBe(q.length);
  });
});

describe('practiceQueue · «solo lo que he fallado»', () => {
  it('prioriza errores, completa con preguntas nuevas y rota entre errores', () => {
    // Dos sesiones normales fallándolo todo (≈30 errores) y luego dos de repaso de errores.
    const { out } = sessions({ count: 4, focus: (i) => i >= 2, ok: (_id, k) => k % 2 === 0 });
    const errorsBefore = new Set(out.slice(0, 2).flatMap((q) => q.filter((_, k) => k % 2 === 1)));
    const f1 = out[2], f2 = out[3];
    const rev1 = f1.filter((id) => errorsBefore.has(id)).length;
    expect(rev1).toBeGreaterThanOrEqual(8);
    expect(rev1).toBeLessThanOrEqual(11); // ~70 %: el resto, preguntas nuevas
    // rotación: los errores que no cupieron en la primera sesión de repaso salen en la segunda
    const skipped = [...errorsBefore].filter((id) => !f1.includes(id));
    expect(skipped.length).toBeGreaterThan(0);
    for (const id of skipped) expect(f2).toContain(id);
    expect(overlap(f1, f2)).toBeLessThan(11);
  });

  it('sin errores guardados funciona como una práctica normal', () => {
    const q = practiceQueue({}, [], true, bank, seeded(5), 15, 0);
    expect(new Set(q).size).toBe(15);
  });

  it('los errores recién cometidos sí salen en «solo errores» (el alumno quiere repasarlos ya)', () => {
    const failed = all.filter((q) => q.topic === 'dativ').slice(0, 5);
    const now = 5_000_000;
    const stats = Object.fromEntries(failed.map((q, i) => [q.id, { n: 1, wrong: 1, last: 0 as const, at: now - 60_000 + i }]));
    const q = practiceQueue(stats, ['dativ'], true, bank, seeded(2), 15, now);
    for (const f of failed) expect(q).toContain(f.id);
    expect(q.length).toBe(15);
  });
});
