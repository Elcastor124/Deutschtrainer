// Preguntas de comprensión de las lecturas nuevas (shared/reading.ts): una lectura distinta en cada partida.
import type { Question } from '../../shared/types.ts';
import { gp, mc, mt, od, tf, wr, type Meta } from './h.ts';

const of = (text: string) => (d: Meta['d'], x: string): Meta => ({ t: 'lesen', s: 'lesen', d, x, tags: [`text:${text}`] });

export function lesenMoreQuestions(): Question[] {
  const A = of('ausrede'), B = of('arzt'), C = of('konto'), D = of('stadtfest'), E = of('umzug');
  return [
    // ── Die beste Ausrede ──
    tf(A('easy', 'Richtig: „Lena studiert Medizin in Hamburg.“'), 'Lena studiert in Hamburg.', true),
    tf(A('easy', 'Falsch: „Aber ihr Wecker hat nicht geklingelt!“'), 'Lenas Wecker hat um sieben Uhr geklingelt.', false),
    mc(A('easy', '„Lena ist erst um halb neun aufgewacht.“ halb neun = 8:30.'), 'Wann ist Lena aufgewacht?', ['um halb neun', 'um neun Uhr', 'um zwanzig nach neun', 'um acht Uhr']),
    mc(A('easy', '„Deshalb ist sie mit dem Fahrrad gefahren.“'), 'Wie ist Lena zur Universität gefahren?', ['mit dem Fahrrad', 'mit dem Bus', 'mit dem Taxi', 'mit der U-Bahn']),
    mc(A('medium', '„Leider hat sie den Bus verpasst. Deshalb ist sie mit dem Fahrrad gefahren.“'), 'Warum ist Lena mit dem Fahrrad gefahren?',
      ['Weil sie den Bus verpasst hat.', 'Weil es warm war.', 'Weil sie gern Fahrrad fährt.']),
    tf(A('medium', 'Falsch: „…obwohl es sehr kalt war.“ Fue en bici AUNQUE hacía frío.'), 'Es war warm, deshalb ist Lena mit dem Fahrrad gefahren.', false),
    wr(A('medium', '„Um zwanzig nach neun ist sie an der Universität angekommen.“'), 'Wann ist Lena an der Universität angekommen? (escribe la hora)',
      ['um zwanzig nach neun', 'zwanzig nach neun', 'um 9:20', '9:20', 'um neun Uhr zwanzig', 'um 9.20 Uhr']),
    mc(A('medium', '„Ich komme zu spät, weil mein Wecker kaputt ist.“'), 'Was sagt Lena zum Professor?', ['Mein Wecker ist kaputt.', 'Der Bus ist kaputt.', 'Ich bin krank.']),
    gp(A('medium', 'weil manda el verbo al final: …, weil ihr Wecker kaputt ist.'), 'Completa con el texto:', 'Lena kommt zu spät, weil ihr Wecker kaputt ___.', [['ist']]),
    tf(A('easy', 'Richtig: „Aber am Ende hat Lena die Prüfung bestanden.“'), 'Lena hat die Prüfung bestanden.', true),
    mt(A('medium', 'deshalb = por eso · obwohl = aunque · leider = por desgracia · bestehen = aprobar'), 'Relaciona las palabras del texto',
      [['deshalb', 'por eso'], ['obwohl', 'aunque'], ['leider', 'por desgracia'], ['bestehen', 'aprobar']]),
    od(A('medium', '„Leider hat sie den Bus verpasst.“ Perfekt: hat … verpasst.'), 'Ordena la frase del texto', 'Leider hat sie den Bus verpasst.', ['Sie hat leider den Bus verpasst.']),
    mc(A('medium', '„Das ist die beste Ausrede der Woche!“ El profesor se ríe: la excusa le parece muy buena… y poco creíble.'), '¿Qué piensa el profesor?',
      ['Que es una excusa muy buena (y no se la cree del todo).', 'Que Lena está enferma.', 'Que el examen es mañana.']),

    // ── Beim Arzt ──
    tf(B('easy', 'Falsch: „Herr Becker ist seit drei Tagen krank.“'), 'Herr Becker ist seit drei Wochen krank.', false),
    mc(B('easy', '„Er hat Fieber und Halsschmerzen.“'), 'Was hat Herr Becker?', ['Fieber und Halsschmerzen', 'Bauchschmerzen', 'einen gebrochenen Arm']),
    mc(B('easy', '„Am Mittwoch ist er zum Arzt gegangen.“'), 'Wann ist Herr Becker zum Arzt gegangen?', ['am Mittwoch', 'am Montag', 'am Freitag']),
    mc(B('medium', '„Die Ärztin hat ihn untersucht und mit dem Stethoskop abgehört.“'), 'Was hat die Ärztin gemacht?',
      ['Sie hat ihn untersucht und abgehört.', 'Sie hat ihm eine Spritze gegeben.', 'Sie hat ein Röntgenbild gemacht.']),
    tf(B('medium', 'Falsch: „Sie müssen drei Tage im Bett bleiben.“'), 'Herr Becker muss eine Woche im Bett bleiben.', false),
    mc(B('easy', '„…und viel Tee trinken.“'), 'Was soll Herr Becker viel trinken?', ['Tee', 'Kaffee', 'Saft']),
    gp(B('medium', 'wenn manda el verbo al final; weggehen es separable y se junta: weggeht.'), 'Completa:', 'Wenn das Fieber nicht ___ (weggehen), kommt Herr Becker am Freitag wieder.', [['weggeht']]),
    wr(B('medium', '„…und ist zur Apotheke gegangen.“ zur = zu der.'), '¿Adónde ha ido Herr Becker con la receta? (zur …)', ['zur Apotheke', 'in die Apotheke', 'Er ist zur Apotheke gegangen.']),
    tf(B('easy', 'Richtig: „Dort hat er auch Bonbons gegen Husten gekauft.“'), 'Herr Becker hat in der Apotheke auch Bonbons gekauft.', true),
    mt(B('medium', 'das Rezept = la receta · die Apotheke = la farmacia · untersuchen = examinar · verschreiben = recetar'), 'Relaciona las palabras del texto',
      [['das Rezept', 'la receta'], ['die Apotheke', 'la farmacia'], ['untersuchen', 'examinar'], ['verschreiben', 'recetar']]),
    mc(B('medium', '«Was fehlt Ihnen?» es la pregunta típica del médico: ¿qué le pasa?'), '«Was fehlt Ihnen?» significa…', ['¿Qué le pasa?', '¿Qué le falta?', '¿Dónde vive?']),
    od(B('medium', '„Herr Becker hat das Rezept genommen.“ Perfekt de nehmen: genommen.'), 'Ordena la frase del texto', 'Herr Becker hat das Rezept genommen.'),
    tf(B('medium', 'Richtig: „Zu Hause hat seine Frau ihm eine Suppe gekocht.“'), 'Seine Frau hat ihm eine Suppe gekocht.', true),

    // ── Ein Konto für Mia ──
    tf(C('easy', 'Falsch: „Mia kommt aus Valencia und ist neu in Köln.“'), 'Mia kommt aus Köln.', false),
    mc(C('easy', '„Sie hat einen Job in einem Café gefunden.“'), 'Wo arbeitet Mia?', ['in einem Café', 'in einer Bank', 'in einem Hotel']),
    mc(C('medium', '„…für ihren Lohn braucht sie ein deutsches Bankkonto.“ der Lohn = el sueldo.'), 'Warum braucht Mia ein Bankkonto?', ['für ihren Lohn', 'für eine Reise', 'für ihre Mutter']),
    mc(C('easy', '„Die Bank war sehr voll, und Mia hat zwanzig Minuten gewartet.“'), 'Wie lange hat Mia in der Bank gewartet?', ['zwanzig Minuten', 'zwei Stunden', 'fünf Minuten']),
    tf(C('medium', 'Falsch: el empleado pidió un Ausweis, pero Mia enseñó su Reisepass (pasaporte).'), 'Mia hat ihren Ausweis gezeigt.', false),
    mc(C('medium', '„Name, Adresse und Telefonnummer.“'), 'Was hat Mia ins Formular geschrieben?', ['Name, Adresse und Telefonnummer', 'nur ihren Namen', 'ihre Lieblingsfarbe']),
    gp(C('medium', 'dass manda el verbo al final: …, dass die Karte in einer Woche kommt.'), 'Completa con el texto:', 'Der Mann hat gesagt, dass die Karte in einer Woche ___.', [['kommt']]),
    tf(C('easy', 'Richtig: „Sie hat zweimal unterschrieben.“'), 'Mia hat zweimal unterschrieben.', true),
    wr(C('medium', '„Ich möchte ein Konto eröffnen.“ möchte en posición 2 y el infinitivo al final.'), 'Escribe la frase de Mia: «Quiero abrir una cuenta.» (con möchte)', ['Ich möchte ein Konto eröffnen.']),
    mt(C('medium', 'der Reisepass = el pasaporte · das Formular = el formulario · unterschreiben = firmar · die Adresse = la dirección'), 'Relaciona las palabras del texto',
      [['der Reisepass', 'el pasaporte'], ['das Formular', 'el formulario'], ['unterschreiben', 'firmar'], ['die Adresse', 'la dirección']]),
    mc(C('easy', '„Am Abend hat sie mit ihrer Mutter in Spanien telefoniert.“'), 'Mit wem hat Mia am Abend telefoniert?', ['mit ihrer Mutter', 'mit ihrem Chef', 'mit dem Bankangestellten']),
    od(C('medium', '„Ich möchte ein Konto eröffnen.“'), 'Ordena la frase del texto', 'Ich möchte ein Konto eröffnen.'),
    tf(C('medium', 'Falsch: „Der Mann war sehr freundlich und hat langsam gesprochen.“'), 'Der Bankangestellte hat sehr schnell gesprochen.', false),

    // ── Das Stadtfest ──
    tf(D('easy', 'Falsch: „Das Fest beginnt am Samstag um vier Uhr.“'), 'Das Stadtfest beginnt am Sonntag.', false),
    mc(D('easy', '„Das Fest beginnt am Samstag um vier Uhr auf dem Marktplatz.“'), 'Um wie viel Uhr beginnt das Fest?', ['um vier Uhr', 'um acht Uhr', 'um Mitternacht']),
    mc(D('easy', '„…deshalb fährt er mit der U-Bahn.“'), 'Wie fährt Jonas zum Fest?', ['mit der U-Bahn', 'mit dem Fahrrad', 'mit dem Auto']),
    mc(D('medium', '„Am Hauptbahnhof muss er umsteigen.“'), 'Wo muss Jonas umsteigen?', ['am Hauptbahnhof', 'am Marktplatz', 'an der Universität']),
    tf(D('medium', 'Falsch: „Nach zwei Stationen steigt er aus.“'), 'Jonas steigt nach drei Stationen aus.', false),
    mc(D('medium', '„Jonas trifft seine Freundin Sara neben dem Brunnen.“ neben + Dativ.'), 'Wo trifft Jonas seine Freundin?', ['neben dem Brunnen', 'vor dem Kino', 'an der Haltestelle']),
    gp(D('medium', 'umsteigen es separable: er steigt … um.'), 'Completa (umsteigen):', 'Am Hauptbahnhof steigt Jonas ___.', [['um']]),
    tf(D('easy', 'Richtig: „Später tanzen sie bis Mitternacht.“'), 'Jonas und Sara tanzen bis Mitternacht.', true),
    wr(D('medium', '„Um eins fahren sie mit dem Taxi nach Hause.“ mit + Dativ.'), 'Wie fahren Jonas und Sara nach Hause?', ['mit dem Taxi', 'Sie fahren mit dem Taxi nach Hause.', 'Sie fahren mit dem Taxi.']),
    mt(D('medium', 'umsteigen = hacer transbordo · einsteigen = subirse · aussteigen = bajarse · der Fahrplan = el horario'), 'Relaciona las palabras del texto',
      [['umsteigen', 'hacer transbordo'], ['einsteigen', 'subirse'], ['aussteigen', 'bajarse'], ['der Fahrplan', 'el horario']]),
    mc(D('easy', '„Sie essen Bratwurst und trinken Apfelsaft.“'), 'Was essen Jonas und Sara?', ['Bratwurst', 'Pizza', 'Kuchen']),
    od(D('medium', '„Nach zwei Stationen steigt er aus.“ Inversión: steigt er … aus.'), 'Ordena la frase del texto', 'Nach zwei Stationen steigt er aus.', ['Er steigt nach zwei Stationen aus.']),
    mc(D('medium', '„Jonas ist müde, aber glücklich.“'), 'Wie ist Jonas am Ende des Tages?', ['müde, aber glücklich', 'traurig', 'krank']),

    // ── Der neue Nachbar ──
    tf(E('easy', 'Richtig: „Familie Yilmaz ist letzte Woche umgezogen.“ umziehen = mudarse.'), 'Familie Yilmaz ist letzte Woche umgezogen.', true),
    mc(E('easy', '„Die neue Wohnung ist groß und hell.“'), 'Wie ist die neue Wohnung?', ['groß und hell', 'klein und dunkel', 'alt und laut']),
    mc(E('easy', '„Am Samstag hat der Nachbar, Herr Klein, geklingelt.“'), 'Wer hat am Samstag geklingelt?', ['der Nachbar, Herr Klein', 'die Oma', 'ein Polizist']),
    tf(E('medium', 'Falsch: „Er wohnt seit zwanzig Jahren im Haus.“'), 'Herr Klein wohnt seit zwei Jahren im Haus.', false),
    mc(E('medium', '„Er hat das schwere Sofa ins Wohnzimmer getragen.“'), 'Was hat Herr Klein ins Wohnzimmer getragen?', ['das Sofa', 'den Kühlschrank', 'die Pflanzen']),
    gp(E('medium', 'stellen = movimiento (¿adónde?) → Akkusativ: auf den Balkon.'), 'Completa con el artículo:', 'Frau Yilmaz hat die Pflanzen auf ___ Balkon gestellt.', [['den']]),
    mc(E('medium', '„Sie hat auf dem Kühlschrank geschlafen!“'), 'Wo war die Katze?', ['auf dem Kühlschrank', 'unter dem Bett', 'hinter dem Schrank']),
    tf(E('medium', 'Falsch: la buscaron debajo de la cama, pero estaba encima de la nevera.'), 'Die Katze hat unter dem Bett geschlafen.', false),
    gp(E('medium', 'schlafen = posición (¿dónde?) → Dativ: auf dem Kühlschrank.'), 'Completa con el artículo:', 'Die Katze hat auf ___ Kühlschrank geschlafen.', [['dem']]),
    mt(E('medium', 'der Karton = la caja de cartón · die Pflanze = la planta · plötzlich = de repente · umziehen = mudarse'), 'Relaciona las palabras del texto',
      [['der Karton', 'la caja de cartón'], ['die Pflanze', 'la planta'], ['plötzlich', 'de repente'], ['umziehen', 'mudarse']]),
    mc(E('easy', '„Am Abend haben alle zusammen Pizza gegessen.“'), 'Was haben alle am Abend gegessen?', ['Pizza', 'Suppe', 'Bratwurst']),
    od(E('medium', '„Ihr Sohn hat Bilder an die Wand gehängt.“ an die Wand = Akkusativ (¿adónde?).'), 'Ordena la frase del texto', 'Ihr Sohn hat Bilder an die Wand gehängt.'),
    wr(E('medium', '„Brauchen Sie Hilfe?“ Pregunta formal con Sie.'), 'Escribe la pregunta de Herr Klein: «¿Necesita ayuda?»', ['Brauchen Sie Hilfe?']),
  ];
}
