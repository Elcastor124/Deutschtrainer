// Leseverstehen 001 — «Alltag und Kommunikation» (A1–A2). Copiado LITERAL del documento del profesor (server/lesen/spec-001.md);
// tests/lesen.test.ts comprueba que cada texto, pregunta y opción aparece tal cual en el documento y que la clave coincide con su Lösungsschlüssel.
// HOREN-style: LESEN_EXAM se envía al cliente (sin soluciones); LESEN_SECRET nunca sale del servidor antes de corregir.
import type { LesenExam, LesenOption, LesenQuestion, LesenSecret } from '../../shared/lesen.ts';

export const LESEN_SPEC_SHA256 = '40589ec5012dbc4eeda533ce9c463986e9167f1e241d19675525a486bba73ee1';

const RF: LesenOption[] = [{ id: 'R', text: 'Richtig' }, { id: 'F', text: 'Falsch' }];
const tf = (n: number, prompt: string): LesenQuestion => ({ id: `q${n}`, number: n, type: 'truefalse', prompt, options: RF });
const mc = (n: number, prompt: string, a: string, b: string, c: string): LesenQuestion => ({ id: `q${n}`, number: n, type: 'choice', prompt, options: [{ id: 'a', text: a }, { id: 'b', text: b }, { id: 'c', text: c }] });
const ADS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const AD_OPTIONS: LesenOption[] = [...ADS.map((id) => ({ id, text: `Anzeige ${id}` })), { id: '0', text: 'Keine Anzeige (0)' }];
const zu = (n: number, prompt: string): LesenQuestion => ({ id: `q${n}`, number: n, type: 'matching', prompt, options: AD_OPTIONS });

export const LESEN_EXAM: LesenExam = {
  id: 'lesen-001', version: '1', title: 'Leseverstehen — Alltag und Kommunikation', subtitle: 'Simulacro pedagógico original inspirado en exámenes de alemán',
  level: 'A1–A2', minutes: 45, maxPoints: 25,
  disclaimer: 'Simulacro pedagógico de Deutschtrainer. La nota no es una calificación oficial Goethe ni DSD.',
  parts: [
    {
      id: 't1', n: 1, title: 'Ein neuer Alltag', minutes: 8, kind: 'Richtig / Falsch',
      instruction: ['Lesen Sie den Text. Sind die Aussagen 1–5 richtig oder falsch?'],
      textTitle: 'Eine neue Stadt, neue Freunde',
      text: [
        { t: 'p', text: 'Hallo zusammen!' },
        { t: 'p', text: 'Ich heiße Nora, bin 15 Jahre alt und komme aus Spanien. Seit drei Wochen wohne ich bei meiner Tante in Köln. Ich möchte hier Deutsch lernen und neue Freunde finden.' },
        { t: 'p', text: 'Mein Deutschkurs ist von Montag bis Donnerstag. Er beginnt um neun Uhr morgens und endet um halb eins. Am Freitag haben wir keinen Unterricht in der Sprachschule. Wir lernen online von zu Hause.' },
        { t: 'p', text: 'Normalerweise fahre ich mit dem Fahrrad zum Unterricht. Das dauert nur fünfzehn Minuten. Letzten Dienstag hat es aber stark geregnet. Deshalb bin ich mit dem Bus gefahren.' },
        { t: 'p', text: 'Nach dem Unterricht gehe ich oft in die Bibliothek. Dort mache ich meine Hausaufgaben und lese einfache Bücher auf Deutsch.' },
        { t: 'p', text: 'Am Samstag habe ich mit meinem Cousin Ben das Stadtmuseum besucht. Danach haben wir ein Eis gegessen. Das Museum war interessant, aber das Eis hat mir besser gefallen!' },
        { t: 'p', text: 'Am Sonntag bin ich zu Hause geblieben und habe mit meiner Tante gekocht.' },
        { t: 'p', text: 'Nächste Woche möchte ich mit meinen neuen Freunden ins Kino gehen.' },
        { t: 'p', text: 'Bis bald!' },
        { t: 'p', text: 'Nora' },
      ],
      questions: [
        tf(1, 'Nora wohnt seit drei Monaten in Köln.'),
        tf(2, 'Der Deutschkurs findet von Montag bis Donnerstag am Vormittag statt.'),
        tf(3, 'Am Freitag muss Nora in die Sprachschule gehen.'),
        tf(4, 'Letzten Dienstag ist Nora mit dem Fahrrad gefahren.'),
        tf(5, 'Nora hat am Samstag mit ihrem Cousin ein Museum besucht.'),
      ],
    },
    {
      id: 't2', n: 2, title: 'Das Jugendzentrum Linden', minutes: 8, kind: 'Multiple Choice',
      instruction: ['Lesen Sie das Programm und die Informationen.', 'Wählen Sie die richtige Antwort: a, b oder c.'],
      textTitle: 'Unser neues Wochenprogramm',
      text: [
        { t: 'p', text: 'Du möchtest etwas Neues lernen oder andere Jugendliche kennenlernen? Dann komm zu uns!' },
        { t: 'h', text: 'JUGENDZENTRUM LINDEN' },
        { t: 'table', head: ['Tag', 'Aktivität', 'Zeit', 'Preis'], rows: [
          ['Montag', 'Deutsch-Club', '16:00–17:00', 'Gratis'],
          ['Dienstag', 'Fotografieren', '17:00–18:30', '4 €'],
          ['Mittwoch', 'Basketball', '16:00–17:00', 'Gratis'],
          ['Donnerstag', 'Kochen', '18:00–19:00', '6 €'],
          ['Freitag', 'Musik-Workshop', '17:00–18:00', '2 €'],
        ] },
        { t: 'h', text: 'Wichtige Informationen' },
        { t: 'p', text: 'Für den Fotokurs brauchst du dein eigenes Handy. Eine professionelle Kamera ist nicht nötig.' },
        { t: 'p', text: 'Für den Kochkurs musst du dich spätestens am Montag anmelden. Wir kaufen die Zutaten für alle Teilnehmer.' },
        { t: 'p', text: 'Beim Musik-Workshop gibt es Gitarren und andere Instrumente im Jugendzentrum. Du musst kein eigenes Instrument mitbringen.' },
        { t: 'p', text: 'Zum Basketballtraining solltest du Sportschuhe und eine Flasche Wasser mitbringen.' },
        { t: 'p', text: 'Alle Kurse sind für Jugendliche zwischen 12 und 18 Jahren.' },
        { t: 'p', text: 'Anmeldung im Jugendzentrum oder per E-Mail.' },
      ],
      questions: [
        mc(6, 'Wann kann man Basketball spielen?', 'Am Montag.', 'Am Mittwoch.', 'Am Freitag.'),
        mc(7, 'Nina fotografiert gern. An welchem Tag soll sie kommen?', 'Am Dienstag.', 'Am Donnerstag.', 'Am Samstag.'),
        mc(8, 'Was braucht man für den Fotokurs?', 'Eine professionelle Kamera.', 'Einen Computer.', 'Ein eigenes Handy.'),
        mc(9, 'Bis wann muss man sich für den Kochkurs anmelden?', 'Spätestens am Montag.', 'Am Donnerstagabend.', 'Am Freitag.'),
        mc(10, 'Was stimmt über den Musik-Workshop?', 'Man muss seine Gitarre mitbringen.', 'Man kann Instrumente vom Jugendzentrum benutzen.', 'Der Workshop ist kostenlos.'),
      ],
    },
    {
      id: 't3', n: 3, title: 'Welche Anzeige passt?', minutes: 10, kind: 'Zuordnung',
      instruction: ['Lesen Sie die Anzeigen A–H und die Situationen 11–16.', 'Welche Anzeige passt zu welcher Person?', 'Jede Anzeige darf nur einmal verwendet werden.', 'Für eine Situation gibt es keine passende Anzeige.', 'Schreiben Sie dann 0.'],
      textTitle: 'Anzeigen',
      text: [
        { t: 'ad', id: 'A', title: 'Fahrradwerkstatt Schnell', lines: ['Dein Fahrrad ist kaputt?', 'Wir reparieren Bremsen, Reifen und Lichter.', 'Dienstag bis Freitag, 10–18 Uhr.', 'Wir verkaufen keine Fahrräder.'] },
        { t: 'ad', id: 'B', title: 'Second Bike', lines: ['Du suchst ein günstiges Fahrrad?', 'Bei uns gibt es gebrauchte Fahrräder für 50 bis 90 Euro.', 'Montag bis Samstag, 11–17 Uhr.'] },
        { t: 'ad', id: 'C', title: 'Deutsch-Tandem', lines: ['Du möchtest besser Deutsch sprechen?', 'Jeden Samstag um 15 Uhr treffen sich Jugendliche im Jugendzentrum.', 'Wir sprechen Deutsch und spielen zusammen.', 'Kostenlos!'] },
        { t: 'ad', id: 'D', title: 'Deutsch online', lines: ['Deutschunterricht von zu Hause!', 'Dienstags und donnerstags um 19 Uhr.', 'Ein Kurs kostet 5 Euro.', 'Du brauchst einen Computer oder ein Tablet.'] },
        { t: 'ad', id: 'E', title: 'Stadtbibliothek', lines: ['Bücher und Zeitschriften kostenlos lesen!', 'Mit einer Bibliothekskarte kannst du Bücher für zwei Wochen mit nach Hause nehmen.', 'Montag bis Samstag geöffnet.'] },
        { t: 'ad', id: 'F', title: 'Hallenbad West', lines: ['Samstags von 8 bis 12 Uhr geöffnet.', 'Eintritt für Jugendliche: 4 Euro.', 'Schwimmen und Spaß haben!'] },
        { t: 'ad', id: 'G', title: 'Café Sonnenschein', lines: ['Jeden Sonntag von 9 bis 13 Uhr gibt es ein vegetarisches Frühstück.', 'Brot, Obst, Käse und warme Getränke.', 'Wir freuen uns auf dich!'] },
        { t: 'ad', id: 'H', title: 'Musikschule Klang', lines: ['Du möchtest Gitarre lernen?', 'Unser Gitarrenkurs findet freitags um 17 Uhr statt.', 'Anfänger sind willkommen.', 'Anmeldung telefonisch.'] },
      ],
      questions: [
        zu(11, 'Paul möchte ein gebrauchtes Fahrrad kaufen. Er hat 70 Euro.'),
        zu(12, 'Anna möchte am Samstag kostenlos Deutsch sprechen üben.'),
        zu(13, 'Tim möchte am Samstagvormittag schwimmen gehen.'),
        zu(14, 'Lisa sucht ein vegetarisches Frühstück für Sonntag.'),
        zu(15, 'Ben möchte abends Deutsch von zu Hause lernen.'),
        zu(16, 'Emma möchte am Donnerstagabend Gitarre lernen.'),
      ],
    },
    {
      id: 't4', n: 4, title: 'Eine E-Mail von der Schule', minutes: 10, kind: 'Multiple Choice',
      instruction: ['Lesen Sie die E-Mail.', 'Wählen Sie bei den Aufgaben 17–21 die richtige Antwort.'],
      textTitle: 'Unser Ausflug am Donnerstag',
      text: [
        { t: 'meta', rows: [['Von', 'Frau Becker'], ['An', 'Klasse 8b'], ['Betreff', 'Unser Ausflug am Donnerstag']] },
        { t: 'p', text: 'Liebe Schülerinnen und Schüler,' },
        { t: 'p', text: 'am nächsten Donnerstag machen wir einen Ausflug nach Bonn. Wir besuchen dort das Museum für Naturkunde.' },
        { t: 'p', text: 'Wir treffen uns um 8:15 Uhr vor der Schule. Der Bus fährt um 8:30 Uhr ab. Bitte kommt pünktlich!' },
        { t: 'p', text: 'Im Museum haben wir zuerst eine Führung. Dabei lernen wir etwas über Tiere und die Natur. Danach machen wir einen kleinen Workshop. Dort arbeiten wir in Gruppen und beantworten interessante Fragen.' },
        { t: 'p', text: 'Um 12 Uhr machen wir eine Mittagspause im Garten des Museums. Bitte bringt ein Sandwich oder etwas anderes zu essen und eine Flasche Wasser mit. Im Museum gibt es ein kleines Café, aber das Essen ist dort ziemlich teuer.' },
        { t: 'p', text: 'Die Eintrittskarten bezahlt die Schule. Ihr braucht also kein Geld für den Eintritt mitzubringen.' },
        { t: 'p', text: 'Handys dürfen während der Führung nicht benutzt werden. In der Mittagspause könnt ihr aber Fotos machen.' },
        { t: 'p', text: 'Wir kommen ungefähr um 16 Uhr wieder an der Schule an.' },
        { t: 'p', text: 'Wenn jemand nicht mitfahren kann, muss er mir spätestens am Dienstag eine Nachricht schreiben.' },
        { t: 'p', text: 'Ich freue mich auf unseren Ausflug!' },
        { t: 'p', text: 'Viele Grüße' },
        { t: 'p', text: 'Frau Becker' },
      ],
      questions: [
        mc(17, 'Wohin fährt die Klasse?', 'In ein Naturkundemuseum in Bonn.', 'In einen Zoo in Köln.', 'In ein Theater in Berlin.'),
        mc(18, 'Wann und wo treffen sich die Schüler?', 'Um 8:30 Uhr am Bahnhof.', 'Um 8:15 Uhr vor der Schule.', 'Um 9 Uhr am Museum.'),
        mc(19, 'Was sollen die Schüler mitbringen?', 'Eine Eintrittskarte.', 'Einen Computer.', 'Etwas zu essen und Wasser.'),
        mc(20, 'Wer bezahlt den Eintritt?', 'Die Schule.', 'Die Eltern.', 'Jeder Schüler selbst.'),
        mc(21, 'Was muss man machen, wenn man nicht mitfahren kann?', 'Am Donnerstag zu Hause bleiben, ohne etwas zu sagen.', 'Spätestens am Dienstag Frau Becker schreiben.', 'Am Mittwoch im Museum anrufen.'),
      ],
    },
    {
      id: 't5', n: 5, title: 'Regeln im Lernhaus', minutes: 9, kind: 'Multiple Choice',
      instruction: ['Sie möchten in einem Lernhaus Deutsch lernen.', 'Lesen Sie die Hausordnung und wählen Sie die richtige Antwort.'],
      textTitle: 'Lernhaus am Park — Hausordnung',
      text: [
        { t: 'h', text: '1. Öffnungszeiten' },
        { t: 'p', text: 'Unser Lernhaus ist von Montag bis Freitag zwischen 14 und 19 Uhr geöffnet.' },
        { t: 'p', text: 'Am Samstag können Sie von 10 bis 16 Uhr kommen.' },
        { t: 'p', text: 'Am Sonntag bleibt das Lernhaus geschlossen.' },
        { t: 'h', text: '2. Essen und Trinken' },
        { t: 'p', text: 'Essen ist nur im Aufenthaltsraum erlaubt.' },
        { t: 'p', text: 'In den Lernräumen dürfen Sie Wasser aus einer geschlossenen Flasche trinken.' },
        { t: 'p', text: 'Andere Getränke und Essen sind dort nicht erlaubt.' },
        { t: 'h', text: '3. Computer und Tablets' },
        { t: 'p', text: 'Alle Besucher dürfen unsere Tablets kostenlos benutzen.' },
        { t: 'p', text: 'Die Benutzungszeit beträgt maximal 45 Minuten pro Person und Tag.' },
        { t: 'p', text: 'Vor der Benutzung muss man sich an der Information anmelden.' },
        { t: 'h', text: '4. Gruppenräume' },
        { t: 'p', text: 'Sie möchten zusammen mit Freunden lernen?' },
        { t: 'p', text: 'Dafür gibt es zwei Gruppenräume.' },
        { t: 'p', text: 'Diese müssen spätestens einen Tag vorher reserviert werden.' },
        { t: 'h', text: '5. Bücher' },
        { t: 'p', text: 'Im Lernhaus finden Sie viele Bücher für Deutschlernende.' },
        { t: 'p', text: 'Sie können die Bücher kostenlos im Gebäude lesen.' },
        { t: 'p', text: 'Die Bücher dürfen aber nicht mit nach Hause genommen werden.' },
        { t: 'h', text: '6. Ruhe' },
        { t: 'p', text: 'Bitte sprechen Sie in den Lernräumen leise.' },
        { t: 'p', text: 'Telefonieren ist dort nicht erlaubt.' },
        { t: 'p', text: 'Für Gespräche können Sie den Aufenthaltsraum benutzen.' },
        { t: 'p', text: 'Vielen Dank für Ihre Hilfe!' },
      ],
      questions: [
        mc(22, 'Wann ist das Lernhaus am Samstag geöffnet?', 'Von 14 bis 19 Uhr.', 'Von 10 bis 16 Uhr.', 'Es ist geschlossen.'),
        mc(23, 'Was darf man in den Lernräumen trinken?', 'Wasser aus einer geschlossenen Flasche.', 'Kaffee und Tee.', 'Alle Getränke.'),
        mc(24, 'Was muss man machen, wenn man einen Gruppenraum benutzen möchte?', 'Fünf Euro bezahlen.', 'Einen eigenen Computer mitbringen.', 'Den Raum spätestens einen Tag vorher reservieren.'),
        mc(25, 'Was ist mit den Büchern erlaubt?', 'Man darf sie zwei Wochen mit nach Hause nehmen.', 'Man darf sie kostenlos im Gebäude lesen.', 'Man darf sie kaufen.'),
      ],
    },
  ],
};

export const LESEN_SECRET: LesenSecret = {
  // Lösungsschlüssel del documento (Teil 1: R = Richtig, F = Falsch).
  answers: {
    q1: 'F', q2: 'R', q3: 'F', q4: 'F', q5: 'R',
    q6: 'b', q7: 'a', q8: 'c', q9: 'a', q10: 'b',
    q11: 'B', q12: 'C', q13: 'F', q14: 'G', q15: 'D', q16: '0',
    q17: 'a', q18: 'b', q19: 'c', q20: 'a', q21: 'b',
    q22: 'b', q23: 'a', q24: 'c', q25: 'b',
  },
  // Explicación = la frase del texto que lo demuestra (+ por qué cae la trampa cuando la hay).
  explain: {
    q1: '«Seit drei Wochen wohne ich bei meiner Tante in Köln.» Son tres semanas, no tres meses.',
    q2: '«Mein Deutschkurs ist von Montag bis Donnerstag. Er beginnt um neun Uhr morgens und endet um halb eins.» De 9:00 a 12:30 = por la mañana.',
    q3: '«Am Freitag haben wir keinen Unterricht in der Sprachschule. Wir lernen online von zu Hause.»',
    q4: '«Letzten Dienstag hat es aber stark geregnet. Deshalb bin ich mit dem Bus gefahren.» Normalmente va en bici, pero ese día no.',
    q5: '«Am Samstag habe ich mit meinem Cousin Ben das Stadtmuseum besucht.»',
    q6: 'Tabla: «Mittwoch · Basketball · 16:00–17:00».',
    q7: 'Tabla: «Dienstag · Fotografieren». El sábado no hay actividades.',
    q8: '«Für den Fotokurs brauchst du dein eigenes Handy. Eine professionelle Kamera ist nicht nötig.»',
    q9: '«Für den Kochkurs musst du dich spätestens am Montag anmelden.» El jueves es el día del curso, no el plazo.',
    q10: '«Beim Musik-Workshop gibt es Gitarren und andere Instrumente im Jugendzentrum.» No es gratis: cuesta 2 €.',
    q11: 'B · Second Bike: «gebrauchte Fahrräder für 50 bis 90 Euro» (70 € entra). A solo repara: «Wir verkaufen keine Fahrräder.»',
    q12: 'C · Deutsch-Tandem: «Jeden Samstag um 15 Uhr … Kostenlos!» D es online y cuesta 5 €.',
    q13: 'F · Hallenbad West: «Samstags von 8 bis 12 Uhr geöffnet.» = sábado por la mañana.',
    q14: 'G · Café Sonnenschein: «Jeden Sonntag von 9 bis 13 Uhr gibt es ein vegetarisches Frühstück.»',
    q15: 'D · Deutsch online: «Deutschunterricht von zu Hause! … um 19 Uhr.» = por la tarde-noche, desde casa.',
    q16: '0 · El curso de guitarra (H) es «freitags um 17 Uhr», no el jueves por la tarde. Ningún anuncio encaja.',
    q17: '«am nächsten Donnerstag machen wir einen Ausflug nach Bonn. Wir besuchen dort das Museum für Naturkunde.»',
    q18: '«Wir treffen uns um 8:15 Uhr vor der Schule. Der Bus fährt um 8:30 Uhr ab.» 8:30 es la salida del bus, no la cita.',
    q19: '«Bitte bringt ein Sandwich oder etwas anderes zu essen und eine Flasche Wasser mit.»',
    q20: '«Die Eintrittskarten bezahlt die Schule.»',
    q21: '«Wenn jemand nicht mitfahren kann, muss er mir spätestens am Dienstag eine Nachricht schreiben.»',
    q22: '«Am Samstag können Sie von 10 bis 16 Uhr kommen.» 14–19 es de lunes a viernes.',
    q23: '«In den Lernräumen dürfen Sie Wasser aus einer geschlossenen Flasche trinken. Andere Getränke … sind dort nicht erlaubt.»',
    q24: '«Diese müssen spätestens einen Tag vorher reserviert werden.»',
    q25: '«Sie können die Bücher kostenlos im Gebäude lesen. Die Bücher dürfen aber nicht mit nach Hause genommen werden.» Lo de «zwei Wochen» es de otro texto (Anzeige E).',
  },
  // Categorías: qué evalúa cada pregunta. La mayoría son comprensión / búsqueda de información, no gramática.
  tags: {
    q1: ['Zeitangaben', 'Detailverstehen'], q2: ['Zeitangaben', 'Alltag'], q3: ['Detailverstehen', 'Alltag'], q4: ['Detailverstehen', 'Perfekt'], q5: ['Detailverstehen', 'Perfekt'],
    q6: ['Informationssuche', 'Zeitangaben'], q7: ['Informationssuche'], q8: ['Detailverstehen', 'Wortschatz'], q9: ['Zeitangaben', 'Modalverben'], q10: ['Detailverstehen', 'Modalverben'],
    q11: ['Informationssuche', 'Wortschatz'], q12: ['Informationssuche', 'Zeitangaben'], q13: ['Informationssuche', 'Zeitangaben'], q14: ['Informationssuche'], q15: ['Informationssuche', 'Zeitangaben'], q16: ['Informationssuche', 'Zeitangaben'],
    q17: ['Globalverstehen'], q18: ['Zeitangaben', 'Detailverstehen'], q19: ['Detailverstehen', 'Alltag'], q20: ['Detailverstehen'], q21: ['Zeitangaben', 'Modalverben'],
    q22: ['Zeitangaben', 'Informationssuche'], q23: ['Modalverben', 'Detailverstehen'], q24: ['Modalverben', 'Zeitangaben'], q25: ['Modalverben', 'Detailverstehen'],
  },
};
