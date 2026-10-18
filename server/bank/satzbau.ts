// Satzbau: ordenar palabras (arrastrando fichas) y construir frases largas.
// Frases de los «Baue den Satz» de bank, warum, kh y unterwegs + Ausreden (warum) + lange Sätze (unterwegs).
import type { Question } from '../../shared/types.ts';
import { bd, od, type Meta } from './h.ts';

const S = (s: Meta['s'], d: Meta['d'], x: string, extra: Partial<Meta> = {}): Meta => ({ t: 'satzbau', s, d, x, ...extra });
const ORD = 'Ordena las palabras (arrastra las fichas)';

export function satzbauQuestions(): Question[] {
  const q: Question[] = [];
  const O: [string, string[], Meta['s'], Meta['d'], string, Partial<Meta>?][] = [
    // Auf der Bank
    ['Ich möchte ein Konto eröffnen.', ['Ein Konto möchte ich eröffnen.'], 'bank', 'easy', 'möchte en posición 2, el infinitivo (eröffnen) al final.'],
    ['Haben Sie einen Ausweis?', [], 'bank', 'easy', 'Pregunta sí/no → el verbo va primero.'],
    ['Ich möchte Geld abheben.', ['Geld möchte ich abheben.'], 'bank', 'easy', 'möchte + … + infinitivo al final.'],
    ['Ich möchte eine neue Karte beantragen.', ['Eine neue Karte möchte ich beantragen.'], 'bank', 'easy', 'möchte + … + beantragen al final.'],
    ['Wie kann ich Ihnen helfen?', [], 'bank', 'medium', 'W-Frage: palabra interrogativa + verbo + sujeto + … + infinitivo.'],
    // warum · Nebensätze
    ['Ich lerne Deutsch, weil ich in Berlin studieren möchte.', ['Weil ich in Berlin studieren möchte, lerne ich Deutsch.'], 'warum', 'medium', 'weil + modal: el modal (möchte) es lo último.'],
    ['Ich gehe spazieren, obwohl es regnet.', ['Obwohl es regnet, gehe ich spazieren.'], 'warum', 'easy', 'obwohl → regnet al final.'],
    ['Ich bin müde, deshalb gehe ich ins Bett.', ['Ich bin müde, ich gehe deshalb ins Bett.'], 'warum', 'medium', 'deshalb + verbo (gehe) + sujeto (ich).'],
    ['Weil ich Hunger habe, esse ich eine Pizza.', ['Ich esse eine Pizza, weil ich Hunger habe.'], 'warum', 'medium', 'Weil… delante → verbo, verbo: habe, esse ich.'],
    ['Ich bin müde, weil ich schlecht geschlafen habe.', ['Weil ich schlecht geschlafen habe, bin ich müde.'], 'warum', 'medium', 'weil + Perfekt → el auxiliar (habe) es lo último.'],
    ['Er ist zu spät gekommen, weil er den Bus verpasst hat.', ['Weil er den Bus verpasst hat, ist er zu spät gekommen.'], 'warum', 'hard', 'Perfekt en las dos frases: ist … gekommen / … verpasst hat.', { why: 'Dos Perfekt (sein y haben) y el auxiliar del Nebensatz al final.' }],
    ['Ich habe die Prüfung bestanden, obwohl ich wenig gelernt habe.', ['Obwohl ich wenig gelernt habe, habe ich die Prüfung bestanden.'], 'warum', 'hard', 'obwohl + Perfekt: …gelernt habe.', { why: 'Perfekt + Nebensatz con dos «habe» que hay que colocar en el sitio exacto.' }],
    ['Ich habe viel gelernt, deshalb habe ich eine gute Note bekommen.', ['Ich habe viel gelernt, ich habe deshalb eine gute Note bekommen.'], 'warum', 'hard', 'deshalb + auxiliar en posición 2 + … + Partizip al final.', { why: 'deshalb + Perfekt: el auxiliar va detrás de deshalb y el Partizip al final (Satzklammer).', unlock: true }],
    // Im Krankenhaus
    ['Ich bin im Krankenhaus, weil ich vom Fahrrad gefallen bin.', ['Weil ich vom Fahrrad gefallen bin, bin ich im Krankenhaus.'], 'kh', 'medium', 'weil + Perfekt con sein: gefallen bin.'],
    ['Die Ärztin sagt, dass ich im Bett bleiben muss.', [], 'kh', 'medium', 'dass → modal (muss) al final.'],
    ['Wenn es wehtut, nehmen Sie eine Tablette.', ['Nehmen Sie eine Tablette, wenn es wehtut.'], 'kh', 'medium', 'Wenn… delante → verbo, verbo.'],
    ['Mein Arm ist gebrochen, deshalb bekomme ich einen Gips.', ['Mein Arm ist gebrochen, ich bekomme deshalb einen Gips.'], 'kh', 'medium', 'deshalb bekomme ich…'],
    ['Obwohl ich Fieber habe, gehe ich zur Schule.', ['Ich gehe zur Schule, obwohl ich Fieber habe.'], 'kh', 'medium', 'Obwohl… delante → verbo, verbo: habe, gehe ich.'],
    // Unterwegs
    ['Ich bin mit dem Bus zur Schule gefahren.', ['Mit dem Bus bin ich zur Schule gefahren.', 'Zur Schule bin ich mit dem Bus gefahren.'], 'unterwegs', 'easy', 'Perfekt: bin (pos. 2) … gefahren (final). mit dem Bus = Dativ.'],
    ['Ich bin müde, weil ich bei meinem Freund geschlafen habe.', ['Weil ich bei meinem Freund geschlafen habe, bin ich müde.'], 'unterwegs', 'medium', 'bei + Dativ (meinem) y auxiliar al final.'],
    ['Sie hat gesagt, dass sie mit ihrer Mutter gesprochen hat.', [], 'unterwegs', 'medium', 'dass + Perfekt → gesprochen hat.'],
    ['Nach dem Frühstück sind wir mit dem Taxi zum Bahnhof gefahren.', ['Wir sind nach dem Frühstück mit dem Taxi zum Bahnhof gefahren.', 'Mit dem Taxi sind wir nach dem Frühstück zum Bahnhof gefahren.', 'Zum Bahnhof sind wir nach dem Frühstück mit dem Taxi gefahren.'], 'unterwegs', 'hard', 'Complemento delante → inversión: Nach dem Frühstück SIND WIR…', { why: 'Inversión + Perfekt con sein + tres complementos con Dativ (nach dem, mit dem, zum).' }],
    ['Obwohl ich seit einer Woche krank bin, bin ich zum Training gegangen.', ['Ich bin zum Training gegangen, obwohl ich seit einer Woche krank bin.'], 'unterwegs', 'hard', 'Obwohl… delante → verbo, verbo: bin, bin ich.', { why: 'Nebensatz delante, seit + Dativ (einer Woche), Perfekt con sein y contracción zum.', unlock: true }],
    // Ausreden (warum)
    ['Weil mein Wecker nicht geklingelt hat.', [], 'warum', 'medium', 'Respuesta a «Warum…?» con weil: el auxiliar al final.'],
    ['Weil ich mein Handy im Bus vergessen habe.', ['Weil ich im Bus mein Handy vergessen habe.'], 'warum', 'medium', 'weil … vergessen habe.'],
    ['Weil ich den ganzen Abend gelernt habe.', [], 'warum', 'medium', 'weil … gelernt habe.'],
    ['Weil ich bis 4 Uhr Netflix gesehen habe.', ['Weil ich Netflix bis 4 Uhr gesehen habe.'], 'warum', 'medium', 'weil … gesehen habe.'],
    ['Weil ich meinen Schlüssel verloren habe.', [], 'warum', 'medium', 'weil … verloren habe (meinen = Akkusativ).'],
    ['Weil ich am Wochenende nach Portugal gefahren bin.', [], 'warum', 'medium', 'fahren → sein: gefahren bin.'],
  ];
  const EXQ: Record<string, string> = {
    'Weil mein Wecker nicht geklingelt hat.': 'Warum bist du zu spät gekommen?',
    'Weil ich mein Handy im Bus vergessen habe.': 'Warum hast du mich nicht angerufen?',
    'Weil ich den ganzen Abend gelernt habe.': 'Warum bist du nicht zur Party gekommen?',
    'Weil ich bis 4 Uhr Netflix gesehen habe.': 'Warum bist du so müde?',
    'Weil ich meinen Schlüssel verloren habe.': 'Warum bist du nicht nach Hause gegangen?',
    'Weil ich am Wochenende nach Portugal gefahren bin.': 'Warum bist du am Montag nicht gekommen?',
  };
  for (const [sent, alts, s, d, x, extra] of O) {
    const prompt = EXQ[sent] ? `Die beste Ausrede 😅 «${EXQ[sent]}» — ordena la respuesta` : ORD;
    q.push(od(S(s, d, x, extra ?? {}), prompt, sent, alts));
  }

  // Lange Sätze (unterwegs): construir a partir de piezas.
  const L: [string[], string[], Meta['d'], string, Partial<Meta>?][] = [
    [['Ich bin müde', 'weil', 'ich / bei / mein Freund / schlafen (Perfekt)'], ['Ich bin müde, weil ich bei meinem Freund geschlafen habe.'], 'medium', 'bei + Dativ → meinem Freund; weil + Perfekt → geschlafen habe.'],
    [['Ich habe Hunger', 'weil', 'ich / nach / die Schule / nichts essen (Perfekt)'], ['Ich habe Hunger, weil ich nach der Schule nichts gegessen habe.'], 'hard', 'nach + Dativ → nach der Schule; …gegessen habe.', { why: 'nach + Dativ femenino (der Schule) + Perfekt irregular + auxiliar al final.' }],
    [['Mein Bruder erzählt', 'dass', 'er / mit / seine Freundin / ins Kino gehen (Perfekt)'], ['Mein Bruder erzählt, dass er mit seiner Freundin ins Kino gegangen ist.'], 'hard', 'mit seiner Freundin (Dativ) · gehen → ist gegangen · ist al final.', { why: 'Dativ con posesivo (seiner), Perfekt con sein y auxiliar al final tras dass.', unlock: true }],
    [['Ich weiß', 'dass', 'du / gestern / bei / deine Oma / sein (Perfekt)'], ['Ich weiß, dass du gestern bei deiner Oma gewesen bist.'], 'hard', 'sein → ist gewesen; du → bist al final; bei deiner Oma.', { why: 'Perfekt de sein (gewesen) con sein conjugado para «du» (bist) + Dativ deiner.' }],
  ];
  for (const [parts, acc, d, x, extra] of L) q.push(bd(S('unterwegs', d, x, extra ?? {}), 'Baue lange Sätze: construye la frase completa', parts, acc));
  return q;
}
