// Original pedagogical adaptation, not an official Goethe examination.
// Server-only: never import this module from browser code.
import type { RoadLevel, RoadSecret } from '../shared/road.ts';

export const ROAD_LEVEL: RoadLevel = {
  "id": "level-1",
  "version": "1.0.0",
  "title": "Level 1 — Die erste Prüfung",
  "disclaimer": "Simulacro pedagógico original inspirado en el formato del Goethe B1 y adaptado a A1–A2. No es un examen oficial ni una calificación certificadora Goethe.",
  "schedule": [
    {
      "id": "intro",
      "title": "Einführung",
      "minutes": 5
    },
    {
      "id": "lesen",
      "title": "Leseverstehen",
      "minutes": 50
    },
    {
      "id": "korrektur",
      "title": "Korrektur",
      "minutes": 8
    },
    {
      "id": "diktat",
      "title": "Diktat",
      "minutes": 15
    },
    {
      "id": "horen",
      "title": "Hörverstehen",
      "minutes": 22
    },
    {
      "id": "ergebnisse",
      "title": "Ergebnisse",
      "minutes": 5
    }
  ],
  "reading": [
    {
      "id": "lesen-1",
      "title": "TEIL 1 — BLOG",
      "instruction": "Lesen Sie den Text und entscheiden Sie: Richtig oder Falsch.",
      "texts": [
        {
          "id": "blog",
          "title": "Ein Samstag mit vielen Überraschungen",
          "body": "Hallo zusammen!\n\nAm Samstag wollte ich mit meiner Freundin Lena ins Schwimmbad gehen. Aber am Morgen hat es geregnet, und Lena war krank. Deshalb bin ich nicht schwimmen gegangen.\n\nUm zehn Uhr habe ich meinen Bruder Tom getroffen. Wir sind zusammen mit dem Bus in die Stadt gefahren, weil mein Fahrrad kaputt war.\n\nZuerst haben wir in einer Buchhandlung ein Geschenk für unsere Mutter gesucht. Ein rotes Buch war sehr schön, aber es war zu teuer. Deshalb haben wir eine blaue Tasse für acht Euro gekauft.\n\nDanach haben wir in einem kleinen Café Mittag gegessen. Ich hatte ein Käsebrot und einen Apfelsaft. Tom hat eine Suppe bestellt.\n\nUm halb drei sind wir nach Hause gekommen. Am Abend hat Lena mir geschrieben: Ihr geht es wieder besser!\n\nNächsten Samstag wollen wir zusammen ins Schwimmbad gehen. Hoffentlich scheint dann die Sonne!\n\nBis bald!\n\nEure Mia"
        }
      ],
      "questions": [
        {
          "id": "l1",
          "number": 1,
          "type": "boolean",
          "prompt": "Mia ist am Samstag schwimmen gegangen.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        },
        {
          "id": "l2",
          "number": 2,
          "type": "boolean",
          "prompt": "Lena konnte nicht mitkommen, weil sie krank war.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        },
        {
          "id": "l3",
          "number": 3,
          "type": "boolean",
          "prompt": "Mia und Tom sind mit dem Fahrrad in die Stadt gefahren.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        },
        {
          "id": "l4",
          "number": 4,
          "type": "boolean",
          "prompt": "Die Geschwister haben ein Geschenk für ihre Mutter gekauft.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        },
        {
          "id": "l5",
          "number": 5,
          "type": "boolean",
          "prompt": "Mia hat im Café eine Suppe gegessen.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        },
        {
          "id": "l6",
          "number": 6,
          "type": "boolean",
          "prompt": "Mia und Lena möchten nächsten Samstag schwimmen gehen.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "textId": "blog"
        }
      ]
    },
    {
      "id": "lesen-2",
      "title": "TEIL 2 — ZEITUNGSARTIKEL",
      "instruction": "Lesen Sie die Texte und wählen Sie a, b oder c.",
      "texts": [
        {
          "id": "sportkurse",
          "title": "Neue Sportkurse für Jugendliche",
          "body": "Das Jugendzentrum Nord in Bremen hat ein neues Sportprogramm.\n\nSeit September gibt es jeden Mittwoch einen Tanzkurs für Jugendliche von 12 bis 17 Jahren. Der Kurs beginnt um 17 Uhr und dauert 60 Minuten. Man braucht keine Erfahrung, aber saubere Sportschuhe.\n\nDer erste Besuch ist kostenlos. Danach kostet jeder Termin zwei Euro.\n\nWer lieber Fußball spielt, kann freitags um 16 Uhr kommen. Im Winter trainieren die Fußballspieler in der Sporthalle und nicht auf dem Sportplatz.\n\nMan kann sich online oder direkt im Jugendzentrum anmelden. Das Ziel ist einfach: Jugendliche sollen neue Freunde finden und Spaß am Sport haben."
        },
        {
          "id": "bibliothek",
          "title": "Eine neue Bibliothek in Leipzig",
          "body": "In Leipzig öffnet am Montag eine neue kleine Bibliothek neben dem Bahnhof.\n\nDie Bibliothek ist von Montag bis Freitag von 10 bis 18 Uhr geöffnet. Am Samstag kann man von 10 bis 14 Uhr kommen.\n\nEs gibt Bücher, Comics, Zeitschriften und Computer. Jugendliche bis 18 Jahre bekommen eine Bibliothekskarte kostenlos.\n\nMit dieser Karte kann man drei Bücher für zwei Wochen mit nach Hause nehmen. Die Computer dürfen alle Besucher in der Bibliothek kostenlos benutzen.\n\nAm Donnerstag um 16 Uhr gibt es einen Leseklub für Jugendliche. Man muss sich dafür nicht anmelden."
        }
      ],
      "questions": [
        {
          "id": "l7",
          "number": 7,
          "type": "choice",
          "prompt": "Worum geht es in diesem Text?",
          "options": [
            "Um neue Schulprüfungen.",
            "Um ein neues Sportprogramm für Jugendliche.",
            "Um einen Ausflug in den Zoo."
          ],
          "textId": "sportkurse"
        },
        {
          "id": "l8",
          "number": 8,
          "type": "choice",
          "prompt": "Wann beginnt der Tanzkurs?",
          "options": [
            "Mittwochs um 17 Uhr.",
            "Freitags um 16 Uhr.",
            "Mittwochs um 16 Uhr."
          ],
          "textId": "sportkurse"
        },
        {
          "id": "l9",
          "number": 9,
          "type": "choice",
          "prompt": "Was kostet der erste Tanzkursbesuch?",
          "options": [
            "Fünf Euro.",
            "Zwei Euro.",
            "Nichts."
          ],
          "textId": "sportkurse"
        },
        {
          "id": "l10",
          "number": 10,
          "type": "choice",
          "prompt": "Wo befindet sich die neue Bibliothek?",
          "options": [
            "Neben dem Bahnhof.",
            "In einer Sporthalle.",
            "In einer Schule."
          ],
          "textId": "bibliothek"
        },
        {
          "id": "l11",
          "number": 11,
          "type": "choice",
          "prompt": "Wofür brauchen Jugendliche eine Bibliothekskarte?",
          "options": [
            "Um Zeitschriften in der Bibliothek zu lesen.",
            "Um Bücher mit nach Hause zu nehmen.",
            "Um einen Computer in der Bibliothek zu benutzen."
          ],
          "textId": "bibliothek"
        },
        {
          "id": "l12",
          "number": 12,
          "type": "choice",
          "prompt": "Wann findet der Leseklub statt?",
          "options": [
            "Mittwochs um 16 Uhr.",
            "Donnerstags um 18 Uhr, nur mit Anmeldung.",
            "Donnerstags um 16 Uhr, ohne Anmeldung."
          ],
          "textId": "bibliothek"
        }
      ]
    },
    {
      "id": "lesen-3",
      "title": "TEIL 3 — ANZEIGEN",
      "instruction": "Lesen Sie die Situationen und die Anzeigen. Welche Anzeige passt? Jede Anzeige darf nur einmal verwendet werden. Für eine Situation gibt es keine passende Anzeige. Schreiben Sie dann 0.",
      "texts": [
        {
          "id": "anzeige-a",
          "label": "A",
          "title": "Gitarrenunterricht",
          "body": "Gitarrenunterricht — Für Anfänger, jeden Freitag um 17 Uhr. Für Jugendliche von 12 bis 17 Jahren."
        },
        {
          "id": "anzeige-b",
          "label": "B",
          "title": "Café Grün",
          "body": "Café Grün — Vegetarische Sandwiches und Salate. Samstag von 12 bis 18 Uhr geöffnet."
        },
        {
          "id": "anzeige-c",
          "label": "C",
          "title": "Kino Central",
          "body": "Kino Central — Jeden Freitag um 19 Uhr neue Filme. Tickets ab 6 Euro."
        },
        {
          "id": "anzeige-d",
          "label": "D",
          "title": "Hallenbad Süd",
          "body": "Hallenbad Süd — Sonntag von 9 bis 12 Uhr geöffnet. Schwimmen für Kinder und Jugendliche."
        },
        {
          "id": "anzeige-e",
          "label": "E",
          "title": "Deutsch online",
          "body": "Deutsch online — Deutsch sprechen von zu Hause. Live-Kurs montags und donnerstags um 19 Uhr."
        },
        {
          "id": "anzeige-f",
          "label": "F",
          "title": "Malkurs am Samstag",
          "body": "Malkurs am Samstag — Male deine eigenen Bilder! Jeden Samstag ab 14 Uhr im Kulturzentrum."
        },
        {
          "id": "anzeige-g",
          "label": "G",
          "title": "Fahrradmarkt",
          "body": "Fahrradmarkt — Gebrauchte Fahrräder ab 40 Euro. Verschiedene Größen. Montag bis Samstag geöffnet."
        },
        {
          "id": "anzeige-h",
          "label": "H",
          "title": "Fußball für alle",
          "body": "Fußball für alle — Training jeden Dienstag um 16 Uhr auf dem Sportplatz Nord."
        },
        {
          "id": "anzeige-i",
          "label": "I",
          "title": "Stadtbibliothek",
          "body": "Stadtbibliothek — Jugendliche können hier kostenlos Bücher ausleihen. Montag bis Samstag."
        },
        {
          "id": "anzeige-j",
          "label": "J",
          "title": "Klavier lernen",
          "body": "Klavier lernen — Klavierunterricht am Mittwoch um 16 Uhr. Für Anfänger und Fortgeschrittene."
        }
      ],
      "questions": [
        {
          "id": "l13",
          "number": 13,
          "type": "matching",
          "prompt": "Tom möchte am Dienstagnachmittag Fußball spielen.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l14",
          "number": 14,
          "type": "matching",
          "prompt": "Mia möchte Bücher lesen und kostenlos mit nach Hause nehmen.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l15",
          "number": 15,
          "type": "matching",
          "prompt": "Lena möchte am Samstag nach 12 Uhr vegetarisch essen.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l16",
          "number": 16,
          "type": "matching",
          "prompt": "Paul hat nur am Sonntagvormittag Zeit zum Schwimmen.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l17",
          "number": 17,
          "type": "matching",
          "prompt": "Nina möchte abends online Deutsch sprechen üben.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l18",
          "number": 18,
          "type": "matching",
          "prompt": "Ben sucht ein gebrauchtes Fahrrad für weniger als 70 Euro.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        },
        {
          "id": "l19",
          "number": 19,
          "type": "matching",
          "prompt": "Emma möchte am Montagvormittag Klavierunterricht nehmen.",
          "options": [
            "0",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J"
          ]
        }
      ],
      "example": "Sara möchte am Freitag um 17 Uhr Gitarre lernen. → A."
    },
    {
      "id": "lesen-4",
      "title": "TEIL 4 — MEINUNGEN",
      "instruction": "Sollen Hausaufgaben am Wochenende verboten sein?\n\nLesen Sie die Meinungen. Ist die Person für ein Verbot von Hausaufgaben am Wochenende? Ja oder Nein?",
      "texts": [
        {
          "id": "meinung-20",
          "title": "David",
          "body": "„Ich finde Hausaufgaben am Wochenende gut. Am Samstag habe ich viel Zeit und kann in Ruhe lernen. Deshalb müssen sie erlaubt bleiben.“"
        },
        {
          "id": "meinung-21",
          "title": "Leonie",
          "body": "„Am Samstag mache ich Sport. Am Sonntag möchte ich Zeit mit meiner Familie haben. Lehrer sollten uns für diese zwei Tage keine Aufgaben geben.“"
        },
        {
          "id": "meinung-22",
          "title": "Julia",
          "body": "„Fünf Schultage sind genug. Wir brauchen auch zwei Tage ohne Schule. Alle Hausaufgaben sollen von Montag bis Freitag gemacht werden.“"
        },
        {
          "id": "meinung-23",
          "title": "Felix",
          "body": "„Zehn Minuten Mathe am Sonntag sind für mich kein Problem. Die Lehrer sollen auch am Wochenende kleine Übungen geben dürfen.“"
        },
        {
          "id": "meinung-24",
          "title": "Omar",
          "body": "„Am Wochenende treffe ich meine Freunde. Ich möchte dann nicht für die Schule arbeiten. Deshalb finde ich ein Verbot richtig.“"
        },
        {
          "id": "meinung-25",
          "title": "Paula",
          "body": "„Hausaufgaben können wichtig sein, auch am Samstag. Aber die Lehrer sollten nicht zu viele Aufgaben geben. Ganz verbieten würde ich sie nicht.“"
        },
        {
          "id": "meinung-26",
          "title": "Emma",
          "body": "„Wenn wir am Montag eine Prüfung haben, ist es gut, am Sonntag etwas zu lernen. Hausaufgaben am Wochenende sind manchmal sinnvoll.“"
        }
      ],
      "questions": [
        {
          "id": "l20",
          "number": 20,
          "type": "yesno",
          "prompt": "David:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-20"
        },
        {
          "id": "l21",
          "number": 21,
          "type": "yesno",
          "prompt": "Leonie:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-21"
        },
        {
          "id": "l22",
          "number": 22,
          "type": "yesno",
          "prompt": "Julia:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-22"
        },
        {
          "id": "l23",
          "number": 23,
          "type": "yesno",
          "prompt": "Felix:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-23"
        },
        {
          "id": "l24",
          "number": 24,
          "type": "yesno",
          "prompt": "Omar:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-24"
        },
        {
          "id": "l25",
          "number": 25,
          "type": "yesno",
          "prompt": "Paula:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-25"
        },
        {
          "id": "l26",
          "number": 26,
          "type": "yesno",
          "prompt": "Emma:",
          "options": [
            "Ja",
            "Nein"
          ],
          "textId": "meinung-26"
        }
      ],
      "example": "Hanna: „Am Wochenende möchte ich frei haben. Die Schule ist von Montag bis Freitag. Hausaufgaben am Samstag oder Sonntag finde ich nicht gut.“\n→ Ja."
    },
    {
      "id": "lesen-5",
      "title": "TEIL 5 — HAUSORDNUNG",
      "instruction": "Lesen Sie die Hausordnung und wählen Sie a, b oder c.",
      "texts": [
        {
          "id": "hausordnung",
          "title": "Jugendzentrum Stadtpark — Hausordnung",
          "body": "1. Öffnungszeiten\n\nDas Jugendzentrum ist von Montag bis Freitag von 14 bis 19 Uhr geöffnet. Am Samstag öffnen wir von 10 bis 17 Uhr. Sonntags ist das Zentrum geschlossen.\n\n2. Fahrräder\n\nFahrräder müssen vor dem Gebäude stehen. Im Flur dürfen keine Fahrräder stehen.\n\n3. Essen und Trinken\n\nEssen und Trinken sind im Café erlaubt. Im Computerraum darf man nicht essen oder trinken.\n\n4. Computer\n\nJugendliche dürfen die Computer 30 Minuten benutzen. Vor der Benutzung müssen sie sich am Empfang anmelden.\n\n5. Spiele und Bücher\n\nAlle Besucher dürfen Spiele und Bücher benutzen. Nach der Benutzung muss alles wieder in den Schrank gestellt werden."
        }
      ],
      "questions": [
        {
          "id": "l27",
          "number": 27,
          "type": "choice",
          "prompt": "Wo müssen Fahrräder stehen?",
          "options": [
            "Im Flur.",
            "Vor dem Gebäude.",
            "Im Café."
          ],
          "textId": "hausordnung"
        },
        {
          "id": "l28",
          "number": 28,
          "type": "choice",
          "prompt": "Wo darf man essen?",
          "options": [
            "Im Café.",
            "Im Computerraum.",
            "Überall im Zentrum."
          ],
          "textId": "hausordnung"
        },
        {
          "id": "l29",
          "number": 29,
          "type": "choice",
          "prompt": "Vor der Computerbenutzung müssen Jugendliche ...",
          "options": [
            "einen eigenen Computer mitbringen.",
            "einen Lehrer fragen.",
            "sich am Empfang anmelden."
          ],
          "textId": "hausordnung"
        },
        {
          "id": "l30",
          "number": 30,
          "type": "choice",
          "prompt": "Am Sonntag ist das Jugendzentrum ...",
          "options": [
            "von 14 bis 19 Uhr geöffnet.",
            "geschlossen.",
            "nur am Vormittag geöffnet."
          ],
          "textId": "hausordnung"
        }
      ]
    }
  ],
  "listening": [
    {
      "audio": {
        "id": "h1",
        "title": "EINE NACHRICHT"
      },
      "questions": [
        {
          "id": "h1q1",
          "number": 1,
          "type": "boolean",
          "prompt": "Die Freunde treffen sich um 15 Uhr.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "audioId": "h1"
        },
        {
          "id": "h1q2",
          "number": 2,
          "type": "choice",
          "prompt": "Wann treffen sich Julia und Leo?",
          "options": [
            "Um 16:30 Uhr.",
            "Um 17:00 Uhr.",
            "Um 15:00 Uhr."
          ],
          "audioId": "h1"
        }
      ]
    },
    {
      "audio": {
        "id": "h2",
        "title": "AM BAHNHOF"
      },
      "questions": [
        {
          "id": "h2q1",
          "number": 3,
          "type": "boolean",
          "prompt": "Der Zug nach Hamburg fährt heute von Gleis vier.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "audioId": "h2"
        },
        {
          "id": "h2q2",
          "number": 4,
          "type": "choice",
          "prompt": "Von welchem Gleis fährt der Zug nach Hamburg?",
          "options": [
            "Gleis vier.",
            "Gleis fünf.",
            "Gleis sechs."
          ],
          "audioId": "h2"
        }
      ]
    },
    {
      "audio": {
        "id": "h3",
        "title": "IN DER SCHULE"
      },
      "questions": [
        {
          "id": "h3q1",
          "number": 5,
          "type": "boolean",
          "prompt": "Die Klasse besucht morgen einen Zoo.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "audioId": "h3"
        },
        {
          "id": "h3q2",
          "number": 6,
          "type": "choice",
          "prompt": "Was sollen die Schüler mitbringen?",
          "options": [
            "Eintrittskarten.",
            "Essen und ein Getränk.",
            "Sportkleidung."
          ],
          "audioId": "h3"
        }
      ]
    },
    {
      "audio": {
        "id": "h4",
        "title": "SPORTVEREIN"
      },
      "questions": [
        {
          "id": "h4q1",
          "number": 7,
          "type": "boolean",
          "prompt": "Das Fußballtraining findet heute nicht statt.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "audioId": "h4"
        },
        {
          "id": "h4q2",
          "number": 8,
          "type": "choice",
          "prompt": "Wo findet das Training morgen statt?",
          "options": [
            "In der Sporthalle.",
            "Auf dem Sportplatz.",
            "Im Park."
          ],
          "audioId": "h4"
        }
      ]
    },
    {
      "audio": {
        "id": "h5",
        "title": "WETTERBERICHT"
      },
      "questions": [
        {
          "id": "h5q1",
          "number": 9,
          "type": "boolean",
          "prompt": "Am Nachmittag bleibt das Wetter heute trocken.",
          "options": [
            "Richtig",
            "Falsch"
          ],
          "audioId": "h5"
        },
        {
          "id": "h5q2",
          "number": 10,
          "type": "choice",
          "prompt": "Wann regnet es?",
          "options": [
            "Morgen Vormittag.",
            "Heute Morgen.",
            "Heute Nachmittag."
          ],
          "audioId": "h5"
        }
      ]
    }
  ],
  "dictation": {
    "title": "Mein Schultag",
    "rubric": [
      "Montag",
      "acht Uhr",
      "Bus",
      "Fahrrad",
      "ersten Stunde",
      "Deutsch",
      "halb elf",
      "Freunden",
      "Hausaufgaben",
      "Familie"
    ]
  },
  "maxPoints": 50
};

export const ROAD_SECRET: RoadSecret = {
  "answers": {
    "l1": "Falsch",
    "l2": "Richtig",
    "l3": "Falsch",
    "l4": "Richtig",
    "l5": "Falsch",
    "l6": "Richtig",
    "l7": "Um ein neues Sportprogramm für Jugendliche.",
    "l8": "Mittwochs um 17 Uhr.",
    "l9": "Nichts.",
    "l10": "Neben dem Bahnhof.",
    "l11": "Um Bücher mit nach Hause zu nehmen.",
    "l12": "Donnerstags um 16 Uhr, ohne Anmeldung.",
    "l13": "H",
    "l14": "I",
    "l15": "B",
    "l16": "D",
    "l17": "E",
    "l18": "G",
    "l19": "0",
    "l20": "Nein",
    "l21": "Ja",
    "l22": "Ja",
    "l23": "Nein",
    "l24": "Ja",
    "l25": "Nein",
    "l26": "Nein",
    "l27": "Vor dem Gebäude.",
    "l28": "Im Café.",
    "l29": "sich am Empfang anmelden.",
    "l30": "geschlossen.",
    "h1q1": "Falsch",
    "h1q2": "Um 16:30 Uhr.",
    "h2q1": "Falsch",
    "h2q2": "Gleis sechs.",
    "h3q1": "Richtig",
    "h3q2": "Essen und ein Getränk.",
    "h4q1": "Richtig",
    "h4q2": "In der Sporthalle.",
    "h5q1": "Falsch",
    "h5q2": "Heute Nachmittag."
  },
  "scripts": {
    "h1": "„Hallo Leo, hier ist Julia. Wir wollten uns heute um drei Uhr vor dem Kino treffen. Aber der Film beginnt erst um fünf. Treffen wir uns also um halb fünf vor dem Eingang. Bring bitte deine Kinokarte mit. Bis später!“",
    "h2": "„Achtung, liebe Fahrgäste! Der Zug nach Hamburg fährt heute nicht von Gleis vier, sondern von Gleis sechs. Er fährt um zehn Uhr zwanzig ab. Der Zug nach Bremen bleibt auf Gleis vier. Vielen Dank für Ihr Verständnis.“",
    "h3": "„Guten Morgen, Klasse! Morgen machen wir einen Ausflug in den Zoo. Wir treffen uns um acht Uhr vor der Schule. Bitte bringt etwas zu essen und ein Getränk mit. Die Eintrittskarten kaufe ich für alle. Wir kommen um zwei Uhr zurück.“",
    "h4": "„Hallo, hier ist der Sportverein Nord. Das Fußballtraining heute muss leider ausfallen, weil der Sportplatz nass ist. Morgen trainieren wir um siebzehn Uhr in der Sporthalle. Bringt bitte eure Sportschuhe mit. Bis morgen!“",
    "h5": "„Guten Morgen aus München! Heute ist es am Vormittag sonnig und warm. Aber ab drei Uhr am Nachmittag regnet es. Morgen bleibt es den ganzen Tag trocken, aber es wird kühler. Nehmen Sie heute einen Regenschirm mit!“"
  },
  "dictation": "Am Montag beginnt die Schule um acht Uhr. Ich fahre mit dem Bus, weil mein Fahrrad kaputt ist. In der ersten Stunde haben wir Deutsch. Danach lernen wir Mathe.\n\nUm halb elf mache ich eine Pause mit meinen Freunden. Ich esse ein Brot und trinke Wasser.\n\nNach der Schule gehe ich nach Hause und mache meine Hausaufgaben. Am Nachmittag spiele ich Basketball. Um sieben Uhr esse ich mit meiner Familie zu Abend.",
  "dictationFragments": [
    "Am Montag beginnt die Schule um acht Uhr. ",
    "Ich fahre mit dem Bus, weil mein Fahrrad kaputt ist. ",
    "In der ersten Stunde haben wir Deutsch. ",
    "Danach lernen wir Mathe.\n\n",
    "Um halb elf mache ich eine Pause mit meinen Freunden. ",
    "Ich esse ein Brot und trinke Wasser.\n\n",
    "Nach der Schule gehe ich nach Hause und mache meine Hausaufgaben. ",
    "Am Nachmittag spiele ich Basketball. ",
    "Um sieben Uhr esse ich mit meiner Familie zu Abend."
  ]
};
