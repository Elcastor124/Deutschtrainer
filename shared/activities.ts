// Actividades después del juego («Nach dem Spiel»): reescritura graciosa, escenas de rol, Schreibwerkstatt,
// escritura libre y Wort-Jenga. Contenido nuevo de esta app, construido con el vocabulario de las presentaciones.
// La detección de palabras y estructuras es la misma en cliente (vista previa) y servidor (estrellas).
import type { RoleCard, VocabWord } from './types.ts';

/** Palabra aprendida + patrón de búsqueda (sobre el texto «plegado»: minúsculas, ä→ae, ö→oe, ü→ue, ß→ss). */
export interface LearnedWord extends VocabWord { re: string }

const n = (de: string, es: string, ...stems: string[]): LearnedWord => ({ de, es, re: stems.map((s) => `\\b${s}\\w*`).join('|') });
const exact = (de: string, es: string, ...words: string[]): LearnedWord => ({ de, es, re: words.map((w) => `\\b${w}\\b`).join('|') });
/** Verbo separable: infinitivo/participio juntos o la raíz con la partícula más adelante en la misma frase. */
const sep = (de: string, es: string, prefix: string, stem: string, part: string): LearnedWord =>
  ({ de, es, re: `\\b${prefix}${stem}\\w{0,32}|\\b${part}\\b|\\b${stem}\\w{0,32}\\b[^.!?]{0,120}\\b${prefix}\\b` });

export function fold(s: string): string {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

export function countWords(text: string): number {
  return (text.match(/[A-Za-zÄÖÜäöüß]+(?:[-'][A-Za-zÄÖÜäöüß]+)*/g) ?? []).length;
}

export function usedWords(text: string, words: LearnedWord[]): string[] {
  const t = fold(text);
  return words.filter((w) => new RegExp(w.re, 'i').test(t)).map((w) => w.de);
}

// ───────── Palabras aprendidas (todas salen del vocabulario de las presentaciones o de la lectura) ─────────
export const LEARNED: Record<string, LearnedWord> = Object.fromEntries([
  n('der Ausweis', 'el DNI', 'ausweis'),
  n('das Formular', 'el formulario', 'formular'),
  n('die Unterschrift', 'la firma', 'unterschrift'),
  n('das Bankkonto', 'la cuenta bancaria', 'bankkont', 'konto', 'konten'),
  n('die Karte', 'la tarjeta', 'karte'),
  n('der Kunde', 'el cliente', 'kunde', 'kundin'),
  n('unterschreiben', 'firmar', 'unterschreib', 'unterschrieb'),
  sep('Geld abheben', 'sacar dinero', 'ab', 'heb', 'abgehoben'),
  n('funktionieren', 'funcionar', 'funktionier'),
  n('die Notaufnahme', 'urgencias', 'notaufnahme'),
  n('der Krankenwagen', 'la ambulancia', 'krankenwagen'),
  n('die Spritze', 'la inyección', 'spritze'),
  n('der Gips', 'la escayola', 'gips'),
  n('das Röntgenbild', 'la radiografía', 'roentgenbild'),
  n('die Tablette', 'la pastilla', 'tablette'),
  n('die Apotheke', 'la farmacia', 'apotheke'),
  n('das Rezept', 'la receta', 'rezept'),
  sep('wehtun', 'doler', 'weh', 't(u|ue|a)', 'wehgetan'),
  sep('hinfallen', 'caerse', 'hin', 'f(a|ae)ll', 'hingefallen'),
  n('gebrochen', 'roto (hueso)', 'gebrochen'),
  n('das Fieber', 'la fiebre', 'fieber'),
  n('der Wecker', 'el despertador', 'wecker'),
  n('der Schlüssel', 'la llave', 'schluessel'),
  n('die Ausrede', 'la excusa', 'ausrede'),
  n('die Prüfung', 'el examen', 'pruefung'),
  n('das Handy', 'el móvil', 'handy'),
  n('verpassen', 'perder (el bus)', 'verpass'),
  n('vergessen', 'olvidar', 'vergess', 'vergiss', 'vergass'),
  sep('einschlafen', 'dormirse', 'ein', 'schl(a|ae)f', 'eingeschlafen'),
  n('müde', 'cansado/a', 'muede'),
  n('krank', 'enfermo/a', 'krank'),
  n('kaputt', 'roto', 'kaputt'),
  exact('weil', 'porque (verbo al final)', 'weil'),
  exact('obwohl', 'aunque (verbo al final)', 'obwohl'),
  exact('deshalb', 'por eso (verbo en posición 2)', 'deshalb'),
  exact('dass', 'que (verbo al final)', 'dass'),
  exact('wenn', 'si / cuando', 'wenn'),
  n('die Haltestelle', 'la parada', 'haltestelle'),
  n('der Bahnhof', 'la estación', 'bahnhof', 'bahnhoef'),
  n('die U-Bahn', 'el metro', 'u-bahn', 'ubahn'),
  n('das Fahrrad', 'la bicicleta', 'fahrrad', 'fahrraed'),
  sep('umsteigen', 'hacer transbordo', 'um', 'steig', 'umgestiegen'),
  sep('aussteigen', 'bajarse', 'aus', 'steig', 'ausgestiegen'),
  n('das Stadtfest', 'la fiesta de la ciudad', 'stadtfest'),
  n('die Einladung', 'la invitación', 'einladung'),
  exact('gegenüber', 'enfrente de', 'gegenueber'),
  n('die Oma', 'la abuela', 'oma'),
  n('das Geschenk', 'el regalo', 'geschenk'),
  n('die Katze', 'el gato / la gata', 'katze'),
  n('das Sofa', 'el sofá', 'sofa'),
  n('die Pflanze', 'la planta', 'pflanze'),
  n('erzählen', 'contar', 'erzaehl'),
  exact('zu Hause', 'en casa', 'zu hause'),
  exact('gestern', 'ayer', 'gestern'),
  n('das Wochenende', 'el fin de semana', 'wochenende'),
  n('der Strand', 'la playa', 'strand'),
  n('das Kino', 'el cine', 'kino'),
  n('glücklich', 'feliz', 'gluecklich'),
  n('schnell', 'rápido', 'schnell'),
  n('plötzlich', 'de repente', 'ploetzlich'),
  n('nett', 'amable', 'nett'),
  exact('zuerst', 'primero', 'zuerst'),
  exact('danach', 'después', 'danach'),
  exact('am Ende', 'al final', 'am ende'),
  n('regnen', 'llover', 'regn', 'geregnet', 'regen'),
].map((w) => [w.de, w]));

const pick = (...keys: string[]) => keys.map((k) => {
  const w = LEARNED[k];
  if (!w) throw new Error(`Palabra no definida: ${k}`);
  return w;
});

// ───────── Rollenspiel I: «Mach den Text lustiger» ─────────
/** Banco de palabras para reescribir la lectura de forma graciosa (cada alumno recibe 8 distintas). */
export const ROLLE_POOL: LearnedWord[] = pick(
  'der Krankenwagen', 'die Spritze', 'der Gips', 'das Röntgenbild', 'die Katze', 'die Oma', 'das Geschenk', 'das Sofa',
  'der Wecker', 'die Ausrede', 'das Handy', 'verpassen', 'vergessen', 'einschlafen', 'kaputt', 'die U-Bahn', 'umsteigen',
  'das Stadtfest', 'die Pflanze', 'der Strand', 'das Kino', 'die Prüfung', 'das Fieber', 'der Schlüssel', 'hinfallen', 'die Einladung',
);
export const ROLLE_PROMPT = 'Reescribe el texto para que sea MUY gracioso. Cambia lo que quieras, pero usa el máximo de palabras de tu lista. Después lo leerás en voz alta como si fueras Pablo.';

// ───────── Rollenspiel II: escenas con tarjetas secretas ─────────
export interface Scene { id: string; title: string; place: string; setup: string; roles: [RoleCard, RoleCard] }

export const SCENES: Scene[] = [
  {
    id: 'bank', title: 'Auf der Bank', place: 'Eine Bank in Berlin, Montagmorgen',
    setup: 'Alguien quiere abrir una cuenta, pero ha olvidado el DNI. El banco necesita documentos… y mucha paciencia.',
    roles: [
      {
        role: 'Kunde / Kundin', who: 'Eres nuevo/a en Berlín.',
        situation: 'Quieres abrir una cuenta y pedir una tarjeta. Has olvidado el DNI en casa, pero llevas el pasaporte.',
        goals: ['Di por qué necesitas una cuenta con «weil».', 'Pide una tarjeta: «Ich möchte eine Karte beantragen.»', 'Cuenta en Perfekt qué ha pasado con tu DNI.'],
        phrases: ['Ich möchte ein Konto eröffnen.', 'Ich habe meinen Ausweis vergessen.', 'Hier ist mein Reisepass.'],
      },
      {
        role: 'Bankangestellte(r)', who: 'Trabajas en el banco desde hace 20 años.',
        situation: 'Eres amable, pero muy estricto/a: sin documento y sin dirección no hay cuenta.',
        goals: ['Pregunta por el documento y por la dirección.', 'Haz que el cliente firme un formulario.', 'Usa «Wie bitte?» o «Noch einmal, bitte.» una vez.'],
        phrases: ['Wie kann ich Ihnen helfen?', 'Haben Sie einen Ausweis?', 'Unterschreiben Sie bitte hier.'],
      },
    ],
  },
  {
    id: 'kh', title: 'In der Notaufnahme', place: 'Urgencias del hospital, sábado por la noche',
    setup: 'Alguien se ha caído de la bici. Le duele todo y le dan pánico las inyecciones.',
    roles: [
      {
        role: 'Patient / Patientin', who: 'Te has caído de la bicicleta.',
        situation: 'Te duelen el brazo y la cabeza. Tienes muchísimo miedo a las inyecciones.',
        goals: ['Cuenta en Perfekt qué ha pasado: «Ich bin … gefallen.»', 'Di dos veces «Mir tut … weh».', 'Di que no quieres una inyección, con «weil» o «obwohl».'],
        phrases: ['Ich bin vom Fahrrad gefallen.', 'Mir tut der Arm weh.', 'Bitte keine Spritze!'],
      },
      {
        role: 'Arzt / Ärztin', who: 'Llevas 14 horas trabajando.',
        situation: 'Examinas al paciente. Crees que el brazo no está roto, pero quieres hacer una radiografía.',
        goals: ['Pregunta «Was fehlt Ihnen?».', 'Di una frase con «wenn»: «Wenn es wehtut, …».', 'Receta pastillas y despídete con «Gute Besserung!».'],
        phrases: ['Was fehlt Ihnen?', 'Wir machen ein Röntgenbild.', 'Ich verschreibe Ihnen Tabletten.'],
      },
    ],
  },
  {
    id: 'unterwegs', title: 'Unterwegs in Berlin', place: 'Una parada de autobús en Berlín',
    setup: 'Un turista ha perdido el autobús y quiere ir a la fiesta de la ciudad. Un berlinés le explica el camino… a su manera.',
    roles: [
      {
        role: 'Tourist / Touristin', who: 'Es tu primer día en Berlín.',
        situation: 'Quieres ir a la fiesta de la ciudad, pero acabas de perder el autobús y no entiendes el plano.',
        goals: ['Pregunta cómo llegar con «zu» + Dativ (zum Bahnhof, zur Haltestelle…).', 'Cuenta en Perfekt que has perdido el autobús.', 'Di un medio de transporte con «mit dem / mit der …».'],
        phrases: ['Entschuldigung, wie komme ich zum Stadtfest?', 'Ich habe den Bus verpasst.', 'Fährt die U-Bahn dorthin?'],
      },
      {
        role: 'Berliner / Berlinerin', who: 'Conoces la ciudad perfectamente.',
        situation: 'Explicas el camino de forma MUY complicada. Al final invitas al turista a ir contigo.',
        goals: ['Explica el camino con «umsteigen» o «aussteigen».', 'Usa dos preposiciones con Dativ (neben, gegenüber, bei, nach…).', 'Invita al turista a la fiesta.'],
        phrases: ['Sie steigen am Bahnhof um.', 'Die Haltestelle ist gegenüber vom Kino.', 'Kommen Sie doch mit!'],
      },
    ],
  },
  {
    id: 'ausrede', title: 'Die beste Ausrede', place: 'El aula, el día del examen',
    setup: 'Alguien llega 30 minutos tarde al examen. Necesita la excusa más creíble (o más absurda) del mundo.',
    roles: [
      {
        role: 'Schüler / Schülerin', who: 'Llegas 30 minutos tarde al examen.',
        situation: 'Necesitas convencer al profesor de que te deje hacer el examen.',
        goals: ['Inventa dos excusas con «weil».', 'Di una frase con «deshalb».', 'Cuenta en Perfekt qué ha pasado esta mañana.'],
        phrases: ['Es tut mir leid, ich bin zu spät.', 'Mein Wecker hat nicht geklingelt.', 'Deshalb habe ich den Bus verpasst.'],
      },
      {
        role: 'Lehrer / Lehrerin', who: 'Has oído TODAS las excusas del mundo.',
        situation: 'No crees nada de lo que te dicen. Pero si la excusa es muy buena…',
        goals: ['Pregunta «Warum?» tres veces.', 'Di una frase con «obwohl».', 'Decide al final: ¿segunda oportunidad o no?'],
        phrases: ['Warum kommst du so spät?', 'Das glaube ich nicht!', 'Obwohl du zu spät bist, darfst du schreiben.'],
      },
    ],
  },
];

// ───────── Schreibwerkstatt: un texto con palabras dadas (lista distinta para cada alumno) ─────────
export interface WordTheme { title: string; words: LearnedWord[] }
export const WORD_THEMES: WordTheme[] = [
  { title: 'Ein Tag zum Vergessen', words: pick('der Wecker', 'verpassen', 'das Handy', 'vergessen', 'die Prüfung', 'müde', 'deshalb', 'regnen') },
  { title: 'Abenteuer auf der Bank', words: pick('das Bankkonto', 'der Ausweis', 'unterschreiben', 'die Karte', 'das Formular', 'nett', 'obwohl', 'Geld abheben') },
  { title: 'Chaos im Krankenhaus', words: pick('die Notaufnahme', 'der Krankenwagen', 'wehtun', 'die Spritze', 'der Gips', 'das Röntgenbild', 'plötzlich', 'weil') },
  { title: 'Unterwegs in der Stadt', words: pick('die U-Bahn', 'umsteigen', 'die Haltestelle', 'der Bahnhof', 'das Fahrrad', 'das Stadtfest', 'gegenüber', 'danach') },
  { title: 'Besuch bei Oma', words: pick('die Oma', 'das Geschenk', 'die Katze', 'das Sofa', 'die Pflanze', 'erzählen', 'zu Hause', 'gestern') },
  { title: 'Das verrückte Wochenende', words: pick('das Wochenende', 'der Strand', 'das Kino', 'glücklich', 'schnell', 'zuerst', 'am Ende', 'einschlafen') },
];
export const WORT_MIN = 40;

// ───────── Freies Schreiben ─────────
export const FREE_PROMPTS = [
  'Mein verrücktester Tag: Was ist passiert?',
  'Ein Brief an Pablo: Was hast du am Wochenende gemacht?',
  'Meine beste Ausrede: Warum bin ich zu spät gekommen?',
  'Wie komme ich zur Schule oder zur Arbeit? Mein Weg durch die Stadt.',
  'Ein Tag im Krankenhaus – aber lustig!',
  'Mein perfektes Wochenende',
  'Ich habe im Lotto gewonnen! Was mache ich jetzt?',
  'Ein Tag als Lehrer oder Lehrerin',
];
export const FREE_MILESTONES = [30, 50, 80];

export const FEATURES: { id: string; label: string; hint: string; re: RegExp }[] = [
  { id: 'perfekt', label: 'Perfekt', hint: 'habe/bin … ge-…t/en', re: /\b(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)\b[^.!?]{0,60}?\b(ge\w{2,32}(t|en)|\w{1,32}iert|\w{1,32}ge\w{1,32}(t|en))\b/ },
  { id: 'neben', label: 'Nebensatz', hint: 'weil · obwohl · dass · wenn', re: /\b(weil|obwohl|dass|wenn)\b/ },
  { id: 'dativ', label: 'Dativ', hint: 'mit dem · zur · bei der…', re: /\b(mit|zu|bei|nach|aus|von|seit|gegenueber)\s+(dem|der|den|einem|einer|meinem|meiner|deinem|deiner|seinem|seiner|ihrem|ihrer)\b|\b(zum|zur|beim|vom)\b/ },
  { id: 'zeit', label: 'Orden', hint: 'zuerst · danach · am Ende', re: /\b(zuerst|danach|dann|spaeter|am ende|ploetzlich)\b/ },
];

export function features(text: string): string[] {
  const t = fold(text);
  return FEATURES.filter((f) => f.re.test(t)).map((f) => f.id);
}

// ───────── Estrellas (vista previa en el cliente, valor final en el servidor) ─────────
export function writeStars(kind: 'rolle' | 'wort' | 'frei', words: number, used: number, feats: number): number {
  if (kind === 'rolle') return used;
  if (kind === 'wort') return used + (words >= WORT_MIN ? 1 : 0);
  return FREE_MILESTONES.filter((m) => words >= m).length + feats;
}

// ───────── Wort-Jenga ─────────
export const JENGA_LEVELS = 15;
/** Preguntas orales: el alumno responde en voz alta y el profesor decide. */
export const SPEAK_QUESTIONS = [
  'Wie heißt du und woher kommst du?',
  'Wo wohnst du und seit wann?',
  'Was hast du gestern Abend gemacht?',
  'Was hast du am Wochenende gemacht?',
  'Warum lernst du Deutsch? Antworte mit «weil».',
  'Wie kommst du zur Schule oder zur Arbeit?',
  'Was isst du gern zum Frühstück?',
  'Was machst du, wenn du krank bist?',
  'Was hast du heute Morgen gemacht? Nenne drei Dinge.',
  'Wann bist du heute aufgestanden?',
  'Was ist deine Lieblingsfarbe und warum?',
  'Beschreibe deine Wohnung in drei Sätzen.',
  'Wie viele Personen gibt es in deiner Familie?',
  'Was machst du gern am Wochenende?',
  'Was hast du zuletzt gekauft?',
  'Wohin bist du im Sommer gefahren?',
  'Was tut dir weh, wenn du viel Sport machst?',
  'Nenne drei Sachen, die man auf der Bank macht.',
  'Was sagst du in der Notaufnahme, wenn dir der Arm wehtut?',
  'Erfinde eine Ausrede: Warum hast du keine Hausaufgaben?',
  'Was machst du, obwohl du müde bist?',
  'Wie spät ist es jetzt? Sag es auf zwei Arten.',
  'Zähle rückwärts von zwanzig bis zehn.',
  'Nenne fünf Körperteile mit Artikel.',
  'Nenne vier Verkehrsmittel mit Artikel.',
  'Mit wem wohnst du zusammen?',
  'Was hast du zu deinem letzten Geburtstag bekommen?',
  'Bei wem warst du zuletzt zu Besuch?',
  'Was machst du nach dem Unterricht?',
  'Wie geht es dir heute? Antworte mit «weil».',
  'Was ist dein Lieblingsessen und wer kocht es?',
  'Beschreibe eine Person aus deiner Familie in drei Sätzen.',
  'Was hast du gestern gegessen und getrunken?',
  'Welche Sprachen sprichst du und wie gut?',
  'Was machst du, wenn es regnet?',
  'Was brauchst du, wenn du ein Konto eröffnest?',
  'Wohin gehst du, wenn du Kopfschmerzen hast?',
  'Erzähl kurz: Was ist Pablo am Samstag passiert?',
  'Was kaufst du im Supermarkt? Nenne vier Dinge mit Artikel.',
  'Welches Wort hast du heute gelernt? Erkläre es auf Deutsch.',
  'Was möchtest du nächstes Jahr machen?',
  'Wann hast du zuletzt einen Bus oder Zug verpasst?',
  'Wo warst du gestern um acht Uhr abends?',
  'Was ist besser: Strand oder Berge? Warum?',
  'Sag drei Sätze über deinen besten Freund oder deine beste Freundin.',
  'Was machst du, bevor du schlafen gehst?',
  'Welche Farben haben dein Handy, deine Jacke und dein Rucksack?',
  'Was hast du in den letzten Ferien gemacht?',
  'Welchen Film oder welche Serie hast du zuletzt gesehen?',
  'Was hast du immer in deiner Tasche?',
];
