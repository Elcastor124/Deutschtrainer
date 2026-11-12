// «Mein Alltag» (Lektion 8): las soluciones de los ejercicios se comprueban con reglas gramaticales escritas aparte
// (conjugación de los modales, terminaciones de los posesivos, prefijos separables), no copiando el texto de la presentación.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { COURSE, findUnit } from '../src/course.ts';
import { TOPICS } from '../shared/rules.ts';
import { parseCatalog } from '../src/catalog.ts';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'public/presentaciones/mein-alltag.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
/** Extrae una constante de datos del script de la presentación (const NAME=[...] o {...}). */
function data<T>(name: string): T {
  const m = new RegExp(`const ${name}=([\\[{][\\s\\S]*?[\\]}]);\\n`).exec(script);
  if (!m) throw new Error('No está ' + name);
  return runInNewContext('(' + m[1] + ')') as T;
}
type Q = { t: string; a: string; o?: string[] };
const QZ = data<Record<string, Q[]>>('QZ');
const Q2O = data<string[]>('Q2O');
const CJ = data<[string, string[]][]>('CJ');
const SENT = data<{ a: string; alt: string[] }[]>('SENT');
const fill = (q: Q, x: string) => q.t.replace('___', x);

const MODAL: Record<string, string[]> = {
  können: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
  müssen: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
  wollen: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
  dürfen: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
  möchten: ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten'],
};
const FINITE = new Set(Object.values(MODAL).flat());
const PREFIX: Record<string, string> = { aufstehen: 'auf', einkaufen: 'ein', anrufen: 'an', fernsehen: 'fern', mitkommen: 'mit' };
/** Posesivo + sustantivo en Akkusativ: masc. -en, fem./pl. -e, neutro sin terminación. */
const akk = (stem: string, g: 'm' | 'f' | 'n' | 'pl') => stem + (g === 'm' ? 'en' : g === 'n' ? '' : 'e');

describe('Mein Alltag · presentación', () => {
  it('tiene 20 diapositivas con el mismo motor que el resto (teclado, notas, temporizador) y los minutos llegan a 75', () => {
    const slides = [...html.matchAll(/<section class="slide[^"]*"[^>]*data-min="(\d+)–(\d+)"/g)];
    expect(slides).toHaveLength(20);
    expect(Number(slides[0][1])).toBe(0);
    expect(Number(slides.at(-1)![2])).toBe(75);
    slides.slice(1).forEach((s, k) => expect(Number(s[1])).toBe(Number(slides[k][2]))); // sin huecos ni solapes
    for (const fn of ['function go(', 'function mkQuiz(', 'function bInit(', 'function tgT(', "addEventListener('keydown'"]) expect(script).toContain(fn);
    expect(html).toContain('/design-tokens.css');
    expect(html).not.toMatch(/WebSocket|fetch\(|\/api\//);
  });

  it('conjugación de los cinco modales', () => {
    expect(Object.fromEntries(CJ)).toEqual(MODAL);
  });

  it('posesivos en Akkusativ (q1) y Schnellrunde (q2)', () => {
    const exp = [akk('mein', 'm'), akk('ihr', 'f'), akk('unser', 'n'), akk('sein', 'm'), akk('dein', 'pl')];
    expect(QZ.q1.map((q) => q.a)).toEqual(exp);
    expect(QZ.q2.map((q) => q.a)).toEqual([akk('ihr', 'f'), akk('mein', 'm'), akk('unser', 'pl'), 'Ihr', 'euer']);
  });

  it('cada pregunta de opción tiene la respuesta entre las opciones y opciones distintas', () => {
    for (const [id, qs] of Object.entries(QZ)) for (const q of qs) {
      const o = q.o ?? Q2O;
      expect(o, id + ': ' + q.t).toContain(q.a);
      expect(new Set(o).size).toBe(o.length);
      expect(q.t.split('___')).toHaveLength(2);
    }
  });

  it('modal adecuado (q3): forma conjugada correcta para el sujeto', () => {
    const subj = { Ich: 0, Wir: 3 } as Record<string, number>;
    const want = ['müssen', 'können', 'dürfen', 'wollen', 'möchten'];
    QZ.q3.forEach((q, k) => {
      const s = /(Ich|Wir) ___/.exec(q.t)![1];
      expect(q.a).toBe(MODAL[want[k]][subj[s]]);
    });
  });

  it('prefijos (q4) completan un verbo separable del tema', () => {
    const verbs = ['aufstehen', 'einkaufen', 'anrufen', 'fernsehen', 'mitkommen'];
    QZ.q4.forEach((q, k) => expect(q.a).toBe(PREFIX[verbs[k]]));
    expect(Q2O.sort()).toEqual(Object.values(PREFIX).sort());
  });

  it('Mini-Prüfung: 4 preguntas, 1 punto cada una, soluciones correctas', () => {
    const q = QZ.q5;
    expect(q).toHaveLength(4);
    expect(q[0].a).toBe(akk('mein', 'm'));
    expect(q[1].a).toBe(MODAL.müssen[1]);
    expect(fill(q[2], q[2].a)).toMatch(/Ich stehe jeden Morgen um sieben Uhr auf\.$/);
    expect(q[3].a).toBe(`Sie ${MODAL.wollen[2]} ${akk('ihr', 'm')} Bruder anrufen.`);
  });

  it('constructor: cada frase cumple V2 y, con modal, el separable va unido al final', () => {
    for (const s of SENT) for (const f of [s.a, ...s.alt]) {
      const w = f.replace(/[.?!]/g, '').split(' ');
      const pos = w.findIndex((x, k) => k > 0 && (FINITE.has(x) || /^(rufe|kaufen|steht)$/.test(x)));
      expect(pos, f).toBeGreaterThan(0);
      if (FINITE.has(w[pos])) {
        const last = w.at(-1)!;
        expect(last, f).toMatch(/(en|n)$/);
        if (Object.keys(PREFIX).includes(last)) expect(w.join(' ')).not.toContain(' ' + PREFIX[last] + ' ');
      } else expect(Object.values(PREFIX)).toContain(w.at(-1));
      expect(new Set(f.replace(/[.?!]/g, '').toLowerCase().split(' ').sort()).size).toBeGreaterThan(0);
      expect(f.replace(/[.?!]/g, '').toLowerCase().split(' ').sort()).toEqual(s.a.replace(/[.?!]/g, '').toLowerCase().split(' ').sort());
    }
    expect(SENT.map((s) => s.a)).toContain('Ich muss meinen Bruder anrufen.');
  });
});

describe('Mein Alltag · integración', () => {
  it('es la Lektion 8 del curso con la presentación, práctica de sus temas y sin borrar las anteriores', () => {
    const u = findUnit('mein-alltag')!;
    expect(u.n).toBe(8);
    expect(COURSE.at(-1)!.id).toBe('road-to-b1');
    expect(u.topics).toEqual(['possessiv', 'modal', 'trennbar', 'satzbau']);
    for (const t of u.topics) expect(TOPICS[t]).toBeTruthy();
    const ver = u.steps.find((s) => s.kind === 'ver')!;
    expect(ver.primary.href).toBe('/presentaciones/mein-alltag.html');
    const pr = u.steps.find((s) => s.kind === 'practicar')!;
    for (const t of u.topics) expect(pr.primary.href).toContain(t);
  });

  it('está en el catálogo (biblioteca, Lektion 8) con su huella correcta', () => {
    const catalog = parseCatalog(JSON.parse(readFileSync(resolve(root, 'public/presentaciones/catalogo.json'), 'utf8')));
    const p = catalog.find((x) => x.id === 'mein-alltag')!;
    expect(p.file).toBe('/presentaciones/mein-alltag.html');
    expect(p.unit).toBe(8);
    expect(catalog.some((x) => x.id === 'drei-regeln')).toBe(false);
  });
});
