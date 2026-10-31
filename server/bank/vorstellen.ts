// Brücke A1 · «Sich vorstellen»: batería de preguntas individuales para presentarse (preguntas W, verbos de la
// presentación, pregunta ↔ respuesta, du/Sie, und/aber, edad, idiomas). Todo correcto por construcción (tablas
// de conjugación regulares + sein/haben/sprechen irregulares) o escrito a mano; ids estables para el historial.
import type { Difficulty, QMc } from '../../shared/types.ts';

function mc(id: string, diff: Difficulty, prompt: string, correct: string, wrong: string[], explain: string): QMc {
  const opts = [...new Set([correct, ...wrong.filter((w) => w !== correct)])].slice(0, 4);
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const k = h % opts.length; [opts[0], opts[k]] = [opts[k], opts[0]];
  return { id, type: 'mc', topic: 'vorstellen', diff, src: 'bruecke', prompt, options: opts, answer: opts.indexOf(correct), explain, tags: ['brücke-a1'] };
}

type P = 'ich' | 'du' | 'er' | 'wir' | 'ihr' | 'Sie';
const PRON: P[] = ['ich', 'du', 'er', 'wir', 'ihr', 'Sie'];
const PRON_ES: Record<P, string> = { ich: 'yo', du: 'tú', er: 'él', wir: 'nosotros', ihr: 'vosotros', Sie: 'usted' };
/** Conjugaciones del presente de los verbos de la presentación (verificadas a mano). */
const VERBS: Record<string, { es: string; forms: Record<P, string>; rest: string }> = {
  heißen: { es: 'llamarse', forms: { ich: 'heiße', du: 'heißt', er: 'heißt', wir: 'heißen', ihr: 'heißt', Sie: 'heißen' }, rest: 'Anna.' },
  kommen: { es: 'venir', forms: { ich: 'komme', du: 'kommst', er: 'kommt', wir: 'kommen', ihr: 'kommt', Sie: 'kommen' }, rest: 'aus Spanien.' },
  wohnen: { es: 'vivir (residir)', forms: { ich: 'wohne', du: 'wohnst', er: 'wohnt', wir: 'wohnen', ihr: 'wohnt', Sie: 'wohnen' }, rest: 'in Zürich.' },
  leben: { es: 'vivir', forms: { ich: 'lebe', du: 'lebst', er: 'lebt', wir: 'leben', ihr: 'lebt', Sie: 'leben' }, rest: 'in Madrid.' },
  arbeiten: { es: 'trabajar', forms: { ich: 'arbeite', du: 'arbeitest', er: 'arbeitet', wir: 'arbeiten', ihr: 'arbeitet', Sie: 'arbeiten' }, rest: 'bei Siemens.' },
  studieren: { es: 'estudiar', forms: { ich: 'studiere', du: 'studierst', er: 'studiert', wir: 'studieren', ihr: 'studiert', Sie: 'studieren' }, rest: 'Medizin.' },
  sprechen: { es: 'hablar', forms: { ich: 'spreche', du: 'sprichst', er: 'spricht', wir: 'sprechen', ihr: 'sprecht', Sie: 'sprechen' }, rest: 'Deutsch.' },
  sein: { es: 'ser / estar', forms: { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', Sie: 'sind' }, rest: '16 Jahre alt.' },
  haben: { es: 'tener', forms: { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', Sie: 'haben' }, rest: 'zwei Geschwister.' },
  machen: { es: 'hacer', forms: { ich: 'mache', du: 'machst', er: 'macht', wir: 'machen', ihr: 'macht', Sie: 'machen' }, rest: 'gern Sport.' },
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const IRREG = new Set(['sein', 'haben', 'sprechen']);

function conjugation(): QMc[] {
  const out: QMc[] = [];
  for (const [inf, v] of Object.entries(VERBS)) for (const p of PRON) {
    const correct = v.forms[p];
    const wrong = [...new Set(Object.values(v.forms).filter((f) => f !== correct))];
    const why = IRREG.has(inf) ? `«${inf}» es irregular: hay que aprenderlo de memoria.` : p === 'du' && /[td]$/.test(inf.replace(/en$/, '')) ? 'Si la raíz acaba en -t/-d se añade -e-: du arbeitest.' : `Raíz «${inf.replace(/e?n$/, '')}-» + terminación de «${p}».`;
    out.push(mc(`vs-conj-${inf}-${p}`, IRREG.has(inf) ? 'medium' : 'easy', `${cap(p)} ___ ${v.rest} (${inf})`, correct, wrong, `${cap(p)} ${correct} ${v.rest} — ${PRON_ES[p]}, «${inf}» (${v.es}). ${why}`));
  }
  return out;
}

/** Pregunta → respuesta adecuada (lo que más se usa al presentarse). */
const QA: [string, string, string[], string][] = [
  ['Wie heißt du?', 'Ich heiße Laura.', ['Ich komme aus Laura.', 'Ich bin aus Laura.', 'Ich wohne Laura.'], '«Wie heißt du?» pregunta el nombre: Ich heiße … (o Ich bin …).'],
  ['Woher kommst du?', 'Ich komme aus Spanien.', ['Ich komme in Spanien.', 'Ich wohne aus Spanien.', 'Ich heiße Spanien.'], '«Woher?» = ¿de dónde? Se responde con «aus» + país: Ich komme aus Spanien.'],
  ['Wo wohnst du?', 'Ich wohne in Madrid.', ['Ich wohne aus Madrid.', 'Ich komme in Madrid.', 'Ich wohne nach Madrid.'], '«Wo?» = ¿dónde? Se responde con «in» + ciudad: Ich wohne in Madrid.'],
  ['Wie alt bist du?', 'Ich bin 15 Jahre alt.', ['Ich habe 15 Jahre.', 'Ich bin 15 Jahre.', 'Ich habe 15 Jahre alt.'], 'En alemán la edad va con «sein»: Ich bin 15 Jahre alt (no «Ich habe 15 Jahre»).'],
  ['Was machst du?', 'Ich bin Schüler.', ['Ich bin ein Schüler aus.', 'Ich mache Schüler.', 'Ich heiße Schüler.'], 'Para la profesión o si estudias: Ich bin Schüler/Schülerin (sin artículo).'],
  ['Welche Sprachen sprichst du?', 'Ich spreche Spanisch und Englisch.', ['Ich spreche aus Spanisch.', 'Ich bin Spanisch und Englisch.', 'Ich sprichst Spanisch.'], '«sprechen»: ich spreche, du sprichst. Los idiomas no llevan artículo: Ich spreche Deutsch.'],
  ['Wie geht es dir?', 'Danke, gut. Und dir?', ['Ich heiße gut.', 'Ich komme gut.', 'Danke, ich bin 15.'], '«Wie geht es dir?» = ¿cómo estás? Respuesta típica: Danke, gut. Und dir?'],
  ['Hast du Geschwister?', 'Ja, ich habe einen Bruder.', ['Ja, ich bin einen Bruder.', 'Ja, ich habe ein Bruder.', 'Ja, ich hast einen Bruder.'], '«haben» + Akkusativ: einen Bruder (masculino), eine Schwester.'],
  ['Was ist dein Hobby?', 'Mein Hobby ist Fußball.', ['Mein Hobby bin Fußball.', 'Ich Hobby ist Fußball.', 'Mein Hobby heißt aus Fußball.'], '«Mein Hobby ist …» o «Ich spiele gern …».'],
  ['Wie ist deine Handynummer?', 'Meine Nummer ist 0151 234 567.', ['Ich bin 0151 234 567.', 'Ich heiße 0151 234 567.', 'Mein Nummer bin 0151.'], 'Nummer es femenino: meine Nummer.'],
  ['Wie heißen Sie?', 'Ich heiße Müller, Thomas Müller.', ['Du heißt Müller.', 'Sie heißen Müller.', 'Ich heißt Müller.'], 'Pregunta formal (Sie). Se responde igual: Ich heiße …'],
  ['Woher kommen Sie?', 'Ich komme aus Mexiko.', ['Sie kommen aus Mexiko.', 'Ich kommen aus Mexiko.', 'Ich komme nach Mexiko.'], 'Aunque pregunten con «Sie», respondes con «ich komme».'],
  ['Wo arbeiten Sie?', 'Ich arbeite bei einer Bank.', ['Ich arbeitest bei einer Bank.', 'Ich arbeite aus einer Bank.', 'Ich bin bei Bank.'], '«arbeiten bei» + empresa: Ich arbeite bei einer Bank.'],
  ['Was studierst du?', 'Ich studiere Informatik.', ['Ich studierst Informatik.', 'Ich bin studiere Informatik.', 'Ich studiere aus Informatik.'], 'studieren: ich studiere, du studierst.'],
  ['Sprechen Sie Englisch?', 'Ja, ein bisschen.', ['Ja, ich bin Englisch.', 'Nein, ich heiße Englisch.', 'Ja, ich komme Englisch.'], 'Pregunta de sí/no: Ja, ein bisschen · Nein, leider nicht.'],
];
function questionAnswer(): QMc[] {
  return QA.map(([q, a, wrong, why], i) => mc(`vs-qa-${i}`, 'easy', `Te preguntan: «${q}» ¿Qué respondes?`, a, wrong, why));
}

/** Respuesta → ¿qué preguntaron? */
function answerToQuestion(): QMc[] {
  const items: [string, string, string[]][] = [
    ['Ich heiße Paul.', 'Wie heißt du?', ['Woher kommst du?', 'Wo wohnst du?', 'Wie alt bist du?']],
    ['Ich komme aus Italien.', 'Woher kommst du?', ['Wo wohnst du?', 'Wie heißt du?', 'Was machst du?']],
    ['Ich wohne in Berlin.', 'Wo wohnst du?', ['Woher kommst du?', 'Wie heißt du?', 'Wann kommst du?']],
    ['Ich bin 17.', 'Wie alt bist du?', ['Wie geht es dir?', 'Wer bist du?', 'Wie heißt du?']],
    ['Mir geht es super!', 'Wie geht es dir?', ['Wie alt bist du?', 'Was machst du?', 'Wo wohnst du?']],
    ['Ich spreche Deutsch und Spanisch.', 'Welche Sprachen sprichst du?', ['Woher kommst du?', 'Was studierst du?', 'Wie heißt du?']],
    ['Ich bin Lehrerin.', 'Was machst du beruflich?', ['Wie heißt du?', 'Wo wohnst du?', 'Woher kommst du?']],
    ['Ich arbeite bei Siemens.', 'Wo arbeitest du?', ['Was arbeitest du?', 'Woher kommst du?', 'Wann arbeitest du?']],
  ];
  return items.map(([a, q, wrong], i) => mc(`vs-aq-${i}`, 'easy', `La respuesta es «${a}». ¿Cuál era la pregunta?`, q, wrong, `«${a}» responde a «${q}».`));
}

/** Palabra interrogativa (W-Wort). */
function wWords(): QMc[] {
  const items: [string, string, string, string[]][] = [
    ['___ heißt du?', 'Wie', '¿Cómo te llamas? → Wie (cómo).', ['Wo', 'Was', 'Woher']],
    ['___ kommst du?', 'Woher', '¿De dónde vienes? → Woher (de dónde).', ['Wo', 'Wie', 'Wer']],
    ['___ wohnst du?', 'Wo', '¿Dónde vives? → Wo (dónde).', ['Woher', 'Was', 'Wann']],
    ['___ machst du?', 'Was', '¿Qué haces? → Was (qué).', ['Wie', 'Wo', 'Wer']],
    ['___ ist das? — Das ist mein Bruder.', 'Wer', '¿Quién es? → Wer (quién).', ['Was', 'Wie', 'Wo']],
    ['___ alt bist du?', 'Wie', '«Wie alt» = qué edad (literalmente «cómo de viejo»).', ['Was', 'Wann', 'Wo']],
    ['___ lernst du Deutsch? — Weil ich in Zürich arbeite.', 'Warum', '¿Por qué? → Warum.', ['Wann', 'Wo', 'Woher']],
    ['___ hast du Deutschkurs? — Am Montag.', 'Wann', '¿Cuándo? → Wann.', ['Wo', 'Wie', 'Warum']],
  ];
  return items.map(([p, c, why, wrong], i) => mc(`vs-w-${i}`, 'easy', p, c, wrong, why));
}

/** du ↔ Sie, und/aber, números de la edad, saludos. */
function misc(): QMc[] {
  const out: QMc[] = [];
  const formal: [string, string, string[]][] = [
    ['Wie heißt du?', 'Wie heißen Sie?', ['Wie heißt Sie?', 'Wie heißen du?', 'Wie heiße Sie?']],
    ['Woher kommst du?', 'Woher kommen Sie?', ['Woher kommst Sie?', 'Woher komme Sie?', 'Woher kommt Sie?']],
    ['Wo wohnst du?', 'Wo wohnen Sie?', ['Wo wohnst Sie?', 'Wo wohnt Sie?', 'Wo wohne Sie?']],
    ['Was machst du?', 'Was machen Sie?', ['Was machst Sie?', 'Was macht Sie?', 'Was mache Sie?']],
    ['Sprichst du Deutsch?', 'Sprechen Sie Deutsch?', ['Sprichst Sie Deutsch?', 'Spricht Sie Deutsch?', 'Spreche Sie Deutsch?']],
  ];
  formal.forEach(([du, sie, wrong], i) => out.push(mc(`vs-sie-${i}`, 'medium', `Pásalo a formal (Sie): «${du}»`, sie, wrong, '«Sie» (usted) va SIEMPRE con la forma del verbo en -en, igual que «wir»: Sie heißen, Sie kommen.')));
  const con: [string, string, string][] = [
    ['Ich komme aus Spanien ___ ich wohne in Zürich.', 'und', 'Dos ideas que se suman → und (y).'],
    ['Ich wohne in Zürich, ___ ich komme aus Spanien.', 'aber', 'Contraste → aber (pero).'],
    ['Ich heiße Álvaro ___ ich bin 16 Jahre alt.', 'und', 'Información que se añade → und.'],
    ['Ich spreche Englisch, ___ nicht so gut Deutsch.', 'aber', 'Contraste → aber.'],
    ['Ich mag Kaffee, ___ keinen Tee.', 'aber', 'Contraste (sí … pero no …) → aber.'],
    ['Mein Bruder heißt Leo ___ meine Schwester heißt Mia.', 'und', 'Dos datos del mismo tipo → und.'],
  ];
  con.forEach(([p, c, why], i) => out.push(mc(`vs-con-${i}`, 'easy', p, c, c === 'und' ? ['aber', 'oder', 'weil'] : ['und', 'oder', 'weil'], `${why} Tras «und/aber» el orden no cambia: el verbo sigue en 2.ª posición.`)));
  const nums: [number, string][] = [[12, 'zwölf'], [13, 'dreizehn'], [14, 'vierzehn'], [15, 'fünfzehn'], [16, 'sechzehn'], [17, 'siebzehn'], [18, 'achtzehn'], [21, 'einundzwanzig'], [25, 'fünfundzwanzig'], [30, 'dreißig'], [34, 'vierunddreißig'], [47, 'siebenundvierzig']];
  const wrongs: Record<string, string[]> = { sechzehn: ['sechszehn'], siebzehn: ['siebenzehn'], dreißig: ['dreizig'], einundzwanzig: ['zwanzigeins', 'einszwanzig'] };
  nums.forEach(([n, w], i) => {
    const pool = [...(wrongs[w] ?? []), ...nums.filter(([m]) => m !== n).map(([, x]) => x)];
    out.push(mc(`vs-num-${n}`, n > 20 ? 'medium' : 'easy', `«Ich bin ${n} Jahre alt.» ¿Cómo se dice ${n}?`, w, pool.slice(i % 3, (i % 3) + 3), n > 20 ? 'Del 21 en adelante: primero la unidad, luego «und», luego la decena: einundzwanzig = 1 + 20.' : 'Del 13 al 19: unidad + «zehn». Ojo: sechzehn, siebzehn (se pierden letras).'));
  });
  const greet: [string, string, string[], string][] = [
    ['Por la mañana, saludo formal:', 'Guten Morgen!', ['Gute Nacht!', 'Tschüss!', 'Guten Abend!'], 'Guten Morgen = buenos días (por la mañana).'],
    ['Despedirte de un amigo:', 'Tschüss!', ['Guten Tag!', 'Hallo!', 'Freut mich!'], 'Tschüss = adiós (informal). Formal: Auf Wiedersehen.'],
    ['Cuando te presentan a alguien dices:', 'Freut mich!', ['Tschüss!', 'Gute Nacht!', 'Entschuldigung!'], 'Freut mich = encantado/a.'],
    ['Despedida formal:', 'Auf Wiedersehen!', ['Hallo!', 'Bis gleich, du!', 'Servus, Alter!'], 'Auf Wiedersehen = adiós (formal).'],
  ];
  greet.forEach(([p, c, w, why], i) => out.push(mc(`vs-gr-${i}`, 'easy', p, c, w, why)));
  const word: [string, string, string[], string][] = [
    ['Ich wohne ___ Berlin.', 'in', ['aus', 'nach', 'bei'], 'Dónde vives: in + ciudad.'],
    ['Ich komme ___ der Türkei.', 'aus', ['in', 'von', 'nach'], 'De dónde vienes: aus + país (aus der Türkei, aus der Schweiz).'],
    ['Ich arbeite ___ BMW.', 'bei', ['in', 'aus', 'mit'], 'Empresa en la que trabajas: bei + empresa.'],
    ['Ich bin ___. (estudiante de instituto, chico)', 'Schüler', ['Schülerin', 'ein Schüler', 'Student'], 'Profesión/estudios sin artículo: Ich bin Schüler (chico) / Schülerin (chica).'],
  ];
  word.forEach(([p, c, w, why], i) => out.push(mc(`vs-prep-${i}`, 'medium', p, c, w, why)));
  return out;
}

export function vorstellenQuestions(): QMc[] {
  return [...conjugation(), ...questionAnswer(), ...answerToQuestion(), ...wWords(), ...misc()];
}
