// Preguntas de comprensión del texto «Ein verrückter Samstag» (shared/reading.ts).
import type { Question } from '../../shared/types.ts';
import { gp, mc, mt, od, tf, wr, type Meta } from './h.ts';

const L = (d: Meta['d'], x: string): Meta => ({ t: 'lesen', s: 'lesen', d, x, tags: ['text:samstag'] });

export function lesenQuestions(): Question[] {
  return [
    tf(L('easy', 'Falsch: Pablo kommt aus Sevilla, aber er wohnt seit einem Jahr in Berlin.'), 'Pablo wohnt in Sevilla.', false),
    mc(L('easy', '„Deshalb ist er mit dem Bus zur Bank gefahren.“ (mit + Dativ)'), 'Wie ist Pablo zur Bank gefahren?', ['mit dem Bus', 'mit dem Fahrrad', 'mit dem Taxi', 'zu Fuß']),
    mc(L('medium', '„Er hatte kein Geld mehr. Deshalb ist er … zur Bank gefahren.“'), 'Warum ist Pablo zur Bank gefahren?',
      ['Weil er kein Geld mehr hatte.', 'Weil er ein Konto eröffnen wollte.', 'Weil er dort arbeitet.']),
    tf(L('easy', 'Falsch: „Aber seine Karte hat nicht funktioniert!“'), 'Pablos Karte hat funktioniert.', false),
    wr(L('medium', '„Sie hat gesagt, dass er ein Formular ausfüllen muss.“ — das Formular = el formulario.'), 'Was muss Pablo in der Bank ausfüllen? (palabra con artículo)',
      ['ein Formular', 'das Formular', 'Formular']),
    mc(L('medium', '„Obwohl es geregnet hat, ist er sehr schnell gefahren.“ obwohl = aunque.'), 'Was hat Pablo gemacht, obwohl es geregnet hat?',
      ['Er ist sehr schnell gefahren.', 'Er ist zu Hause geblieben.', 'Er hat ein Taxi genommen.']),
    tf(L('medium', 'Falsch: „Ihr Arm ist nicht gebrochen.“'), 'Pablos Arm ist gebrochen.', false),
    gp(L('medium', '„Wenn es wehtut, nehmen Sie eine Tablette.“ En Nebensatz el separable se junta: wehtut.'), 'Completa con el texto:', 'Wenn es ___, nehmen Sie eine Tablette.', [['wehtut']]),
    od(L('medium', '„Jonas hat ihn in die Notaufnahme gebracht.“ Perfekt: hat … gebracht.'), 'Ordena la frase del texto', 'Jonas hat ihn in die Notaufnahme gebracht.'),
    mc(L('easy', '„Am Abend war Pablo müde, aber glücklich.“'), 'Wie war Pablo am Abend?', ['müde, aber glücklich', 'krank und traurig', 'sehr hungrig']),
    mt(L('medium', 'Deshalb = por eso · Obwohl = aunque · Plötzlich = de repente · Danach = después'), 'Relaciona las palabras del texto',
      [['Deshalb', 'por eso'], ['Obwohl', 'aunque'], ['Plötzlich', 'de repente'], ['Danach', 'después']]),
    gp(L('medium', '„Die Ärztin hat gesagt: Ihr Arm ist nicht gebrochen.“ → dass … ist (verbo al final).'), 'Completa:', 'Die Ärztin hat gesagt, dass sein Arm nicht gebrochen ___.', [['ist']]),
    tf(L('easy', 'Richtig: „Pablo hat das Formular unterschrieben und eine neue Karte beantragt.“'), 'Pablo hat eine neue Karte beantragt.', true),
    mc(L('easy', '„Jonas hat ihn in die Notaufnahme gebracht.“ die Notaufnahme = urgencias.'), 'Wohin hat Jonas Pablo gebracht?', ['in die Notaufnahme', 'in die Bank', 'nach Hause']),
  ];
}
