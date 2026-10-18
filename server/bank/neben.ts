// Nebensätze: weil · obwohl · dass · wenn · deshalb (presentaciones warum, kh, unterwegs).
import type { Question } from '../../shared/types.ts';
import { er, gp, mc, mt, wr, type Meta } from './h.ts';

const N = (s: Meta['s'], d: Meta['d'], x: string, extra: Partial<Meta> = {}): Meta => ({ t: 'nebensatz', s, d, x, ...extra });
const FIX = 'Corrige la frase y escríbela entera:';

export function nebenQuestions(): Question[] {
  const q: Question[] = [];

  // ── weil oder obwohl? (warum, Spiel) ──
  const WO: [string, 'weil' | 'obwohl', string][] = [
    ['Ich trage eine Jacke, ___ es kalt ist.', 'weil', 'Lógico: hace frío → me pongo chaqueta.'],
    ['Ich trage ein T-Shirt, ___ es kalt ist.', 'obwohl', 'Sorpresa: hace frío y aun así camiseta.'],
    ['Er lernt viel, ___ er gute Noten haben will.', 'weil', 'Causa lógica.'],
    ['Sie ist müde, ___ sie zehn Stunden geschlafen hat.', 'obwohl', 'Sorpresa: ha dormido 10 horas y está cansada.'],
    ['Wir gehen ins Kino, ___ wir Zeit haben.', 'weil', 'Causa lógica.'],
    ['Ich esse den Salat, ___ ich ihn nicht mag.', 'obwohl', 'Contraste: no me gusta, pero me lo como.'],
  ];
  for (const [t, a, x] of WO) q.push(mc(N('warum', 'easy', `${x} weil = porque (lógico) · obwohl = aunque (sorpresa).`), `weil oder obwohl? ${t}`, ['weil', 'obwohl'], { answer: a === 'weil' ? 0 : 1, fixed: true }));

  // ── weil · obwohl · dass · wenn · deshalb (kh, Spiel) ──
  const OPTS = ['weil', 'obwohl', 'dass', 'wenn', 'deshalb'];
  const KQ: [string, string, string][] = [
    ['Ich bin im Krankenhaus, ___ ich vom Fahrrad gefallen bin.', 'weil', 'Causa → weil (verbo al final: gefallen bin).'],
    ['Die Ärztin sagt, ___ mein Bein gebrochen ist.', 'dass', 'sagen + dass → lo que dice otra persona.'],
    ['___ das Fieber steigt, rufen Sie bitte an.', 'wenn', 'Condición (si…) → wenn. Nebensatz delante → verbo, verbo.'],
    ['Er geht zur Schule, ___ er Fieber hat.', 'obwohl', 'Sorpresa: tiene fiebre y va al colegio.'],
    ['Ich habe Zahnschmerzen, ___ gehe ich zum Zahnarzt.', 'deshalb', 'Consecuencia + verbo justo detrás (gehe ich) → deshalb.'],
    ['Ich hoffe, ___ es nicht schlimm ist.', 'dass', 'hoffen + dass.'],
    ['Sie hat Bauchschmerzen, ___ sie zu viel Schokolade gegessen hat.', 'weil', 'Causa → weil + Perfekt (auxiliar al final).'],
    ['___ es sehr wehtut, lacht er.', 'obwohl', 'Sorpresa: le duele y se ríe.'],
  ];
  for (const [t, a, x] of KQ) {
    q.push(mc(N('kh', 'medium', `${x}`), `¿Qué palabra falta? ${t}`, OPTS, { answer: OPTS.indexOf(a), fixed: true }));
  }

  // ── Medizin-Check (krankenhaus.html, diapositiva extra) ──
  q.push(mc(N('kh', 'easy', 'Die Ärztin sagt, dass … : dass introduce lo que se dice.'), 'Die Ärztin sagt, ___ ich warten muss.', ['dass', 'weil'], { fixed: true }));
  q.push(mc(N('kh', 'easy', 'Condición → Wenn es wehtut, rufe ich an.'), '___ es wehtut, rufe ich an.', ['Wenn', 'Dass'], { fixed: true }));
  q.push(mc(N('kh', 'medium', 'Detrás va «ich … gefahren bin» (verbo al final) → es Nebensatz con weil. deshalb llevaría el verbo justo detrás.'),
    'Ich bin gefallen, ___ ich zu schnell gefahren bin.', ['weil', 'deshalb'], { fixed: true }));
  q.push(mc(N('kh', 'medium', '«___ bekomme ich» → verbo justo detrás → Deshalb (posición 1).'), 'Mein Arm ist gebrochen. ___ bekomme ich einen Gips.', ['Deshalb', 'Obwohl'], { fixed: true }));

  // ── wenn / wann · dass / das ──
  q.push(mc(N('kh', 'medium', 'Pregunta directa por el momento → Wann? (¿cuándo?). wenn = si / cuando (conector).'), '___ kommt der Arzt?', ['Wann', 'Wenn', 'Wen']));
  q.push(mc(N('kh', 'medium', 'Condición → Wenn ich Fieber habe, …'), '___ ich Fieber habe, bleibe ich im Bett.', ['Wenn', 'Wann', 'Dass']));
  q.push(mc(N('kh', 'medium', 'dass (que) une frases · das = artículo/pronombre.'), 'Ich glaube, ___ mein Arm gebrochen ist.', ['dass', 'das'], { fixed: true }));
  q.push(mc(N('kh', 'easy', 'das Formular → artículo «das».'), '___ Formular ist hier.', ['Das', 'Dass'], { fixed: true }));

  // ── Posición del verbo ──
  const VP: [string, (string | string[])[], Meta['s'], Meta['d'], string][] = [
    ['Ich bleibe zu Hause, weil ich krank ___. (sein)', [['bin']], 'warum', 'easy', 'weil → verbo conjugado al final: … weil ich krank bin.'],
    ['Ich gehe zur Schule, obwohl ich müde ___. (sein)', [['bin']], 'kh', 'easy', 'obwohl → verbo al final.'],
    ['Ich bin krank. Deshalb ___ ich zu Hause. (bleiben)', [['bleibe']], 'kh', 'medium', 'deshalb ocupa la posición 1 → el verbo va justo detrás (posición 2).'],
    ['Ich bin müde, weil ich schlecht ___ ___. (schlafen, Perfekt)', [['geschlafen'], ['habe']], 'kh', 'medium', 'weil + Perfekt → el auxiliar es lo ÚLTIMO: geschlafen habe.'],
    ['Er kommt nicht, weil er arbeiten ___. (müssen)', [['muss']], 'warum', 'medium', 'Modal en Nebensatz → el ÚLTIMO de todos: arbeiten muss.'],
    ['Sie lernt nicht, obwohl sie morgen eine Prüfung ___. (haben)', [['hat']], 'warum', 'easy', 'obwohl → verbo al final: hat.'],
    ['Ich hoffe, dass ich morgen nach Hause gehen ___. (können)', [['kann']], 'kh', 'medium', 'dass + modal → el modal al final: gehen kann.'],
    ['Der Arzt sagt, dass ich im Bett bleiben ___. (müssen)', [['muss']], 'kh', 'medium', 'dass → modal al final: bleiben muss.'],
    ['Wenn ich Kopfschmerzen ___, nehme ich eine Tablette. (haben)', [['habe']], 'kh', 'easy', 'wenn → verbo al final del Nebensatz.'],
    ['Wenn ich Fieber habe, ___ ich im Bett. (bleiben)', [['bleibe']], 'kh', 'medium', 'Nebensatz delante → el verbo principal va justo después de la coma: verbo, verbo.'],
    ['Wenn mir schlecht ist, ___ ich Tee. (trinken)', [['trinke']], 'kh', 'medium', 'Nebensatz delante → verbo, verbo.'],
    ['Weil ich krank bin, ___ ich zu Hause. (bleiben)', [['bleibe']], 'warum', 'medium', 'Weil… al principio → verbo, verbo: Weil ich krank bin, bleibe ich…'],
    ['Es regnet. Deshalb ___ ich zu Hause. (bleiben)', [['bleibe']], 'warum', 'easy', 'Deshalb + verbo en posición 2.'],
    ['Er sagt, dass er nach Berlin gefahren ___. (sein)', [['ist']], 'unterwegs', 'medium', 'dass + Perfekt → el auxiliar salta al final: gefahren ist.'],
  ];
  for (const [t, g, s, d, x] of VP) q.push(gp(N(s, d, x), 'Completa con el verbo en la posición correcta', t, g));
  q.push(mc(N('warum', 'easy', 'weil y obwohl mandan el verbo a casa (al final). deshalb se sienta en la silla 1 y el verbo sigue en la 2.'),
    '¿Con cuál de estas palabras el verbo NO va al final?', ['deshalb', 'weil', 'obwohl', 'dass']));
  q.push(mt(N('warum', 'medium', 'weil = porque · obwohl = aunque · deshalb = por eso · dass = que'), 'Relaciona cada conector con su significado',
    [['weil', 'porque'], ['obwohl', 'aunque'], ['deshalb', 'por eso'], ['dass', 'que']]));

  // ── Transformaciones (escritura) ──
  const TR: [string, string[], Meta['s'], Meta['d'], string, Partial<Meta>?][] = [
    ['Une con weil: «Ich lerne Deutsch. Ich mag die Sprache.»', ['Ich lerne Deutsch, weil ich die Sprache mag.', 'Weil ich die Sprache mag, lerne ich Deutsch.'], 'warum', 'medium', '…, weil + sujeto + … + VERBO al final.'],
    ['Une con weil: «Ich bleibe zu Hause. Ich bin krank.»', ['Ich bleibe zu Hause, weil ich krank bin.', 'Weil ich krank bin, bleibe ich zu Hause.'], 'warum', 'medium', 'Coma siempre antes de weil; verbo al final.'],
    ['Une con weil: «Ich trinke Kaffee. Ich bin müde.»', ['Ich trinke Kaffee, weil ich müde bin.', 'Weil ich müde bin, trinke ich Kaffee.'], 'warum', 'medium', 'weil → bin al final.'],
    ['Une con obwohl: «Es regnet. Ich gehe spazieren.»', ['Ich gehe spazieren, obwohl es regnet.', 'Obwohl es regnet, gehe ich spazieren.'], 'warum', 'medium', 'obwohl = sorpresa; verbo al final del Nebensatz.'],
    ['Une con obwohl: «Ich gehe zur Schule. Ich bin krank.»', ['Ich gehe zur Schule, obwohl ich krank bin.', 'Obwohl ich krank bin, gehe ich zur Schule.'], 'warum', 'medium', 'obwohl → bin al final.'],
    ['Une con obwohl: «Er spielt Fußball. Es ist sehr kalt.»', ['Er spielt Fußball, obwohl es sehr kalt ist.', 'Obwohl es sehr kalt ist, spielt er Fußball.'], 'warum', 'medium', 'obwohl → ist al final.'],
    ['Con deshalb: «Ich bin müde.» → (ins Bett gehen)', ['Ich bin müde. Deshalb gehe ich ins Bett.', 'Ich bin müde, deshalb gehe ich ins Bett.', 'Ich bin müde. Deswegen gehe ich ins Bett.', 'Ich bin müde, deswegen gehe ich ins Bett.'], 'warum', 'medium', 'Deshalb (pos. 1) + VERBO (pos. 2) + sujeto.'],
    ['Con deshalb: «Ich habe Hunger.» → (eine Pizza essen)', ['Ich habe Hunger. Deshalb esse ich eine Pizza.', 'Ich habe Hunger, deshalb esse ich eine Pizza.', 'Ich habe Hunger. Deswegen esse ich eine Pizza.', 'Ich habe Hunger, deswegen esse ich eine Pizza.'], 'warum', 'medium', 'Deshalb esse ich… (verbo antes que el sujeto).'],
    ['Cambia a deshalb: «Wir gehen schwimmen, weil es heiß ist.»', ['Es ist heiß. Deshalb gehen wir schwimmen.', 'Es ist heiß, deshalb gehen wir schwimmen.', 'Es ist heiß. Deswegen gehen wir schwimmen.', 'Es ist heiß, deswegen gehen wir schwimmen.'], 'warum', 'medium', 'weil da la causa; deshalb, la consecuencia: Grund. Deshalb Folge.'],
    ['Cambia a deshalb: «Ich gehe nicht zur Schule, weil ich krank bin.»', ['Ich bin krank. Deshalb gehe ich nicht zur Schule.', 'Ich bin krank, deshalb gehe ich nicht zur Schule.', 'Ich bin krank. Deswegen gehe ich nicht zur Schule.', 'Ich bin krank, deswegen gehe ich nicht zur Schule.'], 'warum', 'medium', 'Primero la causa, luego Deshalb + verbo.'],
    ['Une con dass: «Ich glaube: Es ist nicht schlimm.»', ['Ich glaube, dass es nicht schlimm ist.'], 'kh', 'medium', 'glauben + , dass … verbo al final.'],
    ['Une con dass: «Ich hoffe: Ich kann morgen nach Hause gehen.»', ['Ich hoffe, dass ich morgen nach Hause gehen kann.'], 'kh', 'hard', 'El modal (kann) va el último, detrás del infinitivo.', { why: 'dass + verbo modal: dos verbos al final y en el orden correcto (gehen kann).' }],
    ['Une con dass: Der Arzt sagt: «Sie müssen im Bett bleiben.»', ['Der Arzt sagt, dass ich im Bett bleiben muss.'], 'kh', 'hard', 'Cambia Sie → ich y müssen → muss, al final.', { why: 'Hay que cambiar la persona (Sie → ich), conjugar el modal (muss) y moverlo al final.', unlock: true }],
    ['La médica dice: «Trinken Sie viel Wasser!» → Sie sagt, dass ich …', ['Sie sagt, dass ich viel Wasser trinken soll.'], 'kh', 'medium', 'Orden de otra persona → dass ich … soll (soll = debo, porque otro lo dice).'],
    ['La médica dice: «Bleiben Sie drei Tage im Bett!» → Sie sagt, dass ich …', ['Sie sagt, dass ich drei Tage im Bett bleiben soll.'], 'kh', 'medium', 'dass ich … bleiben soll.'],
    ['La médica dice: «Nehmen Sie zweimal am Tag eine Tablette!» → Sie sagt, dass ich …', ['Sie sagt, dass ich zweimal am Tag eine Tablette nehmen soll.'], 'kh', 'medium', 'dass ich … nehmen soll.'],
    ['La médica dice: «Machen Sie zwei Wochen keinen Sport!» → Sie sagt, dass ich …', ['Sie sagt, dass ich zwei Wochen keinen Sport machen soll.'], 'kh', 'hard', 'dass ich zwei Wochen keinen Sport machen soll.', { why: 'Combina dass + sollen al final con la negación keinen (der Sport, Akkusativ).' }],
    ['Une con wenn (delante): «Es tut weh. Nehmen Sie eine Tablette.»', ['Wenn es wehtut, nehmen Sie eine Tablette.'], 'kh', 'hard', 'Wenn es wehtut, nehmen Sie… : el separable se junta (wehtut) y después verbo, verbo.', { why: 'Dos reglas a la vez: el verbo separable se junta en el Nebensatz y la frase principal empieza por el verbo.' }],
    ['Une con weil: «Ich bin zu spät gekommen. Der Bus ist nicht gekommen.»', ['Ich bin zu spät gekommen, weil der Bus nicht gekommen ist.', 'Weil der Bus nicht gekommen ist, bin ich zu spät gekommen.'], 'unterwegs', 'medium', 'weil + Perfekt → auxiliar al final: gekommen ist.'],
    ['Une con weil: «Meine Mutter ist sauer. Ich bin spät nach Hause gekommen.»', ['Meine Mutter ist sauer, weil ich spät nach Hause gekommen bin.', 'Weil ich spät nach Hause gekommen bin, ist meine Mutter sauer.'], 'unterwegs', 'medium', 'weil + Perfekt → gekommen bin.'],
    ['Une con dass: Er sagt: «Ich habe den Film schon gesehen.»', ['Er sagt, dass er den Film schon gesehen hat.'], 'unterwegs', 'hard', 'ich → er, habe → hat, y el auxiliar al final.', { why: 'Cambio de persona + auxiliar conjugado de nuevo + posición final.', unlock: true }],
    ['Une con obwohl: «Ich habe keinen Hunger. Ich habe nichts gegessen.»', ['Ich habe keinen Hunger, obwohl ich nichts gegessen habe.', 'Obwohl ich nichts gegessen habe, habe ich keinen Hunger.'], 'unterwegs', 'medium', 'obwohl + Perfekt → gegessen habe.'],
    ['Une con dass: «Glaubst du …? Er hat die Hausaufgaben gemacht.»', ['Glaubst du, dass er die Hausaufgaben gemacht hat?'], 'unterwegs', 'medium', 'Glaubst du, dass … gemacht hat?'],
    ['Empieza con Obwohl: «Es hat geregnet. Wir sind an den Strand gegangen.»', ['Obwohl es geregnet hat, sind wir an den Strand gegangen.'], 'unterwegs', 'hard', 'Obwohl… al principio → verbo, verbo: …geregnet hat, sind wir…', { why: 'Nebensatz delante + Perfekt en las dos partes: «hat, sind» seguidos.', unlock: true }],
    ['Explica a la médica (weil): «Ich habe Bauchschmerzen.» (zu viel Pizza essen)', ['Ich habe Bauchschmerzen, weil ich zu viel Pizza gegessen habe.'], 'kh', 'medium', 'weil + Perfekt: …gegessen habe.'],
    ['Explica a la médica (weil): «Ich habe Kopfschmerzen.» (nicht genug schlafen)', ['Ich habe Kopfschmerzen, weil ich nicht genug geschlafen habe.'], 'kh', 'medium', 'weil + Perfekt: …geschlafen habe.'],
    ['Explica a la médica (weil): «Ich habe mir den Arm gebrochen.» (beim Skaten hinfallen)', ['Ich habe mir den Arm gebrochen, weil ich beim Skaten hingefallen bin.'], 'kh', 'hard', 'hinfallen → ist hingefallen (sein + separable) y el auxiliar al final.', { why: 'Tres reglas: Perfekt con sein, Partizip de un separable (hin-ge-fallen) y auxiliar al final.', unlock: true }],
  ];
  for (const [p, acc, s, d, x, extra] of TR) q.push(wr(N(s, d, x, extra ?? {}), p, acc));

  // ── Diagnose (kh): weil + Perfekt ──
  const PAT: [string, string, string, Meta['d'], string?][] = [
    ['Ich habe Kopfschmerzen', 'zu lange am Handy spielen', 'Ich habe Kopfschmerzen, weil ich zu lange am Handy gespielt habe.', 'medium'],
    ['Ich habe Bauchschmerzen', 'zu viel Eis essen', 'Ich habe Bauchschmerzen, weil ich zu viel Eis gegessen habe.', 'medium'],
    ['Ich habe Fieber', 'ohne Jacke im Regen spazieren gehen', 'Ich habe Fieber, weil ich ohne Jacke im Regen spazieren gegangen bin.', 'hard', 'spazieren gehen → spazieren gegangen bin (sein) al final de un Nebensatz largo.'],
    ['Ich habe Zahnschmerzen', 'zu viele Süßigkeiten essen', 'Ich habe Zahnschmerzen, weil ich zu viele Süßigkeiten gegessen habe.', 'medium'],
    ['Mir ist schwindelig', 'nicht frühstücken', 'Mir ist schwindelig, weil ich nicht gefrühstückt habe.', 'medium'],
    ['Ich habe Husten', 'die ganze Nacht draußen bleiben', 'Ich habe Husten, weil ich die ganze Nacht draußen geblieben bin.', 'hard', 'bleiben usa sein (excepción) y el auxiliar va al final.'],
    ['Ich habe Rückenschmerzen', 'schwere Kisten tragen', 'Ich habe Rückenschmerzen, weil ich schwere Kisten getragen habe.', 'medium'],
  ];
  for (const [sym, why, ans, d, hw] of PAT) {
    q.push({ ...wr(N('kh', d, `${ans} — weil + Perfekt: el auxiliar (habe/bin) es lo último.`, hw ? { why: hw } : {}),
      `Diagnose: ${sym}. ¿Por qué? → (${why}) Escribe la frase con weil + Perfekt.`, [ans]), type: 'build', parts: [sym, 'weil', why, 'Perfekt'] });
  }

  // ── Fehlerjagd (warum · kh · unterwegs) ──
  const ERR_TOK: [string, Meta['s'], string][] = [
    ['Ich glaube, [das|dass] mein Arm gebrochen ist.', 'kh', 'dass (que) une frases; das es el artículo.'],
    ['[Wann|Wenn] ich Fieber habe, bleibe ich im Bett.', 'kh', 'Condición → Wenn. Wann? es la pregunta «¿cuándo?».'],
    ['Mir [tut|tun] die Füße weh.', 'kh', 'die Füße es plural → tun.'],
  ];
  for (const [s, src, x] of ERR_TOK) q.push(er(N(src, 'medium', x), 'Fehlerjagd: toca la palabra incorrecta y corrígela', s));
  const ERR_FIX: [string, string[], Meta['s'], string][] = [
    ['Ich lerne Deutsch, weil ich mag die Sprache.', ['Ich lerne Deutsch, weil ich die Sprache mag.'], 'warum', 'weil → el verbo (mag) al final.'],
    ['Es regnet. Deshalb ich bleibe zu Hause.', ['Es regnet. Deshalb bleibe ich zu Hause.', 'Es regnet, deshalb bleibe ich zu Hause.'], 'warum', 'Deshalb + verbo en posición 2: Deshalb bleibe ich.'],
    ['Ich bin müde, weil ich habe schlecht geschlafen.', ['Ich bin müde, weil ich schlecht geschlafen habe.'], 'warum', 'weil + Perfekt → auxiliar al final: geschlafen habe.'],
    ['Obwohl es kalt ist, ich gehe schwimmen.', ['Obwohl es kalt ist, gehe ich schwimmen.'], 'warum', 'Nebensatz delante → verbo, verbo: …ist, gehe ich.'],
    ['Ich bin hier, weil ich bin hingefallen.', ['Ich bin hier, weil ich hingefallen bin.'], 'kh', 'weil + Perfekt → hingefallen bin.'],
    ['Der Arzt sagt, dass ich muss im Bett bleiben.', ['Der Arzt sagt, dass ich im Bett bleiben muss.'], 'kh', 'dass → modal al final: bleiben muss.'],
    ['Ich habe Fieber. Deshalb ich bleibe zu Hause.', ['Ich habe Fieber. Deshalb bleibe ich zu Hause.', 'Ich habe Fieber, deshalb bleibe ich zu Hause.'], 'kh', 'Deshalb bleibe ich…'],
    ['Wenn es wehtut, Sie nehmen eine Tablette.', ['Wenn es wehtut, nehmen Sie eine Tablette.'], 'kh', 'Wenn… delante → verbo, verbo: wehtut, nehmen Sie.'],
  ];
  for (const [s, acc, src, x] of ERR_FIX) q.push(wr(N(src, 'medium', x, { tags: ['fix'] }), `${FIX} «${s}»`, acc));
  return q;
}
