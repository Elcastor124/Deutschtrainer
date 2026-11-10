// Categorías del selector de temas. Cada tema del banco pertenece a exactamente una (tests/topic-groups.test.ts).
import type { Topic } from '../../shared/types.ts';

export interface TopicGroup { id: string; de: string; es: string; topics: readonly Topic[] }

export const TOPIC_GROUPS: readonly TopicGroup[] = [
  { id: 'verben', de: 'Verben', es: 'Verbos y tiempos', topics: ['praesens', 'perfekt', 'modal', 'trennbar', 'imperativ'] },
  { id: 'kasus', de: 'Kasus', es: 'Casos y artículos', topics: ['akkusativ', 'dativ', 'possessiv', 'praep', 'adjektiv'] },
  { id: 'satz', de: 'Satzbau', es: 'La frase', topics: ['satzbau', 'nebensatz'] },
  { id: 'wort', de: 'Wortschatz', es: 'Vocabulario y uso', topics: ['vocab', 'alltag', 'vorstellen', 'lesen'] },
];
