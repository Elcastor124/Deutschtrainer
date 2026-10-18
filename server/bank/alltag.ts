// Día a día: números, horas, colores, saludos y conversaciones.
// Fuentes: Brücke A1 (index.html), Auf der Bank, deutsch-trainer-120.html; lo marcado 'a1' es contenido nuevo.
import type { Question } from '../../shared/types.ts';
import { deNum } from '../../shared/vocab.ts';
import { gp, mc, mt, wr, type Meta } from './h.ts';

const A = (s: Meta['s'], d: Meta['d'], x: string, extra: Partial<Meta> = {}): Meta => ({ t: 'alltag', s, d, x, ...extra });

const COLORS: [string, string, string][] = [
  ['rot', 'rojo', '#FF3832'], ['blau', 'azul', '#2f6bff'], ['grün', 'verde', '#2fbf5f'], ['gelb', 'amarillo', '#ffd23a'],
  ['schwarz', 'negro', '#000000'], ['weiß', 'blanco', '#ffffff'], ['grau', 'gris', '#888888'], ['orange', 'naranja', '#ff8a1f'],
  ['braun', 'marrón', '#7a4a24'], ['rosa', 'rosa', '#ff9ecf'], ['lila', 'morado / lila', '#9b5cff'],
];

// Horas del trainer (deutsch-trainer-120.html): [h, min, informal, formal/alternativas]
const TIMES: [string, string, string[]][] = [
  ['3:00', 'drei Uhr', ['drei', 'fünfzehn Uhr']],
  ['6:30', 'halb sieben', ['sechs Uhr dreißig']],
  ['8:15', 'Viertel nach acht', ['acht Uhr fünfzehn']],
  ['9:45', 'Viertel vor zehn', ['neun Uhr fünfundvierzig']],
  ['5:10', 'zehn nach fünf', ['fünf Uhr zehn']],
  ['8:40', 'zwanzig vor neun', ['acht Uhr vierzig']],
  ['13:00', 'dreizehn Uhr', ['ein Uhr', 'eins']],
  ['18:45', 'Viertel vor sieben', ['achtzehn Uhr fünfundvierzig']],
];

export function alltagQuestions(): Question[] {
  const q: Question[] = [];

  // ── Colores (trainer) ──
  COLORS.forEach(([de, es, hex], i) => {
    const others = COLORS.filter((_, j) => j !== i).map((c) => c[0]);
    const opts = [de, others[(i * 3) % others.length], others[(i * 5 + 2) % others.length], others[(i * 7 + 4) % others.length]];
    if (new Set(opts).size === 4) q.push(mc(A('trainer', 'easy', `Es ${de} (${es}).`), 'Welche Farbe ist das?', opts, { swatch: hex }));
    q.push(wr(A('trainer', 'medium', `${es} = ${de}. Los colores (adjetivos) van en minúscula.`), `¿Cómo se dice «${es}» en alemán?`, [de]));
  });
  q.push(mt(A('trainer', 'easy', 'rot = rojo · blau = azul · gelb = amarillo · grün = verde'), 'Relaciona los colores', [['rot', 'rojo'], ['blau', 'azul'], ['gelb', 'amarillo'], ['grün', 'verde']]));
  q.push(mt(A('trainer', 'medium', 'schwarz = negro · weiß = blanco · braun = marrón · lila = morado'), 'Relaciona los colores', [['schwarz', 'negro'], ['weiß', 'blanco'], ['braun', 'marrón'], ['lila', 'morado']]));
  q.push(gp(A('a1', 'medium', 'Die Karte ist schwarz. El adjetivo detrás de «ist» no cambia de forma.'), 'Completa (negra):', 'Die Karte ist ___.', ['schwarz']));
  q.push(gp(A('a1', 'medium', 'Der Bus ist gelb. Tras «ist» el color va sin terminación.'), 'Completa (amarillo):', 'Der Bus in Berlin ist ___.', ['gelb']));

  // ── Números (Brücke A1) ──
  for (const n of [7, 12, 16, 17, 20]) {
    const trap = n === 16 ? ' ¡Ojo! sechzehn, no *sechszehn.' : n === 17 ? ' ¡Ojo! siebzehn, no *siebenzehn.' : '';
    q.push(wr(A('bruecke', 'easy', `${n} = ${deNum(n)}.${trap}`), `Escribe el número en letras: ${n}`, [deNum(n)], { strict: true }));
  }
  for (const n of [21, 34, 45, 58, 67, 76, 89, 99]) {
    q.push(wr(A('bruecke', 'medium', `${n} = ${deNum(n)}: en alemán se dice primero la unidad («${deNum(n % 10 === 1 ? 1 : n % 10).replace('eins', 'ein')}-und-…»), al revés que en español.`),
      `Escribe el número en letras: ${n}`, [deNum(n)], { strict: true }));
  }
  q.push(wr(A('a1', 'medium', '100 = hundert (también «einhundert»).'), 'Escribe el número en letras: 100', ['hundert', 'einhundert'], { strict: true }));
  for (const [n, d1, d2] of [[63, 36, 33], [47, 74, 44], [82, 28, 22], [29, 92, 99], [56, 65, 55]]) {
    q.push(mc(A('bruecke', 'easy', `${deNum(n)} = ${n}. Primero la unidad (${n % 10}), después la decena (${n - (n % 10)}).`),
      `¿Qué número es «${deNum(n)}»?`, [String(n), String(d1), String(d2)]));
  }
  q.push(mc(A('bruecke', 'easy', 'sechzehn (16) pierde la -s de sechs.'), '¿Cuál está bien escrito? (16)', ['sechzehn', 'sechszehn', 'sechzen']));
  q.push(mc(A('bruecke', 'easy', 'siebzehn (17) pierde el -en de sieben.'), '¿Cuál está bien escrito? (17)', ['siebzehn', 'siebenzehn', 'siebzen']));
  q.push(gp(A('bank', 'medium', 'Ich möchte hundert Euro einzahlen. Con möchte, el infinitivo va al final.'), 'Escribe el número en letras:', 'Ich möchte ___ Euro einzahlen. (100)', [['hundert', 'einhundert']]));
  q.push(gp(A('bank', 'medium', 'Bahnhofstraße 12 → zwölf.'), 'Escribe el número en letras:', 'Ich wohne in der Bahnhofstraße ___. (12)', [['zwölf']]));
  q.push(gp(A('bruecke', 'easy', 'Ich bin sechzehn Jahre alt. Edad: sein + Zahl + Jahre alt.'), 'Completa (16):', 'Ich bin ___ Jahre alt.', [['sechzehn']]));

  // ── Horas (trainer) ──
  for (const [hhmm, inf, alt] of TIMES) {
    const acc = [inf, ...alt].flatMap((a) => [a, `Es ist ${a}`]);
    const halb = inf.startsWith('halb') ? ' ¡Ojo! «halb sieben» = 6:30: halb mira a la hora SIGUIENTE.' : '';
    q.push(wr(A('trainer', 'medium', `${hhmm} → «${inf}» o «${alt[0]}». Ambas formas valen.${halb}`), `Wie spät ist es? ${hhmm}`, acc));
  }
  q.push(mc(A('trainer', 'easy', 'halb sieben = 6:30. «halb» = media hora ANTES de la hora que se nombra.'), '«Es ist halb sieben.» ¿Qué hora es?', ['6:30', '7:30', '5:30']));
  q.push(mc(A('trainer', 'easy', 'Viertel nach acht = 8:15 (nach = y). Viertel vor = menos cuarto.'), '«Es ist Viertel nach acht.» ¿Qué hora es?', ['8:15', '7:45', '8:45']));
  q.push(mc(A('trainer', 'easy', 'Viertel vor zehn = 9:45 (vor = menos).'), '«Es ist Viertel vor zehn.» ¿Qué hora es?', ['9:45', '10:15', '10:45']));
  q.push(mc(A('trainer', 'medium', 'zwanzig vor neun = 8:40.'), '«Es ist zwanzig vor neun.» ¿Qué hora es?', ['8:40', '9:20', '8:20']));
  q.push(mc(A('warum', 'easy', '«um sieben Uhr» = a las siete. Para decir A QUÉ HORA se usa «um».'), 'Ich bin ___ 7 Uhr aufgestanden.', ['um', 'am', 'im']));

  // ── Saludos (Brücke A1) ──
  q.push(mc(A('bruecke', 'easy', 'Guten Morgen = buenos días, hasta las ~11 h. Vale también con el profesor.'), 'Son las 8:00 y ves a tu profesor. ¿Qué dices?', ['Guten Morgen!', 'Guten Abend!', 'Tschüss!']));
  q.push(mc(A('bruecke', 'easy', 'Tschüss = adiós informal (amigos, familia).'), 'Te despides de un amigo. ¿Qué dices?', ['Tschüss!', 'Guten Tag!', 'Wie geht\'s?']));
  q.push(mc(A('bruecke', 'easy', 'Auf Wiedersehen = despedida formal (banco, tienda, profesor).'), 'Te despides de la empleada del banco. ¿Qué dices?', ['Auf Wiedersehen!', 'Tschüss, Alter!', 'Hallo!']));
  q.push(mc(A('bruecke', 'easy', 'Guten Abend se dice al LLEGAR por la noche (no al irse a dormir).'), 'Llegas a una cena a las 20:00. ¿Qué dices?', ['Guten Abend!', 'Guten Morgen!', 'Bis morgen!']));
  q.push(mc(A('bruecke', 'easy', 'Wie geht\'s? → Gut, danke. Und dir?'), '— Wie geht\'s?', ['Gut, danke. Und dir?', 'Ich heiße Pablo.', 'Ich komme aus Spanien.']));
  q.push(mt(A('bruecke', 'easy', 'Hallo = hola · Tschüss = adiós · Bis morgen = hasta mañana · Guten Tag = buenos días (formal)'), 'Relaciona los saludos',
    [['Hallo', 'hola'], ['Tschüss', 'adiós'], ['Bis morgen', 'hasta mañana'], ['Guten Tag', 'buenos días (formal)']]));

  // ── Las 4 preguntas (Brücke A1) ──
  const ans4: [string, string][] = [
    ['Wie heißt du?', 'Ich heiße Pablo.'], ['Wie alt bist du?', 'Ich bin 16 Jahre alt.'],
    ['Woher kommst du?', 'Ich komme aus Spanien.'], ['Wo wohnst du?', 'Ich wohne in Sevilla.'],
  ];
  ans4.forEach(([fq, fa], i) => {
    const others = ans4.filter((_, j) => j !== i).map((x) => x[1]);
    q.push(mc(A('bruecke', 'easy', `${fq} → ${fa}`), `Lena pregunta: «${fq}» ¿Qué respondes?`, [fa, ...others.slice(0, 2)]));
  });
  q.push(mt(A('bruecke', 'easy', 'Las 4 preguntas clave de la presentación.'), 'Relaciona pregunta y respuesta', ans4));
  q.push(mc(A('bruecke', 'medium', 'Woher? = ¿de dónde? (origen) → aus. Wo? = ¿dónde? (lugar) → in.'), '¿Qué pregunta corresponde a «Ich wohne in Sevilla»?', ['Wo wohnst du?', 'Woher kommst du?', 'Wie heißt du?']));
  q.push(gp(A('bruecke', 'easy', 'du → -st: Woher kommst du? (ich komme, du kommst)'), 'Completa la terminación:', 'Woher komm___ du?', [['st']]));
  q.push(gp(A('bruecke', 'easy', 'heißen: ich heiße, du heißt (la -s- ya está en la raíz, solo se añade -t).'), 'Completa la terminación:', 'Wie heiß___ du?', [['t']]));
  q.push(gp(A('bruecke', 'easy', 'ich → -e: Ich wohne in Sevilla.'), 'Completa la terminación:', 'Ich wohn___ in Sevilla.', [['e']]));
  q.push(gp(A('bruecke', 'easy', 'sein es irregular: ich bin, du bist.'), 'Completa:', 'Wie alt ___ du?', [['bist']]));

  // ── Idiomas y sprechen (Brücke A1) ──
  q.push(gp(A('bruecke', 'medium', 'sprechen cambia la vocal: ich spreche, du sprichst, er spricht.'), 'Completa (sprechen):', 'Welche Sprachen ___ du?', [['sprichst']]));
  q.push(gp(A('bruecke', 'medium', 'er/sie spricht (cambio e → i).'), 'Completa (sprechen):', 'Meine Mutter ___ Englisch.', [['spricht']]));
  q.push(gp(A('bruecke', 'easy', 'Ich spreche Spanisch und ein bisschen Deutsch. ein bisschen = un poco.'), 'Completa:', 'Ich spreche Spanisch und ein ___ Deutsch.', [['bisschen']]));
  q.push(mc(A('bruecke', 'medium', '«aber» une dos ideas que contrastan: me gusta… PERO no…'), 'Ich mag Fußball, ___ ich mag Tennis nicht.', ['aber', 'und', 'weil']));
  q.push(mc(A('bruecke', 'easy', '«und» suma información: vengo de España Y vivo en Sevilla.'), 'Ich komme aus Spanien ___ wohne in Sevilla.', ['und', 'aber', 'obwohl']));

  // ── En el banco: du / Sie y diálogo (Auf der Bank) ──
  q.push(mc(A('bank', 'easy', 'En el banco se habla de usted: Sie (siempre con mayúscula).'), '¿du o Sie? Hablas con el empleado del banco.', ['Sie', 'du'], { fixed: true }));
  q.push(mc(A('bank', 'easy', 'En una entrevista de trabajo: Sie (formal).'), '¿du o Sie? En el Vorstellungsgespräch.', ['Sie', 'du'], { fixed: true }));
  q.push(mc(A('bank', 'easy', 'Con amigos y familia: du (informal).'), '¿du o Sie? Hablas con un amigo.', ['du', 'Sie'], { answer: 0 }));
  q.push(mc(A('bank', 'medium', 'Wie kann ich IHNEN helfen? — Ihnen = a usted (dativo de Sie).'), 'Bankangestellter: «Wie kann ich Ihnen helfen?»', ['Ich möchte ein Konto eröffnen.', 'Ich heiße Konto.', 'Nein, danke. Auf Wiedersehen!']));
  q.push(mc(A('bank', 'easy', 'Te piden el documento → Ja. Hier, bitte.'), 'Bankangestellter: «Haben Sie einen Ausweis?»', ['Ja. Hier, bitte.', 'Ich wohne in Berlin.', 'Wie bitte? Ich möchte Geld.']));
  q.push(mc(A('bank', 'easy', 'Wie ist Ihre Adresse? → Ich wohne in der Bahnhofstraße 12.'), 'Bankangestellter: «Wie ist Ihre Adresse?»', ['Ich wohne in der Bahnhofstraße 12.', 'Ich bin 16 Jahre alt.', 'Ja, hier bitte.']));
  q.push(mc(A('bank', 'easy', 'Brauchen Sie sonst noch etwas? → Nein, danke. Auf Wiedersehen!'), 'Bankangestellter: «Brauchen Sie sonst noch etwas?»', ['Nein, danke. Auf Wiedersehen!', 'Guten Morgen!', 'Ich habe einen Ausweis.']));
  q.push(mc(A('bank', 'easy', 'Wie bitte? = ¿Cómo dice? Tu frase salvavidas si no entiendes.'), 'No has entendido al empleado. ¿Qué dices?', ['Wie bitte?', 'Wie geht\'s?', 'Bis morgen!']));
  q.push(mc(A('bank', 'medium', '«Entschuldigung» abre cualquier problema en alemán.'), 'Tu tarjeta no funciona. ¿Cómo empiezas?', ['Entschuldigung, meine Karte funktioniert nicht.', 'Tschüss, meine Karte!', 'Ich möchte meine Karte funktionieren.']));

  // Situaciones del banco: producir la frase (respuestas abiertas → revisión del profesor si hay dudas)
  const SIT: [string, string[]][] = [
    ['Quieres sacar dinero.', ['Ich möchte Geld abheben.', 'Ich möchte Geld abheben, bitte.']],
    ['Quieres abrir una cuenta.', ['Ich möchte ein Konto eröffnen.', 'Ich möchte ein Bankkonto eröffnen.']],
    ['Quieres ingresar 100 euros.', ['Ich möchte 100 Euro einzahlen.', 'Ich möchte hundert Euro einzahlen.']],
    ['Has perdido tu tarjeta.', ['Ich habe meine Karte verloren.']],
    ['Quieres pedir una tarjeta nueva.', ['Ich möchte eine neue Karte beantragen.']],
    ['Tu tarjeta no funciona.', ['Meine Karte funktioniert nicht.', 'Entschuldigung, meine Karte funktioniert nicht.']],
    ['Preguntas dónde tienes que firmar.', ['Wo muss ich unterschreiben?']],
  ];
  for (const [es, acc] of SIT) {
    q.push(wr(A('bank', 'medium', `${acc[0]} — con möchte/muss, el segundo verbo va al FINAL.`), `Auf der Bank: ${es} ¿Qué dices?`, acc));
  }
  return q;
}
