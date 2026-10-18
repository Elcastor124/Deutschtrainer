// Gramática: Perfekt, Präsens, Trennbare Verben, Dativ, Akkusativ / kein.
import type { Question } from '../../shared/types.ts';
import { PERFEKT_VERBS, PERSONS, PRAESENS } from '../../shared/vocab.ts';
import { er, gp, mc, mt, od, rng, wr, type Meta } from './h.ts';

const M = (t: Meta['t'], s: Meta['s'], d: Meta['d'], x: string, extra: Partial<Meta> = {}): Meta => ({ t, s, d, x, ...extra });

const SEIN_RULE = 'sein = movimiento de A a B o cambio de estado (+ sein, bleiben, passieren). haben = todo lo demás (≈90 %).';
function family(inf: string, part: string): string {
  if (/ieren$/.test(inf)) return 'Verbos en -ieren: sin ge- (studiert, telefoniert).';
  if (/^(be|ver|ent|er|zer|ge)/.test(inf) && !part.startsWith('ge')) return 'Prefijo inseparable (be-, ver-…): sin ge-.';
  if (/^(auf|ein|fern|an|um|mit|aus|ab|hin)/.test(inf)) return 'Verbo separable: el ge- va en medio (auf-ge-standen).';
  if (part.endsWith('en')) return 'Irregular: ge- … -en (y a veces cambia la vocal).';
  return 'Regular: ge- … -t.';
}

export function grammarQuestions(): Question[] {
  const q: Question[] = [];

  // ═════════ PERFEKT (warum · unterwegs · kh) ═════════
  for (const [inf, aux, part, es] of PERFEKT_VERBS) {
    const full = `${aux === 'sein' ? 'ist' : 'hat'} ${part}`;
    q.push(mc(M('perfekt', 'warum', 'easy', `${inf} → ${full}. ${SEIN_RULE}`, { tags: ['tf'] }),
      `Perfekt: ¿haben o sein? → ${inf} (${es})`, ['haben', 'sein'], { answer: aux === 'haben' ? 0 : 1, fixed: true }));
    if (inf !== 'haben' && inf !== 'sein') {
      q.push(wr(M('perfekt', 'warum', 'medium', `${inf} → ${part}. ${family(inf, part)}`), `Escribe el Partizip II de «${inf}» (${es})`, [part], { strict: true }));
    }
  }
  const PG: [string, string, (string | string[])[], Meta['s'], string][] = [
    ['essen', 'Ich ___ gestern Pizza ___.', ['habe', 'gegessen'], 'warum', 'essen → hat gegessen (irregular: ge-…-en).'],
    ['fahren', 'Wir ___ nach Madrid ___.', ['sind', 'gefahren'], 'warum', 'fahren = movimiento → sein: wir sind gefahren.'],
    ['aufstehen', 'Er ___ um 7 Uhr ___.', ['ist', 'aufgestanden'], 'warum', 'aufstehen = cambio de estado → sein; separable → auf-ge-standen.'],
    ['anrufen', 'Ich ___ meine Mutter ___.', ['habe', 'angerufen'], 'warum', 'anrufen → hat angerufen (separable: an-ge-rufen).'],
    ['einkaufen', 'Sie ___ im Supermarkt ___.', ['hat', 'eingekauft'], 'unterwegs', 'einkaufen → hat eingekauft.'],
    ['bleiben', 'Wir ___ am Wochenende bei der Oma ___.', ['sind', 'geblieben'], 'unterwegs', 'bleiben usa sein aunque no hay movimiento: es una de las excepciones.'],
    ['sehen', 'Ich ___ den Film schon ___.', ['habe', 'gesehen'], 'unterwegs', 'sehen → hat gesehen.'],
    ['studieren', 'Er ___ Medizin ___.', ['hat', 'studiert'], 'warum', 'studieren → hat studiert (-ieren sin ge-).'],
    ['kommen', 'Ihr ___ zu spät ___.', ['seid', 'gekommen'], 'warum', 'kommen → sein: ihr seid gekommen.'],
    ['verlieren', 'Du ___ deinen Schlüssel ___.', ['hast', 'verloren'], 'warum', 'verlieren → hat verloren (ver- sin ge-).'],
    ['einschlafen', 'Ich ___ im Unterricht ___.', ['bin', 'eingeschlafen'], 'warum', 'einschlafen = cambio de estado (despierto → dormido) → sein.'],
    ['treffen', 'Wir ___ unsere Freunde ___.', ['haben', 'getroffen'], 'unterwegs', 'treffen → hat getroffen.'],
    ['besuchen', 'Sie (ella) ___ ihre Oma ___.', ['hat', 'besucht'], 'unterwegs', 'besuchen → hat besucht (be- sin ge-).'],
    ['verstehen', 'Ich ___ das Wort nicht ___.', ['habe', 'verstanden'], 'warum', 'verstehen → hat verstanden.'],
    ['sein', 'Gestern ___ ich krank ___.', ['bin', 'gewesen'], 'warum', 'sein → ist gewesen. (Inversión: Gestern bin ich…)'],
    ['kommen', 'Der Bus ___ nicht ___.', ['ist', 'gekommen'], 'unterwegs', 'kommen → ist gekommen.'],
    ['bekommen', 'Ich ___ eine gute Note ___.', ['habe', 'bekommen'], 'warum', 'bekommen → hat bekommen (be- sin ge-; Partizip = infinitivo).'],
    ['fliegen', 'Wir ___ nach Berlin ___.', ['sind', 'geflogen'], 'warum', 'fliegen = movimiento → sein: sind geflogen.'],
    ['fallen', 'Ich ___ vom Fahrrad ___.', ['bin', 'gefallen'], 'kh', 'fallen = movimiento → sein: Ich bin vom Fahrrad gefallen.'],
    ['sprechen', 'Ich ___ mit meiner Mutter ___.', ['habe', 'gesprochen'], 'unterwegs', 'sprechen → hat gesprochen.'],
  ];
  for (const [inf, text, gaps, s, x] of PG) {
    q.push(gp(M('perfekt', s, 'medium', x), `Perfekt de «${inf}»: completa auxiliar y Partizip II`, text, gaps));
  }
  q.push(mc(M('perfekt', 'warum', 'medium', 'schlafen → haben (no hay cambio de estado). einschlafen → sein (pasas de despierto a dormido).'),
    '¿Cuál es correcta?', ['Ich bin eingeschlafen.', 'Ich habe eingeschlafen.', 'Ich bin geschlafen.']));
  q.push(mc(M('perfekt', 'warum', 'medium', 'besuchen tiene prefijo be- → sin ge-: besucht.'), '¿Qué Partizip II NO lleva ge-?', ['besucht', 'gemacht', 'gegessen', 'angerufen']));
  q.push(mc(M('perfekt', 'warum', 'medium', 'fernsehen es separable: fern-ge-sehen.'), 'Partizip II de «fernsehen»:', ['ferngesehen', 'gefernsehen', 'ferngesieht']));
  q.push(mc(M('perfekt', 'warum', 'easy', 'Satzklammer: el auxiliar en posición 2 y el Partizip II AL FINAL.'), '¿Dónde va el Partizip II en «Ich habe gestern Pizza gegessen»?',
    ['al final', 'en posición 2', 'justo después de «ich»']));
  q.push(mt(M('perfekt', 'warum', 'medium', 'Las 4 familias del Partizip II.'), 'Relaciona infinitivo y Partizip II',
    [['machen', 'gemacht'], ['schreiben', 'geschrieben'], ['aufstehen', 'aufgestanden'], ['telefonieren', 'telefoniert']]));
  q.push(er(M('perfekt', 'warum', 'medium', 'fahren = movimiento → sein: Ich bin nach Berlin gefahren.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich [habe|bin] nach Berlin gefahren.'));
  q.push(er(M('perfekt', 'warum', 'medium', 'essen es irregular: gegessen (no *gegesst).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Wir haben Pizza [gegesst|gegessen].'));
  q.push(er(M('perfekt', 'warum', 'medium', 'aufstehen = cambio de estado → sein.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich [habe|bin] um 7 Uhr aufgestanden.'));
  q.push(er(M('perfekt', 'warum', 'medium', 'Verbos en -ieren: sin ge- → studiert.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Er hat Medizin [gestudiert|studiert].'));
  q.push(er(M('perfekt', 'kh', 'medium', 'fallen = movimiento → sein: Ich bin vom Fahrrad gefallen.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich [habe|bin] vom Fahrrad gefallen.'));
  q.push(er(M('perfekt', 'unterwegs', 'medium', 'fahren → sein: Ich bin mit dem Rad zur Schule gefahren.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich [habe|bin] mit dem Rad zur Schule gefahren.'));
  q.push(wr(M('perfekt', 'unterwegs', 'medium', 'Was hast du gestern gegessen? → Ich habe … gegessen.'), 'Responde en Perfekt: «Was hast du gestern gegessen?» (pizza)',
    ['Ich habe Pizza gegessen.', 'Ich habe gestern Pizza gegessen.', 'Gestern habe ich Pizza gegessen.']));
  q.push(wr(M('perfekt', 'unterwegs', 'medium', 'Wann bist du aufgestanden? → Ich bin um sieben Uhr aufgestanden.'), 'Responde en Perfekt: «Wann bist du heute aufgestanden?» (a las 7)',
    ['Ich bin um sieben Uhr aufgestanden.', 'Ich bin um 7 Uhr aufgestanden.', 'Ich bin heute um sieben Uhr aufgestanden.', 'Ich bin heute um 7 Uhr aufgestanden.', 'Heute bin ich um sieben Uhr aufgestanden.', 'Heute bin ich um 7 Uhr aufgestanden.']));
  q.push(wr(M('perfekt', 'unterwegs', 'medium', 'Wohin bist du gefahren? → Ich bin nach … gefahren (nach + ciudad).'), 'Responde en Perfekt: «Wohin bist du in den Ferien gefahren?» (a Madrid)',
    ['Ich bin nach Madrid gefahren.', 'Ich bin in den Ferien nach Madrid gefahren.', 'In den Ferien bin ich nach Madrid gefahren.']));

  // ═════════ PRÄSENS (trainer · Brücke) ═════════
  const PICKS: [number, number][] = [[0, 1], [0, 2], [1, 1], [2, 2], [3, 1], [4, 1], [4, 2], [4, 4], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4],
    [6, 1], [6, 2], [6, 4], [7, 1], [7, 2], [7, 4], [8, 1], [8, 2], [8, 4], [2, 4], [3, 3]];
  for (const [vi, pi] of PICKS) {
    const [inf, es, forms] = PRAESENS[vi];
    const irregular = ['sein', 'haben', 'fahren', 'sprechen', 'arbeiten'].includes(inf);
    const tip = inf === 'fahren' ? 'fahren: a → ä en du/er (fährst, fährt).' : inf === 'sprechen' ? 'sprechen: e → i en du/er (sprichst, spricht).'
      : inf === 'arbeiten' ? 'arbeiten: raíz en -t → se añade -e- (arbeitest, arbeitet).' : inf === 'sein' ? 'sein es totalmente irregular: bin, bist, ist, sind, seid, sind.'
      : inf === 'haben' ? 'haben: du hast, er hat (pierde la b).' : 'Regular: -e, -st, -t, -en, -t, -en.';
    q.push(gp(M('praesens', 'trainer', irregular && pi > 0 && pi < 3 ? 'medium' : 'easy', `${PERSONS[pi]} ${forms[pi]}. ${tip}`),
      `Conjuga «${inf}» (${es}) en presente`, `${PERSONS[pi].replace(' (ellos)', '')} ___`, [forms[pi]]));
  }
  const COMBOS: [string[], string[]][] = [
    [['ICH', 'FAHREN', 'SCHULE'], ['Ich fahre zur Schule.']],
    [['DU', 'SPRECHEN', 'DEUTSCH'], ['Du sprichst Deutsch.']],
    [['ER', 'ARBEITEN', 'BANK'], ['Er arbeitet bei einer Bank.', 'Er arbeitet bei der Bank.', 'Er arbeitet in einer Bank.', 'Er arbeitet in der Bank.']],
    [['WIR', 'WOHNEN', 'BERLIN'], ['Wir wohnen in Berlin.']],
    [['SIE (ella)', 'KOMMEN', 'SPANIEN'], ['Sie kommt aus Spanien.']],
    [['IHR', 'HABEN', 'ZEIT?'], ['Habt ihr Zeit?']],
    [['DU', 'FAHREN', 'MIT DEM BUS'], ['Du fährst mit dem Bus.']],
  ];
  for (const [parts, acc] of COMBOS) {
    q.push({ ...wr(M('praesens', 'trainer', 'medium', `${acc[0]} Verbo conjugado en posición 2.`), 'Construye la frase en presente', acc), type: 'build', parts });
  }
  q.push(gp(M('praesens', 'bank', 'easy', 'möchten: ich möchte, du möchtest, er möchte.'), 'Completa (möchten):', 'Ich ___ ein Konto eröffnen.', [['möchte']]));
  q.push(gp(M('praesens', 'bank', 'medium', 'du möchtest.'), 'Completa (möchten):', 'Was ___ du trinken?', [['möchtest']]));
  q.push(mc(M('praesens', 'bank', 'easy', 'Con möchte, el segundo verbo va AL FINAL en infinitivo.'), '¿Cuál es correcta?',
    ['Ich möchte Geld abheben.', 'Ich möchte abheben Geld.', 'Ich abheben möchte Geld.']));
  q.push(mc(M('praesens', 'kh', 'medium', 'Mir tut der Kopf weh (singular) · Mir tun die Füße weh (plural → tun).'), 'Mir ___ die Füße weh.', ['tun', 'tut', 'tust']));
  q.push(mc(M('praesens', 'kh', 'easy', 'der Kopf es singular → tut.'), 'Mir ___ der Kopf weh.', ['tut', 'tun', 'tust']));

  // ═════════ TRENNBARE VERBEN (trainer · warum · bank · kh) ═════════
  // [infinitivo, huecos, solución, frase modelo, Partizip II, órdenes alternativos válidos]
  const TRV: [string, string, string, string, string, string[]][] = [
    ['aufstehen', 'Ich ___ um sieben Uhr ___.', 'stehe|auf', 'Ich stehe um sieben Uhr auf.', 'aufgestanden', ['Um sieben Uhr stehe ich auf.']],
    ['einkaufen', 'Ich ___ im Supermarkt ___.', 'kaufe|ein', 'Ich kaufe im Supermarkt ein.', 'eingekauft', ['Im Supermarkt kaufe ich ein.']],
    ['anrufen', 'Ich ___ meine Mutter ___.', 'rufe|an', 'Ich rufe meine Mutter an.', 'angerufen', ['Meine Mutter rufe ich an.']],
    ['mitkommen', '___ du zum Stadtfest ___?', 'Kommst|mit', 'Kommst du zum Stadtfest mit?', 'mitgekommen', []],
    ['einsteigen', 'Wir ___ in den Zug ___.', 'steigen|ein', 'Wir steigen in den Zug ein.', 'eingestiegen', ['In den Zug steigen wir ein.']],
    ['aussteigen', 'Wir ___ am Hackeschen Markt ___.', 'steigen|aus', 'Wir steigen am Hackeschen Markt aus.', 'ausgestiegen', ['Am Hackeschen Markt steigen wir aus.']],
    ['fernsehen', 'Am Abend ___ ich ___.', 'sehe|fern', 'Am Abend sehe ich fern.', 'ferngesehen', ['Ich sehe am Abend fern.']],
    ['abheben', 'Ich ___ 50 Euro ___.', 'hebe|ab', 'Ich hebe 50 Euro ab.', 'abgehoben', ['50 Euro hebe ich ab.']],
    ['einzahlen', 'Er ___ 100 Euro ___.', 'zahlt|ein', 'Er zahlt 100 Euro ein.', 'eingezahlt', ['100 Euro zahlt er ein.']],
  ];
  for (const [inf, text, ans, sentence, part, alts] of TRV) {
    const [a, b] = ans.split('|');
    const src: Meta['s'] = ['abheben', 'einzahlen'].includes(inf) ? 'bank' : 'trainer';
    q.push(gp(M('trennbar', src, 'medium', `${sentence} El prefijo (${b}) se separa y va AL FINAL.`), `Verbo separable «${inf}»: completa`, text, [[a, a.toLowerCase()], [b]]));
    q.push(od(M('trennbar', src, 'easy', `${sentence} Verbo en posición 2, prefijo al final.`), `Ordena la frase (${inf})`, sentence, alts));
    if (!PERFEKT_VERBS.some((v) => v[0] === inf)) {
      q.push(wr(M('trennbar', src, 'medium', `${inf} → ${part}: el ge- va entre prefijo y verbo.`), `Escribe el Partizip II de «${inf}»`, [part], { strict: true }));
    }
  }
  q.push(gp(M('trennbar', 'kh', 'medium', 'En Nebensatz el verbo separable se vuelve a juntar al final: wehtut.'), 'Completa (wehtun):', 'Wenn es ___, nehmen Sie eine Tablette.', [['wehtut']]));
  q.push(gp(M('trennbar', 'kh', 'medium', 'En Hauptsatz se separa: Mein Arm tut weh.'), 'Completa (wehtun):', 'Mein Arm ___ sehr ___.', [['tut'], ['weh']]));
  q.push(mc(M('trennbar', 'kh', 'medium', 'Ich lache, obwohl es wehtut. Tras obwohl el verbo va al final y el separable se junta.'), '¿Cuál es correcta?',
    ['Ich lache, obwohl es wehtut.', 'Ich lache, obwohl es tut weh.', 'Ich lache, obwohl tut es weh.']));
  q.push(mt(M('trennbar', 'trainer', 'medium', 'aufstehen = levantarse · einkaufen = hacer la compra · anrufen = llamar · fernsehen = ver la tele'), 'Relaciona los verbos separables',
    [['aufstehen', 'levantarse'], ['einkaufen', 'hacer la compra'], ['anrufen', 'llamar'], ['fernsehen', 'ver la tele']]));

  // ═════════ DATIV (unterwegs · trainer · kh) ═════════
  const DQ: [string, string, string[], string][] = [
    ['Ich fahre mit ___ Bus zur Schule.', 'dem', ['der', 'dem', 'den'], 'der Bus → mit dem Bus (masculino: der → dem).'],
    ['Ich wohne bei ___ Mutter.', 'meiner', ['meine', 'meiner', 'meinem'], 'die Mutter → bei meiner Mutter (femenino: -e → -er).'],
    ['Seit ___ Jahr lerne ich Gitarre.', 'einem', ['ein', 'einem', 'einer'], 'das Jahr → seit einem Jahr (neutro: ein → einem).'],
    ['Das Geschenk ist von ___ Oma.', 'meiner', ['mein', 'meiner', 'meinem'], 'die Oma → von meiner Oma.'],
    ['Nach ___ Schule gehe ich nach Hause.', 'der', ['die', 'der', 'dem'], 'die Schule → nach der Schule (die → der).'],
    ['Ich spiele mit ___ Freunden Fußball.', 'meinen', ['meine', 'meinem', 'meinen'], 'Plural: die Freunde → mit meinen Freunden (-n en artículo y sustantivo).'],
    ['Er kommt gerade aus ___ Kino.', 'dem', ['das', 'dem', 'den'], 'das Kino → aus dem Kino (das → dem).'],
    ['Gegenüber ___ Bahnhof ist ein Café.', 'dem', ['der', 'dem', 'den'], 'der Bahnhof → gegenüber dem Bahnhof.'],
    ['Ich muss heute ___ Arzt.', 'zum', ['zum', 'zur', 'zu'], 'zu + dem Arzt = zum Arzt.'],
    ['Wie komme ich ___ Bank?', 'zur', ['zum', 'zur', 'zu'], 'zu + der Bank = zur Bank.'],
  ];
  for (const [t, a, o, x] of DQ) q.push(mc(M('dativ', 'unterwegs', 'easy', x), t, [a, ...o.filter((y) => y !== a)]));
  const NZB: [string, string, string][] = [
    ['Im Sommer fliege ich ___ Spanien.', 'nach', 'Países y ciudades → nach.'],
    ['Nach der Schule gehe ich ___ Hause.', 'nach', '¿Adónde? → nach Hause.'],
    ['Am Abend bin ich ___ Hause.', 'zu', '¿Dónde? → zu Hause.'],
    ['Heute Abend gehe ich ___ meinem Freund.', 'zu', 'Voy hacia una persona → zu.'],
    ['Heute schlafe ich ___ meinem Freund.', 'bei', 'Estoy en casa de alguien → bei.'],
    ['Ich muss ___ Zahnarzt.', 'zum', 'Voy al dentista → zu + dem = zum.'],
    ['Gestern war ich ___ Zahnarzt.', 'beim', 'Estuve en el dentista → bei + dem = beim.'],
    ['Wie komme ich ___ Universität?', 'zur', 'die Universität → zu + der = zur.'],
  ];
  const NZB_OPTS = ['nach', 'zu', 'zum', 'zur', 'bei', 'beim'];
  for (const [t, a, x] of NZB) {
    const others = NZB_OPTS.filter((o) => o !== a);
    const r = rng(t);
    const pick = others.map((o) => ({ o, k: r() })).sort((p, s) => p.k - s.k).slice(0, 3).map((p) => p.o);
    q.push(mc(M('dativ', 'unterwegs', 'medium', `${x} nach = ciudad/país/casa · zu = hacia persona/lugar · bei = en casa de / allí.`), `nach, zu o bei? ${t}`, [a, ...pick]));
  }
  const DG: [string, string, string[], Meta['d'], string][] = [
    ['Ich fahre mit ___ U-Bahn. (die)', 'der', ['der'], 'easy', 'die U-Bahn → mit der U-Bahn.'],
    ['Ich wohne bei ___ Eltern. (meine)', 'meinen', ['meinen'], 'medium', 'Plural → meinen Eltern.'],
    ['Das Geschenk ist von ___ Bruder. (mein)', 'meinem', ['meinem'], 'medium', 'der Bruder → von meinem Bruder.'],
    ['Seit ___ Woche bin ich krank. (eine)', 'einer', ['einer'], 'medium', 'die Woche → seit einer Woche.'],
    ['Ich komme aus ___ Stadt. (die)', 'der', ['der'], 'easy', 'die Stadt → aus der Stadt.'],
    ['Wir fahren mit ___ Freunden nach Sevilla. (die)', 'den', ['den'], 'medium', 'Plural: die Freunde → mit den Freunden.'],
    ['Nach ___ Essen gehe ich spazieren. (das)', 'dem', ['dem'], 'easy', 'das Essen → nach dem Essen.'],
    ['Ich lerne seit zwei ___ Deutsch. (Jahre)', 'Jahren', ['Jahren'], 'medium', 'Dativ plural: el sustantivo añade -n → seit zwei Jahren.'],
    ['Ich wohne bei ___ Oma. (meine)', 'meiner', ['meiner'], 'easy', 'die Oma → bei meiner Oma.'],
    ['Er spielt mit ___ Kind. (sein)', 'seinem', ['seinem'], 'medium', 'das Kind → mit seinem Kind (como mein → meinem).'],
    ['Ich fahre mit ___ Auto. (ein)', 'einem', ['einem'], 'easy', 'das Auto → mit einem Auto.'],
    ['Wir sprechen mit ___ Bankangestellten. (der)', 'dem', ['dem'], 'medium', 'der Bankangestellte → mit dem Bankangestellten.'],
  ];
  for (const [t, , acc, d, x] of DG) q.push(gp(M('dativ', 'unterwegs', d, `${x} Regla: -m · -r · -m · -n.`), 'Escribe la forma en Dativ', t, [acc]));
  const PRON: [string, string, string][] = [
    ['Kommst du mit ___? (ich)', 'mir', 'ich → mir'], ['Ich spiele mit ___. (er)', 'ihm', 'er → ihm'], ['Ich gehe mit ___ ins Kino. (sie, ella)', 'ihr', 'sie → ihr'],
    ['Wir kommen mit ___. (ihr)', 'euch', 'ihr → euch'], ['Kommt ihr mit ___? (wir)', 'uns', 'wir → uns'], ['Darf ich mit ___ sprechen? (Sie)', 'Ihnen', 'Sie → Ihnen'],
    ['Er wohnt bei ___. (du)', 'dir', 'du → dir'], ['Ich fahre mit ___ (es, das Kind)', 'ihm', 'es → ihm'],
  ];
  for (const [t, a, x] of PRON) q.push(gp(M('dativ', 'unterwegs', 'medium', `${x}. Pronombres en dativo: mir, dir, ihm, ihr, ihm, uns, euch, ihnen/Ihnen.`), 'Pronombre en Dativ', t, [[a]]));
  q.push(mt(M('dativ', 'unterwegs', 'medium', 'zu+dem=zum · zu+der=zur · bei+dem=beim · von+dem=vom'), 'Relaciona las contracciones',
    [['zu + dem', 'zum'], ['zu + der', 'zur'], ['bei + dem', 'beim'], ['von + dem', 'vom']]));
  const CT: [string, string, string][] = [
    ['Ich gehe ___ Arzt.', 'zum', 'zu + dem Arzt'], ['Ich gehe ___ Schule.', 'zur', 'zu + der Schule'], ['Ich kaufe Brot ___ Bäcker.', 'beim', 'bei + dem Bäcker'],
    ['Ich komme gerade ___ Training.', 'vom', 'von + dem Training'], ['Wir sind ___ Kino.', 'im', 'in + dem Kino'], ['Wir liegen ___ Strand.', 'am', 'an + dem Strand'],
  ];
  for (const [t, a, x] of CT) q.push(gp(M('dativ', 'unterwegs', 'medium', `${x} = ${a}.`), 'Completa con una contracción (zum, zur, beim, vom, im, am)', t, [[a]]));
  q.push(mc(M('dativ', 'unterwegs', 'hard', 'Plural: zu den Freunden. Las contracciones solo existen con dem/der singular.',
    { why: 'Trampa: parece que toca contraer (zum), pero en plural «zu den» no se contrae.' }), 'Ich gehe ___ Freunden.', ['zu den', 'zum', 'zur']));
  const CAT: [string, string, string[], string][] = [
    ['🐈 encima del 🛋️ → Die Katze sitzt ___ Sofa.', 'auf dem', ['auf dem', 'auf den', 'auf das'], 'Wo? → Dativ: auf dem Sofa.'],
    ['🐈 delante del 🛋️ → Die Katze liegt ___ Sofa.', 'vor dem', ['vor dem', 'vor den', 'vor der'], 'Wo? → Dativ: vor dem Sofa.'],
    ['🐈 detrás del 🛋️ → Die Katze versteckt sich ___ Sofa.', 'hinter dem', ['hinter dem', 'hinter das', 'hinter der'], 'Wo? → Dativ: hinter dem Sofa.'],
    ['🐈 al lado de la 🪴 → Die Katze sitzt ___ Pflanze.', 'neben der', ['neben der', 'neben die', 'neben dem'], 'die Pflanze → neben der Pflanze.'],
    ['🐈 dentro del 📦 → Die Katze schläft ___ Karton.', 'im', ['im', 'in den', 'in die'], 'in + dem = im Karton.'],
    ['🐈 colgada de la 🧱 → Die Katze hängt ___ Wand.', 'an der', ['an der', 'an die', 'an dem'], 'die Wand → an der Wand.'],
  ];
  for (const [t, a, o, x] of CAT) q.push(mc(M('dativ', 'unterwegs', 'medium', `${x} Con ¿dónde? (Wo?) estas preposiciones llevan Dativ.`), `Wo ist die Katze? ${t}`, [a, ...o.filter((y) => y !== a)]));
  q.push(mc(M('dativ', 'unterwegs', 'easy', '¿Dónde? = zu Hause. ¿Adónde? = nach Hause. «Ich gehe zu Hause» ✗.'), '¿Cuál es correcta?', ['Ich bin zu Hause.', 'Ich bin nach Hause.', 'Ich gehe zu Hause.']));
  q.push(mc(M('dativ', 'kh', 'easy', 'Mir tut … weh: la persona a la que le duele va en Dativ (mir).'), '___ tut der Kopf weh.', ['Mir', 'Ich', 'Mich']));
  const DE: [string, string][] = [
    ['Ich fahre mit [der|dem] Bus.', 'der Bus → mit dem Bus.'],
    ['Im Sommer fahre ich [zu|nach] Berlin.', 'Ciudades → nach Berlin.'],
    ['Ich lerne seit zwei [Jahre|Jahren] Deutsch.', 'Dativ plural +n → seit zwei Jahren.'],
    ['Ich wohne bei [mein|meinem] Vater.', 'der Vater → bei meinem Vater.'],
    ['Heute bleibe ich [nach|zu] Hause.', '¿Dónde? → zu Hause.'],
    ['Das Geschenk ist von [meine|meiner] Oma.', 'die Oma → von meiner Oma.'],
  ];
  for (const [s, x] of DE) q.push(er(M('dativ', 'unterwegs', 'medium', x), 'Fehlerjagd: toca la palabra incorrecta y corrígela', s));
  const MAPQ: [string, string, string, string][] = [
    ['Woher kommst du?', 'Ich komme ___ Supermarkt.', 'vom', 'von + dem → vom'],
    ['Wo liegt die Apotheke?', 'Die Apotheke liegt gegenüber ___ Bahnhof.', 'dem', 'gegenüber + Dativ: dem Bahnhof'],
    ['Wie fährst du zum Café?', 'Ich fahre mit ___ Bus zum Café.', 'dem', 'mit + Dativ: dem Bus'],
    ['Seit wann wartest du?', 'Ich warte seit zehn ___.', 'Minuten', 'seit + Dativ plural: zehn Minuten'],
  ];
  for (const [fq, t, a, x] of MAPQ) q.push(gp(M('dativ', 'trainer', 'medium', `${x}.`), `${fq} — completa la respuesta`, t, [[a]]));

  // ═════════ AKKUSATIV & KEIN (trainer · bank · warum · kh · Brücke) ═════════
  const KEIN: [string, string, string, Meta['s']][] = [
    ['Ich habe ___ Auto.', 'kein', 'das Auto (Akk.) → kein Auto.', 'trainer'],
    ['Ich habe ___ Tasche.', 'keine', 'die Tasche → keine Tasche.', 'trainer'],
    ['Ich sehe ___ Hund.', 'keinen', 'der Hund en Akkusativ → keinen Hund.', 'trainer'],
    ['Ich habe ___ Bücher.', 'keine', 'Plural → keine Bücher.', 'trainer'],
    ['Das ist ___ Bahnhof.', 'kein', 'Tras «sein» es Nominativ: der → kein Bahnhof.', 'trainer'],
    ['Wir trinken ___ Kaffee.', 'keinen', 'der Kaffee (Akk.) → keinen Kaffee.', 'trainer'],
    ['Er hat ___ Zeit.', 'keine', 'die Zeit → keine Zeit.', 'trainer'],
    ['Ich komme heute ___.', 'nicht', 'Se niega el verbo, no un sustantivo → nicht.', 'trainer'],
    ['Ich esse, obwohl ich ___ Hunger habe.', 'keinen', 'der Hunger → keinen Hunger.', 'warum'],
    ['Machen Sie zwei Wochen ___ Sport!', 'keinen', 'der Sport → keinen Sport.', 'kh'],
    ['Ich spreche ___ Französisch.', 'kein', 'Idioma sin artículo → kein Französisch.', 'bruecke'],
    ['Ich habe ___ Fieber.', 'kein', 'das Fieber → kein Fieber.', 'kh'],
    ['Er hat ___ Husten.', 'keinen', 'der Husten → keinen Husten.', 'kh'],
    ['Heute haben wir ___ Hausaufgaben.', 'keine', 'Plural → keine Hausaufgaben.', 'warum'],
  ];
  for (const [t, a, x, s] of KEIN) {
    q.push(mc(M('akkusativ', s, ['keinen', 'nicht'].includes(a) ? 'medium' : 'easy', `${x} kein (das/–) · keine (die/plural) · keinen (der, Akk.).`),
      `kein, keine, keinen o nicht? ${t}`, ['kein', 'keine', 'keinen', 'nicht'], { answer: ['kein', 'keine', 'keinen', 'nicht'].indexOf(a), fixed: true }));
  }
  const AKK: [string, string, string[], Meta['s'], string][] = [
    ['Haben Sie ___ Ausweis?', 'einen', ['ein', 'eine', 'einen'], 'bank', 'der Ausweis en Akkusativ → einen Ausweis.'],
    ['Ich möchte ___ Konto eröffnen.', 'ein', ['ein', 'eine', 'einen'], 'bank', 'das Konto → ein Konto (neutro no cambia).'],
    ['Ich möchte ___ neue Karte beantragen.', 'eine', ['ein', 'eine', 'einen'], 'bank', 'die Karte → eine Karte.'],
    ['Ich habe ___ Karte verloren.', 'meine', ['mein', 'meine', 'meinen'], 'bank', 'die Karte → meine Karte.'],
    ['Ich habe ___ Schlüssel verloren.', 'meinen', ['mein', 'meine', 'meinen'], 'warum', 'der Schlüssel en Akkusativ → meinen Schlüssel.'],
    ['Ich habe ___ Bruder.', 'einen', ['ein', 'eine', 'einen'], 'bruecke', 'der Bruder en Akkusativ → einen Bruder.'],
    ['Ich esse ___ Apfel.', 'einen', ['ein', 'eine', 'einen'], 'warum', 'der Apfel en Akkusativ → einen Apfel.'],
    ['Ich kaufe ___ neues Handy.', 'ein', ['ein', 'eine', 'einen'], 'warum', 'das Handy → ein Handy.'],
    ['Deshalb bekomme ich ___ Gips.', 'einen', ['ein', 'eine', 'einen'], 'kh', 'der Gips en Akkusativ → einen Gips.'],
    ['Nehmen Sie ___ Tablette.', 'eine', ['ein', 'eine', 'einen'], 'kh', 'die Tablette → eine Tablette.'],
  ];
  for (const [t, a, o, s, x] of AKK) {
    q.push(mc(M('akkusativ', s, a === 'einen' || a === 'meinen' ? 'medium' : 'easy', `${x} En Akkusativ solo cambia el masculino: der → den / ein → einen.`),
      `Akkusativ: ${t}`, o, { answer: o.indexOf(a), fixed: true }));
  }
  q.push(er(M('akkusativ', 'warum', 'medium', 'der Hunger → keinen Hunger (Akkusativ masculino).'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich habe [kein|keinen] Hunger.'));
  q.push(er(M('akkusativ', 'bank', 'medium', 'der Ausweis → einen Ausweis.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Haben Sie [ein|einen] Ausweis?'));
  q.push(er(M('akkusativ', 'trainer', 'medium', 'die Zeit → keine Zeit.'), 'Fehlerjagd: toca la palabra incorrecta y corrígela', 'Ich habe [keinen|keine] Zeit.'));
  q.push(wr(M('akkusativ', 'bruecke', 'medium', 'Ich spreche Englisch, aber ich spreche kein Französisch.'), 'Traduce: «Hablo inglés, pero no hablo francés.»',
    ['Ich spreche Englisch, aber ich spreche kein Französisch.', 'Ich spreche Englisch, aber kein Französisch.']));
  return q;
}
