// Preguntas GENERADAS por plantillas a partir de tablas gramaticales (artículos, conjugaciones, imperativo, posesivos,
// preposiciones de cambio y verbos separables). Cada combinación es correcta por construcción y tiene id estable,
// así el historial (no repetir, repasar lo fallado) funciona igual que con las preguntas escritas a mano.
import type { Difficulty, QMc, Topic } from '../../shared/types.ts';

type G = 'm' | 'f' | 'n';
interface Noun { de: string; g: G; es: string }
const PEOPLE: Noun[] = [
  { de: 'Mann', g: 'm', es: 'el hombre' }, { de: 'Lehrer', g: 'm', es: 'el profesor' }, { de: 'Bruder', g: 'm', es: 'el hermano' }, { de: 'Freund', g: 'm', es: 'el amigo' },
  { de: 'Nachbar', g: 'm', es: 'el vecino' }, { de: 'Vater', g: 'm', es: 'el padre' }, { de: 'Arzt', g: 'm', es: 'el médico' }, { de: 'Chef', g: 'm', es: 'el jefe' },
  { de: 'Frau', g: 'f', es: 'la mujer' }, { de: 'Lehrerin', g: 'f', es: 'la profesora' }, { de: 'Schwester', g: 'f', es: 'la hermana' }, { de: 'Freundin', g: 'f', es: 'la amiga' },
  { de: 'Nachbarin', g: 'f', es: 'la vecina' }, { de: 'Mutter', g: 'f', es: 'la madre' }, { de: 'Ärztin', g: 'f', es: 'la médica' }, { de: 'Oma', g: 'f', es: 'la abuela' },
  { de: 'Kind', g: 'n', es: 'el niño' }, { de: 'Baby', g: 'n', es: 'el bebé' }, { de: 'Mädchen', g: 'n', es: 'la chica' },
];
const THINGS: Noun[] = [
  { de: 'Tisch', g: 'm', es: 'la mesa' }, { de: 'Stuhl', g: 'm', es: 'la silla' }, { de: 'Computer', g: 'm', es: 'el ordenador' }, { de: 'Apfel', g: 'm', es: 'la manzana' },
  { de: 'Schlüssel', g: 'm', es: 'la llave' }, { de: 'Kuli', g: 'm', es: 'el boli' }, { de: 'Rucksack', g: 'm', es: 'la mochila' }, { de: 'Kaffee', g: 'm', es: 'el café' },
  { de: 'Lampe', g: 'f', es: 'la lámpara' }, { de: 'Tasche', g: 'f', es: 'el bolso' }, { de: 'Jacke', g: 'f', es: 'la chaqueta' }, { de: 'Uhr', g: 'f', es: 'el reloj' },
  { de: 'Brille', g: 'f', es: 'las gafas' }, { de: 'Zeitung', g: 'f', es: 'el periódico' }, { de: 'Flasche', g: 'f', es: 'la botella' }, { de: 'Karte', g: 'f', es: 'la tarjeta' },
  { de: 'Buch', g: 'n', es: 'el libro' }, { de: 'Handy', g: 'n', es: 'el móvil' }, { de: 'Fahrrad', g: 'n', es: 'la bici' }, { de: 'Heft', g: 'n', es: 'el cuaderno' },
  { de: 'Bild', g: 'n', es: 'el cuadro' }, { de: 'Geschenk', g: 'n', es: 'el regalo' }, { de: 'Glas', g: 'n', es: 'el vaso' }, { de: 'Brot', g: 'n', es: 'el pan' },
];
type Det = 'def' | 'indef' | 'kein' | 'mein';
const NOM: Record<Det, Record<G, string>> = { def: { m: 'der', f: 'die', n: 'das' }, indef: { m: 'ein', f: 'eine', n: 'ein' }, kein: { m: 'kein', f: 'keine', n: 'kein' }, mein: { m: 'mein', f: 'meine', n: 'mein' } };
const AKK: Record<Det, Record<G, string>> = { def: { m: 'den', f: 'die', n: 'das' }, indef: { m: 'einen', f: 'eine', n: 'ein' }, kein: { m: 'keinen', f: 'keine', n: 'kein' }, mein: { m: 'meinen', f: 'meine', n: 'mein' } };
const DAT: Record<Det, Record<G, string>> = { def: { m: 'dem', f: 'der', n: 'dem' }, indef: { m: 'einem', f: 'einer', n: 'einem' }, kein: { m: 'keinem', f: 'keiner', n: 'keinem' }, mein: { m: 'meinem', f: 'meiner', n: 'meinem' } };
const GEN_ES: Record<G, string> = { m: 'masculino', f: 'femenino', n: 'neutro' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Opciones únicas con la correcta en una posición que depende de la semilla (el juego además las baraja). */
function mc(id: string, topic: Topic, diff: Difficulty, prompt: string, correct: string, wrong: string[], explain: string): QMc {
  const opts = [...new Set([correct, ...wrong.filter((w) => w !== correct)])].slice(0, 4);
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const k = h % opts.length; [opts[0], opts[k]] = [opts[k], opts[0]];
  return { id, type: 'mc', topic, diff, src: 'trainer', prompt, options: opts, answer: opts.indexOf(correct), explain };
}

function akkusativ(): QMc[] {
  const out: QMc[] = [];
  const thingVerbs = [['kaufe', 'kaufen'], ['brauche', 'brauchen'], ['suche', 'suchen'], ['habe', 'haben'], ['nehme', 'nehmen'], ['finde', 'finden']];
  const personVerbs = [['besuche', 'besuchen'], ['frage', 'fragen'], ['sehe', 'sehen'], ['kenne', 'kennen'], ['rufe', 'anrufen (rufe … an)']];
  const dets: Det[] = ['def', 'indef', 'kein', 'mein'];
  THINGS.forEach((n, i) => dets.forEach((d) => {
    const [v, inf] = thingVerbs[(i + dets.indexOf(d)) % thingVerbs.length];
    const base = `${NOM[d][n.g]} ${n.de}`;
    out.push(mc(`gen-akk-t-${n.de}-${d}`, 'akkusativ', d === 'def' ? 'easy' : 'medium', `Ich ${v} ___ ${n.de}. (${base})`, AKK[d][n.g], [NOM[d][n.g], DAT[d][n.g], AKK[d][n.g === 'm' ? 'f' : 'm']],
      `«${inf}» lleva complemento directo en Akkusativ. ${cap(GEN_ES[n.g])}: ${base} → ${AKK[d][n.g]} ${n.de}.${n.g === 'm' ? ' Solo el masculino cambia en Akkusativ.' : ' En femenino y neutro el Akkusativ es igual que el nominativo.'}`));
  }));
  PEOPLE.forEach((n, i) => (['def', 'mein'] as Det[]).forEach((d) => {
    const [v, inf] = personVerbs[(i + (d === 'def' ? 0 : 2)) % personVerbs.length];
    const tail = v === 'rufe' ? ' an' : '';
    out.push(mc(`gen-akk-p-${n.de}-${d}`, 'akkusativ', 'medium', `Ich ${v} ___ ${n.de}${tail}. (${NOM[d][n.g]} ${n.de})`, AKK[d][n.g], [NOM[d][n.g], DAT[d][n.g], AKK[d][n.g === 'm' ? 'n' : 'm']],
      `«${inf}» lleva Akkusativ: ${NOM[d][n.g]} ${n.de} → ${AKK[d][n.g]} ${n.de}.`));
  }));
  return out;
}

function dativ(): QMc[] {
  const out: QMc[] = [];
  const verbs = [['helfe', 'helfen'], ['danke', 'danken'], ['antworte', 'antworten'], ['gratuliere', 'gratulieren']];
  PEOPLE.forEach((n, i) => (['def', 'indef', 'mein'] as Det[]).forEach((d, j) => {
    const [v, inf] = verbs[(i + j) % verbs.length];
    out.push(mc(`gen-dat-v-${n.de}-${d}`, 'dativ', d === 'def' ? 'easy' : 'medium', `Ich ${v} ___ ${n.de}. (${NOM[d][n.g]} ${n.de})`, DAT[d][n.g], [AKK[d][n.g], NOM[d][n.g], DAT[d][n.g === 'f' ? 'm' : 'f']],
      `«${inf}» exige Dativ: ${NOM[d][n.g]} ${n.de} → ${DAT[d][n.g]} ${n.de}. Dativ: der/das → dem, die → der.`));
  }));
  THINGS.forEach((n, i) => {
    const o = PEOPLE[i % PEOPLE.length];
    out.push(mc(`gen-dat-g-${n.de}`, 'dativ', 'medium', `${cap(NOM.def[n.g])} ${n.de} gehört ___ ${o.de}. (${NOM.def[o.g]} ${o.de})`, DAT.def[o.g], [NOM.def[o.g], AKK.def[o.g], DAT.def[o.g === 'f' ? 'm' : 'f']], `«gehören» exige Dativ: ${NOM.def[o.g]} ${o.de} → ${DAT.def[o.g]} ${o.de}.`));
  });
  const preps: [string, string][] = [['mit', 'con'], ['bei', 'en casa de / junto a'], ['von', 'de (procedencia)'], ['zu', 'a / hacia (sin contraer)']];
  PEOPLE.forEach((n, i) => {
    const [p, es] = preps[i % preps.length];
    if (p === 'zu') return;
    out.push(mc(`gen-dat-p-${p}-${n.de}`, 'dativ', 'easy', `Ich spreche ${p === 'mit' ? 'mit' : p === 'bei' ? 'oft bei' : 'gern von'} ___ ${n.de}. (${NOM.def[n.g]} ${n.de})`.replace('spreche oft bei', 'esse oft bei').replace('spreche gern von', 'erzähle gern von'), DAT.def[n.g], [AKK.def[n.g], NOM.def[n.g]],
      `«${p}» (${es}) siempre va con Dativ: ${NOM.def[n.g]} ${n.de} → ${DAT.def[n.g]} ${n.de}.`));
  });
  return out;
}

function praep(): QMc[] {
  const out: QMc[] = [];
  const places: Noun[] = [{ de: 'Tisch', g: 'm', es: '' }, { de: 'Stuhl', g: 'm', es: '' }, { de: 'Schrank', g: 'm', es: '' }, { de: 'Kühlschrank', g: 'm', es: '' }, { de: 'Tasche', g: 'f', es: '' }, { de: 'Kiste', g: 'f', es: '' }, { de: 'Regal', g: 'n', es: '' }, { de: 'Bett', g: 'n', es: '' }, { de: 'Sofa', g: 'n', es: '' }, { de: 'Fenster', g: 'n', es: '' }];
  const ok: Record<string, string[]> = { auf: ['Tisch', 'Stuhl', 'Schrank', 'Regal', 'Bett', 'Sofa'], in: ['Schrank', 'Kühlschrank', 'Tasche', 'Kiste', 'Regal'], unter: ['Tisch', 'Stuhl', 'Bett', 'Sofa'], neben: ['Tisch', 'Stuhl', 'Schrank', 'Bett', 'Sofa', 'Fenster', 'Regal'], hinter: ['Schrank', 'Sofa', 'Regal'] };
  for (const [p, list] of Object.entries(ok)) for (const name of list) {
    const n = places.find((x) => x.de === name)!;
    out.push(mc(`gen-praep-wo-${p}-${n.de}`, 'praep', 'medium', `Wo ist das Buch? – Es liegt ${p} ___ ${n.de}.`, DAT.def[n.g], [AKK.def[n.g], NOM.def[n.g]],
      `Wechselpräposition «${p}»: ¿dónde? (posición, liegen) → Dativ: ${DAT.def[n.g]} ${n.de}.`));
    out.push(mc(`gen-praep-wohin-${p}-${n.de}`, 'praep', 'medium', `Wohin legst du das Buch? – Ich lege es ${p} ___ ${n.de}.`, AKK.def[n.g], [DAT.def[n.g], NOM.def[n.g]],
      `Wechselpräposition «${p}»: ¿adónde? (movimiento, legen) → Akkusativ: ${AKK.def[n.g]} ${n.de}.`));
  }
  return out;
}

const PERSONS = [['ich', 0], ['du', 1], ['er', 2], ['sie (ella)', 2], ['wir', 3], ['ihr', 4], ['sie (ellos)', 5], ['Sie', 5]] as const;
const subj = (p: string) => p.replace(/ \(.*\)/, '');
function conj(topic: Topic, idp: string, verbs: { inf: string; forms: string[]; es: string; tail: string }[], diff: Difficulty): QMc[] {
  const out: QMc[] = [];
  for (const v of verbs) for (const [p, k] of PERSONS) {
    const correct = v.forms[k];
    const s = subj(p);
    out.push(mc(`gen-${idp}-${v.inf}-${p.replace(/\W/g, '')}`, topic, diff, `${cap(s)} ___ ${v.tail} (${v.inf})`, correct, [...new Set(v.forms.filter((f) => f !== correct))].slice(0, 3),
      `${v.inf} (${v.es}): ich ${v.forms[0]}, du ${v.forms[1]}, er/sie/es ${v.forms[2]}, wir ${v.forms[3]}, ihr ${v.forms[4]}, sie/Sie ${v.forms[5]}.`));
  }
  return out;
}

function modal(): QMc[] {
  return conj('modal', 'modal', [
    { inf: 'können', forms: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'], es: 'poder', tail: 'heute nicht kommen.' },
    { inf: 'müssen', forms: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'], es: 'tener que', tail: 'morgen früh arbeiten.' },
    { inf: 'wollen', forms: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'], es: 'querer', tail: 'Deutsch lernen.' },
    { inf: 'dürfen', forms: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'], es: 'poder (permiso)', tail: 'hier nicht rauchen.' },
    { inf: 'sollen', forms: ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'], es: 'deber', tail: 'mehr Wasser trinken.' },
    { inf: 'möchten', forms: ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten'], es: 'querer (cortés)', tail: 'einen Kaffee trinken.' },
  ], 'medium');
}

function praesens(): QMc[] {
  return conj('praesens', 'praes', [
    { inf: 'wohnen', forms: ['wohne', 'wohnst', 'wohnt', 'wohnen', 'wohnt', 'wohnen'], es: 'vivir', tail: 'in Berlin.' },
    { inf: 'lernen', forms: ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen'], es: 'aprender', tail: 'jeden Tag Deutsch.' },
    { inf: 'arbeiten', forms: ['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten'], es: 'trabajar', tail: 'im Krankenhaus.' },
    { inf: 'fahren', forms: ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], es: 'ir (en vehículo)', tail: 'mit dem Bus.' },
    { inf: 'lesen', forms: ['lese', 'liest', 'liest', 'lesen', 'lest', 'lesen'], es: 'leer', tail: 'gern Bücher.' },
    { inf: 'sprechen', forms: ['spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen'], es: 'hablar', tail: 'ein bisschen Spanisch.' },
    { inf: 'essen', forms: ['esse', 'isst', 'isst', 'essen', 'esst', 'essen'], es: 'comer', tail: 'oft Pizza.' },
    { inf: 'nehmen', forms: ['nehme', 'nimmst', 'nimmt', 'nehmen', 'nehmt', 'nehmen'], es: 'tomar / coger', tail: 'den Zug.' },
    { inf: 'schlafen', forms: ['schlafe', 'schläfst', 'schläft', 'schlafen', 'schlaft', 'schlafen'], es: 'dormir', tail: 'bis acht Uhr.' },
    { inf: 'sein', forms: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], es: 'ser / estar', tail: 'heute müde.' },
    { inf: 'haben', forms: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], es: 'tener', tail: 'keine Zeit.' },
    { inf: 'tanzen', forms: ['tanze', 'tanzt', 'tanzt', 'tanzen', 'tanzt', 'tanzen'], es: 'bailar', tail: 'am Samstag.' },
  ], 'easy');
}

function imperativ(): QMc[] {
  const out: QMc[] = [];
  const verbs: [string, string, string, string, string][] = [
    ['kommen', 'Komm', 'Kommt', 'Kommen Sie', 'bitte herein!'], ['lesen', 'Lies', 'Lest', 'Lesen Sie', 'den Text!'], ['sprechen', 'Sprich', 'Sprecht', 'Sprechen Sie', 'bitte langsamer!'],
    ['nehmen', 'Nimm', 'Nehmt', 'Nehmen Sie', 'Platz!'], ['essen', 'Iss', 'Esst', 'Essen Sie', 'mehr Obst!'], ['fahren', 'Fahr', 'Fahrt', 'Fahren Sie', 'vorsichtig!'],
    ['helfen', 'Hilf', 'Helft', 'Helfen Sie', 'mir bitte!'], ['warten', 'Warte', 'Wartet', 'Warten Sie', 'einen Moment!'], ['arbeiten', 'Arbeite', 'Arbeitet', 'Arbeiten Sie', 'nicht so viel!'],
    ['sein', 'Sei', 'Seid', 'Seien Sie', 'bitte leise!'], ['geben', 'Gib', 'Gebt', 'Geben Sie', 'mir das Buch!'], ['schlafen', 'Schlaf', 'Schlaft', 'Schlafen Sie', 'gut!'],
    ['öffnen', 'Öffne', 'Öffnet', 'Öffnen Sie', 'das Fenster!'], ['trinken', 'Trink', 'Trinkt', 'Trinken Sie', 'viel Wasser!'], ['machen', 'Mach', 'Macht', 'Machen Sie', 'die Tür zu!'],
  ];
  for (const [inf, du, ihr, sie, tail] of verbs) {
    const forms = [du, ihr, sie];
    (['du', 'ihr', 'Sie'] as const).forEach((who, i) => {
      out.push(mc(`gen-imp-${inf}-${who}`, 'imperativ', inf === 'sein' || du !== cap(inf.replace(/en$/, '')) ? 'medium' : 'easy', `Imperativ (${who}) de «${inf}»: ___ ${tail}`, forms[i], forms.filter((_, j) => j !== i).concat(`${cap(inf)}st`),
        `Imperativo de ${inf}: du → ${du}!, ihr → ${ihr}!, Sie → ${sie}!${['lesen', 'sprechen', 'nehmen', 'essen', 'helfen', 'geben'].includes(inf) ? ' Los verbos con cambio e→i/ie lo mantienen en la forma de «du».' : ''}`));
    });
  }
  return out;
}

function possessiv(): QMc[] {
  const out: QMc[] = [];
  const own: [string, string][] = [['ich', 'mein'], ['du', 'dein'], ['er', 'sein'], ['sie (ella)', 'ihr'], ['wir', 'unser'], ['ihr', 'euer'], ['Sie', 'Ihr']];
  const end = (stem: string, g: G, cas: 'nom' | 'akk') => { const s = stem === 'euer' && (g === 'f' || (cas === 'akk' && g === 'm')) ? 'eur' : stem; return s + (g === 'f' ? 'e' : cas === 'akk' && g === 'm' ? 'en' : ''); };
  THINGS.forEach((n, i) => {
    const [who, stem] = own[i % own.length];
    out.push(mc(`gen-poss-nom-${n.de}-${stem}`, 'possessiv', 'easy', `Das ist ___ ${n.de}. (${who})`, end(stem, n.g, 'nom'), [end(stem, n.g === 'f' ? 'm' : 'f', 'nom'), end(stem, 'm', 'akk'), `${stem}es`],
      `Posesivo de «${subj(who)}»: ${stem}-. Nominativo ${GEN_ES[n.g]}: ${end(stem, n.g, 'nom')} ${n.de}.`));
    const [who2, stem2] = own[(i + 3) % own.length];
    out.push(mc(`gen-poss-akk-${n.de}-${stem2}`, 'possessiv', 'medium', `Ich suche ___ ${n.de}. (${who2})`, end(stem2, n.g, 'akk'), [end(stem2, n.g, 'nom') === end(stem2, n.g, 'akk') ? end(stem2, 'm', 'akk') : end(stem2, n.g, 'nom'), end(stem2, 'f', 'nom'), `${stem2 === 'euer' ? 'eur' : stem2}em`],
      `«suchen» + Akkusativ. Posesivo de «${subj(who2)}» (${stem2}-) en Akkusativ ${GEN_ES[n.g]}: ${end(stem2, n.g, 'akk')} ${n.de}.`));
  });
  return out;
}

function trennbar(): QMc[] {
  const out: QMc[] = [];
  const verbs: [string, string, string, string][] = [
    ['aufstehen', 'stehe', 'auf', 'um sieben Uhr'], ['einkaufen', 'kaufe', 'ein', 'am Samstag'], ['anrufen', 'rufe', 'an', 'meine Mutter'], ['fernsehen', 'sehe', 'fern', 'am Abend'],
    ['aufräumen', 'räume', 'auf', 'mein Zimmer'], ['mitkommen', 'komme', 'mit', 'gern'], ['ankommen', 'komme', 'an', 'um acht Uhr'], ['abholen', 'hole', 'ab', 'dich'], ['einladen', 'lade', 'ein', 'meine Freunde'], ['anfangen', 'fange', 'an', 'um neun Uhr'],
  ];
  const persons: [string, (s: string) => string][] = [['Ich', (s) => s], ['Wir', (s) => s.replace(/e$/, 'en').replace(/ee$/, 'een')], ['Er', (s) => s.replace(/e$/, 't')]];
  for (const [inf, stem, pref, rest] of verbs) for (const [who, f] of persons) {
    let v = f(stem);
    if (who === 'Er') v = ({ stehe: 'steht', kaufe: 'kauft', rufe: 'ruft', sehe: 'sieht', räume: 'räumt', komme: 'kommt', hole: 'holt', lade: 'lädt', fange: 'fängt' } as Record<string, string>)[stem] ?? v;
    if (who === 'Wir') v = ({ stehe: 'stehen', kaufe: 'kaufen', rufe: 'rufen', sehe: 'sehen', räume: 'räumen', komme: 'kommen', hole: 'holen', lade: 'laden', fange: 'fangen' } as Record<string, string>)[stem] ?? v;
    const good = `${who} ${v} ${rest} ${pref}.`;
    out.push(mc(`gen-trenn-${inf}-${who}`, 'trennbar', 'medium', `Ordena bien «${inf}» (${who.toLowerCase()}): ¿qué frase es correcta?`, good, [`${who} ${pref}${v} ${rest}.`, `${who} ${v} ${pref} ${rest}.`, `${who} ${rest} ${v} ${pref}.`],
      `Verbo separable: el prefijo «${pref}-» se va al FINAL de la frase y el verbo conjugado queda en posición 2: ${good}`));
  }
  return out;
}

export function generatedQuestions(): QMc[] {
  return [...akkusativ(), ...dativ(), ...praep(), ...modal(), ...praesens(), ...imperativ(), ...possessiv(), ...trennbar()];
}
