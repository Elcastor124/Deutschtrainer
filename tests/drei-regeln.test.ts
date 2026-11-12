// «Drei Regeln, ein Satz»: el contenido (JSON dentro del HTML) se valida con reglas gramaticales independientes
// (tablas de conjugación, terminaciones de posesivos, prefijos separables), no solo comparando con el mismo texto.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COURSE, findUnit, courseOrder } from '../src/course.ts';
import { TOPICS } from '../shared/rules.ts';
import { parseCatalog } from '../src/catalog.ts';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'public/presentaciones/drei-regeln.html'), 'utf8');
const data = JSON.parse(/<script id="deck-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]);
const catalog = parseCatalog(JSON.parse(readFileSync(resolve(root, 'public/presentaciones/catalogo.json'), 'utf8')));

// ── Gramática de referencia, escrita aparte ──
const PRON = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
const MODAL: Record<string, string[]> = {
  können: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
  müssen: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
  wollen: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
  dürfen: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
  möchten: ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten'],
};
const POSS_STEM = ['mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'Ihr'];
/** Terminación del posesivo según género/número/caso (Nominativ y Akkusativ). */
const possEnding = (g: 'm' | 'f' | 'n' | 'pl', c: 'nom' | 'akk') => (g === 'f' || g === 'pl' ? 'e' : g === 'm' && c === 'akk' ? 'en' : '');
const possForm = (stem: string, g: 'm' | 'f' | 'n' | 'pl', c: 'nom' | 'akk') => {
  const base = stem === 'unser' || stem === 'euer' ? (possEnding(g, c) ? stem.replace(/er$/, 'er') : stem) : stem; // unser/euer: unsere, unseren (con «e» antes de -n: euere → eure es opcional; no se usa aquí)
  return base + possEnding(g, c);
};
const PREFIXES: Record<string, string> = { aufstehen: 'auf', einkaufen: 'ein', anrufen: 'an', fernsehen: 'fern', mitkommen: 'mit' };
const STEM: Record<string, string> = { aufstehen: 'stehen', einkaufen: 'kaufen', anrufen: 'rufen', fernsehen: 'sehen', mitkommen: 'kommen' };
/** La frase cumple V2: el verbo conjugado va justo tras el primer bloque (un token del ejercicio) y el último elemento es `end`. */
const v2 = (sentence: string, tok: { t: string; r?: string }[]) => {
  const s = sentence.replace(/\.$/, ''), fin = tok.find((t) => t.r === 'fin')!.t, end = tok.find((t) => t.r === 'end')!.t;
  const firsts = tok.filter((t) => !t.r).map((t) => t.t.toLowerCase());
  const first = firsts.find((f) => s.toLowerCase().startsWith(f + ' ' + fin + ' '));
  return { first, endsOk: s.endsWith(' ' + end) };
};
const norm = (s: string) => s.replace(/[.!?]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

describe('Drei Regeln, ein Satz · estructura', () => {
  it('tiene exactamente 20 diapositivas y los tiempos suman 75 minutos', () => {
    // Una diapositiva = una llamada slide(...) del código; los bloques fijan el reparto 10/23/22/15/5.
    const slides = html.match(/^slide\('/gm) ?? [];
    expect(slides).toHaveLength(20);
    expect(data.notes).toHaveLength(20);
    expect(data.blocks.map((b: { min: number }) => b.min)).toEqual([10, 23, 22, 15, 5]);
    expect(data.blocks.reduce((n: number, b: { min: number }) => n + b.min, 0)).toBe(75);
    let from = 0; for (const b of data.blocks) { expect(b.from).toBe(from); from += b.min; }
    // Reparto de diapositivas por bloque según el guion: 3 + 6 + 5 + 4 + 2.
    const per = (id: string) => (html.match(new RegExp(`^slide\\('${id}'`, 'gm')) ?? []).length;
    expect(['poss', 'modal', 'trenn', 'challenge', 'pruefung'].map(per)).toEqual([3, 6, 5, 4, 2]);
  });
  it('es autónomo: tokens de marca, sin recursos relativos ni red de datos, soporta movimiento reducido y teclado', () => {
    expect(html).toContain('href="/design-tokens.css"');
    // Recursos: solo tokens de marca, Google Fonts y el motor de Klaus (cargado por JS). Ninguna ruta relativa ni plantilla en un atributo estático.
    const attrs = [...html.split('<script>')[0].matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    for (const a of attrs) expect(a, a).toMatch(/^(?:https:\/\/fonts\.(?:googleapis|gstatic)\.com|\/design-tokens\.css$)/);
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
    expect(html).toContain('prefers-reduced-motion');
    for (const k of ['ArrowRight', 'ArrowLeft', "' '"]) expect(html).toContain(k);
    expect(html).not.toContain('\r\n');
  });
});

describe('Drei Regeln, ein Satz · gramática verificada', () => {
  it('las conjugaciones de los cinco modales son correctas (6 personas)', () => {
    expect(Object.keys(data.modals)).toEqual(Object.keys(MODAL));
    for (const [v, f] of Object.entries(MODAL)) expect(data.modals[v].f, v).toEqual(f);
    expect(data.pron).toEqual(PRON);
    for (const v of Object.keys(MODAL)) expect(data.modals[v].f[0], `${v}: ich = er/sie/es`).toBe(data.modals[v].f[2]);
  });
  it('los ocho posesivos de la tabla son mein, dein, sein, ihr, unser, euer, ihr, Ihr', () => {
    expect(data.persons.map((p: string[]) => p[1])).toEqual(['mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'ihr', 'Ihr']);
    expect(data.persons.map((p: string[]) => p[0])).toEqual(['ich', 'du', 'er', 'sie (Sg.)', 'wir', 'ihr', 'sie (Pl.)', 'Sie']);
  });
  it('las terminaciones de posesivos de los ejercicios cumplen la regla (m. Akk. -en; f., pl. -e; n. sin terminación)', () => {
    for (const q of [...data.ex.p2, ...data.ex.p3]) {
      const { b, g, c } = q.pos;
      expect(q.a, q.t).toEqual([possForm(b, g, c)]);
      expect(POSS_STEM.map((s) => s.toLowerCase())).toContain(b);
      if (q.o) { expect(q.o).toContain(q.a[0]); expect(new Set(q.o).size).toBe(q.o.length); }
    }
    expect(data.akkRows.map((r: { poss: string; suf: string; n: string }) => `${r.poss}${r.suf} ${r.n}`)).toEqual(['mein Bruder'.replace('mein', 'meinen'), 'meine Schwester', 'mein Auto', 'meine Freunde']);
  });
  it('en cada hueco solo cabe UNA respuesta razonable: p3 y m7 tienen una única opción correcta', () => {
    for (const q of [...data.ex.p3, ...data.ex.m7]) { expect(q.a).toHaveLength(1); expect(q.o.filter((o: string) => o === q.a[0])).toHaveLength(1); }
    // La solución de cada modal es la forma conjugada del verbo y la persona indicados.
    for (const q of data.ex.m7) expect(MODAL[q.verb][q.person], q.t).toBe(q.a[0]);
    expect(data.ex.m7.map((q: { verb: string }) => q.verb)).toEqual(['müssen', 'können', 'dürfen', 'wollen', 'möchten']);
  });
  it('en las frases con modal, el modal conjugado va en 2.ª posición y el infinitivo al final', () => {
    for (const q of data.ex.m8) {
      const fin = q.tok.find((t: { r?: string }) => t.r === 'fin'), end = q.tok.find((t: { r?: string }) => t.r === 'end');
      expect(Object.values(MODAL).flat()).toContain(fin.t);
      expect(end.t).toMatch(/en$/);
      // Las dos soluciones aceptadas (sujeto-primero y complemento-primero) respetan la posición 2 y el final.
      for (const s of q.sol.split(' · ')) { const r = v2(s, q.tok); expect(r.first, `V2 en «${s}»`).toBeTruthy(); expect(r.endsOk, `final en «${s}»`).toBe(true); }
    }
  });
  it('los verbos separables: prefijo + raíz = infinitivo, y en la frase el prefijo va al final con el verbo en 2.ª posición', () => {
    expect(data.verbs.map((v: { inf: string }) => v.inf)).toEqual(Object.keys(PREFIXES));
    for (const v of data.verbs) {
      expect(v.pre + v.stem, v.inf).toBe(v.inf); expect(v.pre).toBe(PREFIXES[v.inf]); expect(v.stem).toBe(STEM[v.inf]);
      for (const s of [v.s, v.s11]) { expect(s).toHaveLength(4); expect(s[3]).toBe(v.pre); expect(s[1]).toMatch(new RegExp(`^(?:${v.stem.slice(0, 3)}|sieh|ruf|komm|kauf|steh)`)); }
    }
    for (const q of data.ex.t12) { expect(q.a).toEqual([PREFIXES[q.verb]]); expect(q.t.replace('___', q.a[0])).toBe(q.full); expect(q.t.indexOf('___')).toBeGreaterThan(q.t.length - 8); }
    for (const q of data.ex.t13) {
      const fin = q.tok.find((t: { r?: string }) => t.r === 'fin').t, pre = q.tok.find((t: { r?: string }) => t.r === 'end').t;
      expect(Object.values(PREFIXES)).toContain(pre);
      expect(fin).toBeTruthy();
      for (const s of q.sol.split(' · ')) { const r = v2(s, q.tok); expect(r.first, `V2 en «${s}»`).toBeTruthy(); expect(r.endsOk, `prefijo ${pre} al final de «${s}»`).toBe(true); }
    }
  });
  it('modal + separable: el verbo vuelve a infinitivo unido (prefijo + raíz) al final', () => {
    for (const c of data.combo) { const w = c.s.replace(/\.$/, '').split(' '); expect(Object.values(MODAL).flat()).toContain(w[1]); expect(Object.keys(PREFIXES)).toContain(w.at(-1)); }
    const sm = data.ex.c16;
    expect(sm.map((x: { sol: string }) => x.sol)).toEqual(['Ich muss meinen Bruder anrufen.', 'Sie möchte ihre Mutter anrufen.', 'Wir wollen unsere Freunde anrufen.']);
    for (const x of sm) {
      expect(MODAL[x.mod][x.person]).toBe(x.a);
      expect(x.ansPos).toBe(possForm(x.pos, x.g === 'pl' ? 'pl' : x.g, 'akk'));
      const sentence = `${x.subj[0].toUpperCase()}${x.subj.slice(1)} ${x.a} ${x.ansPos} ${x.n} ${x.inf}.`;
      expect(sentence).toBe(x.sol);
    }
  });
  it('Fehlerdetektiv: tres frases con error, una correcta, y toda corrección es una frase gramatical', () => {
    expect(data.ex.c17.map((x: { ok: boolean }) => x.ok)).toEqual([false, false, false, true]);
    const good = new Set(sm()); function sm() { return ['Ich muss meinen Bruder anrufen', 'Er kann seine Mutter anrufen', 'Wir wollen unsere Freunde anrufen', 'Sie möchte ihren Vater anrufen']; }
    data.ex.c17.forEach((x: { t: string; ok: boolean; fix: string[] }, i: number) => {
      if (x.ok) { expect(x.fix).toEqual([]); expect(good.has(x.t.replace('.', ''))).toBe(true); }
      else { expect(x.fix).toHaveLength(1); expect([...good][i]).toBe(x.fix[0].replace('.', '')); expect(norm(x.t)).not.toBe(norm(x.fix[0])); }
    });
  });
  it('Mini-Prüfung: 4 ejercicios, un punto cada uno, soluciones del guion', () => {
    expect(data.exam).toHaveLength(4);
    expect(data.exam[0].a).toEqual([['meinen']]); expect(data.exam[1].a).toEqual([['musst']]); expect(data.exam[2].a).toEqual([['stehe'], ['auf']]);
    expect(data.exam[3].any.map(norm)).toEqual(['sie will ihren bruder anrufen', 'ihren bruder will sie anrufen']);
    expect(data.exam[1].a[0][0]).toBe(MODAL['müssen'][1]);
    expect(data.exam[3].any[0]).toBe(`Sie ${MODAL['wollen'][2]} ${possForm('ihr', 'm', 'akk')} Bruder anrufen`);
  });
  it('las tres situaciones de Alltag incluyen el Dativ con pista (mit meinem Freund)', () => {
    expect(data.alltag.map((a: { de: string }) => a.de)).toEqual(['Ich muss meine Mutter anrufen.', 'Ich möchte mit meinem Freund einkaufen gehen.', 'Ich kann morgen meinen Bruder anrufen.']);
    expect(data.alltag[1].hint).toContain('meinem');
  });
});

describe('Drei Regeln, ein Satz · integración', () => {
  it('Curso: Lektion 8 agrupa los temas 05–07 con presentación, práctica preseleccionada, objetivos y progreso; el simulacro sigue siendo el último', () => {
    const u = findUnit('drei-regeln')!;
    expect(u.n).toBe(8); expect(COURSE.at(-1)!.id).toBe('road-to-b1'); expect(COURSE.slice(0, 7).map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(u.minutes).toBe(75); expect(u.level).toBe('A1–A2');
    expect(u.topics).toEqual(['possessiv', 'modal', 'trennbar', 'satzbau']);
    for (const t of u.topics) expect(Object.keys(TOPICS)).toContain(t);
    expect(u.steps[0].primary).toMatchObject({ label: 'Abrir presentación', href: '/presentaciones/drei-regeln.html', external: true });
    expect(u.steps[1].primary).toEqual({ label: 'Practicar estos temas', href: '/practica?temas=possessiv,modal,trennbar,satzbau' });
    expect(u.goals).toHaveLength(4);
    expect(u.steps.map((s) => s.id)).toEqual(['drei-regeln:ver', 'drei-regeln:practicar', 'drei-regeln:repaso']);
    // Abrir la presentación no completa nada: el progreso es solo el de los pasos que marca el alumno.
    expect(u.games).toEqual([]);
    for (const s of u.steps) for (const l of [s.primary, ...s.extra]) expect(l.href).not.toMatch(/^\/(jenga|jugar|boxeo)/);
    expect(courseOrder('drei-regeln')).toBeLessThan(courseOrder('no-existe')); expect(courseOrder('drei-regeln')).toBeGreaterThan(courseOrder('sprache-in-bewegung'));
  });
  it('Biblioteca: está en el catálogo, en el Tema 1, con título, subtítulo, nivel y duración exactos', () => {
    const e = catalog.find((c) => c.id === 'drei-regeln')!;
    expect(e).toMatchObject({ title: 'Drei Regeln, ein Satz', description: 'Possessivartikel, Modalverben und trennbare Verben.', level: 'A1–A2', minutes: 75, unit: 8, file: '/presentaciones/drei-regeln.html' });
    expect(e.topics).toEqual(['Possessivartikel', 'Modalverben', 'Trennbare Verben', 'Satzbau']);
    expect(e.pdf).toBeUndefined();   // no hay PDF: no se enlaza ninguno
  });
  it('los temas del banco existente tienen preguntas (la práctica preseleccionada no queda vacía)', async () => {
    const { loadBank } = await import('../server/bank/index.ts');
    const all = [...loadBank().values()] as { topic: string }[];
    for (const t of ['possessiv', 'modal', 'trennbar', 'satzbau']) expect(all.filter((q) => q.topic === t).length, t).toBeGreaterThan(5);
  });
});
