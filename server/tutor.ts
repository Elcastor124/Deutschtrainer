// KLAUS · TUTOR CONTEXTUAL (V1, sin IA): reglas deterministas + plantillas. No hay modelo generativo ni API externa.
// Tres niveles de ayuda:
//   1 · Pista: orienta sin revelar la respuesta (nunca contiene la opción correcta).
//   2 · Regla: explica el concepto con un ejemplo DISTINTO al de la pregunta.
//   3 · Solución razonada: respuesta correcta + explicación verificada del banco (q.explain) + la regla.
// Si no hay una regla específica para la pregunta, se usa la regla general del tema; si tampoco existe, Klaus lo dice.
import type { Question, Topic } from '../shared/types.ts';

export type HintLevel = 1 | 2 | 3;
export interface Hint { level: HintLevel; ruleId: string | null; text: string; example?: string; solution?: string }

/** Una regla gramatical comprobable: cuándo aplica, pista, explicación y ejemplos correcto/incorrecto. */
export interface Rule {
  id: string; topic: Topic; level: 'A1' | 'A2' | 'B1';
  /** Detecta si la regla aplica a la pregunta (sobre el enunciado). */
  match?: (prompt: string) => boolean;
  hint: string; rule: string;
  example: { ok: string; ko: string };
  errorType: string;
}

const has = (re: RegExp) => (p: string) => re.test(p);
export const RULES: Rule[] = [
  // ── Dativ
  { id: 'dat-prep', topic: 'dativ', level: 'A1', match: has(/\b(mit|bei|von|zu|aus|nach|seit|gegenüber)\b\s+(___|…)/i), errorType: 'caso tras preposición',
    hint: 'Fíjate en la preposición que va justo antes del hueco. ¿Qué caso pide siempre?', rule: 'mit, bei, von, zu, aus, nach, seit y gegenüber van SIEMPRE con dativo: der/das → dem, die → der, (plural) → den + -n.',
    example: { ok: 'Ich fahre mit dem Bus.', ko: 'Ich fahre mit den Bus.' } },
  { id: 'dat-verb', topic: 'dativ', level: 'A2', match: has(/\b(helfe|hilft|hilfst|danke|dankt|gehört|gefällt|antworte|schmeckt|passt)\b/i), errorType: 'verbo con dativo',
    hint: 'El verbo de esta frase no lleva acusativo. ¿Recuerdas qué verbos piden dativo?', rule: 'helfen, danken, gehören, gefallen, antworten, schmecken y passen llevan complemento en dativo (a quién).',
    example: { ok: 'Ich helfe meiner Mutter.', ko: 'Ich helfe meine Mutter.' } },
  { id: 'dat-gen', topic: 'dativ', level: 'A2', errorType: 'artículo en dativo',
    hint: 'Primero piensa en el género del sustantivo y luego en el caso dativo.', rule: 'Dativo: der → dem, die → der, das → dem, ein → einem, eine → einer, mein → meinem, meine → meiner.',
    example: { ok: 'Das Buch gehört dem Lehrer.', ko: 'Das Buch gehört der Lehrer.' } },
  // ── Akkusativ
  { id: 'akk-prep', topic: 'akkusativ', level: 'A1', match: has(/\b(für|ohne|gegen|durch|um)\b\s+(___|…)/i), errorType: 'caso tras preposición',
    hint: 'Mira la preposición antes del hueco: es de las que siempre piden el mismo caso.', rule: 'für, ohne, gegen, durch y um van SIEMPRE con acusativo: solo cambia el masculino (der → den, ein → einen).',
    example: { ok: 'Das Geschenk ist für den Vater.', ko: 'Das Geschenk ist für dem Vater.' } },
  { id: 'akk-obj', topic: 'akkusativ', level: 'A1', errorType: 'complemento directo',
    hint: '¿Qué hace el verbo con este sustantivo? Si es lo que se compra, se busca o se tiene, es el complemento directo.', rule: 'El complemento directo va en acusativo. Solo cambia el masculino: der → den, ein → einen, kein → keinen, mein → meinen. Femenino y neutro no cambian.',
    example: { ok: 'Ich kaufe einen Tisch.', ko: 'Ich kaufe ein Tisch.' } },
  // ── Präpositionen (Wechsel)
  { id: 'wechsel', topic: 'praep', level: 'A2', match: has(/\b(wo|wohin)\b/i), errorType: 'Wechselpräposition',
    hint: 'La pregunta te da la clave: ¿hay movimiento hacia un sitio (wohin) o es una posición (wo)?', rule: 'in, an, auf, unter, über, vor, hinter, neben, zwischen: «wo?» (posición) → dativo; «wohin?» (movimiento hacia) → acusativo.',
    example: { ok: 'Ich lege das Buch auf den Tisch. (wohin?)', ko: 'Ich lege das Buch auf dem Tisch. (wohin?)' } },
  { id: 'praep-gen', topic: 'praep', level: 'A2', errorType: 'preposición',
    hint: 'Piensa si la preposición expresa lugar, dirección o tiempo, y qué caso pide.', rule: 'Acusativo fijo: für, ohne, gegen, durch, um. Dativo fijo: mit, bei, von, zu, aus, nach, seit. Wechsel: wo? dativo / wohin? acusativo.',
    example: { ok: 'Wir gehen ohne den Hund.', ko: 'Wir gehen ohne dem Hund.' } },
  // ── Präsens
  { id: 'praes-end', topic: 'praesens', level: 'A1', errorType: 'terminación verbal',
    hint: 'Busca el sujeto de la frase: la terminación del verbo depende de él.', rule: 'Presente regular: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en. Raíz en -t/-d: du arbeitest, er arbeitet.',
    example: { ok: 'Du wohnst in Berlin.', ko: 'Du wohnt in Berlin.' } },
  { id: 'praes-irr', topic: 'praesens', level: 'A1', match: has(/\b(sein|haben|sprechen|fahren|lesen|essen|nehmen|sehen|geben)\b/i), errorType: 'verbo irregular',
    hint: 'Este verbo es irregular en du y er/sie/es. ¿Cambia su vocal?', rule: 'sein: bin, bist, ist, sind, seid, sind. haben: habe, hast, hat. Cambio de vocal en du/er: sprechen → sprichst/spricht, fahren → fährst/fährt, lesen → liest.',
    example: { ok: 'Er spricht Deutsch.', ko: 'Er sprecht Deutsch.' } },
  // ── Sich vorstellen
  { id: 'vs-verb', topic: 'vorstellen', level: 'A1', match: has(/\((heißen|kommen|wohnen|leben|arbeiten|studieren|sprechen|sein|haben|machen)\)/), errorType: 'conjugación',
    hint: 'Mira el pronombre del principio: ich, du, er, wir, ihr o Sie. ¿Qué terminación le toca?', rule: 'ich -e, du -st, er -t, wir/Sie -en, ihr -t. Irregulares de la presentación: sein (bin, bist, ist, sind) y sprechen (du sprichst, er spricht).',
    example: { ok: 'Wir kommen aus Peru.', ko: 'Wir kommt aus Peru.' } },
  { id: 'vs-w', topic: 'vorstellen', level: 'A1', match: has(/^___\s|\b(wie|wo|woher|was|wer|wann|warum)\b/i), errorType: 'palabra interrogativa',
    hint: '¿Qué información pide la pregunta: nombre, origen, lugar, qué, quién, cuándo?', rule: 'Wie = cómo (Wie heißt du?), Woher = de dónde (Woher kommst du?), Wo = dónde (Wo wohnst du?), Was = qué, Wer = quién, Wann = cuándo, Warum = por qué.',
    example: { ok: 'Woher kommst du? — Aus Chile.', ko: 'Wo kommst du? — Aus Chile.' } },
  { id: 'vs-sie', topic: 'vorstellen', level: 'A1', match: has(/formal|\bSie\b/), errorType: 'tratamiento formal',
    hint: 'En formal, el verbo va con la misma forma que «wir».', rule: '«Sie» (usted/ustedes) siempre con el verbo en -en: Sie heißen, Sie kommen, Sie sind, Sie sprechen.',
    example: { ok: 'Wie heißen Sie?', ko: 'Wie heißt Sie?' } },
  { id: 'vs-gen', topic: 'vorstellen', level: 'A1', errorType: 'presentarse',
    hint: 'Piensa en la pregunta original: ¿qué dato se pide y con qué verbo se responde?', rule: 'Ich heiße … (nombre) · Ich komme aus … (origen) · Ich wohne in … (ciudad) · Ich bin … Jahre alt (edad, con sein) · Ich spreche … (idiomas).',
    example: { ok: 'Ich bin 14 Jahre alt.', ko: 'Ich habe 14 Jahre.' } },
  // ── Modalverben
  { id: 'modal', topic: 'modal', level: 'A1', errorType: 'verbo modal',
    hint: 'Hay un verbo modal: él se conjuga y el otro verbo va al final, sin conjugar.', rule: 'Modal conjugado en 2.ª posición + infinitivo al final. ich/er sin terminación: ich kann, er muss, ich will, er darf, ich möchte.',
    example: { ok: 'Ich kann heute nicht kommen.', ko: 'Ich kann heute nicht komme.' } },
  // ── Perfekt
  { id: 'perf-aux', topic: 'perfekt', level: 'A2', match: has(/\b(bin|bist|ist|sind|seid|habe|hast|hat|haben|habt)\b|___ .*ge\w+t\b|___ .*ge\w+en\b/i), errorType: 'auxiliar del Perfekt',
    hint: '¿El verbo expresa movimiento o cambio de estado? Eso decide el auxiliar.', rule: 'Perfekt = haben/sein + participio al final. «sein» con verbos de movimiento o cambio (gehen, fahren, kommen, aufstehen) y con sein/bleiben; el resto con «haben».',
    example: { ok: 'Wir sind nach Berlin gefahren.', ko: 'Wir haben nach Berlin gefahren.' } },
  { id: 'perf-part', topic: 'perfekt', level: 'A2', errorType: 'participio',
    hint: 'Fíjate en cómo se forma el participio: ¿regular (ge-…-t) o irregular (ge-…-en)?', rule: 'Regulares: ge + raíz + t (gemacht). Irregulares: ge + raíz (a veces cambiada) + en (gesehen, gegangen). Separables: auf-ge-standen. Verbos en -ieren sin ge-: studiert.',
    example: { ok: 'Ich habe Pizza gegessen.', ko: 'Ich habe Pizza geesst.' } },
  // ── Possessiv
  { id: 'poss', topic: 'possessiv', level: 'A1', errorType: 'posesivo',
    hint: 'Primero: ¿de quién es? Después: ¿qué género y caso tiene el sustantivo?', rule: 'ich → mein, du → dein, er/es → sein, sie → ihr, wir → unser, ihr → euer, Sie → Ihr. Terminación como «ein»: meine (fem.), meinen (masc. acusativo), meinem (dativo).',
    example: { ok: 'Das ist ihr Bruder. (de ella)', ko: 'Das ist sein Bruder. (de ella)' } },
  // ── Trennbare Verben
  { id: 'trenn', topic: 'trennbar', level: 'A1', errorType: 'verbo separable',
    hint: '¿El verbo tiene un prefijo que se separa? Mira dónde va cada parte.', rule: 'Verbo separable en presente: la raíz conjugada en 2.ª posición y el prefijo al FINAL: aufstehen → Ich stehe um 7 Uhr auf.',
    example: { ok: 'Wir kaufen im Supermarkt ein.', ko: 'Wir einkaufen im Supermarkt.' } },
  // ── Nebensätze
  { id: 'neben', topic: 'nebensatz', level: 'A2', match: has(/\b(weil|dass|wenn|obwohl|ob)\b/i), errorType: 'orden en subordinada',
    hint: '¿La frase tiene una conjunción que introduce una oración subordinada? Piensa qué significa cada opción y dónde queda el verbo conjugado.', rule: 'Tras weil, dass, wenn, obwohl, ob el verbo conjugado va AL FINAL de la oración subordinada. deshalb/trotzdem no son subordinantes: verbo en 2.ª posición.',
    example: { ok: '…, weil ich krank bin.', ko: '…, weil ich bin krank.' } },
  // ── Satzbau
  { id: 'satz', topic: 'satzbau', level: 'A1', errorType: 'posición del verbo',
    hint: 'Cuenta los bloques: ¿en qué posición tiene que estar el verbo conjugado?', rule: 'En la oración principal el verbo conjugado va en 2.ª posición (aunque empiece por otra cosa: Heute gehe ich…). En preguntas de sí/no, en 1.ª posición.',
    example: { ok: 'Morgen fahre ich nach Hause.', ko: 'Morgen ich fahre nach Hause.' } },
  // ── Adjektive & Komparativ
  { id: 'adj', topic: 'adjektiv', level: 'A2', errorType: 'comparativo',
    hint: '¿Comparas dos cosas (más … que) o dices cuál es la que más (el más …)?', rule: 'Comparativo: adjetivo + -er + als (größer als); igualdad: so … wie. Superlativo: am + adjetivo + -sten (am größten). Muchos monosílabos llevan Umlaut: alt → älter.',
    example: { ok: 'Berlin ist größer als Bonn.', ko: 'Berlin ist größer wie Bonn.' } },
  // ── Imperativ
  { id: 'imp', topic: 'imperativ', level: 'A1', errorType: 'imperativo',
    hint: '¿A quién le das la orden: a una persona (du), a varias (ihr) o en formal (Sie)?', rule: 'du: raíz sin -st y sin pronombre (Komm!, Lies!); ihr: forma de ihr sin pronombre (Kommt!); Sie: verbo + Sie (Kommen Sie!).',
    example: { ok: 'Komm bitte her!', ko: 'Kommst bitte her!' } },
  // ── Wortschatz / Alltag
  { id: 'vocab-art', topic: 'vocab', level: 'A1', match: has(/der, die o das|der\/die\/das/i), errorType: 'género del sustantivo',
    hint: 'Piensa en el género de la palabra. Algunas terminaciones lo delatan.', rule: 'Pistas de género: -ung, -heit, -keit, -schaft, -ion, -tät → die · -chen, -lein, -ment, -um → das · días, meses, estaciones y muchas palabras en -er (personas) → der. Si no hay pista, apréndela siempre con su artículo.',
    example: { ok: 'die Zeitung, das Mädchen, der Montag', ko: 'der Zeitung' } },
  { id: 'vocab', topic: 'vocab', level: 'A1', errorType: 'vocabulario',
    hint: 'Piensa en el contexto de la frase: ¿de qué tema se habla? Descarta las opciones que no encajan.', rule: 'Aprende cada sustantivo con su artículo (der/die/das) y en una frase: es más fácil recordarlo en contexto.',
    example: { ok: 'die Lampe — la lámpara', ko: 'der Lampe' } },
  { id: 'alltag', topic: 'alltag', level: 'A1', errorType: 'situación cotidiana',
    hint: 'Imagina la situación real: ¿qué diría una persona en ese momento?', rule: 'Fórmulas fijas del día a día: Wie spät ist es? · Es ist halb drei (= 2:30) · Was kostet das? · Ich hätte gern …',
    example: { ok: 'halb drei = 2:30', ko: 'halb drei = 3:30' } },
];

/** Selección contextual: primero una regla del tema cuyo detector encaje con el enunciado; si no, la general del tema. */
export function ruleFor(q: Pick<Question, 'topic' | 'prompt'>): Rule | null {
  const ofTopic = RULES.filter((r) => r.topic === q.topic);
  return ofTopic.find((r) => r.match?.(q.prompt)) ?? ofTopic.find((r) => !r.match) ?? ofTopic[0] ?? null;
}

const correctText = (q: Question): string | null => (q.type === 'mc' ? q.options[q.answer] : null);

/** Pista de nivel 1–3. Nivel 3 incluye la solución (solo debe pedirse tras fallar o si el alumno lo pide). */
export function hintFor(q: Question, level: HintLevel): Hint {
  const r = ruleFor(q);
  if (!r) {
    const base: Hint = { level, ruleId: null, text: 'Todavía no tengo una pista específica para esta pregunta. Lee el enunciado con calma y descarta las opciones que seguro no encajan.' };
    return level === 3 ? { ...base, text: q.explain, solution: correctText(q) ?? undefined } : base;
  }
  if (level === 1) return { level, ruleId: r.id, text: r.hint };
  if (level === 2) return { level, ruleId: r.id, text: r.rule, example: r.example.ok };
  return { level, ruleId: r.id, text: `${q.explain}${q.explain.includes(r.rule.slice(0, 20)) ? '' : ` · Regla: ${r.rule}`}`, solution: correctText(q) ?? undefined };
}

/** Frase corta de Klaus al fallar (cercana, sin culpabilizar). Varía de forma determinista. */
export function klausLine(seed: string): string {
  const lines = ['Fast richtig! Vamos a mirarlo juntos.', 'Kein Problem — aquí hay una trampa clásica.', 'Hmm, casi. Te doy una pista.', 'Das passiert! Fíjate en esto:'];
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lines[h % lines.length];
}

/**
 * Punto de extensión para el futuro (NO activo en V1): un proveedor opcional (LLM local o API) podría proponer una
 * pista extra. Si se añade, debe recibir solo la pregunta (nunca datos del alumno) y su salida debe pasar por una
 * revisión humana o una validación contra RULES antes de mostrarse.
 */
export interface TutorProvider { name: string; hint(q: Question, level: HintLevel): Promise<string | null> }
export const tutorProvider: TutorProvider | null = null;
