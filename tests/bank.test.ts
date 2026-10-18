import { describe, expect, it } from 'vitest';
import { compare, fold, grade, makeInstance, publicView } from '../server/grade.ts';
import { READING_WORDS } from '../shared/reading.ts';
import { all, correct, seeded, wrong } from './helpers.ts';

const rand = seeded(42);

describe('banco de preguntas', () => {
  it('tiene volumen y variedad suficientes', () => {
    expect(all.length).toBeGreaterThan(600);
    const types = new Set(all.map((q) => q.type));
    for (const t of ['mc', 'write', 'gap', 'order', 'error', 'match', 'build']) expect(types.has(t as never), t).toBe(true);
    expect(all.filter((q) => q.unlock).length).toBeGreaterThanOrEqual(6);
    expect(all.filter((q) => q.diff === 'special').length).toBeGreaterThanOrEqual(6);
  });

  it('toda pregunta difícil o especial está justificada (why) y tiene explicación', () => {
    for (const q of all) {
      expect(q.explain.length, q.prompt).toBeGreaterThan(3);
      if (q.diff === 'hard' || q.diff === 'special') expect(q.why, q.prompt).toBeTruthy();
    }
  });

  it('la solución modelo de cada pregunta se corrige como correcta (con varios barajados)', () => {
    for (const q of all) {
      for (let k = 0; k < 3; k++) {
        const inst = makeInstance(q, rand);
        const g = grade(q, inst, correct(q, inst), false);
        expect(g.status, `${q.id} ${q.prompt}`).toBe('correct');
      }
    }
  });

  it('una respuesta errónea nunca se da por buena', () => {
    for (const q of all) {
      const inst = makeInstance(q, rand);
      expect(grade(q, inst, wrong(q, inst), false).status, `${q.id} ${q.prompt}`).not.toBe('correct');
    }
  });

  it('las alternativas de ordenar usan exactamente las mismas fichas', () => {
    for (const q of all) {
      if (q.type !== 'order') continue;
      const tiles = q.tokens.map((t) => fold(t)).sort().join(' ');
      for (const a of q.accept) expect(fold(a).split(' ').sort().join(' '), a).toBe(tiles);
    }
  });

  it('opciones sin duplicados y solución dentro de rango', () => {
    for (const q of all) {
      if (q.type !== 'mc') continue;
      expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
    }
  });

  it('la vista pública nunca expone respuestas', () => {
    for (const q of all.slice(0, 300)) {
      const v = publicView(q, makeInstance(q, rand)) as unknown as Record<string, unknown>;
      expect(v.answer).toBeUndefined();
      expect(v.accept).toBeUndefined();
      expect(v.gaps).toBeUndefined();
      expect(v.fix).toBeUndefined();
      expect(v.pairs).toBeUndefined();
    }
  });

  it('BlackCard solo en difíciles/especiales; Second Chance nunca en binarias ni retos', () => {
    for (const q of all) {
      const v = publicView(q, makeInstance(q, rand));
      expect(v.bc).toBe(q.diff === 'hard' || q.diff === 'special');
      if (q.type === 'mc' && q.options.length <= 2) expect(v.secondOk).toBe(false);
      if (q.diff === 'special') expect(v.secondOk).toBe(false);
    }
  });

  it('la lectura tiene entre 120 y 150 palabras', () => {
    expect(READING_WORDS).toBeGreaterThanOrEqual(120);
    expect(READING_WORDS).toBeLessThanOrEqual(150);
  });
});

describe('corrección de respuestas abiertas', () => {
  it('acepta variantes sin umlaut, mayúsculas y puntuación (con aviso)', () => {
    // «mochte» (sin umlaut) es otra palabra: no se acepta sola, va a revisión del profesor.
    expect(compare('Ich mochte Geld abheben', ['Ich möchte Geld abheben.'], true).level).toBe('near');
    expect(compare('Ich moechte Geld abheben', ['Ich möchte Geld abheben.'], true).level).toBe('fold');
    expect(compare('ich möchte geld abheben', ['Ich möchte Geld abheben.'], true).level).toBe('loose');
    expect(compare('Ich bleibe zu Hause weil ich krank bin', ['Ich bleibe zu Hause, weil ich krank bin.'], true).level).toBe('loose');
    expect(compare('Strasse', ['Straße'], false).level).toBe('fold');
  });

  it('detecta el artículo que falta', () => {
    const m = compare('Reisepass', ['der Reisepass'], false);
    expect(m.level).toBe('none');
    expect(m.note).toContain('der Reisepass');
  });

  it('una errata pequeña o un orden distinto van a revisión del profesor', () => {
    expect(compare('Ich habe meine Karte verlorn.', ['Ich habe meine Karte verloren.'], true).level).toBe('near');
    expect(compare('Weil ich krank bin bleibe ich zu Hause', ['Ich bleibe zu Hause, weil ich krank bin.'], true).level).toBe('reorder');
  });

  it('en huecos de gramática no hay tolerancia: dem ≠ den', () => {
    expect(compare('den', ['dem'], false).level).toBe('none');
  });
});
