// Ruta del curso DEUTSCHTRAINER: orden pedagógico fijo de Lektionen y el flujo de clase de cada una.
// Datos puros + funciones puras (sin DOM): se prueban en src/course.test.ts.
import type { Topic } from '../shared/types.ts';

export type StepKind = 'ver' | 'practicar' | 'jugar' | 'repaso' | 'examen';

export interface StepLink { label: string; href: string; external?: boolean }
export interface CourseStep {
  /** Identificador estable `<unidad>:<tipo>` (se guarda en localStorage). */
  id: string;
  kind: StepKind;
  n: number;
  title: string;
  de: string;
  desc: string;
  primary: StepLink;
  extra: StepLink[];
}
export interface CourseUnit {
  id: string;
  n: number;
  title: string;
  /** Subtítulo en alemán (toque de idioma). */
  de: string;
  level: string;
  summary: string;
  /** «Ich kann…» — objetivos que el alumno comprueba en el repaso. */
  goals: string[];
  topics: Topic[];
  /** id en public/presentaciones/catalogo.json */
  presentation?: string;
  /** Nota visible junto a la presentación (p. ej. de dónde viene). */
  presentationNote?: string;
  pdf?: boolean;
  /** Presentación extra de repaso (p. ej. el remaster 3D). */
  review?: { id: string; label: string };
  games: ('jenga' | 'jugar' | 'boxeo')[];
  workshop?: boolean;
  exam?: boolean;
  steps: CourseStep[];
}

export const STEP_META: Record<StepKind, { title: string; de: string; icon: string }> = {
  ver: { title: 'Ver la presentación', de: 'Anschauen', icon: '▶' },
  practicar: { title: 'Practicar', de: 'Üben', icon: '✎' },
  jugar: { title: 'Jugar', de: 'Spielen', icon: '◆' },
  repaso: { title: 'Repaso', de: 'Wiederholen', icon: '↺' },
  examen: { title: 'Simulacro de examen', de: 'Prüfung', icon: '★' },
};

export const GAME_INFO = {
  jenga: { label: 'Wort-Jenga', href: '/jenga' },
  jugar: { label: 'BlackCard en clase', href: '/jugar' },
  boxeo: { label: 'Boxen Arena', href: '/boxeo' },
} as const;

export const topicQuery = (topics: readonly Topic[]) => (topics.length ? `?temas=${topics.join(',')}` : '');
export const presentationHref = (id: string) => `/presentaciones/${id}.html`;
export const pdfHref = (id: string) => `/presentaciones/${id}.pdf`;

type UnitSeed = Omit<CourseUnit, 'steps' | 'n'>;
const SEEDS: UnitSeed[] = [
  { id: 'bruecke-a1', title: 'Brücke A1 · Empieza aquí', de: 'Hallo! Ich bin…', level: 'A1',
    summary: 'Saludos, presentarte, números, preguntas personales e idiomas: la base para todo lo demás.',
    goals: ['Saludar y presentarme (Ich heiße…, Ich komme aus…)', 'Contar y decir números y la hora', 'Hacer y responder preguntas personales', 'Conjugar verbos en presente'],
    topics: ['praesens', 'alltag', 'vocab', 'satzbau'], presentation: 'mission-01', presentationNote: 'Traducción web de la presentación original «DEUTSCHTRAINER · Mission 01» que nos pasaste.',
    review: { id: 'bruecke-a1', label: 'Brücke A1 (repaso)' }, games: ['jenga', 'jugar'] },
  { id: 'bank', title: 'Auf der Bank', de: 'Ich möchte ein Konto eröffnen.', level: 'A2',
    summary: 'Vocabulario del banco, trato formal con «Sie» y diálogos para situaciones reales.',
    goals: ['Usar Sie y las fórmulas de cortesía', 'Pedir algo con möchte / können', 'Entender un diálogo en el banco', 'Recordar el vocabulario con su artículo'],
    topics: ['vocab', 'alltag', 'modal'], presentation: 'bank', pdf: true, games: ['jenga', 'jugar'] },
  { id: 'nebensaetze-perfekt', title: 'Warum? · Nebensätze y Perfekt', de: '…, weil ich Deutsch gelernt habe.', level: 'A1–A2',
    summary: 'weil, obwohl, dass y deshalb; contar el pasado con haben/sein + Partizip II y el verbo al final.',
    goals: ['Unir frases con weil, obwohl y dass (verbo al final)', 'Usar deshalb con inversión', 'Formar el Perfekt con haben o sein', 'Escribir el Partizip II de verbos frecuentes'],
    topics: ['nebensatz', 'perfekt', 'satzbau'], presentation: 'nebensaetze-perfekt', pdf: true,
    review: { id: 'zusammenfassung-thema-1', label: 'Resumen del Tema 1' }, games: ['jenga', 'jugar'], workshop: true },
  { id: 'krankenhaus', title: 'Im Krankenhaus', de: 'Mir tut der Kopf weh.', level: 'A1–A2',
    summary: 'El cuerpo y la salud con Nebensätze; repaso de Dativ y Perfekt con la lectura 3D de Leo.',
    goals: ['Nombrar partes del cuerpo con su artículo', 'Explicar qué me pasa (weil, wenn, dass)', 'Entender la lectura de Leo en el hospital', 'Repasar Dativ y Perfekt en contexto'],
    topics: ['vocab', 'nebensatz', 'perfekt', 'lesen'], presentation: 'krankenhaus', pdf: true,
    review: { id: 'krankenhaus-remaster', label: 'Lectura y repaso 3D' }, games: ['jenga', 'jugar'] },
  { id: 'unterwegs', title: 'Unterwegs · Dativ + Perfekt', de: 'Ich fahre mit dem Zug.', level: 'A1–A2',
    summary: 'Artículos, pronombres y preposiciones de Dativ en viajes; frases combinadas con Perfekt.',
    goals: ['Usar dem / der / den en Dativ', 'Elegir mit, bei, nach, zu, von, aus', 'Usar mir, dir, ihm, ihr', 'Contar un viaje en Perfekt'],
    topics: ['dativ', 'perfekt', 'praep'], presentation: 'unterwegs', pdf: true, games: ['jenga', 'jugar'] },
  { id: 'akkusativ', title: 'Mission Stadt · Akkusativ', de: 'Wohin gehst du? In den Park!', level: 'A1–A2',
    summary: 'Akkusativ y Dativ en la ciudad, Wo/Wohin y un combate final en la Boxen Arena.',
    goals: ['Reconocer el complemento directo (den, einen, keinen)', 'Distinguir Wo? (Dativ) y Wohin? (Akkusativ)', 'Usar preposiciones de dos casos', 'Ganar un combate de repaso de casos'],
    topics: ['akkusativ', 'dativ', 'praep'], presentation: 'akkusativ', pdf: true, games: ['boxeo', 'jenga', 'jugar'] },
  { id: 'sprache-in-bewegung', title: 'Sprache in Bewegung', de: 'Alles zusammen!', level: 'A1–A2',
    summary: 'Repaso general interactivo: estructuras, ejercicios y diccionario de todo el curso.',
    goals: ['Combinar Präsens, Perfekt y Nebensätze', 'Elegir el caso correcto (Akkusativ/Dativ)', 'Usar el vocabulario de todas las Lektionen', 'Sentirme listo para el simulacro'],
    topics: ['vocab', 'perfekt', 'nebensatz', 'dativ', 'akkusativ'], presentation: 'sprache-in-bewegung', games: ['jenga', 'jugar', 'boxeo'], workshop: true },
  { id: 'road-to-b1', title: 'Road to B1 · Die erste Prüfung', de: 'Viel Erfolg!', level: 'A1–A2 → B1',
    summary: 'Simulacro de examen de 105 minutos guiado por el profesor: lectura, dictado y audición.',
    goals: ['Leer un texto y responder con seguridad', 'Escribir un dictado', 'Entender audios cortos', 'Gestionar el tiempo de un examen'],
    topics: ['lesen', 'vocab', 'perfekt', 'nebensatz', 'dativ', 'akkusativ'], games: [], exam: true },
];

function buildSteps(u: UnitSeed): CourseStep[] {
  const q = topicQuery(u.topics);
  const mk = (kind: StepKind, desc: string, primary: StepLink, extra: StepLink[] = []): Omit<CourseStep, 'n'> =>
    ({ id: `${u.id}:${kind}`, kind, title: STEP_META[kind].title, de: STEP_META[kind].de, desc, primary, extra });
  const steps: Omit<CourseStep, 'n'>[] = [];
  if (u.exam) {
    steps.push(mk('practicar', 'Entrena todo el curso sin tiempo antes del examen.', { label: 'Practicar todo', href: `/practica${q}` }));
    steps.push(mk('examen', 'Simulacro A1/A2 a tu ritmo, sin sala: corrige lo que lleves cuando quieras. 50 puntos, nota sobre 10.', { label: 'Hacer el simulacro', href: '/examenes/a1-a2' }, [{ label: 'En clase con profesor', href: '/road-to-b1/level-1' }]));
    steps.push(mk('repaso', 'Revisa tus resultados y vuelve a practicar lo que falló.', { label: 'Repasar errores', href: `/practica${q}` }));
  } else {
    const pres = u.presentation!;
    steps.push(mk('ver', u.presentationNote ?? 'Abre la presentación de clase y recorre los ejemplos.', { label: 'Abrir presentación', href: presentationHref(pres), external: true },
      u.pdf ? [{ label: 'PDF con soluciones', href: pdfHref(pres), external: true }] : []));
    steps.push(mk('practicar', 'Preguntas sin tiempo de los temas de esta Lektion.', { label: 'Practicar ahora', href: `/practica${q}` }));
    // Los juegos (BlackCard, Jenga, Boxen) viven en /juegos: la ruta se centra en presentación, práctica y repaso.
    const extra: StepLink[] = [];
    if (u.review) extra.push({ label: u.review.label, href: presentationHref(u.review.id), external: true });
    if (u.workshop) extra.push({ label: 'Taller de escritura', href: '/tema/1/taller' });
    steps.push(mk('repaso', 'Comprueba los objetivos «Ich kann…» y repite lo que aún no domines.',
      u.review ? extra.shift()! : { label: 'Repasar errores', href: `/practica${q}` }, extra));
  }
  return steps.map((s, i) => ({ ...s, n: i + 1 }));
}

export const COURSE: CourseUnit[] = SEEDS.map((u, i) => ({ ...u, n: i + 1, steps: buildSteps(u) }));
export const ALL_STEP_IDS = COURSE.flatMap((u) => u.steps.map((s) => s.id));
export const findUnit = (id: string) => COURSE.find((u) => u.id === id);

// ── Progreso (un Set de ids de pasos completados) ──
export const PROGRESS_KEY = 'dt:course:v1';

export function parseProgress(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const v = JSON.parse(raw) as unknown;
    const list = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { done?: unknown }).done) ? (v as { done: unknown[] }).done : [];
    return new Set(list.filter((x): x is string => typeof x === 'string' && ALL_STEP_IDS.includes(x)));
  } catch { return new Set(); }
}
export const serializeProgress = (done: ReadonlySet<string>) =>
  JSON.stringify({ v: 1, done: ALL_STEP_IDS.filter((id) => done.has(id)) });

export function toggleStep(done: ReadonlySet<string>, id: string, on = !done.has(id)): Set<string> {
  const next = new Set(done);
  if (!ALL_STEP_IDS.includes(id)) return next;
  if (on) next.add(id); else next.delete(id);
  return next;
}

export interface Progress { done: number; total: number; pct: number }
const ratio = (done: number, total: number): Progress => ({ done, total, pct: total ? Math.round((done / total) * 100) : 0 });
export const unitProgress = (unit: CourseUnit, done: ReadonlySet<string>) => ratio(unit.steps.filter((s) => done.has(s.id)).length, unit.steps.length);
export const overallProgress = (done: ReadonlySet<string>) => ratio(ALL_STEP_IDS.filter((id) => done.has(id)).length, ALL_STEP_IDS.length);

/** Siguiente paso recomendado: el primer paso pendiente en el orden del curso. null = curso completo. */
export function nextStep(done: ReadonlySet<string>): { unit: CourseUnit; step: CourseStep } | null {
  for (const unit of COURSE) for (const step of unit.steps) if (!done.has(step.id)) return { unit, step };
  return null;
}

export type UnitStatus = 'done' | 'current' | 'started' | 'todo';
export function unitStatus(unit: CourseUnit, done: ReadonlySet<string>): UnitStatus {
  const p = unitProgress(unit, done);
  if (p.done === p.total) return 'done';
  if (nextStep(done)?.unit.id === unit.id) return 'current';
  return p.done > 0 ? 'started' : 'todo';
}

/** Orden del curso para listar presentaciones (las que no estén en el curso van al final). */
export function courseOrder(presentationId: string): number {
  const i = COURSE.findIndex((u) => u.presentation === presentationId || u.review?.id === presentationId);
  return i === -1 ? COURSE.length + 1 : i + (COURSE[i].review?.id === presentationId ? 0.5 : 0);
}
