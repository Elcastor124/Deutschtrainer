// Vocabulario extraído de las presentaciones de la carpeta clase-aleman.
// Cada bloque indica la presentación de origen. Lo usa el diccionario (tecla D) y los generadores del banco.
import type { Source } from './types.ts';

export interface Voc {
  de: string;
  es: string;
  src: Source;
  cat: string;
  /** Plural (para sustantivos) o 'only' si solo existe en plural. */
  pl?: string;
}

type Row = [de: string, es: string, pl?: string];
const V = (src: Source, cat: string, rows: Row[]): Voc[] => rows.map(([de, es, pl]) => ({ de, es, src, cat, pl }));

export const VOCAB: Voc[] = [
  // ── Auf der Bank (Lektion 6) ──
  ...V('bank', 'bank', [
    ['die Bank', 'el banco'], ['das Bankkonto', 'la cuenta bancaria'], ['die Karte', 'la tarjeta'],
    ['das Geld', 'el dinero'], ['der Ausweis', 'el DNI / documento de identidad'], ['der Reisepass', 'el pasaporte'],
    ['die Unterschrift', 'la firma'], ['das Formular', 'el formulario'], ['die Adresse', 'la dirección'],
    ['der Bankangestellte', 'el empleado del banco'], ['der Kunde', 'el cliente'],
  ]),
  ...V('bank', 'bank-act', [
    ['Geld abheben', 'sacar dinero'], ['Geld einzahlen', 'ingresar dinero'], ['ein Konto eröffnen', 'abrir una cuenta'],
    ['eine Karte beantragen', 'solicitar una tarjeta'], ['unterschreiben', 'firmar'], ['funktionieren', 'funcionar'],
    ['helfen', 'ayudar'],
  ]),
  ...V('bank', 'bank-phr', [
    ['Wie kann ich Ihnen helfen?', '¿En qué puedo ayudarle?'], ['Haben Sie einen Ausweis?', '¿Tiene un documento de identidad?'],
    ['Wie ist Ihre Adresse?', '¿Cuál es su dirección?'], ['Unterschreiben Sie bitte hier.', 'Firme aquí, por favor.'],
    ['Brauchen Sie sonst noch etwas?', '¿Necesita algo más?'], ['Wie bitte?', '¿Cómo dice? / ¿Perdón?'],
    ['Noch einmal, bitte.', 'Otra vez, por favor.'], ['Ja, hier bitte.', 'Sí, aquí tiene.'],
    ['Was soll ich jetzt machen?', '¿Qué debo hacer ahora?'],
  ]),
  ...V('bank', 'job', [
    ['das Vorstellungsgespräch', 'la entrevista de trabajo'], ['fleißig', 'trabajador / aplicado'], ['pünktlich', 'puntual'],
    ['die Erfahrung', 'la experiencia'], ['die Stärke', 'el punto fuerte'],
  ]),

  // ── Warum? weil · obwohl · deshalb + Perfekt ──
  ...V('warum', 'conn', [
    ['weil', 'porque (verbo al final)'], ['obwohl', 'aunque (verbo al final)'], ['deshalb', 'por eso (verbo en posición 2)'],
  ]),
  ...V('warum', 'state', [
    ['müde', 'cansado/a'], ['krank', 'enfermo/a'], ['kalt', 'frío'], ['heiß', 'caluroso / muy caliente'], ['kaputt', 'roto / estropeado'],
  ]),
  ...V('warum', 'daily', [
    ['die Prüfung', 'el examen'], ['die Note', 'la nota'], ['der Wecker', 'el despertador'], ['der Schlüssel', 'la llave'],
    ['das Handy', 'el móvil'], ['die Ausrede', 'la excusa'], ['das Wochenende', 'el fin de semana'], ['der Hunger', 'el hambre'],
    ['die Jacke', 'la chaqueta'], ['der Apfel', 'la manzana'], ['die Hausaufgaben', 'los deberes', 'only'],
  ]),
  ...V('warum', 'verb-w', [
    ['bestehen', 'aprobar (un examen)'], ['vergessen', 'olvidar'], ['verpassen', 'perder (el autobús, el tren)'],
    ['spazieren gehen', 'pasear'], ['einschlafen', 'dormirse'], ['aufstehen', 'levantarse'], ['bleiben', 'quedarse'],
  ]),

  // ── Im Krankenhaus (Lektion 8) ──
  ...V('kh', 'body', [
    ['der Kopf', 'la cabeza'], ['das Auge', 'el ojo', 'die Augen'], ['das Ohr', 'la oreja / el oído'], ['die Nase', 'la nariz'],
    ['der Zahn', 'el diente', 'die Zähne'], ['der Hals', 'el cuello / la garganta'], ['der Arm', 'el brazo'], ['die Hand', 'la mano'],
    ['der Bauch', 'la barriga'], ['der Rücken', 'la espalda'], ['das Bein', 'la pierna'], ['der Fuß', 'el pie', 'die Füße'],
    ['das Herz', 'el corazón'],
  ]),
  ...V('kh', 'symptom', [
    ['das Fieber', 'la fiebre'], ['der Husten', 'la tos'], ['der Schnupfen', 'el resfriado (mocos)'],
    ['die Kopfschmerzen', 'el dolor de cabeza', 'only'], ['die Bauchschmerzen', 'el dolor de barriga', 'only'],
    ['die Halsschmerzen', 'el dolor de garganta', 'only'],
  ]),
  ...V('kh', 'symptom-phr', [
    ['Mir ist schlecht.', 'Tengo náuseas.'], ['Mir ist schwindelig.', 'Estoy mareado/a.'], ['Mir tut der Kopf weh.', 'Me duele la cabeza.'],
    ['Was fehlt Ihnen?', '¿Qué le pasa?'], ['Gute Besserung!', '¡Que te mejores!'],
  ]),
  ...V('kh', 'hospital', [
    ['die Notaufnahme', 'urgencias'], ['der Krankenwagen', 'la ambulancia'], ['der Arzt', 'el médico'], ['die Ärztin', 'la médica'],
    ['das Röntgenbild', 'la radiografía'], ['der Gips', 'la escayola'], ['die Spritze', 'la inyección'], ['das Rezept', 'la receta'],
    ['die Tablette', 'la pastilla'], ['die Apotheke', 'la farmacia'], ['die Versicherungskarte', 'la tarjeta sanitaria'],
    ['das Krankenhaus', 'el hospital'], ['das Stethoskop', 'el estetoscopio'], ['die Medizin', 'el medicamento'],
  ]),
  ...V('kh', 'kh-verb', [
    ['wehtun', 'doler'], ['hinfallen', 'caerse'], ['gebrochen', 'roto (hueso)'], ['untersuchen', 'examinar'],
    ['abhören', 'auscultar'], ['verschreiben', 'recetar'],
  ]),
  ...V('kh', 'conn', [
    ['dass', 'que (verbo al final)'], ['wenn', 'si / cuando (verbo al final)'], ['wann?', '¿cuándo? (pregunta)'],
  ]),

  // ── Unterwegs · Dativ + Perfekt ──
  ...V('unterwegs', 'prep', [
    ['aus', 'de (origen, salir de)'], ['bei', 'en casa de / en (empresa)'], ['mit', 'con / en (transporte)'],
    ['nach', 'a (ciudad, país, casa) / después de'], ['seit', 'desde (hace)'], ['von', 'de (de parte de) / desde'],
    ['zu', 'a (personas y lugares)'], ['außer', 'excepto'], ['gegenüber', 'enfrente de'],
  ]),
  ...V('unterwegs', 'transport', [
    ['der Bus', 'el autobús'], ['die U-Bahn', 'el metro'], ['das Fahrrad', 'la bicicleta'], ['der Zug', 'el tren'],
    ['das Taxi', 'el taxi'], ['das Auto', 'el coche'], ['der Bahnhof', 'la estación'],
  ]),
  ...V('unterwegs', 'places', [
    ['die Stadt', 'la ciudad'], ['der Strand', 'la playa'], ['das Kino', 'el cine'], ['das Training', 'el entrenamiento'],
    ['der Zahnarzt', 'el dentista'], ['die Universität', 'la universidad'], ['die Schule', 'el colegio'],
  ]),
  ...V('unterwegs', 'family', [
    ['die Oma', 'la abuela'], ['die Mutter', 'la madre'], ['der Vater', 'el padre'], ['der Bruder', 'el hermano'],
    ['die Eltern', 'los padres', 'only'], ['das Kind', 'el niño / la niña'], ['der Freund', 'el amigo'], ['das Geschenk', 'el regalo'],
  ]),
  ...V('unterwegs', 'home', [
    ['das Sofa', 'el sofá'], ['die Pflanze', 'la planta'], ['der Karton', 'la caja de cartón'], ['die Wand', 'la pared'],
    ['die Katze', 'el gato / la gata'],
  ]),
  ...V('unterwegs', 'wo', [
    ['auf', 'encima de'], ['vor', 'delante de'], ['hinter', 'detrás de'], ['neben', 'al lado de'], ['zwischen', 'entre'],
  ]),
  ...V('unterwegs', 'adv', [
    ['nach Hause', 'a casa (¿adónde?)'], ['zu Hause', 'en casa (¿dónde?)'], ['zuerst', 'primero'], ['danach', 'después'],
    ['am Ende', 'al final'], ['gestern', 'ayer'], ['erzählen', 'contar (una historia)'], ['glauben', 'creer'],
  ]),

  // ── Brücke A1 (clase puente) ──
  ...V('bruecke', 'greet', [
    ['Hallo', 'hola'], ['Guten Morgen', 'buenos días (hasta ~11 h)'], ['Guten Tag', 'buenos días / tardes (formal)'],
    ['Guten Abend', 'buenas noches (al llegar)'], ['Tschüss', 'adiós (informal)'], ['Auf Wiedersehen', 'adiós (formal)'],
    ['Bis morgen', 'hasta mañana'], ['Wie geht\'s?', '¿qué tal?'],
  ]),
  ...V('bruecke', 'q4', [
    ['Wie heißt du?', '¿Cómo te llamas?'], ['Wie alt bist du?', '¿Cuántos años tienes?'],
    ['Woher kommst du?', '¿De dónde eres?'], ['Wo wohnst du?', '¿Dónde vives?'],
  ]),
  ...V('bruecke', 'lang', [
    ['Deutsch', 'alemán'], ['Spanisch', 'español'], ['Englisch', 'inglés'], ['Französisch', 'francés'],
    ['ein bisschen', 'un poco'], ['sehr gut', 'muy bien'],
  ]),

  // ── Sprache in Bewegung (deutsch-trainer-120.html) ──
  ...V('trainer', 'color', [
    ['rot', 'rojo'], ['blau', 'azul'], ['grün', 'verde'], ['gelb', 'amarillo'], ['schwarz', 'negro'], ['weiß', 'blanco'],
    ['grau', 'gris'], ['orange', 'naranja'], ['braun', 'marrón'], ['rosa', 'rosa'], ['lila', 'morado / lila'],
  ]),
  ...V('trainer', 'city', [
    ['die Haltestelle', 'la parada'], ['der Fahrplan', 'el horario (de transporte)'], ['die Einladung', 'la invitación'],
    ['das Stadtfest', 'la fiesta de la ciudad'], ['der Supermarkt', 'el supermercado'], ['die Wohnung', 'el piso'],
  ]),
  ...V('trainer', 'city-verb', [
    ['umsteigen', 'hacer transbordo'], ['aussteigen', 'bajarse'], ['einsteigen', 'subirse'], ['mitkommen', 'venir (con alguien)'],
    ['einkaufen', 'hacer la compra'], ['anrufen', 'llamar (por teléfono)'], ['fernsehen', 'ver la tele'],
  ]),

  // ── A1–A2 general (contenido nuevo de esta app, no sale de ninguna presentación) ──
  ...V('a1', 'food', [
    ['das Brot', 'el pan', 'die Brote'], ['das Brötchen', 'el panecillo', 'die Brötchen'], ['die Butter', 'la mantequilla'],
    ['der Käse', 'el queso'], ['die Wurst', 'el embutido / la salchicha', 'die Würste'], ['das Ei', 'el huevo', 'die Eier'],
    ['die Milch', 'la leche'], ['der Kaffee', 'el café'], ['der Tee', 'el té'], ['das Wasser', 'el agua'],
    ['der Saft', 'el zumo', 'die Säfte'], ['der Wein', 'el vino', 'die Weine'], ['die Banane', 'el plátano', 'die Bananen'],
    ['die Orange', 'la naranja', 'die Orangen'], ['die Tomate', 'el tomate', 'die Tomaten'], ['die Kartoffel', 'la patata', 'die Kartoffeln'],
    ['der Reis', 'el arroz'], ['die Nudeln', 'la pasta', 'only'], ['das Fleisch', 'la carne'], ['der Fisch', 'el pescado', 'die Fische'],
    ['das Hähnchen', 'el pollo', 'die Hähnchen'], ['der Salat', 'la ensalada', 'die Salate'], ['die Suppe', 'la sopa', 'die Suppen'],
    ['der Kuchen', 'la tarta / el pastel', 'die Kuchen'], ['das Eis', 'el helado'], ['die Schokolade', 'el chocolate'],
    ['der Zucker', 'el azúcar'], ['das Salz', 'la sal'],
  ]),
  ...V('a1', 'meal', [
    ['das Frühstück', 'el desayuno'], ['das Mittagessen', 'la comida (del mediodía)'], ['das Abendessen', 'la cena'],
    ['das Restaurant', 'el restaurante', 'die Restaurants'], ['die Speisekarte', 'la carta (del restaurante)', 'die Speisekarten'],
    ['die Rechnung', 'la cuenta / la factura', 'die Rechnungen'], ['der Teller', 'el plato', 'die Teller'], ['das Glas', 'el vaso', 'die Gläser'],
  ]),
  ...V('a1', 'clothes', [
    ['die Hose', 'el pantalón', 'die Hosen'], ['das Hemd', 'la camisa', 'die Hemden'], ['das T-Shirt', 'la camiseta', 'die T-Shirts'],
    ['der Pullover', 'el jersey', 'die Pullover'], ['das Kleid', 'el vestido', 'die Kleider'], ['der Rock', 'la falda', 'die Röcke'],
    ['der Schuh', 'el zapato', 'die Schuhe'], ['die Socke', 'el calcetín', 'die Socken'], ['der Mantel', 'el abrigo', 'die Mäntel'],
    ['die Mütze', 'el gorro', 'die Mützen'], ['der Schal', 'la bufanda', 'die Schals'], ['die Brille', 'las gafas', 'die Brillen'],
    ['die Tasche', 'el bolso / la bolsa', 'die Taschen'], ['der Rucksack', 'la mochila', 'die Rucksäcke'],
  ]),
  ...V('a1', 'house', [
    ['das Haus', 'la casa', 'die Häuser'], ['das Zimmer', 'la habitación', 'die Zimmer'], ['die Küche', 'la cocina', 'die Küchen'],
    ['das Bad', 'el baño', 'die Bäder'], ['das Schlafzimmer', 'el dormitorio', 'die Schlafzimmer'], ['das Wohnzimmer', 'el salón', 'die Wohnzimmer'],
    ['der Balkon', 'el balcón', 'die Balkone'], ['der Garten', 'el jardín', 'die Gärten'], ['die Treppe', 'la escalera', 'die Treppen'],
  ]),
  ...V('a1', 'furniture', [
    ['der Tisch', 'la mesa', 'die Tische'], ['der Stuhl', 'la silla', 'die Stühle'], ['das Bett', 'la cama', 'die Betten'],
    ['der Schrank', 'el armario', 'die Schränke'], ['das Regal', 'la estantería', 'die Regale'], ['die Lampe', 'la lámpara', 'die Lampen'],
    ['das Fenster', 'la ventana', 'die Fenster'], ['die Tür', 'la puerta', 'die Türen'], ['der Kühlschrank', 'la nevera', 'die Kühlschränke'],
    ['der Teppich', 'la alfombra', 'die Teppiche'],
  ]),
  ...V('a1', 'weather', [
    ['das Wetter', 'el tiempo (meteorológico)'], ['die Sonne', 'el sol'], ['der Regen', 'la lluvia'], ['der Schnee', 'la nieve'],
    ['der Wind', 'el viento'], ['die Wolke', 'la nube', 'die Wolken'], ['der Frühling', 'la primavera'], ['der Sommer', 'el verano'],
    ['der Herbst', 'el otoño'], ['der Winter', 'el invierno'],
  ]),
  ...V('a1', 'weather-adj', [
    ['sonnig', 'soleado'], ['windig', 'con viento'], ['bewölkt', 'nublado'], ['warm', 'cálido / templado'], ['kühl', 'fresco'], ['neblig', 'con niebla'],
  ]),
  ...V('a1', 'time', [
    ['der Tag', 'el día', 'die Tage'], ['die Woche', 'la semana', 'die Wochen'], ['der Monat', 'el mes', 'die Monate'],
    ['das Jahr', 'el año', 'die Jahre'], ['die Stunde', 'la hora (duración)', 'die Stunden'], ['die Minute', 'el minuto', 'die Minuten'],
    ['der Morgen', 'la mañana (temprano)'], ['der Mittag', 'el mediodía'], ['der Nachmittag', 'la tarde (13–18 h)'],
    ['der Abend', 'la tarde-noche (después de las 18 h)'], ['die Nacht', 'la noche', 'die Nächte'],
  ]),
  ...V('a1', 'days', [
    ['der Montag', 'el lunes'], ['der Dienstag', 'el martes'], ['der Mittwoch', 'el miércoles'], ['der Donnerstag', 'el jueves'],
    ['der Freitag', 'el viernes'], ['der Samstag', 'el sábado'], ['der Sonntag', 'el domingo'],
  ]),
  ...V('a1', 'time-adv', [
    ['heute', 'hoy'], ['morgen', 'mañana (el día siguiente)'], ['übermorgen', 'pasado mañana'], ['vorgestern', 'anteayer'],
    ['immer', 'siempre'], ['oft', 'a menudo'], ['manchmal', 'a veces'], ['nie', 'nunca'], ['früh', 'temprano'], ['spät', 'tarde (hora)'],
    ['jetzt', 'ahora'], ['bald', 'pronto'],
  ]),
  ...V('a1', 'free', [
    ['das Hobby', 'el hobby / la afición', 'die Hobbys'], ['die Musik', 'la música'], ['das Buch', 'el libro', 'die Bücher'],
    ['der Film', 'la película', 'die Filme'], ['das Spiel', 'el juego / el partido', 'die Spiele'], ['der Sport', 'el deporte'],
    ['der Fußball', 'el fútbol'], ['das Schwimmbad', 'la piscina', 'die Schwimmbäder'], ['der Park', 'el parque', 'die Parks'],
    ['das Museum', 'el museo', 'die Museen'], ['das Konzert', 'el concierto', 'die Konzerte'], ['die Party', 'la fiesta', 'die Partys'],
    ['die Gitarre', 'la guitarra', 'die Gitarren'], ['das Foto', 'la foto', 'die Fotos'],
  ]),
  ...V('a1', 'jobs', [
    ['der Lehrer', 'el profesor', 'die Lehrer'], ['die Lehrerin', 'la profesora', 'die Lehrerinnen'], ['der Koch', 'el cocinero', 'die Köche'],
    ['der Kellner', 'el camarero', 'die Kellner'], ['die Verkäuferin', 'la dependienta', 'die Verkäuferinnen'],
    ['der Polizist', 'el policía', 'die Polizisten'], ['der Ingenieur', 'el ingeniero', 'die Ingenieure'],
    ['die Krankenpflegerin', 'la enfermera', 'die Krankenpflegerinnen'], ['der Student', 'el estudiante', 'die Studenten'],
    ['der Friseur', 'el peluquero', 'die Friseure'], ['der Bäcker', 'el panadero', 'die Bäcker'], ['der Beruf', 'la profesión', 'die Berufe'],
    ['die Arbeit', 'el trabajo'], ['das Büro', 'la oficina', 'die Büros'],
  ]),
  ...V('a1', 'city2', [
    ['die Straße', 'la calle', 'die Straßen'], ['der Platz', 'la plaza', 'die Plätze'], ['die Kirche', 'la iglesia', 'die Kirchen'],
    ['das Rathaus', 'el ayuntamiento', 'die Rathäuser'], ['die Post', 'correos (la oficina)'], ['die Bäckerei', 'la panadería', 'die Bäckereien'],
    ['der Markt', 'el mercado', 'die Märkte'], ['das Geschäft', 'la tienda', 'die Geschäfte'], ['das Hotel', 'el hotel', 'die Hotels'],
    ['der Flughafen', 'el aeropuerto', 'die Flughäfen'], ['die Brücke', 'el puente', 'die Brücken'], ['die Ampel', 'el semáforo', 'die Ampeln'],
    ['das Café', 'la cafetería', 'die Cafés'], ['der Preis', 'el precio', 'die Preise'], ['die Bibliothek', 'la biblioteca', 'die Bibliotheken'],
  ]),
  ...V('a1', 'adj', [
    ['groß', 'grande / alto (persona)'], ['klein', 'pequeño'], ['alt', 'viejo / mayor'], ['jung', 'joven'], ['neu', 'nuevo'],
    ['gut', 'bueno / bien'], ['schlecht', 'malo / mal'], ['schön', 'bonito'], ['hässlich', 'feo'], ['lang', 'largo'], ['kurz', 'corto'],
    ['leicht', 'fácil / ligero'], ['schwer', 'difícil / pesado'], ['laut', 'ruidoso / fuerte (sonido)'], ['leise', 'silencioso / bajito'],
    ['voll', 'lleno'], ['leer', 'vacío'], ['billig', 'barato'], ['teuer', 'caro'], ['langsam', 'lento'], ['interessant', 'interesante'],
    ['langweilig', 'aburrido'], ['traurig', 'triste'], ['lustig', 'divertido / gracioso'], ['freundlich', 'amable / simpático'],
    ['ruhig', 'tranquilo'], ['hungrig', 'con hambre'], ['durstig', 'con sed'],
  ]),
  ...V('a1', 'verb-a1', [
    ['wohnen', 'vivir (en un sitio)'], ['heißen', 'llamarse'], ['essen', 'comer'], ['trinken', 'beber'], ['schlafen', 'dormir'],
    ['kochen', 'cocinar'], ['lesen', 'leer'], ['schreiben', 'escribir'], ['hören', 'oír / escuchar'], ['sehen', 'ver'],
    ['sprechen', 'hablar'], ['verstehen', 'entender'], ['fragen', 'preguntar'], ['antworten', 'responder'], ['suchen', 'buscar'],
    ['finden', 'encontrar'], ['brauchen', 'necesitar'], ['warten', 'esperar'], ['öffnen', 'abrir'], ['schließen', 'cerrar'],
    ['beginnen', 'empezar'], ['bezahlen', 'pagar'], ['kosten', 'costar'], ['arbeiten', 'trabajar'], ['lernen', 'aprender / estudiar'],
    ['spielen', 'jugar / tocar (un instrumento)'], ['tanzen', 'bailar'], ['singen', 'cantar'], ['schwimmen', 'nadar'], ['reisen', 'viajar'],
    ['besuchen', 'visitar'], ['treffen', 'quedar con alguien'], ['mögen', 'gustar (ich mag…)'], ['wissen', 'saber (un dato)'],
    ['kennen', 'conocer'], ['kaufen', 'comprar'], ['nehmen', 'tomar / coger'], ['geben', 'dar'], ['laufen', 'correr / andar'],
    ['tragen', 'llevar puesto / cargar'], ['waschen', 'lavar'], ['verkaufen', 'vender'],
  ]),
  ...V('a1', 'sep-a1', [
    ['aufräumen', 'ordenar (recoger)'], ['anfangen', 'comenzar'], ['mitbringen', 'traer (consigo)'], ['abholen', 'recoger (a alguien)'],
    ['ankommen', 'llegar'], ['abfahren', 'salir (un tren, un bus)'], ['zurückkommen', 'volver'], ['aufmachen', 'abrir (coloquial)'],
    ['zumachen', 'cerrar (coloquial)'], ['anziehen', 'ponerse (ropa)'],
  ]),

  // ── Lectura de esta clase ──
  ...V('lesen', 'lesen', [
    ['nett', 'amable'], ['ausfüllen', 'rellenar (un formulario)'], ['plötzlich', 'de repente'], ['glücklich', 'feliz'],
    ['regnen', 'llover'], ['bringen', 'llevar (a alguien)'], ['schnell', 'rápido'],
  ]),
];

/** Verbos del Perfekt (presentación «weil · obwohl · deshalb + Perfekt»): infinitivo, auxiliar, Partizip II, traducción. */
export const PERFEKT_VERBS: [inf: string, aux: 'haben' | 'sein', part: string, es: string][] = [
  ['machen', 'haben', 'gemacht', 'hacer'], ['spielen', 'haben', 'gespielt', 'jugar'], ['kaufen', 'haben', 'gekauft', 'comprar'],
  ['arbeiten', 'haben', 'gearbeitet', 'trabajar'], ['lernen', 'haben', 'gelernt', 'aprender / estudiar'], ['essen', 'haben', 'gegessen', 'comer'],
  ['trinken', 'haben', 'getrunken', 'beber'], ['sehen', 'haben', 'gesehen', 'ver'], ['schreiben', 'haben', 'geschrieben', 'escribir'],
  ['lesen', 'haben', 'gelesen', 'leer'], ['schlafen', 'haben', 'geschlafen', 'dormir'], ['treffen', 'haben', 'getroffen', 'quedar con'],
  ['finden', 'haben', 'gefunden', 'encontrar'], ['bekommen', 'haben', 'bekommen', 'recibir'], ['vergessen', 'haben', 'vergessen', 'olvidar'],
  ['verstehen', 'haben', 'verstanden', 'entender'], ['besuchen', 'haben', 'besucht', 'visitar'], ['studieren', 'haben', 'studiert', 'estudiar (carrera)'],
  ['telefonieren', 'haben', 'telefoniert', 'hablar por teléfono'], ['einkaufen', 'haben', 'eingekauft', 'hacer la compra'],
  ['fernsehen', 'haben', 'ferngesehen', 'ver la tele'], ['anrufen', 'haben', 'angerufen', 'llamar'], ['haben', 'haben', 'gehabt', 'tener'],
  ['verlieren', 'haben', 'verloren', 'perder'],
  ['gehen', 'sein', 'gegangen', 'ir (a pie)'], ['fahren', 'sein', 'gefahren', 'ir (en vehículo)'], ['kommen', 'sein', 'gekommen', 'venir'],
  ['fliegen', 'sein', 'geflogen', 'volar'], ['laufen', 'sein', 'gelaufen', 'correr / andar'], ['aufstehen', 'sein', 'aufgestanden', 'levantarse'],
  ['einschlafen', 'sein', 'eingeschlafen', 'dormirse'], ['bleiben', 'sein', 'geblieben', 'quedarse'], ['sein', 'sein', 'gewesen', 'ser / estar'],
  ['werden', 'sein', 'geworden', 'llegar a ser'], ['passieren', 'sein', 'passiert', 'pasar / ocurrir'], ['reisen', 'sein', 'gereist', 'viajar'],
  ['umziehen', 'sein', 'umgezogen', 'mudarse'],
];

/** Conjugación en presente (deutsch-trainer-120.html): ich, du, er/sie/es, wir, ihr, sie/Sie. */
export const PRAESENS: [inf: string, es: string, forms: [string, string, string, string, string, string]][] = [
  ['machen', 'hacer', ['mache', 'machst', 'macht', 'machen', 'macht', 'machen']],
  ['lernen', 'aprender', ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen']],
  ['wohnen', 'vivir', ['wohne', 'wohnst', 'wohnt', 'wohnen', 'wohnt', 'wohnen']],
  ['kommen', 'venir', ['komme', 'kommst', 'kommt', 'kommen', 'kommt', 'kommen']],
  ['arbeiten', 'trabajar', ['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten']],
  ['sein', 'ser / estar', ['bin', 'bist', 'ist', 'sind', 'seid', 'sind']],
  ['haben', 'tener', ['habe', 'hast', 'hat', 'haben', 'habt', 'haben']],
  ['fahren', 'ir (en vehículo)', ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren']],
  ['sprechen', 'hablar', ['spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen']],
];
export const PERSONS = ['ich', 'du', 'er', 'wir', 'ihr', 'sie (ellos)'] as const;

const UNITS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf',
  'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
/** Números en alemán (mismo algoritmo que la presentación Brücke A1). */
export function deNum(n: number): string {
  if (n < 20) return UNITS[n];
  if (n === 100) return 'hundert';
  const d = Math.floor(n / 10), r = n % 10;
  return r === 0 ? TENS[d] : (r === 1 ? 'ein' : UNITS[r]) + 'und' + TENS[d];
}

export const isNoun = (de: string) => /^(der|die|das) [A-ZÄÖÜ]/.test(de);
export const articleOf = (de: string) => de.split(' ')[0] as 'der' | 'die' | 'das';
