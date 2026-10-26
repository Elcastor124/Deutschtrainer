import type { KlausReaction } from './events.ts';

export const REACTION_LABELS: Record<KlausReaction, string> = {
  waving: 'Hallo! Soy Klaus', idle: 'A tu ritmo', thinking: 'Denkpause · sin prisa', correct: 'Richtig! · bien hecho',
  support: 'Weiter so · seguimos', streak3: 'Racha de 3 · wunderbar', streak5: 'Racha de 5 · Feuer!',
  streak10: 'Racha de 10 · majestätisch', complete: 'Geschafft! · sesión terminada',
};

const COMMENTS: Record<KlausReaction, readonly string[]> = {
  waving: [
    'Hallo! Tú pones el alemán; yo pongo las orejas. Buen equipo.',
    'Soy Klaus. Hoy el único cronómetro es el del té. Vamos a tu ritmo.',
    'Willkommen! He traído mis mejores bigotes para esta práctica.',
  ],
  idle: [
    'Sin prisa. Hasta los gatos hacemos una pausa antes de saltar.',
    'Aquí sigo. Mi agenda: acompañarte y fingir que entiendo la impresora.',
    'Una pausa también cuenta como estrategia. Weiter geht’s cuando quieras.',
  ],
  thinking: [
    'Denkpause. Me ajusto las gafas; tú tómate el tiempo que necesites.',
    'En modo concentración. Mis bigotes han pedido silencio de biblioteca.',
    'Schritt für Schritt: paso a paso. El alemán no se va a escapar.',
    'Tú piensa con calma. Yo vigilo que el diccionario no se coma la mesa.',
  ],
  correct: [
    'Richtig! Mis bigotes acaban de hacer una pequeña ola.',
    'Sehr gut! Ese acierto merece un aplauso de patitas.',
    'Genau! Lo has clavado. Yo solo he supervisado con elegancia.',
    'Wunderbar! Un pasito más; sin correr, que llevo las patas de gala.',
    'Jawohl! Si tuviera sombrero, me lo quitaría. Tengo orejas: sirven.',
    'Bien hecho. El alemán avanza y mi taza sigue peligrosamente vacía.',
    'Treffer! Acierto confirmado. Mis gafas ya están celebrándolo.',
    'Fantastisch! Aprender así da gusto. Lo del atún lo negociamos luego.',
  ],
  support: [
    'Kein Problem. Mira la explicación: el error es una pista, no una etiqueta.',
    'Noch einmal! Aprender también es probar. Yo he fallado saltos a sofás.',
    'Seguimos en equipo. Revisa la explicación y prueba con calma la próxima.',
    'Alles gut. Una respuesta no decide lo que sabes. Mis bigotes siguen contigo.',
    'Esto también es practicar. Hasta yo necesito dos intentos para entrar en una caja.',
    'Respira y mira el porqué. Aquí no hay prisa ni miradas de gato juez.',
    'Un tropiezo no borra lo aprendido. Weiter so: seguimos paso a paso.',
    'Probamos, revisamos, aprendemos. Mi plan B siempre incluye una pausa.',
  ],
  streak3: [
    'Drei! Tres seguidas. He levantado tres patitas… mejor no preguntes cómo.',
    'Tres aciertos seguidos. Ya hay ritmo; mis orejas llevan el compás.',
    'Wunderbar: racha de tres. Una mini celebración, sin tirar la taza.',
  ],
  streak5: [
    'Fünf! Cinco seguidas. Modo Feuer: calorcito de aprendizaje, no de examen.',
    'Racha de cinco. Mis bigotes están en llamas. Metafóricas, por seguridad.',
    'Cinco aciertos seguidos. Esto va fino: hasta mi té se ha puesto de pie.',
  ],
  streak10: [
    'Zehn! Diez seguidas. Me pongo la corona; el mérito es tuyo.',
    'Diez aciertos seguidos. Majestätisch! La corona pesa menos que un diccionario.',
    'Racha de diez. Ceremonia real breve: tenemos alemán que seguir aprendiendo.',
  ],
  complete: [
    'Geschafft! Sesión terminada. Gracias por practicar; ahora estira esas patitas.',
    'Feierabend! Buen trabajo por llegar al final. El descanso también es del equipo.',
    'Práctica completada. Me quito la corona para saludar: nos vemos en la siguiente.',
  ],
};

/** Local, deterministic per-state rotation. Network renders never advance this deck. */
export class KlausComments {
  private counts = new Map<KlausReaction, number>();
  private previous = '';
  next(kind: KlausReaction): string {
    const deck = COMMENTS[kind];
    let index = this.counts.get(kind) ?? 0;
    if (deck[index % deck.length] === this.previous) index++;
    this.previous = deck[index % deck.length];
    this.counts.set(kind, index + 1);
    return this.previous;
  }
}
