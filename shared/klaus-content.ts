// Klaus AI · contenido estructurado y reutilizable (datos, no código): escenarios de conversación y tareas de escritura guiada.
// Ampliar = añadir una entrada. Nada de esto requiere llamar a un modelo.
import type { AiLevel } from './klaus-ai.ts';

export interface RedetScenario {
  id: string; title: string; de: string; levels: AiLevel[];
  /** Contexto que Klaus presenta (en español, con la frase de apertura en alemán). */ intro: string; opening: string;
  /** Rol e instrucciones para el modelo (texto fijo, sin datos del alumno). */ role: string;
  /** Expresiones útiles que el modo de pruebas puede sugerir. */ phrases: { de: string; es: string }[];
  /** Respuestas guionizadas del modo determinista (se recorren por turno). */ script: string[];
}
export const REDET_SCENARIOS: RedetScenario[] = [
  { id: 'presentarse', title: 'Presentarse', de: 'Sich vorstellen', levels: ['A1', 'A2'], intro: 'Vas a conocer a Klaus. Preséntate: nombre, de dónde eres y dónde vives.',
    opening: 'Hallo! Ich bin Klaus. Wie heißt du?', role: 'Eres Klaus y conoces al alumno por primera vez. Pregunta nombre, origen, residencia, edad y aficiones, de una en una.',
    phrases: [{ de: 'Ich heiße …', es: 'Me llamo …' }, { de: 'Ich komme aus …', es: 'Vengo de …' }, { de: 'Ich wohne in …', es: 'Vivo en …' }],
    script: ['Freut mich! Woher kommst du?', 'Interessant! Und wo wohnst du jetzt?', 'Schön. Was machst du gern in deiner Freizeit?', 'Das klingt gut! Danke für das Gespräch.'] },
  { id: 'restaurante', title: 'Pedir comida en un restaurante', de: 'Im Restaurant', levels: ['A1', 'A2'], intro: 'Estás en un restaurante en Berlín. Klaus es el camarero: pide comida y bebida.',
    opening: 'Guten Tag! Was möchten Sie trinken?', role: 'Eres un camarero amable en un restaurante alemán. Toma el pedido, ofrece opciones y al final trae la cuenta.',
    phrases: [{ de: 'Ich möchte …, bitte.', es: 'Quisiera …, por favor.' }, { de: 'Die Rechnung, bitte.', es: 'La cuenta, por favor.' }],
    script: ['Gern. Und was möchten Sie essen?', 'Sehr gut. Möchten Sie noch etwas?', 'Kommt sofort. Zahlen Sie zusammen oder getrennt?', 'Vielen Dank! Einen schönen Tag noch.'] },
  { id: 'tienda', title: 'Comprar en una tienda', de: 'Im Geschäft', levels: ['A1', 'A2'], intro: 'Estás en una tienda de ropa. Klaus es el dependiente.',
    opening: 'Hallo! Kann ich Ihnen helfen?', role: 'Eres un dependiente de una tienda de ropa. Pregunta qué busca, talla y color, y dile el precio.',
    phrases: [{ de: 'Was kostet das?', es: '¿Cuánto cuesta?' }, { de: 'Ich nehme es.', es: 'Me lo llevo.' }],
    script: ['Welche Größe brauchen Sie?', 'Und welche Farbe gefällt Ihnen?', 'Das kostet neunundzwanzig Euro.', 'Gern. Bar oder mit Karte?'] },
  { id: 'vacaciones', title: 'Hablar de las vacaciones', de: 'Über den Urlaub', levels: ['A2'], intro: 'Klaus te pregunta por tus últimas vacaciones.',
    opening: 'Hallo! Wo warst du in den Ferien?', role: 'Eres Klaus y charlas sobre las últimas vacaciones del alumno. Pregunta lugar, con quién, qué hizo y qué tal el tiempo; usa Perfekt.',
    phrases: [{ de: 'Ich bin nach … gefahren.', es: 'Fui a … (en un medio de transporte).' }, { de: 'Das Wetter war …', es: 'El tiempo era …' }],
    script: ['Wie schön! Mit wem bist du gefahren?', 'Und was hast du dort gemacht?', 'Wie war das Wetter?', 'Das klingt toll! Danke fürs Erzählen.'] },
  { id: 'rutina', title: 'Describir la rutina diaria', de: 'Mein Tag', levels: ['A1', 'A2'], intro: 'Cuéntale a Klaus cómo es un día normal tuyo.',
    opening: 'Hallo! Wann stehst du normalerweise auf?', role: 'Eres Klaus y quieres saber cómo es un día normal del alumno: hora de levantarse, escuela, comidas, tarde y noche.',
    phrases: [{ de: 'Ich stehe um … Uhr auf.', es: 'Me levanto a las …' }, { de: 'Danach …', es: 'Después …' }],
    script: ['Und wann beginnt die Schule?', 'Was machst du nach der Schule?', 'Wann gehst du abends ins Bett?', 'Danke! Das war ein klarer Tagesablauf.'] },
  { id: 'indicaciones', title: 'Pedir indicaciones', de: 'Nach dem Weg fragen', levels: ['A1', 'A2'], intro: 'Estás perdido en una ciudad. Pregúntale a Klaus cómo llegar a un sitio.',
    opening: 'Hallo! Sie sehen verloren aus. Kann ich helfen?', role: 'Eres un vecino que da indicaciones sencillas: geradeaus, links, rechts, an der Ampel.',
    phrases: [{ de: 'Wo ist …?', es: '¿Dónde está …?' }, { de: 'Wie komme ich zum Bahnhof?', es: '¿Cómo llego a la estación?' }],
    script: ['Gehen Sie hier geradeaus.', 'An der Ampel gehen Sie links.', 'Dann ist es auf der rechten Seite.', 'Gern geschehen!'] },
  { id: 'libre', title: 'Conversación libre', de: 'Freies Gespräch', levels: ['A1', 'A2'], intro: 'Habla con Klaus de lo que quieras, en alemán sencillo.',
    opening: 'Hallo! Worüber möchtest du sprechen?', role: 'Eres Klaus y mantienes una charla cotidiana sobre el tema que elija el alumno, con frases cortas.',
    phrases: [{ de: 'Ich möchte über … sprechen.', es: 'Quiero hablar de …' }],
    script: ['Interessant! Erzähl mir mehr.', 'Und was denkst du darüber?', 'Das verstehe ich. Warum?', 'Danke für das schöne Gespräch!'] },
];
export const scenarioById = (id: string) => REDET_SCENARIOS.find((s) => s.id === id) ?? null;

/** Modo libre de Redet: temas para empezar a hablar sin situación. Cada uno trae su pregunta de apertura y su guion determinista
 * (lo usa el modo sin IA). Con IA real, el tema se añade al rol de Klaus y la conversación sigue lo que diga el alumno. */
export interface FreeTopic { id: string; label: string; de: string; opening: string; script: string[] }
export const FREE_TOPICS: FreeTopic[] = [
  { id: 'hobbys', label: 'Aficiones', de: 'Hobbys', opening: 'Hallo! Was machst du gern in deiner Freizeit?',
    script: ['Cool! Wie oft machst du das?', 'Mit wem machst du das am liebsten?', 'Und was möchtest du gern einmal ausprobieren?', 'Danke! Deine Hobbys klingen super.'] },
  { id: 'schule', label: 'El instituto', de: 'Schule', opening: 'Hallo! Was ist dein Lieblingsfach in der Schule?',
    script: ['Warum magst du dieses Fach?', 'Und welches Fach findest du schwierig?', 'Wie kommst du morgens zur Schule?', 'Danke! Viel Erfolg in der Schule!'] },
  { id: 'familie', label: 'La familia', de: 'Familie', opening: 'Hallo! Erzähl mir von deiner Familie. Hast du Geschwister?',
    script: ['Wie alt sind sie?', 'Was macht ihr gern zusammen?', 'Und wo wohnt deine Familie?', 'Danke! Das ist eine schöne Familie.'] },
  { id: 'essen', label: 'Comida', de: 'Essen', opening: 'Hallo! Was isst du am liebsten?',
    script: ['Lecker! Kochst du auch selbst?', 'Was isst du normalerweise zum Frühstück?', 'Und was möchtest du einmal probieren?', 'Danke! Jetzt habe ich Hunger.'] },
  { id: 'wochenende', label: 'El fin de semana', de: 'Wochenende', opening: 'Hallo! Was hast du am Wochenende gemacht?',
    script: ['Und wie war das?', 'Mit wem warst du da?', 'Was machst du nächstes Wochenende?', 'Danke! Das klingt nach einem guten Wochenende.'] },
  { id: 'musik', label: 'Música y series', de: 'Musik und Serien', opening: 'Hallo! Welche Musik hörst du gern?',
    script: ['Wer ist dein Lieblingssänger oder deine Lieblingsband?', 'Und welche Serie siehst du gerade?', 'Warum gefällt sie dir?', 'Danke! Ich höre mir das mal an.'] },
];
export const freeTopicById = (id: unknown) => FREE_TOPICS.find((t) => t.id === id) ?? null;

export interface WritingTask { id: string; level: AiLevel; title: string; prompt: string; minWords: number; maxWords: number; points: string[] }
export const WRITING_TASKS: WritingTask[] = [
  { id: 'a1-presentacion', level: 'A1', title: 'Presentación personal', prompt: 'Escribe una presentación sobre ti: cómo te llamas, cuántos años tienes, de dónde eres, dónde vives y qué te gusta.', minWords: 30, maxWords: 60, points: ['nombre', 'edad', 'origen y ciudad', 'una afición'] },
  { id: 'a1-familia', level: 'A1', title: 'Mi familia', prompt: 'Describe a tu familia: quiénes sois, cómo se llaman y qué hacen.', minWords: 30, maxWords: 60, points: ['miembros', 'nombres', 'profesión o escuela'] },
  { id: 'a2-correo', level: 'A2', title: 'Correo informal a un amigo', prompt: 'Escribe un correo a un amigo alemán: salúdalo, cuéntale qué haces estos días e invítalo a algo el fin de semana.', minWords: 50, maxWords: 90, points: ['saludo', 'qué haces', 'invitación', 'despedida'] },
  { id: 'a2-vacaciones', level: 'A2', title: 'Mis vacaciones', prompt: 'Cuenta qué hiciste en tus últimas vacaciones: adónde fuiste, con quién, qué hiciste y qué tal estuvo.', minWords: 50, maxWords: 90, points: ['lugar', 'con quién', 'actividades en Perfekt', 'opinión'] },
  { id: 'a2-experiencia', level: 'A2', title: 'Una experiencia', prompt: 'Describe un día que recuerdes bien: qué pasó, cómo te sentiste y por qué fue especial.', minWords: 50, maxWords: 90, points: ['qué pasó', 'cómo te sentiste', 'por qué'] },
];
export const taskById = (id: string) => WRITING_TASKS.find((t) => t.id === id) ?? null;
