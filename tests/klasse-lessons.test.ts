// Klasse mit Klaus · validación del CONTENIDO de todas las lecciones (sin IA): cada ejercicio debe poder resolverse
// con la interfaz real y su solución tiene que ser coherente. Falla cerrado: un error de datos rompe la prueba.
import { describe, expect, it } from 'vitest';
import { RULES } from '../server/tutor.ts';
import { LESSONS, basePlan, grade, publicActivity } from '../server/ai/lessons.ts';
import { isExercise, type Activity } from '../shared/lesson.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ruleIds = new Set(RULES.map((r) => r.id));
const sorted = (a: string[]) => [...a].sort().join('|');
const word = (s: string, w: string) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu').test(s);

describe('Klasse · banco de lecciones', () => {
  it('ids únicos y orden A1 → A2', () => {
    const ids = LESSONS.map((l) => l.id), acts = LESSONS.flatMap((l) => [...l.activities, ...l.remedial].map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(acts).size).toBe(acts.length);
    const levels = LESSONS.map((l) => l.level);
    expect(levels.lastIndexOf('A1')).toBeLessThan(levels.indexOf('A2') === -1 ? Infinity : levels.indexOf('A2'));
  });
  for (const lesson of LESSONS) describe(lesson.id, () => {
    const all: Activity[] = [...lesson.activities, ...lesson.remedial];
    it('estructura de la lección', () => {
      expect(lesson.id).toMatch(/^[a-z0-9-]+$/);
      expect(lesson.title.length).toBeGreaterThan(4);
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
      for (const r of lesson.ruleRefs) expect(ruleIds.has(r), `ruleRef ${r}`).toBe(true);
      expect(lesson.activities.filter(isExercise).length).toBeGreaterThanOrEqual(6);
      expect(lesson.remedial.filter(isExercise).length).toBeGreaterThanOrEqual(2);
      const cps = lesson.activities.filter((a) => a.kind === 'checkpoint');
      expect(cps.length).toBe(1);
      expect(lesson.activities.at(-1)!.kind).toBe('checkpoint');
      expect(lesson.activities.slice(0, 2).every((a) => !isExercise(a)), 'empieza explicando').toBe(true);
      expect(lesson.activities.some((a) => a.kind === 'grammar-table' || a.kind === 'comparison'), 'tabla o comparación').toBe(true);
    });
    for (const a of all) it(`${a.id} (${a.kind})`, () => {
      expect(a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.title.length).toBeGreaterThan(2);
      if ('ruleId' in a && a.ruleId) expect(ruleIds.has(a.ruleId), `ruleId ${a.ruleId}`).toBe(true);
      switch (a.kind) {
        case 'grammar-table': {
          for (const row of a.rows) expect(row.cells.length, `fila ${row.id}`).toBe(a.columns.length - 1);
          for (const st of a.steps) { const [r, c] = st.focus.split(':'); const row = a.rows.find((x) => x.id === r); expect(row, st.focus).toBeTruthy(); expect(Number(c)).toBeLessThan(row!.cells.length); }
          expect(a.steps.length).toBeGreaterThanOrEqual(2);
          break;
        }
        case 'comparison': for (const it_ of [...a.left.items, ...a.right.items]) if (it_.mark) expect(it_.de.includes(it_.mark), it_.mark).toBe(true); break;
        case 'dialogue': expect(a.lines.length).toBeGreaterThanOrEqual(3); for (const l of a.lines) if (l.mark) expect(l.de.includes(l.mark), l.mark).toBe(true); break;
        case 'theory': expect(a.text.length).toBeGreaterThan(30); break;
        case 'checkpoint': expect(a.pass).toBeGreaterThan(0); expect(a.pass).toBeLessThanOrEqual(1); break;
        default: break;
      }
      if (!isExercise(a)) return;
      expect(a.hint.length).toBeGreaterThan(10); expect(a.explain.length).toBeGreaterThan(10);
      const right = { 'multiple-choice': () => ({ choice: (a as any).answer }), listening: () => ({ choice: (a as any).answer }), 'fill-blank': () => ({ text: (a as any).answers[0] }), 'sentence-builder': () => ({ order: (a as any).solutions[0] }), matching: () => null }[a.kind]();
      switch (a.kind) {
        case 'multiple-choice': case 'listening':
          expect(a.options.length).toBeGreaterThanOrEqual(2); expect(new Set(a.options).size).toBe(a.options.length);
          expect(a.answer).toBeGreaterThanOrEqual(0); expect(a.answer).toBeLessThan(a.options.length);
          if (a.options[a.answer].length >= 4 && a.kind === 'multiple-choice') expect(word(a.hint, a.options[a.answer]), 'la pista no revela la respuesta').toBe(false);
          if (a.kind === 'listening') expect(a.audio).toBe(a.id);
          break;
        case 'fill-blank':
          expect(a.prompt.split('___').length - 1, 'un único hueco').toBe(1); expect(a.answers.length).toBeGreaterThan(0);
          if (a.answers[0].length >= 4) expect(word(a.hint, a.answers[0]), 'la pista no revela la respuesta').toBe(false);
          break;
        case 'sentence-builder':
          for (const sol of a.solutions) expect(sorted(sol), 'la solución usa exactamente las palabras').toBe(sorted(a.words));
          expect(a.solutions.some((sol) => sol.join(' ') === a.words.join(' ')), 'las palabras vienen desordenadas').toBe(false);
          break;
        case 'matching':
          expect(a.pairs.length).toBeGreaterThanOrEqual(3);
          expect(new Set(a.pairs.map((p) => p.left)).size).toBe(a.pairs.length); expect(new Set(a.pairs.map((p) => p.right)).size).toBe(a.pairs.length);
          break;
      }
      // La solución pasa por el corrector real y la proyección pública no la filtra.
      if (a.kind === 'matching') {
        const pub: any = publicActivity(a, lesson, 'kl_test');
        const pairs = a.pairs.map((p) => pub.right.indexOf(p.right));
        expect(grade(a, { pairs }, 0, 2, 'kl_test')?.ok).toBe(true);
      } else {
        expect(grade(a, right as any, 0, 2, 'kl_test')?.ok).toBe(true);
        const pub = JSON.stringify(publicActivity(a, lesson, 'kl_test'));
        expect(pub).not.toMatch(/"answer"|"answers"|"solutions"|"explain"|"hint"/);
      }
    });
    it('sin audio generado, la escucha se omite (no se finge)', () => {
      const empty = mkdtempSync(join(tmpdir(), 'kx-audio-'));
      expect(basePlan(lesson, empty).some((id) => lesson.activities.find((a) => a.id === id)?.kind === 'listening')).toBe(false);
    });
  });
});
