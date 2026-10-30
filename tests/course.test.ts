import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOPICS } from '../shared/rules.ts';
import {
  ALL_STEP_IDS, COURSE, courseOrder, nextStep, overallProgress, parseProgress, serializeProgress,
  toggleStep, topicQuery, unitProgress, unitStatus,
} from '../src/course.ts';

const catalog = JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/presentaciones/catalogo.json'), 'utf8')) as { id: string; pdf?: string; unit?: number }[];

describe('Ruta del curso', () => {
  it('sigue el orden pedagógico fijo y termina en Road to B1', () => {
    expect(COURSE.map((u) => u.id)).toEqual(['bruecke-a1', 'bank', 'nebensaetze-perfekt', 'krankenhaus', 'unterwegs', 'akkusativ', 'sprache-in-bewegung', 'road-to-b1']);
    expect(COURSE.map((u) => u.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('cubre todas las presentaciones del catálogo y solo enlaza PDFs que existen', () => {
    const used = COURSE.flatMap((u) => [u.presentation, u.review?.id]).filter(Boolean);
    expect(new Set(used)).toEqual(new Set(catalog.map((c) => c.id)));
    for (const u of COURSE) if (u.presentation) expect(!!catalog.find((c) => c.id === u.presentation)?.pdf, u.id).toBe(!!u.pdf);
  });

  it('el catálogo generado lleva el número de unidad del curso', () => {
    for (const c of catalog) expect(c.unit, c.id).toBe(COURSE.find((u) => u.presentation === c.id || u.review?.id === c.id)!.n);
  });

  it('cada Lektion tiene el flujo Ver → Practicar → Repaso (sin juegos: viven en /juegos) con enlaces a sus temas', () => {
    for (const u of COURSE.filter((x) => !x.exam)) {
      expect(u.steps.map((s) => s.kind), u.id).toEqual(['ver', 'practicar', 'repaso']);
      expect(u.steps[0].primary.href).toBe(`/presentaciones/${u.presentation}.html`);
      expect(u.steps[1].primary.href).toBe(`/practica?temas=${u.topics.join(',')}`);
      for (const s of u.steps) for (const l of [s.primary, ...s.extra]) expect(l.href, u.id).not.toMatch(/^\/(jenga|jugar|boxeo)/);
      for (const t of u.topics) expect(Object.keys(TOPICS)).toContain(t);
    }
    expect(COURSE[0].steps[0].desc).toContain('Traducción web de la presentación original');
    expect(COURSE.find((u) => u.id === 'krankenhaus')!.steps[2].primary.href).toBe('/presentaciones/krankenhaus-remaster.html');
    expect(COURSE.at(-1)!.steps.map((s) => s.primary.href)).toContain('/road-to-b1');
    expect(new Set(ALL_STEP_IDS).size).toBe(ALL_STEP_IDS.length);
  });

  it('topicQuery no añade parámetros vacíos', () => {
    expect(topicQuery([])).toBe('');
    expect(topicQuery(['dativ', 'akkusativ'])).toBe('?temas=dativ,akkusativ');
  });
});

describe('Progreso del curso', () => {
  it('recomienda el primer paso pendiente y avanza al marcarlo', () => {
    let done = new Set<string>();
    expect(nextStep(done)!.step.id).toBe('bruecke-a1:ver');
    done = toggleStep(done, 'bruecke-a1:ver');
    expect(nextStep(done)!.step.id).toBe('bruecke-a1:practicar');
    expect(unitProgress(COURSE[0], done)).toEqual({ done: 1, total: 3, pct: 33 });
    expect(unitStatus(COURSE[0], done)).toBe('current');
    // Saltar pasos no se pierde: la recomendación vuelve al hueco más temprano.
    done = toggleStep(done, 'bank:ver');
    expect(unitStatus(COURSE[1], done)).toBe('started');
    expect(nextStep(done)!.step.id).toBe('bruecke-a1:practicar');
    done = toggleStep(done, 'bruecke-a1:ver');
    expect(done.has('bruecke-a1:ver')).toBe(false);
  });

  it('el curso completo da 100 % y ninguna recomendación', () => {
    const all = new Set(ALL_STEP_IDS);
    expect(overallProgress(all).pct).toBe(100);
    expect(nextStep(all)).toBeNull();
    expect(COURSE.every((u) => unitStatus(u, all) === 'done')).toBe(true);
  });

  it('serializa y tolera datos corruptos o pasos desconocidos', () => {
    const done = toggleStep(toggleStep(new Set(), 'bank:practicar'), 'bruecke-a1:ver');
    expect(parseProgress(serializeProgress(done))).toEqual(done);
    expect(JSON.parse(serializeProgress(done)).done).toEqual(['bruecke-a1:ver', 'bank:practicar']);
    for (const raw of [null, '', '{', '42', '{"done":"x"}']) expect(parseProgress(raw).size).toBe(0);
    expect([...parseProgress('["bank:ver","hack:ver",3]')]).toEqual(['bank:ver']);
    expect(toggleStep(new Set(), 'nope:ver').size).toBe(0);
  });

  it('ordena presentaciones según el curso (remaster justo tras Krankenhaus)', () => {
    const ids = catalog.map((c) => c.id).sort((a, b) => courseOrder(a) - courseOrder(b));
    expect(ids).toEqual(['mission-01', 'bruecke-a1', 'bank', 'nebensaetze-perfekt', 'zusammenfassung-thema-1', 'krankenhaus', 'krankenhaus-remaster', 'unterwegs', 'akkusativ', 'sprache-in-bewegung']);
  });
});
