// Textos originales de Leseverstehen (A1–A2, 120–150 palabras). Cada sesión usa uno: el que estos alumnos
// han visto hace más tiempo. Reúnen vocabulario y gramática de las cuatro presentaciones.
// Formato: [texto visible|traducción] → palabra subrayada que se traduce al pulsarla.
// «vocab»: entradas de shared/vocab.ts que aparecen en el texto (sus preguntas vuelven a salir en el juego).

export interface Reading { id: string; title: string; sub: string; paragraphs: string[]; vocab: string[] }

export const READINGS: Reading[] = [
  {
    id: 'samstag',
    vocab: [
      'die Bank', 'das Geld', 'Geld abheben', 'die Karte', 'funktionieren', 'der Bankangestellte', 'das Formular', 'unterschreiben',
      'eine Karte beantragen', 'der Bus', 'das Fahrrad', 'der Arm', 'die Notaufnahme', 'die Ärztin', 'gebrochen', 'wehtun',
      'die Tablette', 'müde', 'deshalb', 'obwohl', 'dass', 'wenn', 'aufstehen', 'der Freund', 'nett', 'ausfüllen', 'plötzlich',
      'glücklich', 'regnen', 'bringen', 'schnell',
    ],
    title: 'Ein verrückter Samstag',
    sub: 'Un sábado de locos',
    paragraphs: [
      'Pablo kommt aus Sevilla, aber er wohnt [seit einem Jahr|desde hace un año] in Berlin. Am Samstag ist er um acht Uhr [aufgestanden|se ha levantado (aufstehen, con sein)]. Er [hatte kein Geld mehr|ya no tenía dinero]. [Deshalb|por eso → verbo en posición 2] ist er [mit dem Bus|en autobús (mit + Dativ)] [zur Bank|al banco (zu + der)] gefahren. „Guten Morgen. Ich möchte [Geld abheben|sacar dinero]“, hat er gesagt. Aber seine [Karte|tarjeta] hat nicht [funktioniert|funcionado]! Die [Bankangestellte|empleada del banco] war sehr [nett|amable]. Sie hat gesagt, [dass|que → verbo al final] er ein [Formular|formulario] [ausfüllen|rellenar] muss. Pablo hat das Formular [unterschrieben|firmado (unterschreiben)] und eine neue Karte [beantragt|solicitado (beantragen)].',
      '[Danach|después] ist er mit dem [Fahrrad|bicicleta] zu seinem Freund Jonas gefahren. [Obwohl|aunque → verbo al final] es [geregnet|llovido (regnen)] hat, ist er sehr [schnell|rápido] gefahren. [Plötzlich|de repente] – bumm! Pablo ist [vom Fahrrad gefallen|se ha caído de la bici (von + dem)]. Sein Arm hat sehr [wehgetan|dolido (wehtun)], und Jonas hat ihn in die [Notaufnahme|urgencias] [gebracht|llevado (bringen)]. Die [Ärztin|médica] hat gesagt: „Ihr Arm ist nicht [gebrochen|roto]. [Wenn es wehtut|si le duele → wehtut se junta], nehmen Sie eine [Tablette|pastilla].“ Am Abend war Pablo [müde|cansado], aber [glücklich|feliz].',
    ],
  },
  {
    id: 'ausrede',
    title: 'Die beste Ausrede',
    sub: 'La mejor excusa',
    vocab: [
      'die Prüfung', 'der Wecker', 'die Haltestelle', 'verpassen', 'deshalb', 'obwohl', 'weil', 'kaputt', 'die Ausrede', 'bestehen',
      'das Fahrrad', 'der Bus', 'die Jacke', 'die Universität', 'die Note', 'kalt',
    ],
    paragraphs: [
      'Lena studiert Medizin in Hamburg. Sie wohnt mit zwei Freundinnen in einer kleinen Wohnung. Am Montag hatte sie eine wichtige [Prüfung|examen]. Aber ihr [Wecker|despertador] hat nicht [geklingelt|sonado (klingeln)]! Lena ist erst um halb neun [aufgewacht|se ha despertado (aufwachen)], und die Prüfung hat um neun Uhr [angefangen|empezado (anfangen)]. Sie hat schnell ihre [Jacke|chaqueta] [angezogen|puesto (anziehen)] und ist zur [Haltestelle|parada] gelaufen. [Leider|por desgracia] hat sie den Bus [verpasst|perdido (verpassen)]. [Deshalb|por eso → verbo en posición 2] ist sie mit dem Fahrrad gefahren, [obwohl|aunque → verbo al final] es sehr [kalt|frío] war.',
      'Um zwanzig nach neun ist sie an der [Universität|universidad] angekommen. Der Professor hat gefragt: „Warum kommen Sie so spät?“ Lena hat gesagt: „Ich komme zu spät, [weil|porque → verbo al final] mein Wecker [kaputt|roto] ist.“ Der Professor hat gelacht: „Das ist die beste [Ausrede|excusa] der Woche!“ Aber am Ende hat Lena die Prüfung [bestanden|aprobado (bestehen)] – mit einer sehr guten [Note|nota].',
    ],
  },
  {
    id: 'arzt',
    title: 'Beim Arzt',
    sub: 'En el médico',
    vocab: [
      'krank', 'das Fieber', 'die Halsschmerzen', 'der Arzt', 'die Ärztin', 'Was fehlt Ihnen?', 'müde', 'untersuchen', 'abhören', 'das Stethoskop',
      'verschreiben', 'die Tablette', 'wenn', 'das Rezept', 'die Apotheke', 'Gute Besserung!', 'der Husten',
    ],
    paragraphs: [
      'Herr Becker ist seit drei Tagen [krank|enfermo]. Er hat [Fieber|fiebre] und [Halsschmerzen|dolor de garganta]. Er kann nicht arbeiten. Am Mittwoch ist er zum [Arzt|médico] gegangen. Die [Ärztin|médica] hat gefragt: „[Was fehlt Ihnen?|¿Qué le pasa?]“ Herr Becker hat gesagt: „[Mir tut der Hals weh|me duele la garganta], und ich bin sehr [müde|cansado].“ Die Ärztin hat ihn [untersucht|examinado (untersuchen)] und mit dem [Stethoskop|estetoscopio] [abgehört|auscultado (abhören)].',
      'Dann hat sie gesagt: „Sie haben [eine Grippe|una gripe]. Sie müssen drei Tage im Bett bleiben und viel Tee trinken. Ich [verschreibe|receto (verschreiben)] Ihnen [Tabletten|pastillas]. [Wenn|si → verbo al final] das Fieber nicht weggeht, kommen Sie am Freitag wieder.“ Herr Becker hat das [Rezept|receta] genommen und ist zur [Apotheke|farmacia] gegangen. Dort hat er auch Bonbons gegen [Husten|tos] gekauft. Zu Hause hat seine Frau ihm eine Suppe gekocht. Danach hat er zwölf Stunden geschlafen. [Gute Besserung|¡que se mejore!], Herr Becker!',
    ],
  },
  {
    id: 'konto',
    title: 'Ein Konto für Mia',
    sub: 'Una cuenta para Mía',
    vocab: [
      'das Bankkonto', 'die Bank', 'der Bankangestellte', 'helfen', 'ein Konto eröffnen', 'der Ausweis', 'der Reisepass', 'das Formular',
      'die Adresse', 'unterschreiben', 'die Karte', 'deshalb', 'dass', 'erzählen', 'das Café',
    ],
    paragraphs: [
      'Mia kommt aus Valencia und ist neu in Köln. Sie hat einen Job in einem [Café|cafetería] [gefunden|encontrado (finden)], und für ihren Lohn braucht sie ein deutsches [Bankkonto|cuenta bancaria]. [Deshalb|por eso] ist sie am Dienstag zur Bank gegangen. Die Bank war sehr voll, und Mia hat zwanzig Minuten gewartet. Ein [Bankangestellter|empleado del banco] hat gefragt: „Wie kann ich Ihnen [helfen|ayudar]?“ – „Ich möchte [ein Konto eröffnen|abrir una cuenta].“ – „Haben Sie einen [Ausweis|documento de identidad]?“ Mia hat ihren [Reisepass|pasaporte] gezeigt. Der Mann war sehr freundlich und hat langsam gesprochen.',
      'Dann hat sie ein [Formular|formulario] [ausgefüllt|rellenado (ausfüllen)]: Name, [Adresse|dirección] und Telefonnummer. Sie hat zweimal [unterschrieben|firmado (unterschreiben)]. Der Mann hat gesagt, [dass|que → verbo al final] die [Karte|tarjeta] in einer Woche kommt. Mia war sehr [froh|contenta]. Am Abend hat sie mit ihrer Mutter in Spanien telefoniert und alles [erzählt|contado (erzählen)]. Ihre Mutter hat gelacht: „Jetzt bist du eine richtige Kölnerin!“',
    ],
  },
  {
    id: 'stadtfest',
    title: 'Das Stadtfest',
    sub: 'La fiesta de la ciudad',
    vocab: [
      'die Einladung', 'das Stadtfest', 'die U-Bahn', 'die Haltestelle', 'der Fahrplan', 'umsteigen', 'einsteigen', 'aussteigen', 'nach Hause',
      'das Taxi', 'deshalb', 'die Stadt',
    ],
    paragraphs: [
      'Jonas hat eine [Einladung|invitación] zum [Stadtfest|fiesta de la ciudad] bekommen. Das Fest beginnt am Samstag um vier Uhr auf dem Marktplatz. Jonas wohnt am Rand der [Stadt|ciudad], deshalb fährt er mit der [U-Bahn|metro]. An der [Haltestelle|parada] schaut er auf den [Fahrplan|horario]: Die nächste U-Bahn kommt in fünf Minuten. Am Hauptbahnhof muss er [umsteigen|hacer transbordo] und in die Linie 3 [einsteigen|subirse]. Nach zwei Stationen [steigt|se baja (aussteigen)] er [aus|— partícula de aussteigen].',
      'Auf dem Marktplatz ist schon viel los: Es gibt Musik, Essen und viele Leute. Auf der Bühne spielt eine Band, und alle singen mit. Jonas trifft seine Freundin Sara [neben dem Brunnen|al lado de la fuente (neben + Dativ)]. Sie essen Bratwurst und trinken Apfelsaft. [Später|más tarde] tanzen sie [bis Mitternacht|hasta medianoche]. Um eins fahren sie mit dem [Taxi|taxi] [nach Hause|a casa]. Jonas ist müde, aber glücklich. Was für ein schöner Tag!',
    ],
  },
  {
    id: 'umzug',
    title: 'Der neue Nachbar',
    sub: 'El nuevo vecino',
    vocab: [
      'der Karton', 'das Sofa', 'die Pflanze', 'die Wand', 'die Katze', 'plötzlich', 'der Schrank', 'der Kühlschrank', 'das Bett',
      'der Balkon', 'die Wohnung',
    ],
    paragraphs: [
      'Familie Yilmaz ist letzte Woche [umgezogen|se ha mudado (umziehen)]. Die neue [Wohnung|piso] ist groß und hell, aber überall stehen [Kartons|cajas de cartón]. Am Samstag hat der Nachbar, Herr Klein, [geklingelt|llamado al timbre]. Er wohnt seit zwanzig Jahren im Haus. „Brauchen Sie Hilfe?“ Er hat das schwere [Sofa|sofá] ins Wohnzimmer getragen. Frau Yilmaz hat die [Pflanzen|plantas] [auf den Balkon|al balcón (¿adónde? → Akkusativ)] gestellt, und ihr Sohn hat Bilder [an die Wand|en la pared (¿adónde? → Akkusativ)] gehängt. Die Kinder haben ihre Spielsachen in die Schränke gelegt.',
      '[Plötzlich|de repente] war die [Katze|gata] weg! Alle haben sie gesucht: [unter dem Bett|debajo de la cama (¿dónde? → Dativ)], [hinter dem Schrank|detrás del armario] und in allen Kartons. Endlich hat Herr Klein sie gefunden: Sie hat [auf dem Kühlschrank|encima de la nevera] geschlafen! Alle haben gelacht. Am Abend haben alle zusammen Pizza gegessen. „Danke für alles“, hat Frau Yilmaz gesagt. „Sie sind der beste Nachbar der Welt!“',
    ],
  },
];

export interface ReadingChunk { text: string; gloss?: string }

export function parseParagraph(p: string): ReadingChunk[] {
  const out: ReadingChunk[] = [];
  const re = /\[([^|\]]+)\|([^\]]+)\]/g;
  let last = 0;
  for (let m = re.exec(p); m; m = re.exec(p)) {
    if (m.index > last) out.push({ text: p.slice(last, m.index) });
    out.push({ text: m[1], gloss: m[2] });
    last = m.index + m[0].length;
  }
  if (last < p.length) out.push({ text: p.slice(last) });
  return out;
}

export const readingById = (id?: string | null): Reading => READINGS.find((r) => r.id === id) ?? READINGS[0];

/** Texto sin marcas de traducción (para reescribirlo en «Mach es lustiger!»). */
export const plainText = (r: Reading) => r.paragraphs.map((p) => p.replace(/\[([^|\]]+)\|[^\]]+\]/g, '$1')).join('\n\n');

export const readingWords = (r: Reading) => plainText(r).split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;

/** Glosario de todas las lecturas, para el diccionario. */
export const READING_GLOSSARY: { de: string; es: string }[] = [...new Map(READINGS.flatMap((r) => r.paragraphs)
  .flatMap(parseParagraph)
  .filter((c) => c.gloss)
  .map((c) => [c.text, { de: c.text, es: c.gloss as string }] as const)).values()];
