// Preguntas de vocabulario generadas a partir de shared/vocab.ts (todas las presentaciones).
import type { Question } from '../../shared/types.ts';
import { READINGS } from '../../shared/reading.ts';
import { VOCAB, articleOf, isNoun, type Voc } from '../../shared/vocab.ts';
import { mc, mt, rng, wr, type Meta } from './h.ts';

/** Etiquetas «reading:<texto>» de las palabras que aparecen en cada lectura: esas preguntas vuelven a salir en el juego. */
const readingTags = (words: string[]) => {
  const t = READINGS.filter((r) => words.some((w) => r.vocab.includes(w))).map((r) => `reading:${r.id}`);
  return t.length ? t : undefined;
};

// Categorías que se preguntan desde otros módulos (gramática, día a día).
const SKIP = new Set(['conn', 'prep', 'wo', 'greet', 'q4', 'lang', 'color', 'bank-phr', 'symptom-phr']);
const CONCRETE = new Set(['body', 'transport', 'family', 'hospital', 'bank', 'places', 'home', 'food', 'meal', 'clothes', 'house', 'furniture', 'weather', 'days', 'free', 'jobs', 'city2']);

const core = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/^(el|la|los|las|un|una|der|die|das|ein|eine) /, '').replace(/[¿?¡!.]/g, '').trim();
const similar = (a: string, b: string) => {
  const x = core(a), y = core(b);
  return x === y || x.includes(y) || y.includes(x);
};

function distractors(v: Voc, field: 'de' | 'es', pool: Voc[], n: number): string[] {
  const r = rng(v.de + field);
  // Ningún distractor puede significar lo mismo que la respuesta (öffnen / aufmachen = «abrir»).
  const clash = (w: Voc) => similar(w.de, v.de) || similar(w.es, v.es);
  const same = pool.filter((w) => w !== v && w.cat === v.cat && !clash(w));
  const wider = pool.filter((w) => w !== v && w.src === v.src && w.cat !== v.cat && !clash(w) && isNoun(w.de) === isNoun(v.de));
  const pick = (list: Voc[], k: number) => list.map((w) => ({ w, k: r() })).sort((a, b) => a.k - b.k).slice(0, k).map((o) => o.w[field]);
  const out = pick(same, n);
  if (out.length < n) out.push(...pick(wider, n - out.length));
  return [...new Set(out)].slice(0, n);
}

function articleTip(de: string): string {
  const noun = de.split(' ')[1];
  if (/(ung|schrift|heit|keit)$/.test(noun)) return 'Truco: -ung / -schrift / -heit / -keit → siempre DIE.';
  if (/e$/.test(noun) && articleOf(de) === 'die') return 'Truco: muchas palabras en -e son femeninas (DIE).';
  if (/chen$/.test(noun)) return 'Truco: -chen → siempre DAS.';
  return 'El artículo se aprende siempre junto con la palabra.';
}

export function vocabQuestions(): Question[] {
  const out: Question[] = [];
  const pool = VOCAB;
  for (const v of VOCAB) {
    if (SKIP.has(v.cat)) continue;
    const noun = isNoun(v.de);
    const tags = readingTags([v.de]);
    const plural = v.pl && v.pl !== 'only' ? ` Plural: ${v.pl}.` : v.pl === 'only' ? ' (solo en plural)' : '';
    const m = (d: Meta['d'], x: string): Meta => ({ t: 'vocab', d, s: v.src, x, tags });

    const es3 = distractors(v, 'es', pool, 3);
    if (es3.length === 3) out.push(mc(m('easy', `${v.de} = ${v.es}.${plural}`), `¿Qué significa «${v.de}»?`, [v.es, ...es3]));

    if (noun && v.pl !== 'only') {
      out.push(mc(m('easy', `Es ${v.de}. ${articleTip(v.de)}`), `der, die o das? ___ ${v.de.split(' ').slice(1).join(' ')}`,
        ['der', 'die', 'das'], { answer: ['der', 'die', 'das'].indexOf(articleOf(v.de)), fixed: true }));
    }
    if (noun) {
      out.push(wr(m('medium', `${v.es} = ${v.de}. Los sustantivos se escriben con mayúscula y con su artículo.${plural}`),
        `Escribe en alemán, con artículo: «${v.es}»`, [v.de]));
    } else {
      const de3 = distractors(v, 'de', pool, 3);
      if (de3.length === 3) out.push(mc(m('medium', `«${v.es}» = ${v.de}.`), `¿Cómo se dice «${v.es}»?`, [v.de, ...de3]));
      if (!v.de.includes(' ')) out.push(wr(m('medium', `«${v.es}» = ${v.de}.`), `Escribe en alemán: «${v.es}»`, [v.de]));
    }
  }

  // Relacionar: grupos de 4 palabras de la misma categoría.
  const cats = new Map<string, Voc[]>();
  for (const v of VOCAB) if (!SKIP.has(v.cat)) cats.set(v.cat, [...(cats.get(v.cat) ?? []), v]);
  for (const [cat, list] of cats) {
    for (let i = 0; i + 4 <= list.length; i += 4) {
      const g = list.slice(i, i + 4);
      const meta: Meta = {
        t: 'vocab', d: CONCRETE.has(cat) ? 'easy' : 'medium', s: g[0].src, x: g.map((v) => `${v.de} = ${v.es}`).join(' · '),
        tags: readingTags(g.map((v) => v.de)),
      };
      out.push(mt(meta, 'Relaciona cada palabra con su traducción', g.map((v) => [v.de, v.es] as [string, string])));
    }
  }
  return out;
}
