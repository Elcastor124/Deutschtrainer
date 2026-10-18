// Gramática A1–A2 general (contenido nuevo de esta app, fuente «a1»): artículos en Akkusativ y Dativ,
// preposiciones, posesivos, verbos modales, presente con cambio de vocal, Perfekt de verbos nuevos,
// imperativo, comparativo, verbos separables, kein/nicht, W-Fragen, horas, números y días.
import type { Question } from '../../shared/types.ts';
import { VOCAB, articleOf, deNum } from '../../shared/vocab.ts';
import { er, gp, mc, mt, od, rng, wr, type Meta } from './h.ts';

const M = (t: Meta['t'], d: Meta['d'], x: string, extra: Partial<Meta> = {}): Meta => ({ t, d, s: 'a1', x, ...extra });
type Art = 'der' | 'die' | 'das';
const nounsOf = (...cats: string[]) => VOCAB.filter((v) => v.src === 'a1' && cats.includes(v.cat) && /^(der|die|das) /.test(v.de) && v.pl !== 'only')
  .map((v) => ({ art: articleOf(v.de) as Art, noun: v.de.slice(4), es: v.es, de: v.de }));
const pick = <T,>(list: T[], seed: string) => list[Math.floor(rng(seed)() * list.length)];

const AKK: Record<Art, { def: string; indef: string; neg: string }> = {
  der: { def: 'den', indef: 'einen', neg: 'keinen' }, die: { def: 'die', indef: 'eine', neg: 'keine' }, das: { def: 'das', indef: 'ein', neg: 'kein' },
};
const DAT: Record<Art, { def: string; indef: string; mein: string }> = {
  der: { def: 'dem', indef: 'einem', mein: 'meinem' }, die: { def: 'der', indef: 'einer', mein: 'meiner' }, das: { def: 'dem', indef: 'einem', mein: 'meinem' },
};
/** Sustantivos que no se cuentan: sin «ein» (se usan con artículo determinado o kein). */
const UNCOUNT = new Set(['Butter', 'Käse', 'Milch', 'Kaffee', 'Tee', 'Wasser', 'Reis', 'Fleisch', 'Zucker', 'Salz', 'Schokolade', 'Eis', 'Musik', 'Sport', 'Fußball', 'Wetter', 'Regen', 'Schnee', 'Wind', 'Arbeit', 'Post', 'Sonne', 'Frühling', 'Sommer', 'Herbst', 'Winter', 'Frühstück', 'Mittagessen', 'Abendessen']);

export function a1GrammarQuestions(): Question[] {
  const q: Question[] = [];

  // ═════════ AKKUSATIV: artículos con verbos de compra, búsqueda y ropa ═════════
  type Series = 'def' | 'indef' | 'neg';
  const ALL: Series[] = ['def', 'indef', 'neg'];
  // [categorías, frases, series permitidas, sustantivos excluidos]: solo combinaciones que suenan naturales.
  const AKK_FRAMES: [string[], string[], Series[], string[]][] = [
    [['food'], ['Ich kaufe ___ {N}.', 'Wir brauchen ___ {N}.', 'Möchtest du ___ {N}?', 'Er bestellt ___ {N}.'], ALL, []],
    [['meal'], ['Können Sie mir bitte ___ {N} bringen?'], ['def', 'indef'], ['Frühstück', 'Mittagessen', 'Abendessen', 'Restaurant']],
    [['clothes'], ['Ich suche ___ {N}.', 'Sie kauft ___ {N}.', 'Brauchst du ___ {N}?'], ALL, []],
    [['furniture'], ['Wir brauchen ___ {N}.', 'Ich kaufe ___ {N} für mein Zimmer.'], ALL, ['Fenster', 'Tür']],
    [['furniture'], ['Mach bitte ___ {N} auf!'], ['def'], ['Tisch', 'Stuhl', 'Bett', 'Schrank', 'Regal', 'Lampe', 'Kühlschrank', 'Teppich']],
    [['free', 'city2'], ['Kennst du ___ {N}?', 'Wir suchen ___ {N}.'], ['def'], ['Sport', 'Fußball', 'Hobby', 'Preis', 'Ampel', 'Musik']],
  ];
  const DEF_ONLY = new Set(['Speisekarte', 'Rechnung']);
  for (const [cats, frames, allowed, skip] of AKK_FRAMES) {
    for (const n of nounsOf(...cats).filter((x) => !skip.includes(x.noun))) {
      const frame = pick(frames, n.de);
      const okSeries = allowed.filter((x) => !(x === 'indef' && (UNCOUNT.has(n.noun))) && !(DEF_ONLY.has(n.noun) && x !== 'def'));
      const series: Series = pick(okSeries, n.de + 'series');
      const opts = series === 'def' ? ['den', 'die', 'das'] : series === 'indef' ? ['einen', 'eine', 'ein'] : ['keinen', 'keine', 'kein'];
      const right = AKK[n.art][series];
      const text = frame.replace('{N}', n.noun);
      q.push(mc(M('akkusativ', n.art === 'der' ? 'medium' : 'easy', `${n.de} (${n.es}) → Akkusativ: ${right} ${n.noun}. Solo cambia el masculino: der → den, ein → einen, kein → keinen.`),
        `Akkusativ: ¿qué artículo falta? ${text}`, opts, { answer: opts.indexOf(right), fixed: true }));
    }
  }

  // ═════════ DATIV: aus, nach, mit, bei personas y lugares ═════════
  const datRooms = nounsOf('house', 'city2').filter((n) => !['Post', 'Platz', 'Straße', 'Ampel', 'Brücke', 'Preis', 'Treppe', 'Garten', 'Balkon', 'Markt', 'Flughafen'].includes(n.noun));
  for (const n of datRooms) {
    const right = DAT[n.art].def;
    q.push(mc(M('dativ', n.art === 'die' ? 'medium' : 'easy', `aus + Dativ: ${n.art} ${n.noun} → aus ${right} ${n.noun}. Dativ: der/das → dem, die → der.`),
      `Dativ: Ich komme gerade aus ___ ${n.noun}.`, ['dem', 'der', 'den'], { answer: ['dem', 'der', 'den'].indexOf(right), fixed: true }));
  }
  for (const n of nounsOf('meal').filter((x) => ['Frühstück', 'Mittagessen', 'Abendessen'].includes(x.noun))
    .concat(nounsOf('free').filter((x) => ['Film', 'Konzert', 'Spiel', 'Party'].includes(x.noun)))) {
    const right = DAT[n.art].def;
    q.push(mc(M('dativ', n.art === 'die' ? 'medium' : 'easy', `nach (después de) + Dativ: nach ${right} ${n.noun}.`),
      `Dativ: Nach ___ ${n.noun} gehen wir spazieren.`, ['dem', 'der', 'den'], { answer: ['dem', 'der', 'den'].indexOf(right), fixed: true }));
  }
  for (const n of nounsOf('jobs').filter((x) => !['Beruf', 'Arbeit', 'Büro'].includes(x.noun))) {
    const right = DAT[n.art].def;
    q.push(mc(M('dativ', n.art === 'die' ? 'medium' : 'easy', `mit + Dativ: mit ${right} ${n.noun}. Masculino y neutro → dem; femenino → der.`),
      `Dativ: Ich spreche mit ___ ${n.noun}.`, ['dem', 'der', 'den', 'die'], { answer: ['dem', 'der', 'den', 'die'].indexOf(right), fixed: true }));
  }
  const DAT_GAPS: [string, string[], string][] = [
    ['Ich wohne seit ___ Jahr in Berlin. (ein)', ['einem'], 'seit + Dativ: das Jahr → seit einem Jahr.'],
    ['Wir fahren mit ___ Fahrrad zum Park. (das)', ['dem'], 'mit + Dativ: das Fahrrad → mit dem Fahrrad.'],
    ['Nach ___ Arbeit gehe ich ins Schwimmbad. (die)', ['der'], 'nach + Dativ: die Arbeit → nach der Arbeit.'],
    ['Das Café ist gegenüber ___ Kirche. (die)', ['der'], 'gegenüber + Dativ: die Kirche → gegenüber der Kirche.'],
    ['Ich gehe mit ___ Freundin ins Konzert. (meine)', ['meiner'], 'mit + Dativ femenino: meine → meiner.'],
    ['Er wohnt bei ___ Eltern. (seine)', ['seinen'], 'bei + Dativ plural: seine → seinen.'],
    ['Wir essen mit ___ Kindern im Restaurant. (unsere)', ['unseren'], 'Dativ plural: unsere → unseren, y el sustantivo +n: Kindern.'],
    ['Sie kommt aus ___ Schweiz. (die)', ['der'], 'Países femeninos llevan artículo: aus der Schweiz.'],
    ['Ich gebe ___ Lehrerin das Heft. (die)', ['der'], 'geben + Dativ (a quién): der Lehrerin.'],
    ['Der Kellner bringt ___ Gast die Rechnung. (der)', ['dem'], 'bringen + Dativ (a quién): dem Gast.'],
  ];
  for (const [text, gaps, x] of DAT_GAPS) q.push(gp(M('dativ', 'medium', x), 'Dativ: completa con la forma correcta', text, [gaps]));

  // ═════════ PRÄPOSITIONEN: ¿dónde? (Dativ) o ¿adónde? (Akkusativ) ═════════
  const WECHSEL: [string, Art, string[]][] = [
    ['Tisch', 'der', ['auf', 'unter', 'neben']], ['Stuhl', 'der', ['auf', 'unter', 'neben']], ['Bett', 'das', ['auf', 'unter', 'neben']],
    ['Schrank', 'der', ['auf', 'neben', 'hinter']], ['Regal', 'das', ['auf', 'neben']], ['Sofa', 'das', ['auf', 'hinter', 'neben']],
    ['Kühlschrank', 'der', ['auf', 'neben']], ['Fenster', 'das', ['vor', 'neben']], ['Lampe', 'die', ['neben', 'unter']], ['Tür', 'die', ['hinter', 'neben', 'vor']],
    ['Teppich', 'der', ['auf', 'unter']],
  ];
  const WO = ['Das Buch liegt {P} ___ {N}.', 'Die Tasche steht {P} ___ {N}.', 'Die Katze schläft {P} ___ {N}.'];
  const WOHIN = ['Ich lege das Buch {P} ___ {N}.', 'Ich stelle die Tasche {P} ___ {N}.', 'Die Katze springt {P} ___ {N}.'];
  WECHSEL.forEach(([noun, art, preps], k) => {
    preps.forEach((p, j) => {
      const where = (k + j) % 2 === 0;
      const frame = (where ? WO : WOHIN)[(k + j) % 3];
      const right = where ? DAT[art].def : AKK[art].def;
      const opts = art === 'die' ? ['der', 'die', 'den'] : art === 'der' ? ['dem', 'den', 'der'] : ['dem', 'das', 'den'];
      q.push(mc(M('praep', 'medium', `${where ? '¿Dónde? (liegen, stehen, schlafen: posición) → Dativ' : '¿Adónde? (legen, stellen, springen: movimiento) → Akkusativ'}: ${p} ${right} ${noun}.`),
        `Wechselpräposition: ${frame.replace('{P}', p).replace('{N}', noun)}`, opts, { answer: opts.indexOf(right), fixed: true }));
    });
  });
  q.push(mc(M('praep', 'easy', 'liegen, stehen, sitzen, hängen = posición (¿dónde?) → Dativ. legen, stellen, setzen = movimiento (¿adónde?) → Akkusativ.'),
    '«Das Handy liegt auf dem Tisch.» ¿Por qué «dem»?', ['Porque responde a ¿dónde? (posición)', 'Porque responde a ¿adónde? (movimiento)', 'Porque «Tisch» es femenino']));
  const AKK_PREP: [string, string, string][] = [
    ['Das Geschenk ist für ___ Vater. (mein)', 'meinen', 'für + Akkusativ: der Vater → für meinen Vater.'],
    ['Ich gehe nie ohne ___ Brille aus dem Haus. (meine)', 'meine', 'ohne + Akkusativ: die Brille → ohne meine Brille (el femenino no cambia).'],
    ['Wir laufen durch ___ Park. (der)', 'den', 'durch + Akkusativ: der Park → durch den Park.'],
    ['Die Kinder sitzen um ___ Tisch. (der)', 'den', 'um + Akkusativ: der Tisch → um den Tisch.'],
    ['Wir spielen heute gegen ___ Team aus Köln. (das)', 'das', 'gegen + Akkusativ: das Team → gegen das Team (el neutro no cambia).'],
    ['Ich habe ein Geschenk für ___ Lehrer. (unser)', 'unseren', 'für + Akkusativ: der Lehrer → für unseren Lehrer.'],
    ['Wir fahren durch ___ Stadt. (die)', 'die', 'durch + Akkusativ: die Stadt → durch die Stadt.'],
  ];
  for (const [text, a, x] of AKK_PREP) q.push(gp(M('praep', a === 'die' || a === 'das' || a === 'meine' ? 'easy' : 'medium', x), 'Preposición + Akkusativ (für, ohne, durch, um, gegen): completa', text, [[a]]));
  q.push(mt(M('praep', 'medium', 'Siempre Akkusativ: für, ohne, durch, um, gegen. Siempre Dativ: mit, nach, bei, seit, von, zu, aus.'), 'Relaciona la preposición con su caso',
    [['für', 'Akkusativ'], ['mit', 'Dativ'], ['ohne', 'Akkusativ (sin)'], ['bei', 'Dativ (en casa de)']]));

  // ═════════ POSSESSIVARTIKEL ═════════
  const POS_NOM: [string, string, string][] = [
    ['Das ist ___ Bruder. (de él)', 'sein', 'er → sein: sein Bruder.'],
    ['Das ist ___ Mutter. (de ella)', 'ihre', 'sie (ella) → ihr; die Mutter → ihre Mutter.'],
    ['Das ist ___ Haus. (nuestro)', 'unser', 'wir → unser; das Haus → unser Haus.'],
    ['Ist das ___ Handy? (tuyo)', 'dein', 'du → dein; das Handy → dein Handy.'],
    ['Wo ist ___ Wohnung? (vuestra)', 'eure', 'ihr → euer; die Wohnung → eure (euer pierde la -e-: eure).'],
    ['Das sind ___ Eltern. (míos)', 'meine', 'Plural → meine Eltern.'],
    ['Wie ist ___ Name? (de usted)', 'Ihr', 'Sie → Ihr (con mayúscula): Ihr Name.'],
    ['___ Katze heißt Mimi. (de ellos)', 'Ihre', 'sie (ellos) → ihr; die Katze → ihre (al principio de frase, con mayúscula).'],
    ['Das ist ___ Schlüssel. (de ella)', 'ihr', 'sie (ella) → ihr; der Schlüssel → ihr Schlüssel (Nominativ masculino, sin terminación).'],
    ['Das ist ___ Fahrrad. (de él)', 'sein', 'er → sein; das Fahrrad → sein Fahrrad.'],
  ];
  for (const [text, a, x] of POS_NOM) q.push(gp(M('possessiv', a === 'eure' || a === 'Ihre' ? 'medium' : 'easy', x), 'Possessivartikel (Nominativ): completa', text, [[a]]));
  const POS_AKK: [string, string, string][] = [
    ['Ich suche ___ Schlüssel. (mi)', 'meinen', 'der Schlüssel en Akkusativ → meinen Schlüssel.'],
    ['Hast du ___ Jacke? (tu)', 'deine', 'die Jacke → deine Jacke (el femenino no cambia en Akkusativ).'],
    ['Er ruft ___ Mutter an. (su, de él)', 'seine', 'er → sein; die Mutter → seine Mutter.'],
    ['Sie besucht ___ Bruder. (su, de ella)', 'ihren', 'sie (ella) → ihr; der Bruder en Akkusativ → ihren Bruder.'],
    ['Wir verkaufen ___ Auto. (nuestro)', 'unser', 'das Auto → unser Auto (el neutro no cambia).'],
    ['Habt ihr ___ Hausaufgaben gemacht? (vuestros)', 'eure', 'Plural: euer → eure Hausaufgaben.'],
    ['Ich liebe ___ Hund. (mi)', 'meinen', 'der Hund en Akkusativ → meinen Hund.'],
    ['Haben Sie ___ Ausweis dabei? (su, de usted)', 'Ihren', 'Sie → Ihr; der Ausweis en Akkusativ → Ihren Ausweis.'],
  ];
  for (const [text, a, x] of POS_AKK) q.push(gp(M('possessiv', a.endsWith('en') ? 'medium' : 'easy', x), 'Possessivartikel (Akkusativ): completa', text, [[a]]));
  const POS_DAT: [string, string, string][] = [
    ['Ich fahre mit ___ Vater in die Stadt. (mi)', 'meinem', 'mit + Dativ masculino: meinem Vater.'],
    ['Sie wohnt bei ___ Tante. (su, de ella)', 'ihrer', 'bei + Dativ femenino: ihrer Tante.'],
    ['Er spricht mit ___ Lehrerin. (su, de él)', 'seiner', 'mit + Dativ femenino: seiner Lehrerin.'],
    ['Wir gehen mit ___ Kind zum Arzt. (nuestro)', 'unserem', 'mit + Dativ neutro: unserem Kind.'],
  ];
  for (const [text, a, x] of POS_DAT) q.push(gp(M('possessiv', 'medium', x), 'Possessivartikel (Dativ): completa', text, [[a]]));
  q.push(mt(M('possessiv', 'easy', 'ich → mein · du → dein · er/es → sein · sie → ihr · wir → unser · ihr → euer · Sie → Ihr.'), 'Relaciona el pronombre con su posesivo',
    [['ich', 'mein'], ['du', 'dein'], ['er', 'sein'], ['wir', 'unser']]));
  q.push(mt(M('possessiv', 'medium', 'sie (ella) y sie (ellos) → ihr; Sie (usted) → Ihr con mayúscula; ihr (vosotros) → euer.'), 'Relaciona el pronombre con su posesivo',
    [['sie (ella)', 'ihr'], ['ihr (vosotros)', 'euer'], ['Sie (usted)', 'Ihr'], ['es', 'sein']]));
  q.push(mc(M('possessiv', 'medium', 'sie (ella) → ihr. «sein» sería de él.'), '«Anna sucht ___ Handy.» (su = de Anna)', ['ihr', 'sein', 'ihre', 'seine']));
  q.push(er(M('possessiv', 'medium', 'Paul es él → sein (no ihr).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Paul besucht [ihre|seine] Oma am Sonntag.'));
  q.push(er(M('possessiv', 'medium', 'der Bruder en Akkusativ → meinen.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich besuche [mein|meinen] Bruder in Madrid.'));

  // ═════════ MODALVERBEN ═════════
  const MODAL: [string, string, string[]][] = [
    ['können', 'poder / saber hacer', ['kann', 'kannst', 'kann', 'können', 'könnt', 'können']],
    ['müssen', 'tener que', ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen']],
    ['wollen', 'querer', ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen']],
    ['dürfen', 'poder (tener permiso)', ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen']],
    ['sollen', 'deber (lo dice otra persona)', ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen']],
    ['möchten', 'quisiera / me gustaría', ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten']],
  ];
  const MODAL_SENT: Record<string, string[]> = {
    können: ['Ich ___ gut kochen.', 'Du ___ sehr gut tanzen.', 'Er ___ heute leider nicht kommen.', 'Wir ___ am Samstag ins Kino gehen.', 'Ihr ___ mir helfen, oder?', 'Meine Eltern ___ kein Deutsch sprechen.'],
    müssen: ['Ich ___ heute lange arbeiten.', 'Du ___ mehr Wasser trinken.', 'Sie (ella) ___ um sieben Uhr aufstehen.', 'Wir ___ jetzt nach Hause gehen.', 'Ihr ___ eure Hausaufgaben machen.', 'Die Kinder ___ um acht Uhr schlafen.'],
    wollen: ['Ich ___ Ärztin werden.', 'Du ___ immer Pizza essen!', 'Er ___ ein neues Fahrrad kaufen.', 'Wir ___ im Sommer nach Spanien fahren.', 'Ihr ___ heute Abend tanzen gehen.', 'Meine Freunde ___ ein Konzert besuchen.'],
    dürfen: ['Hier ___ ich nicht parken.', 'Du ___ heute länger fernsehen.', 'Im Krankenhaus ___ man nicht laut sprechen.', 'Wir ___ im Unterricht kein Handy benutzen.', 'Ihr ___ jetzt nach Hause gehen.', 'Die Kinder ___ ein Eis essen.'],
    sollen: ['Ich ___ drei Tage im Bett bleiben.', 'Du ___ deine Mutter anrufen.', 'Er ___ mehr Sport machen, sagt der Arzt.', 'Wir ___ das Formular unterschreiben.', 'Ihr ___ pünktlich sein.', 'Sie (ellos) ___ den Text lesen.'],
    möchten: ['Ich ___ einen Kaffee, bitte.', 'Was ___ du essen?', 'Er ___ ein Konto eröffnen.', 'Wir ___ am Wochenende wandern.', '___ ihr noch etwas essen?', 'Meine Eltern ___ eine neue Wohnung.'],
  };
  for (const [inf, es, forms] of MODAL) {
    MODAL_SENT[inf].forEach((text, i) => {
      const irregularSingular = inf !== 'möchten' && inf !== 'sollen' && i !== 3 && i !== 5 && i !== 4;
      q.push(gp(M('modal', irregularSingular ? 'medium' : 'easy', `${inf} (${es}): ${['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'][i]} ${forms[i]}. El infinitivo va al final de la frase.`),
        `Modalverb «${inf}»: completa`, text, [[forms[i]]]));
    });
  }
  q.push(mt(M('modal', 'easy', 'können = poder/saber · müssen = tener que · wollen = querer · dürfen = tener permiso.'), 'Relaciona cada verbo modal con su significado',
    [['können', 'poder / saber hacer'], ['müssen', 'tener que'], ['wollen', 'querer'], ['dürfen', 'tener permiso']]));
  q.push(mt(M('modal', 'medium', 'sollen = deber (otra persona lo dice) · möchten = quisiera (cortés) · nicht dürfen = estar prohibido · nicht müssen = no hace falta.'), 'Relaciona cada forma con su significado',
    [['sollen', 'deber (me lo dicen)'], ['möchten', 'quisiera'], ['nicht dürfen', 'estar prohibido'], ['nicht müssen', 'no hace falta']]));
  q.push(mc(M('modal', 'medium', '«Du musst nicht kommen» = no hace falta que vengas. «Du darfst nicht kommen» = tienes prohibido venir.'), '«Du musst nicht kommen» significa…',
    ['No hace falta que vengas.', 'No puedes venir (está prohibido).', 'No quieres venir.']));
  q.push(mc(M('modal', 'easy', 'En el singular de los modales, ich y er son iguales y no llevan -t: ich kann, er kann.'), '¿Cuál es correcta?', ['Er kann gut schwimmen.', 'Er kannt gut schwimmen.', 'Er können gut schwimmen.']));
  const MODAL_ORDER: [string, string[]][] = [
    ['Ich muss heute meine Hausaufgaben machen.', ['Heute muss ich meine Hausaufgaben machen.']],
    ['Wir wollen am Samstag ins Kino gehen.', ['Am Samstag wollen wir ins Kino gehen.']],
    ['Kannst du mir bitte helfen?', []],
    ['Im Krankenhaus darf man nicht laut sprechen.', ['Man darf im Krankenhaus nicht laut sprechen.']],
    ['Ich möchte einen Tee mit Zucker trinken.', []],
    ['Du sollst deine Oma anrufen.', []],
    ['Morgen muss er sehr früh aufstehen.', ['Er muss morgen sehr früh aufstehen.']],
    ['Wir können heute Abend zusammen kochen.', ['Heute Abend können wir zusammen kochen.']],
  ];
  for (const [s, alts] of MODAL_ORDER) q.push(od(M('modal', 'medium', `${s} El modal va en posición 2 y el infinitivo, al final.`, { tags: ['fix'] }), 'Ordena la frase (verbo modal)', s, alts));
  q.push(er(M('modal', 'medium', 'Con verbo modal, el segundo verbo va al final en infinitivo: schwimmen.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich kann sehr gut [schwimme|schwimmen].'));
  q.push(er(M('modal', 'medium', 'müssen con du: du musst.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Du [muss|musst] mehr lernen.'));
  q.push(er(M('modal', 'medium', 'wollen con er: er will (sin -t).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Er [willt|will] ein Eis essen.'));

  // ═════════ PRÄSENS: cambios de vocal y verbos especiales ═════════
  const PR: [string, string, string, string, string][] = [
    // inf, es, du, er, nota
    ['essen', 'comer', 'isst', 'isst', 'e → i: du isst, er isst.'],
    ['lesen', 'leer', 'liest', 'liest', 'e → ie: du liest, er liest.'],
    ['sehen', 'ver', 'siehst', 'sieht', 'e → ie: du siehst, er sieht.'],
    ['schlafen', 'dormir', 'schläfst', 'schläft', 'a → ä: du schläfst, er schläft.'],
    ['nehmen', 'tomar', 'nimmst', 'nimmt', 'irregular: du nimmst, er nimmt.'],
    ['geben', 'dar', 'gibst', 'gibt', 'e → i: du gibst, er gibt.'],
    ['helfen', 'ayudar', 'hilfst', 'hilft', 'e → i: du hilfst, er hilft.'],
    ['treffen', 'quedar con', 'triffst', 'trifft', 'e → i: du triffst, er trifft.'],
    ['laufen', 'correr', 'läufst', 'läuft', 'au → äu: du läufst, er läuft.'],
    ['tragen', 'llevar puesto', 'trägst', 'trägt', 'a → ä: du trägst, er trägt.'],
    ['waschen', 'lavar', 'wäschst', 'wäscht', 'a → ä: du wäschst, er wäscht.'],
    ['tanzen', 'bailar', 'tanzt', 'tanzt', 'raíz en -z: du tanzt (solo -t, no -st).'],
    ['heißen', 'llamarse', 'heißt', 'heißt', 'raíz en -ß: du heißt (solo -t).'],
    ['warten', 'esperar', 'wartest', 'wartet', 'raíz en -t: se añade -e-: du wartest, er wartet.'],
    ['finden', 'encontrar', 'findest', 'findet', 'raíz en -d: se añade -e-: du findest, er findet.'],
    ['öffnen', 'abrir', 'öffnest', 'öffnet', 'raíz en -n tras consonante: du öffnest, er öffnet.'],
  ];
  const PR_DU: Record<string, string> = {
    essen: 'Du ___ gern Pizza, oder?', lesen: '___ du gern Bücher?', sehen: 'Du ___ müde aus.', schlafen: 'Du ___ zu wenig.', nehmen: '___ du den Bus oder die U-Bahn?',
    geben: 'Du ___ mir das Buch, und ich gebe dir mein Heft.', helfen: '___ du mir bitte?', treffen: 'Wann ___ du deine Freunde?', laufen: 'Du ___ sehr schnell!', tragen: 'Du ___ heute eine schöne Jacke.',
    waschen: '___ du heute die Wäsche?', tanzen: 'Du ___ sehr gut!', heißen: 'Wie ___ du?', warten: 'Du ___ schon lange, oder?', finden: 'Wie ___ du das Buch?', öffnen: '___ du bitte das Fenster?',
  };
  const PR_ER: Record<string, string> = {
    essen: 'Mein Bruder ___ kein Fleisch.', lesen: 'Anna ___ jeden Abend die Zeitung.', sehen: 'Er ___ am Abend fern.', schlafen: 'Das Baby ___ schon.', nehmen: 'Sie (ella) ___ eine Tablette.',
    geben: 'Der Lehrer ___ uns viele Hausaufgaben.', helfen: 'Mein Vater ___ mir bei den Hausaufgaben.', treffen: 'Paul ___ heute seine Oma.', laufen: 'Der Hund ___ in den Park.', tragen: 'Sie (ella) ___ immer eine Brille.',
    waschen: 'Er ___ sein Auto am Samstag.', tanzen: 'Lisa ___ jeden Freitag Salsa.', heißen: 'Mein Lehrer ___ Herr Weber.', warten: 'Sie (ella) ___ an der Haltestelle.', finden: 'Er ___ seinen Schlüssel nicht.', öffnen: 'Die Bank ___ um neun Uhr.',
  };
  for (const [inf, es, du, erf, note] of PR) {
    const changes = du !== inf.replace(/en$/, 'st');
    q.push(gp(M('praesens', changes ? 'medium' : 'easy', `${inf} (${es}): ${note}`), `Präsens de «${inf}»: completa (du)`, PR_DU[inf], [[du]]));
    q.push(gp(M('praesens', changes ? 'medium' : 'easy', `${inf} (${es}): ${note}`), `Präsens de «${inf}»: completa (er/sie/es)`, PR_ER[inf], [[erf]]));
  }
  q.push(gp(M('praesens', 'medium', 'wissen es irregular: ich weiß, du weißt, er weiß.'), 'Präsens de «wissen»: completa', 'Ich ___ es nicht.', [['weiß']]));
  q.push(gp(M('praesens', 'medium', 'wissen: er weiß (igual que ich).'), 'Präsens de «wissen»: completa', '___ er, wo der Bahnhof ist?', [['Weiß']]));
  q.push(gp(M('praesens', 'medium', 'mögen: ich mag, du magst, er mag.'), 'Präsens de «mögen»: completa', 'Ich ___ keinen Fisch.', [['mag']]));
  q.push(gp(M('praesens', 'medium', 'mögen: du magst.'), 'Präsens de «mögen»: completa', '___ du Schokolade?', [['Magst']]));
  q.push(mc(M('praesens', 'medium', 'wissen = saber un dato. kennen = conocer (personas, lugares).'), '«¿Conoces a mi hermano?» →', ['Kennst du meinen Bruder?', 'Weißt du meinen Bruder?', 'Kannst du meinen Bruder?']));
  q.push(mc(M('praesens', 'medium', 'wissen = saber un dato: Weißt du, wie spät es ist?'), '«¿Sabes qué hora es?» →', ['Weißt du, wie spät es ist?', 'Kennst du, wie spät es ist?', 'Kannst du, wie spät es ist?']));

  // ═════════ PERFEKT de verbos nuevos ═════════
  const PV: [string, 'haben' | 'sein', string, string][] = [
    ['kochen', 'haben', 'gekocht', 'cocinar'], ['tanzen', 'haben', 'getanzt', 'bailar'], ['singen', 'haben', 'gesungen', 'cantar'],
    ['helfen', 'haben', 'geholfen', 'ayudar'], ['nehmen', 'haben', 'genommen', 'tomar'], ['geben', 'haben', 'gegeben', 'dar'],
    ['bringen', 'haben', 'gebracht', 'llevar / traer'], ['denken', 'haben', 'gedacht', 'pensar'], ['wissen', 'haben', 'gewusst', 'saber'],
    ['kennen', 'haben', 'gekannt', 'conocer'], ['fragen', 'haben', 'gefragt', 'preguntar'], ['antworten', 'haben', 'geantwortet', 'responder'],
    ['warten', 'haben', 'gewartet', 'esperar'], ['suchen', 'haben', 'gesucht', 'buscar'], ['öffnen', 'haben', 'geöffnet', 'abrir'],
    ['schließen', 'haben', 'geschlossen', 'cerrar'], ['beginnen', 'haben', 'begonnen', 'empezar'], ['bezahlen', 'haben', 'bezahlt', 'pagar'],
    ['verkaufen', 'haben', 'verkauft', 'vender'], ['frühstücken', 'haben', 'gefrühstückt', 'desayunar'], ['aufräumen', 'haben', 'aufgeräumt', 'ordenar'],
    ['anfangen', 'haben', 'angefangen', 'comenzar'], ['mitbringen', 'haben', 'mitgebracht', 'traer'], ['abholen', 'haben', 'abgeholt', 'recoger'],
    ['wandern', 'sein', 'gewandert', 'hacer senderismo'], ['ankommen', 'sein', 'angekommen', 'llegar'], ['abfahren', 'sein', 'abgefahren', 'salir (tren, bus)'],
    ['zurückkommen', 'sein', 'zurückgekommen', 'volver'], ['aussteigen', 'sein', 'ausgestiegen', 'bajarse'], ['einsteigen', 'sein', 'eingestiegen', 'subirse'],
    ['umsteigen', 'sein', 'umgestiegen', 'hacer transbordo'],
  ];
  const fam = (inf: string, part: string) => /^(be|ver|ent|er|zer|ge)/.test(inf) && !part.startsWith('ge') ? 'prefijo inseparable: sin ge-'
    : /^(auf|an|mit|ab|aus|ein|um|zurück)/.test(inf) ? 'separable: el ge- va en medio' : part.endsWith('en') ? 'irregular: ge-…-en' : 'regular: ge-…-t';
  for (const [inf, aux, part, es] of PV) {
    const full = `${aux === 'sein' ? 'ist' : 'hat'} ${part}`;
    q.push(mc(M('perfekt', aux === 'sein' ? 'medium' : 'easy', `${inf} → ${full}. sein = movimiento de A a B o cambio de estado; haben = el resto.`, { tags: ['tf'] }),
      `Perfekt de «${inf}» (${es}): ¿haben o sein?`, ['haben', 'sein'], { answer: aux === 'haben' ? 0 : 1, fixed: true }));
    q.push(wr(M('perfekt', 'medium', `${inf} → ${part} (${fam(inf, part)}).`), `Partizip II de «${inf}» (${es})`, [part], { strict: true }));
  }
  const PG: [string, string, string[], string][] = [
    ['kochen', 'Gestern ___ ich Spaghetti ___.', ['habe', 'gekocht'], 'kochen → hat gekocht. Inversión: Gestern habe ich…'],
    ['helfen', 'Mein Freund ___ mir beim Umzug ___.', ['hat', 'geholfen'], 'helfen → hat geholfen (irregular).'],
    ['ankommen', 'Der Zug ___ pünktlich ___.', ['ist', 'angekommen'], 'ankommen = llegar (movimiento) → sein; separable: an-ge-kommen.'],
    ['warten', 'Wir ___ eine Stunde auf den Bus ___.', ['haben', 'gewartet'], 'warten → hat gewartet (raíz en -t: ge-wart-et).'],
    ['umsteigen', 'Am Bahnhof ___ ich ___.', ['bin', 'umgestiegen'], 'umsteigen = movimiento → sein: Ich bin umgestiegen.'],
    ['bezahlen', 'Wer ___ die Rechnung ___?', ['hat', 'bezahlt'], 'bezahlen → hat bezahlt (be- sin ge-).'],
    ['aufräumen', '___ du dein Zimmer schon ___?', ['Hast', 'aufgeräumt'], 'aufräumen → hat aufgeräumt (separable: auf-ge-räumt).'],
    ['wandern', 'Am Wochenende ___ wir in den Bergen ___.', ['sind', 'gewandert'], 'wandern = desplazarse a pie → sein: sind gewandert.'],
    ['beginnen', 'Der Film ___ um acht Uhr ___.', ['hat', 'begonnen'], 'beginnen → hat begonnen (be- sin ge-).'],
    ['abholen', 'Meine Mutter ___ mich vom Bahnhof ___.', ['hat', 'abgeholt'], 'abholen → hat abgeholt (separable: ab-ge-holt).'],
    ['zurückkommen', 'Wann ___ ihr aus dem Urlaub ___?', ['seid', 'zurückgekommen'], 'zurückkommen = movimiento → sein: ihr seid zurückgekommen.'],
    ['singen', 'Auf der Party ___ wir laut ___.', ['haben', 'gesungen'], 'singen → hat gesungen (irregular: i → u).'],
  ];
  for (const [inf, text, gaps, x] of PG) q.push(gp(M('perfekt', 'medium', x), `Perfekt de «${inf}»: completa auxiliar y Partizip II`, text, gaps.map((g) => [g])));
  q.push(er(M('perfekt', 'medium', 'ankommen = llegar → sein.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Wir [haben|sind] um zehn Uhr angekommen.'));
  q.push(er(M('perfekt', 'medium', 'bezahlen lleva prefijo be-: bezahlt, sin ge-.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich habe die Rechnung [gebezahlt|bezahlt].'));
  q.push(er(M('perfekt', 'medium', 'denken es irregular: gedacht.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich habe an dich [gedenkt|gedacht].'));
  q.push(mt(M('perfekt', 'medium', 'Partizip II de verbos nuevos.'), 'Relaciona infinitivo y Partizip II',
    [['bringen', 'gebracht'], ['nehmen', 'genommen'], ['anfangen', 'angefangen'], ['verkaufen', 'verkauft']]));

  // ═════════ IMPERATIV ═════════
  const IMP: [string, string, string[], string, string[], string][] = [
    // inf, es, du (aceptadas), ihr, Sie, nota
    ['kommen', 'venir', ['komm', 'komme'], 'kommt', ['kommen'], 'du: komm · ihr: kommt · Sie: kommen Sie.'],
    ['nehmen', 'tomar', ['nimm'], 'nehmt', ['nehmen'], 'e → i también en el imperativo: nimm (sin -st).'],
    ['essen', 'comer', ['iss'], 'esst', ['essen'], 'e → i: iss.'],
    ['lesen', 'leer', ['lies'], 'lest', ['lesen'], 'e → ie: lies.'],
    ['sprechen', 'hablar', ['sprich'], 'sprecht', ['sprechen'], 'e → i: sprich.'],
    ['helfen', 'ayudar', ['hilf'], 'helft', ['helfen'], 'e → i: hilf.'],
    ['warten', 'esperar', ['warte'], 'wartet', ['warten'], 'raíz en -t: warte (con -e).'],
    ['schreiben', 'escribir', ['schreib', 'schreibe'], 'schreibt', ['schreiben'], 'du: schreib(e).'],
    ['sein', 'ser / estar', ['sei'], 'seid', ['seien'], 'sein es irregular: sei, seid, seien Sie.'],
    ['fahren', 'ir (en vehículo)', ['fahr', 'fahre'], 'fahrt', ['fahren'], 'En el imperativo de du NO hay a → ä: fahr (no *fähr).'],
    ['öffnen', 'abrir', ['öffne'], 'öffnet', ['öffnen'], 'raíz en -n tras consonante: öffne.'],
    ['trinken', 'beber', ['trink', 'trinke'], 'trinkt', ['trinken'], 'du: trink(e).'],
  ];
  const IMP_TXT: Record<string, [string, string, string]> = {
    kommen: ['Paul, ___ bitte pünktlich!', 'Kinder, ___ bitte zum Essen!', 'Frau Lang, ___ Sie bitte herein!'],
    nehmen: ['Lena, ___ bitte deine Jacke mit!', 'Leute, ___ einen Regenschirm mit!', '___ Sie bitte Platz!'],
    essen: ['Max, ___ nicht so schnell!', 'Kinder, ___ euer Gemüse!', 'Herr Schmidt, ___ Sie doch noch ein Stück Kuchen!'],
    lesen: ['Ana, ___ bitte den Text laut!', 'Bitte ___ den Text bis morgen!', '___ Sie bitte das Formular genau!'],
    sprechen: ['Tom, ___ bitte lauter!', 'Kinder, ___ bitte leise!', '___ Sie bitte langsamer!'],
    helfen: ['Bitte ___ mir mal!', 'Bitte ___ eurer Oma!', 'Entschuldigung, ___ Sie mir bitte!'],
    warten: ['Lisa, ___ bitte einen Moment!', 'Leute, ___ auf mich!', '___ Sie bitte hier!'],
    schreiben: ['Jonas, ___ mir eine Nachricht!', 'Bitte ___ die Wörter ins Heft!', '___ Sie bitte Ihren Namen hier!'],
    sein: ['Max, ___ bitte ruhig!', 'Kinder, ___ bitte nicht so laut!', '___ Sie bitte pünktlich!'],
    fahren: ['Papa, ___ bitte langsam!', 'Bitte ___ vorsichtig!', '___ Sie bitte geradeaus!'],
    öffnen: ['Mia, ___ bitte das Fenster!', 'Bitte ___ eure Bücher!', '___ Sie bitte die Tür!'],
    trinken: ['Opa, ___ mehr Wasser!', 'Kinder, ___ eure Milch!', '___ Sie bitte viel Tee!'],
  };
  for (const [inf, es, du, ihr, sie, note] of IMP) {
    const [t1, t2, t3] = IMP_TXT[inf];
    const irregular = ['nehmen', 'essen', 'lesen', 'sprechen', 'helfen', 'sein'].includes(inf);
    q.push(gp(M('imperativ', irregular ? 'medium' : 'easy', `${inf} (${es}): ${note}`), `Imperativ de «${inf}» (du): completa`, t1, [du]));
    q.push(gp(M('imperativ', inf === 'sein' ? 'medium' : 'easy', `${inf} (${es}): ${note}`), `Imperativ de «${inf}» (ihr): completa`, t2, [[ihr]]));
    q.push(gp(M('imperativ', inf === 'sein' ? 'medium' : 'easy', `${inf} (${es}): ${note} Con Sie: verbo + Sie.`), `Imperativ de «${inf}» (Sie): completa`, t3, [sie]));
  }
  const IMP_SEP: [string, string[][], string][] = [
    ['Tim, ___ bitte dein Zimmer ___! (aufräumen)', [['räum', 'räume'], ['auf']], 'Separable en imperativo: räum … auf (la partícula al final).'],
    ['Lena, ___ bitte deine Oma ___! (anrufen)', [['ruf', 'rufe'], ['an']], 'anrufen → ruf … an.'],
    ['Kinder, ___ bitte um sieben Uhr ___! (aufstehen)', [['steht'], ['auf']], 'ihr: steht … auf.'],
    ['___ Sie bitte am Bahnhof ___! (umsteigen)', [['Steigen'], ['um']], 'Sie: Steigen Sie … um.'],
    ['Paul, ___ doch ___! (mitkommen)', [['komm', 'komme'], ['mit']], 'mitkommen → komm … mit.'],
  ];
  for (const [text, gaps, x] of IMP_SEP) q.push(gp(M('imperativ', 'medium', x), 'Imperativ con verbo separable: completa', text, gaps));
  q.push(mc(M('imperativ', 'medium', 'Imperativo de du: sin pronombre y sin -st. nehmen → nimm.'), '¿Cuál es el imperativo correcto (du) de «nehmen»?', ['Nimm!', 'Nimmst!', 'Nehm du!']));
  q.push(mc(M('imperativ', 'easy', 'Forma de cortesía: verbo + Sie: Kommen Sie bitte!'), '¿Cuál es correcta (usted)?', ['Kommen Sie bitte!', 'Sie kommen bitte!', 'Komm Sie bitte!']));
  q.push(er(M('imperativ', 'medium', 'fahren en imperativo de du: fahr (sin ä).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Papa, [fähr|fahr] bitte nicht so schnell!'));
  q.push(er(M('imperativ', 'medium', 'Imperativo de du sin -st: lies.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ana, [liest|lies] bitte den Satz!'));

  // ═════════ ADJEKTIVE & KOMPARATIV ═════════
  const KOMP: [string, string, string, string][] = [
    ['groß', 'größer', 'am größten', 'grande'], ['klein', 'kleiner', 'am kleinsten', 'pequeño'], ['alt', 'älter', 'am ältesten', 'viejo'],
    ['jung', 'jünger', 'am jüngsten', 'joven'], ['lang', 'länger', 'am längsten', 'largo'], ['kurz', 'kürzer', 'am kürzesten', 'corto'],
    ['warm', 'wärmer', 'am wärmsten', 'cálido'], ['kalt', 'kälter', 'am kältesten', 'frío'], ['gut', 'besser', 'am besten', 'bueno'],
    ['viel', 'mehr', 'am meisten', 'mucho'], ['gern', 'lieber', 'am liebsten', 'con gusto'], ['teuer', 'teurer', 'am teuersten', 'caro'],
    ['schnell', 'schneller', 'am schnellsten', 'rápido'], ['billig', 'billiger', 'am billigsten', 'barato'], ['hoch', 'höher', 'am höchsten', 'alto'],
  ];
  const KOMP_TXT: Record<string, [string, string]> = {
    groß: ['Berlin ist ___ als Köln.', 'Mein Bruder ist ___ in der Familie.'],
    klein: ['Mein Zimmer ist ___ als dein Zimmer.', 'Von allen Katzen ist Mimi ___.'],
    alt: ['Meine Schwester ist zwei Jahre ___ als ich.', 'Opa ist ___ in unserer Familie.'],
    jung: ['Ich bin ___ als mein Bruder.', 'Lisa ist ___ in der Klasse.'],
    lang: ['Der Rhein ist ___ als die Spree.', 'Im Juni sind die Tage ___.'],
    kurz: ['Der Weg mit dem Fahrrad ist ___ als mit dem Bus.', 'Im Dezember sind die Tage ___.'],
    warm: ['In Spanien ist es ___ als in Deutschland.', 'Im August ist es ___.'],
    kalt: ['Im Winter ist es ___ als im Herbst.', 'Im Januar ist es ___.'],
    gut: ['Dein Deutsch ist ___ als mein Englisch.', 'Ana spricht ___ Deutsch.'],
    viel: ['Ich trinke ___ Wasser als du.', 'Von allen Kindern liest Tomás ___.'],
    gern: ['Ich trinke ___ Tee als Kaffee.', 'Ich esse ___ Pizza.'],
    teuer: ['Das Taxi ist ___ als der Bus.', 'Das Hotel am Strand ist ___.'],
    schnell: ['Der Zug ist ___ als das Auto.', 'Das Flugzeug ist ___.'],
    billig: ['Der Markt ist ___ als der Supermarkt.', 'Im Internet ist das Handy ___.'],
    hoch: ['Der Berg ist ___ als das Haus.', 'Der Fernsehturm ist ___.'],
  };
  for (const [adj, komp, sup, es] of KOMP) {
    const [t1, t2] = KOMP_TXT[adj];
    const irr = ['gut', 'viel', 'gern', 'hoch'].includes(adj) || /[äöü]/.test(komp);
    q.push(gp(M('adjektiv', irr ? 'medium' : 'easy', `${adj} (${es}) → ${komp} als… Comparativo: -er (+ als).${irr ? ' Forma especial o con Umlaut.' : ''}`), `Komparativ de «${adj}»: completa`, t1, [[komp]]));
    q.push(gp(M('adjektiv', irr ? 'medium' : 'easy', `${adj} → ${sup}. Superlativo con verbo: am …sten.`), `Superlativ de «${adj}»: completa (am …sten)`, t2, [[sup]]));
  }
  q.push(mc(M('adjektiv', 'easy', 'Igualdad: so … wie. Comparativo: …er als.'), 'Tomás ist so groß ___ Ana.', ['wie', 'als', 'dass'], { fixed: true }));
  q.push(mc(M('adjektiv', 'easy', 'Comparativo + als: größer als.'), 'Tomás ist größer ___ Ana.', ['als', 'wie', 'dass'], { fixed: true }));
  q.push(mc(M('adjektiv', 'medium', 'gut → besser → am besten (irregular).'), 'Comparativo de «gut»:', ['besser', 'guter', 'güter']));
  q.push(mc(M('adjektiv', 'medium', 'gern → lieber → am liebsten. «Ich trinke lieber Tee» = prefiero el té.'), '«Prefiero el té.» →', ['Ich trinke lieber Tee.', 'Ich trinke gerner Tee.', 'Ich trinke mehr gern Tee.']));
  q.push(mt(M('adjektiv', 'medium', 'Contrarios.'), 'Relaciona los contrarios', [['groß', 'klein'], ['teuer', 'billig'], ['laut', 'leise'], ['voll', 'leer']]));
  q.push(mt(M('adjektiv', 'medium', 'Contrarios.'), 'Relaciona los contrarios', [['alt', 'jung'], ['lang', 'kurz'], ['schnell', 'langsam'], ['interessant', 'langweilig']]));
  q.push(er(M('adjektiv', 'medium', 'Comparativo + als (no wie).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Mein Bruder ist älter [wie|als] ich.'));
  q.push(er(M('adjektiv', 'medium', 'alt → älter (con Umlaut).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Meine Oma ist [alter|älter] als mein Opa.'));

  // ═════════ TRENNBARE VERBEN (nuevos) ═════════
  const TRV: [string, string, string[], string][] = [
    ['abfahren', 'Der Zug ___ um acht Uhr ___.', ['fährt', 'ab'], 'abfahren: fährt … ab (a → ä con er).'],
    ['ankommen', 'Wann ___ der Bus in München ___?', ['kommt', 'an'], 'ankommen: kommt … an.'],
    ['abholen', 'Ich ___ dich um sieben Uhr ___.', ['hole', 'ab'], 'abholen: hole … ab.'],
    ['aufräumen', 'Am Samstag ___ wir die Wohnung ___.', ['räumen', 'auf'], 'aufräumen: räumen … auf.'],
    ['anfangen', 'Der Unterricht ___ um neun Uhr ___.', ['fängt', 'an'], 'anfangen: fängt … an (a → ä).'],
    ['mitbringen', '___ du einen Kuchen ___?', ['Bringst', 'mit'], 'mitbringen: Bringst du … mit?'],
    ['zurückkommen', 'Wir ___ am Sonntag ___.', ['kommen', 'zurück'], 'zurückkommen: kommen … zurück.'],
    ['anziehen', 'Im Winter ___ ich einen Mantel ___.', ['ziehe', 'an'], 'anziehen: ziehe … an.'],
    ['zumachen', '___ bitte die Tür ___! (du)', ['Mach/Mache', 'zu'], 'zumachen en imperativo: Mach … zu!'],
    ['einsteigen', 'Bitte ___ Sie jetzt ___!', ['steigen', 'ein'], 'einsteigen: steigen Sie … ein.'],
  ];
  for (const [inf, text, gaps, x] of TRV) q.push(gp(M('trennbar', 'medium', x), `Trennbares Verb «${inf}»: completa las dos partes`, text, gaps.map((g) => g.split('/'))));
  const TRV_MOD: [string, string, string][] = [
    ['Kannst du bitte das Fenster ___?', 'aufmachen', 'Con modal, el separable va junto al final: aufmachen.'],
    ['Ich muss morgen früh ___.', 'aufstehen', 'Con modal: aufstehen junto al final.'],
    ['Wir wollen am Freitag die Küche ___.', 'aufräumen', 'Con modal: aufräumen junto al final.'],
    ['Du sollst deine Mutter ___.', 'anrufen', 'Con modal: anrufen junto al final.'],
    ['Der Zug soll um zehn Uhr ___.', 'ankommen', 'Con modal: ankommen junto al final.'],
  ];
  for (const [text, a, x] of TRV_MOD) q.push(gp(M('trennbar', 'medium', x), 'Verbo separable con modal: completa (infinitivo)', text, [[a]]));
  const TRV_ORDER: [string, string[]][] = [
    ['Der Zug fährt um acht Uhr ab.', ['Um acht Uhr fährt der Zug ab.']],
    ['Ich hole dich vom Bahnhof ab.', []],
    ['Am Wochenende räume ich mein Zimmer auf.', ['Ich räume am Wochenende mein Zimmer auf.']],
    ['Wann kommt der Bus an?', []],
    ['Der Film fängt um neun Uhr an.', ['Um neun Uhr fängt der Film an.']],
  ];
  for (const [s, alts] of TRV_ORDER) q.push(od(M('trennbar', 'medium', `${s} El verbo conjugado en posición 2 y la partícula al final.`, { tags: ['fix'] }), 'Ordena la frase (verbo separable)', s, alts));

  // ═════════ kein / nicht ═════════
  const NEG: [string, string, string][] = [
    ['Ich habe heute ___ Zeit.', 'keine', 'die Zeit → keine Zeit.'],
    ['Wir haben ___ Brot mehr.', 'kein', 'das Brot → kein Brot.'],
    ['Er trinkt ___ Wein.', 'keinen', 'der Wein (Akk.) → keinen Wein.'],
    ['Das Wetter ist heute ___ gut.', 'nicht', 'Con adjetivos se usa nicht: nicht gut.'],
    ['Ich komme morgen ___.', 'nicht', 'Con verbos (sin sustantivo) se usa nicht.'],
    ['Sie hat ___ Geschwister.', 'keine', 'Plural → keine Geschwister.'],
    ['Das ist ___ mein Handy.', 'nicht', 'Con posesivo (mein) se niega con nicht.'],
    ['Im Kühlschrank ist ___ Milch.', 'keine', 'die Milch → keine Milch.'],
    ['Ich brauche ___ Regenschirm.', 'keinen', 'der Regenschirm (Akk.) → keinen Regenschirm.'],
    ['Der Bus kommt heute ___.', 'nicht', 'Negar el verbo: kommt nicht.'],
    ['Wir haben ___ Auto.', 'kein', 'das Auto → kein Auto.'],
    ['Ich esse ___ Fleisch.', 'kein', 'das Fleisch → kein Fleisch.'],
  ];
  for (const [t, a, x] of NEG) {
    q.push(mc(M('akkusativ', ['keinen', 'nicht'].includes(a) ? 'medium' : 'easy', `${x} kein (das) · keine (die, plural) · keinen (der, Akk.) · nicht (verbos, adjetivos, posesivos).`),
      `¿kein, keine, keinen o nicht? ${t}`, ['kein', 'keine', 'keinen', 'nicht'], { answer: ['kein', 'keine', 'keinen', 'nicht'].indexOf(a), fixed: true }));
  }

  // ═════════ W-FRAGEN ═════════
  const WQ: [string, string, string[], string][] = [
    ['___ wohnst du? – In Hamburg.', 'Wo', ['Wo', 'Wohin', 'Woher', 'Wann'], 'Wo = ¿dónde? (lugar).'],
    ['___ fährst du im Sommer? – Nach Italien.', 'Wohin', ['Wohin', 'Wo', 'Woher', 'Wie'], 'Wohin = ¿adónde? (dirección).'],
    ['___ kommst du? – Aus Mexiko.', 'Woher', ['Woher', 'Wo', 'Wohin', 'Was'], 'Woher = ¿de dónde?'],
    ['___ beginnt der Film? – Um acht Uhr.', 'Wann', ['Wann', 'Wie', 'Was', 'Wo'], 'Wann = ¿cuándo?'],
    ['___ heißt du? – Ich heiße Ana.', 'Wie', ['Wie', 'Was', 'Wer', 'Wo'], 'Wie heißt du? = ¿cómo te llamas?'],
    ['___ ist das? – Das ist mein Lehrer.', 'Wer', ['Wer', 'Was', 'Wie', 'Wen'], 'Wer = ¿quién? (persona).'],
    ['___ machst du am Wochenende? – Ich spiele Fußball.', 'Was', ['Was', 'Wer', 'Wie', 'Wann'], 'Was = ¿qué?'],
    ['___ lernst du Deutsch? – Weil ich in Berlin arbeiten möchte.', 'Warum', ['Warum', 'Wann', 'Wie', 'Was'], 'Warum = ¿por qué? (respuesta con weil).'],
    ['___ kostet das Brot? – Drei Euro.', 'Wie viel', ['Wie viel', 'Wie alt', 'Wann', 'Was'], 'Wie viel kostet…? = ¿cuánto cuesta?'],
    ['___ alt bist du? – Ich bin zwanzig.', 'Wie', ['Wie', 'Was', 'Wann', 'Wer'], 'Wie alt bist du? = ¿cuántos años tienes?'],
    ['___ Farbe hat dein Auto? – Rot.', 'Welche', ['Welche', 'Was', 'Wie', 'Wer'], 'Welche Farbe…? = ¿qué color…?'],
    ['___ besuchst du am Sonntag? – Meine Oma.', 'Wen', ['Wen', 'Wer', 'Wem', 'Was'], 'Wen = ¿a quién? (Akkusativ).'],
    ['___ hilfst du? – Meinem Bruder.', 'Wem', ['Wem', 'Wen', 'Wer', 'Was'], 'Wem = ¿a quién? (Dativ: helfen + Dativ).'],
    ['___ spät ist es? – Halb zehn.', 'Wie', ['Wie', 'Wann', 'Was', 'Wo'], 'Wie spät ist es? = ¿qué hora es?'],
  ];
  for (const [t, a, opts, x] of WQ) q.push(mc(M('alltag', ['Wen', 'Wem', 'Welche'].includes(a) ? 'medium' : 'easy', x), `W-Frage: ${t}`, opts, { answer: opts.indexOf(a), fixed: true }));

  // ═════════ HORAS (lenguaje coloquial) ═════════
  const hourWord = (h: number) => (h % 12 === 1 ? 'eins' : deNum(h % 12 === 0 ? 12 : h % 12));
  const colloquial = (h: number, m: number): string => {
    const nx = h + 1;
    if (m === 0) return `${hourWord(h)} Uhr`.replace('eins Uhr', 'ein Uhr');
    if (m === 15) return `Viertel nach ${hourWord(h)}`;
    if (m === 30) return `halb ${hourWord(nx)}`;
    if (m === 45) return `Viertel vor ${hourWord(nx)}`;
    if (m === 10 || m === 5 || m === 20) return `${deNum(m)} nach ${hourWord(h)}`;
    if (m === 25) return `fünf vor halb ${hourWord(nx)}`;
    if (m === 35) return `fünf nach halb ${hourWord(nx)}`;
    if (m === 40) return `zwanzig vor ${hourWord(nx)}`;
    return `${deNum(60 - m)} vor ${hourWord(nx)}`;
  };
  const TIMES: [number, number][] = [[7, 30], [8, 15], [9, 45], [10, 30], [11, 15], [12, 45], [2, 30], [3, 10], [4, 50], [5, 20], [6, 25], [6, 35], [1, 30], [8, 40], [9, 55], [11, 5]];
  for (const [h, m] of TIMES) {
    const right = colloquial(h, m);
    const wrongs = [colloquial(h - 1 || 12, m), colloquial(h, (m + 15) % 60), m === 30 ? `halb ${hourWord(h)}` : colloquial(h + 1, m)].filter((w) => w !== right);
    const opts = [right, ...[...new Set(wrongs)].slice(0, 3)];
    const hard = m === 25 || m === 35;
    const clock = `${h}:${String(m).padStart(2, '0')}`;
    q.push(mc(M('alltag', hard || m === 30 || m === 45 ? 'medium' : 'easy', `${clock} = ${right}. ¡Ojo! «halb acht» = 7:30 (media hora ANTES de las ocho).`),
      `Es ist ${clock}. ¿Cómo se dice en la calle?`, opts));
  }
  q.push(mc(M('alltag', 'medium', '«halb neun» = media hora antes de las nueve = 8:30.'), '«Es ist halb neun.» ¿Qué hora es?', ['8:30', '9:30', '9:15', '8:45']));
  q.push(mc(M('alltag', 'medium', '«Viertel vor drei» = 2:45.'), '«Es ist Viertel vor drei.» ¿Qué hora es?', ['2:45', '3:15', '3:45', '2:15']));

  // ═════════ NÚMEROS GRANDES ═════════
  const big = (n: number) => {
    const h = Math.floor(n / 100), r = n % 100;
    return `${h === 1 ? 'ein' : deNum(h)}hundert${r ? deNum(r) : ''}`;
  };
  for (const n of [125, 247, 316, 452, 589, 634, 768, 893, 971, 1000]) {
    if (n === 1000) { q.push(mc(M('alltag', 'easy', '1000 = (ein)tausend.'), '¿Cómo se dice 1000?', ['tausend', 'hunderttausend', 'zehnhundert'])); continue; }
    const r = n % 100, tens = Math.floor(r / 10), units = r % 10;
    const swapped = Math.floor(n / 100) * 100 + units * 10 + tens;
    const opts = [big(n), big(swapped), big((Math.floor(n / 100) % 9 + 1) * 100 + r)];
    q.push(mc(M('alltag', 'medium', `${n} = ${big(n)}. Las unidades van antes que las decenas: ${deNum(r)}.`), `¿Cómo se escribe ${n}?`, [...new Set(opts)]));
  }

  // ═════════ DÍAS, MESES Y ESTACIONES ═════════
  const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  DAYS.forEach((d, i) => {
    const next = DAYS[(i + 1) % 7];
    q.push(mc(M('alltag', 'easy', `Después de ${d} viene ${next}.`), `Welcher Tag kommt nach ${d}?`, [next, DAYS[(i + 2) % 7], DAYS[(i + 6) % 7]]));
  });
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const ES_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  MONTHS.forEach((m, i) => {
    if (i % 2 === 0) q.push(wr(M('alltag', 'easy', `${ES_MONTHS[i]} = ${m}. Los meses son masculinos: der ${m}, im ${m}.`), `Escribe en alemán: «${ES_MONTHS[i]}»`, [m], { strict: true }));
    else q.push(mc(M('alltag', 'easy', `${m} = ${ES_MONTHS[i]}.`), `¿Qué mes es «${m}»?`, [ES_MONTHS[i], ES_MONTHS[(i + 1) % 12], ES_MONTHS[(i + 5) % 12]]));
  });
  q.push(mc(M('alltag', 'medium', 'Con meses y estaciones: im (= in dem): im Juli, im Sommer. Con días: am: am Montag.'), '¿Cuál es correcta?', ['Im Juli fahren wir ans Meer.', 'Am Juli fahren wir ans Meer.', 'Um Juli fahren wir ans Meer.']));
  q.push(mc(M('alltag', 'medium', 'Días: am Montag. Horas: um acht Uhr. Meses: im Mai.'), '¿Cuál es correcta?', ['Am Montag um acht Uhr.', 'Im Montag um acht Uhr.', 'Am Montag am acht Uhr.']));
  q.push(mt(M('alltag', 'easy', 'Las estaciones: der Frühling, der Sommer, der Herbst, der Winter.'), 'Relaciona la estación con su mes típico (en España)',
    [['der Frühling', 'April'], ['der Sommer', 'August'], ['der Herbst', 'Oktober'], ['der Winter', 'Januar']]));
  q.push(gp(M('alltag', 'medium', 'Preposiciones de tiempo: am + día, um + hora, im + mes.'), 'Completa con am, um o im', 'Ich habe ___ Freitag ___ zehn Uhr einen Termin. ___ Mai fahre ich nach Berlin.', [['am'], ['um'], ['Im']]));

  return q;
}
