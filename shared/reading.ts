// Texto original de Leseverstehen (A1–A2, 136 palabras). Reúne vocabulario y gramática de las cuatro
// presentaciones: banco, Dativ (mit dem Bus, zur Bank, vom Fahrrad), Perfekt con haben/sein, deshalb, dass, obwohl, wenn.
// Formato: [texto visible|traducción] → palabra subrayada que se traduce al pulsarla.

export const READING = {
  title: 'Ein verrückter Samstag',
  sub: 'Un sábado de locos',
  paragraphs: [
    'Pablo kommt aus Sevilla, aber er wohnt [seit einem Jahr|desde hace un año] in Berlin. Am Samstag ist er um acht Uhr [aufgestanden|se ha levantado (aufstehen, con sein)]. Er [hatte kein Geld mehr|ya no tenía dinero]. [Deshalb|por eso → verbo en posición 2] ist er [mit dem Bus|en autobús (mit + Dativ)] [zur Bank|al banco (zu + der)] gefahren. „Guten Morgen. Ich möchte [Geld abheben|sacar dinero]“, hat er gesagt. Aber seine [Karte|tarjeta] hat nicht [funktioniert|funcionado]! Die [Bankangestellte|empleada del banco] war sehr [nett|amable]. Sie hat gesagt, [dass|que → verbo al final] er ein [Formular|formulario] [ausfüllen|rellenar] muss. Pablo hat das Formular [unterschrieben|firmado (unterschreiben)] und eine neue Karte [beantragt|solicitado (beantragen)].',
    '[Danach|después] ist er mit dem [Fahrrad|bicicleta] zu seinem Freund Jonas gefahren. [Obwohl|aunque → verbo al final] es [geregnet|llovido (regnen)] hat, ist er sehr [schnell|rápido] gefahren. [Plötzlich|de repente] – bumm! Pablo ist [vom Fahrrad gefallen|se ha caído de la bici (von + dem)]. Sein Arm hat sehr [wehgetan|dolido (wehtun)], und Jonas hat ihn in die [Notaufnahme|urgencias] [gebracht|llevado (bringen)]. Die [Ärztin|médica] hat gesagt: „Ihr Arm ist nicht [gebrochen|roto]. [Wenn es wehtut|si le duele → wehtut se junta], nehmen Sie eine [Tablette|pastilla].“ Am Abend war Pablo [müde|cansado], aber [glücklich|feliz].',
  ],
};

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

/** Glosario de la lectura, para el diccionario. */
export const READING_GLOSSARY: { de: string; es: string }[] = READING.paragraphs
  .flatMap(parseParagraph)
  .filter((c) => c.gloss)
  .map((c) => ({ de: c.text, es: c.gloss as string }));

export const READING_WORDS = READING.paragraphs
  .join(' ')
  .replace(/\[([^|\]]+)\|[^\]]+\]/g, '$1')
  .split(/\s+/)
  .filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
