// La portada antigua «Explorar» fue sustituida por la landing de marca (src/views/Landing.tsx).
// Se conservan el alias y STUDY_TOPICS (los usa la biblioteca de Tema 1).
export { Landing as Explore } from './Landing.tsx';

export const STUDY_TOPICS = [
  { title: 'Nebensätze', description: 'Conecta ideas con weil, obwohl, dass y wenn. Coloca el verbo al final.' },
  { title: 'Perfekt', description: 'Cuenta lo que has hecho: haben o sein + Partizip II.' },
  { title: 'Akkusativ', description: 'Reconoce el complemento directo, usa den/einen y contrasta Wo/Wohin.' },
  { title: 'Dativ', description: 'Repasa artículos, preposiciones y situaciones del día a día.' },
  { title: 'Vocabulario', description: 'Aprende palabras con su artículo y úsalas en contexto.' },
];
