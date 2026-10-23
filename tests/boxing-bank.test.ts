import { describe, expect, it } from 'vitest';
import { BOXING_BANK } from '../server/boxing-bank.ts';

const CASE_TOPICS = ['Akkusativ', 'Dativ', 'Präpositionen', 'Pronomen', 'Wo/Wohin'] as const;
const caseQuestions = BOXING_BANK.filter((q) => (CASE_TOPICS as readonly string[]).includes(q.topic));

describe('banco ampliado de casos para el boxeo', () => {
  it('tiene al menos 120 preguntas de casos y al menos 20 por tema', () => {
    expect(caseQuestions.length).toBeGreaterThanOrEqual(120);
    for (const topic of CASE_TOPICS) {
      expect(caseQuestions.filter((q) => q.topic === topic).length, topic).toBeGreaterThanOrEqual(20);
    }
  });

  it('no repite ids ni enunciados en todo el banco', () => {
    expect(new Set(BOXING_BANK.map((q) => q.id)).size).toBe(BOXING_BANK.length);
    expect(new Set(BOXING_BANK.map((q) => q.prompt.trim())).size).toBe(BOXING_BANK.length);
  });

  it('cada pregunta tiene exactamente 3 opciones distintas, clave 0..2 y explicación en español', () => {
    for (const q of BOXING_BANK) {
      expect(q.options.length, q.id).toBe(3);
      expect(new Set(q.options.map((o) => o.trim())).size, q.id).toBe(3);
      expect(q.options.every((o) => o.trim().length > 0), q.id).toBe(true);
      expect([0, 1, 2], q.id).toContain(q.answer);
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(30);
      // Spanish explanation: uses Spanish function words.
      expect(/\b(el|la|lleva|exige|se|es|con|en|y|del|al|de|un|una|no|para|por)\b/.test(q.explanation), q.id).toBe(true);
      expect(q.prompt.includes('___') || q.prompt.includes('?') || q.prompt.includes('…'), q.id).toBe(true);
    }
  });

  it('reparte las posiciones de la respuesta correcta de forma equilibrada', () => {
    const counts = [0, 0, 0];
    for (const q of caseQuestions) counts[q.answer]++;
    for (const c of counts) {
      expect(c / caseQuestions.length).toBeGreaterThanOrEqual(0.25);
      expect(c / caseQuestions.length).toBeLessThanOrEqual(0.42);
    }
  });
});
