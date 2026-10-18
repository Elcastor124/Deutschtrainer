// Actividades después del juego: escritura (rolle · wort · frei), escenas de rol (szene) y Wort-Jenga.
// El servidor guarda los textos, calcula las estrellas y decide todo lo que pasa en la torre.
import {
  FREE_PROMPTS, JENGA_LEVELS, LEARNED, ROLLE_POOL, ROLLE_PROMPT, SCENES, SPEAK_QUESTIONS, WORD_THEMES, WORT_MIN,
  countWords, features, usedWords, writeStars,
} from '../shared/activities.ts';
import { plainText, readingById } from '../shared/reading.ts';
import type { Answer, TaskKind, TaskView, WriteEntry } from '../shared/types.ts';
import { grade, makeInstance, publicView, solution, type Instance } from './grade.ts';
import type { Result, Room } from './room.ts';
import { jengaQuestion } from './select.ts';

export interface WriteTask {
  kind: 'rolle' | 'wort' | 'frei';
  stage: 'write' | 'show';
  showing: string | null;
  /** Palabras (claves de LEARNED), consigna y texto de partida de cada alumno. */
  sets: Record<string, { words: string[]; prompt: string; base?: string }>;
  prompts?: string[];
  choice: Record<string, number>;
  texts: Record<string, { text: string; done: boolean }>;
  bonus: Record<string, number>;
}
export interface SceneTask {
  kind: 'szene';
  stage: 'prep' | 'play' | 'score';
  scene: number;
  roles: Record<string, 0 | 1>;
  goals: Record<string, boolean[]>;
  bonus: Record<string, number>;
}
export interface JengaTask {
  kind: 'jenga';
  stage: 'answer' | 'judge' | 'pull' | 'fallen';
  levels: number[][];
  order: string[];
  turn: string | null;
  pulls: number;
  q: { id: string; inst: Instance } | null;
  speak: string | null;
  pending: { given: string; expected: string } | null;
  last: { pid: string; ok: boolean; given: string; solution: string } | null;
  lastPull: { level: number; slot: number; by: string } | null;
  loser: string | null;
  games: number;
  speakUsed: number[];
}
export type TaskState = WriteTask | SceneTask | JengaTask;

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });
const TIMES: Record<TaskKind, number> = { rolle: 360, wort: 420, frei: 360, szene: 90, jenga: 0 };
const SCENE_PLAY = 180;
const MAX_TEXT = 2500;

function shuffled<T>(a: T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const learned = (keys: string[]) => keys.map((k) => LEARNED[k]).filter(Boolean);

// ───────────── inicio ─────────────
export function startTask(room: Room, kind: TaskKind): Result {
  const s = room.s;
  if (kind === 'szene') {
    s.task = { kind, stage: 'prep', scene: pickScene(room), roles: {}, goals: {}, bonus: {} };
    assignRoles(room, s.task);
  } else if (kind === 'jenga') {
    s.task = {
      kind, stage: 'answer', levels: freshTower(), order: [], turn: null, pulls: 0, q: null, speak: null, pending: null,
      last: null, lastPull: null, loser: null, games: 1, speakUsed: [],
    };
    s.task.order = shuffled(s.players.filter((p) => p.connected).map((p) => p.id), room.d.rand);
    if (!s.task.order.length) s.task.order = s.players.map((p) => p.id);
    s.task.turn = s.task.order[0] ?? null;
    s.phase = 'task';
    askJenga(room, s.task);
    room.touch();
    return OK;
  } else {
    const t: WriteTask = { kind, stage: 'write', showing: null, sets: {}, choice: {}, texts: {}, bonus: {} };
    if (kind === 'frei') t.prompts = shuffled(FREE_PROMPTS, room.d.rand).slice(0, 3);
    s.task = t;
    for (const p of s.players) ensureSet(room, t, p.id);
  }
  s.phase = 'task';
  s.timer = { endsAt: room.now + TIMES[kind] * 1000, left: null, total: TIMES[kind] };
  room.touch();
  return OK;
}

/** Lista de palabras y consigna de un alumno (también para quien entra tarde). Las listas no se repiten entre alumnos. */
function ensureSet(room: Room, t: WriteTask, pid: string) {
  if (t.sets[pid]) return t.sets[pid];
  const taken = new Set(Object.values(t.sets).flatMap((x) => x.words));
  if (t.kind === 'rolle') {
    const base = plainText(readingById(room.s.reading));
    const pool = ROLLE_POOL.filter((w) => !usedWords(base, [w]).length);
    const fresh = shuffled(pool.filter((w) => !taken.has(w.de)), room.d.rand);
    const words = (fresh.length >= 8 ? fresh : [...fresh, ...shuffled(pool.filter((w) => taken.has(w.de)), room.d.rand)]).slice(0, 8).map((w) => w.de);
    t.sets[pid] = { words, prompt: ROLLE_PROMPT, base };
    t.texts[pid] = { text: base, done: false };
  } else if (t.kind === 'wort') {
    const usedThemes = new Set(Object.values(t.sets).map((x) => x.prompt));
    const themes = shuffled(WORD_THEMES, room.d.rand);
    const theme = themes.find((th) => !usedThemes.has(themePrompt(th.title))) ?? themes[0];
    const words = shuffled(theme.words, room.d.rand).slice(0, 6).map((w) => w.de);
    t.sets[pid] = { words, prompt: themePrompt(theme.title) };
    t.texts[pid] = { text: '', done: false };
  } else {
    t.sets[pid] = { words: [], prompt: '' };
    t.choice[pid] = -1;
    t.texts[pid] = { text: '', done: false };
  }
  return t.sets[pid];
}
/** Prepara la ficha de quien entra mientras ya hay una actividad de escritura. */
export function addTaskPlayer(room: Room, pid: string) {
  const t = room.s.task;
  if (t && (t.kind === 'rolle' || t.kind === 'wort' || t.kind === 'frei')) ensureSet(room, t, pid);
}
const themePrompt = (title: string) => `«${title}»: escribe una historia de al menos ${WORT_MIN} palabras con todas tus palabras.`;

function pickScene(room: Room): number {
  const fresh = SCENES.map((_, i) => i).filter((i) => !room.s.scenesUsed.includes(i));
  const list = fresh.length ? fresh : SCENES.map((_, i) => i);
  const i = list[Math.floor(room.d.rand() * list.length)];
  room.s.scenesUsed.push(i);
  return i;
}

function assignRoles(room: Room, t: SceneTask) {
  const ids = shuffled(room.s.players.map((p) => p.id), room.d.rand);
  t.roles = {};
  t.goals = {};
  ids.forEach((id, k) => {
    t.roles[id] = (k % 2) as 0 | 1;
    t.goals[id] = [false, false, false];
  });
}

// ───────────── escritura ─────────────
export function taskText(room: Room, pid: string, text: string, done: boolean): Result {
  const t = room.s.task;
  if (room.s.phase !== 'task' || !t || (t.kind !== 'rolle' && t.kind !== 'wort' && t.kind !== 'frei')) return fail('Ahora no hay ningún texto que escribir.');
  if (t.stage !== 'write') return fail('El tiempo de escritura ha terminado.');
  if (!room.player(pid)) return fail('Jugador desconocido.');
  ensureSet(room, t, pid);
  if (t.kind === 'frei' && (t.choice[pid] ?? -1) < 0) return fail('Primero elige una consigna.');
  t.texts[pid] = { text: String(text ?? '').slice(0, MAX_TEXT), done: !!done };
  room.touch();
  return OK;
}

export function taskPick(room: Room, pid: string, n: number): Result {
  const t = room.s.task;
  if (room.s.phase !== 'task' || t?.kind !== 'frei' || t.stage !== 'write') return fail('Ahora no se elige consigna.');
  if (!room.player(pid)) return fail('Jugador desconocido.');
  if (!Number.isInteger(n) || n < 0 || n >= (t.prompts?.length ?? 0)) return fail('Consigna no válida.');
  ensureSet(room, t, pid);
  t.choice[pid] = n;
  t.sets[pid].prompt = t.prompts?.[n] ?? '';
  room.touch();
  return OK;
}

function entry(t: WriteTask, pid: string): WriteEntry {
  const text = t.texts[pid]?.text ?? '';
  const words = countWords(text);
  const used = usedWords(text, learned(t.sets[pid]?.words ?? []));
  const feats = t.kind === 'frei' ? features(text) : [];
  const bonus = t.bonus[pid] ?? 0;
  return { text, words, used, features: feats, stars: writeStars(t.kind, words, used.length, feats.length) + bonus, bonus, done: !!t.texts[pid]?.done };
}

// ───────────── escenas ─────────────
const sceneStars = (t: SceneTask, pid: string) => (t.goals[pid] ?? []).filter(Boolean).length + (t.bonus[pid] ?? 0);

// ───────────── Wort-Jenga ─────────────
export const freshTower = () => Array.from({ length: JENGA_LEVELS }, () => [1, 1, 1]);
const filled = (l: number[]) => l[0] + l[1] + l[2];

/** Niveles por debajo del superior: vacíos o con una sola pieza lateral → la torre cae. */
export function unstable(levels: number[][]): boolean {
  for (let i = 0; i < levels.length - 1; i++) {
    const c = filled(levels[i]);
    if (c === 0 || (c === 1 && levels[i][1] !== 1)) return true;
  }
  return false;
}

/** Probabilidad de que la torre se tambalee y caiga: crece con los niveles sostenidos por una sola pieza central. */
export function towerRisk(levels: number[][]): number {
  let weak = 0;
  for (let i = 0; i < levels.length - 1; i++) if (filled(levels[i]) === 1) weak++;
  return Math.min(0.35, weak * 0.04);
}

/** Último nivel del que se puede sacar: nunca el superior y, si está incompleto, tampoco el de debajo. */
export function maxPullLevel(levels: number[][]): number {
  const top = levels.length - 1;
  return filled(levels[top]) === 3 ? top - 1 : top - 2;
}

function askJenga(room: Room, t: JengaTask) {
  t.pending = null;
  t.q = null;
  t.speak = null;
  t.stage = 'answer';
  const speakLeft = SPEAK_QUESTIONS.map((_, i) => i).filter((i) => !t.speakUsed.includes(i));
  const useSpeak = speakLeft.length > 0 && room.d.rand() < 0.3;
  const id = useSpeak ? null : jengaQuestion(room.d.bank, new Set(room.s.used), room.d.rand, room.selCtx());
  const q = id ? room.d.bank.get(id) : undefined;
  if (q) {
    room.s.used.push(q.id);
    t.q = { id: q.id, inst: makeInstance(q, room.d.rand) };
    const secs = Math.min(40, publicView(q, t.q.inst).time);
    room.s.timer = { endsAt: room.now + secs * 1000, left: null, total: secs };
  } else {
    const pool = speakLeft.length ? speakLeft : SPEAK_QUESTIONS.map((_, i) => i);
    const i = pool[Math.floor(room.d.rand() * pool.length)];
    t.speakUsed.push(i);
    t.speak = SPEAK_QUESTIONS[i];
    room.s.timer = { endsAt: room.now + 45_000, left: null, total: 45 };
  }
}

function resolveJenga(room: Room, t: JengaTask, ok: boolean, given: string) {
  const pid = t.turn as string;
  const q = t.q ? room.d.bank.get(t.q.id) : undefined;
  t.last = { pid, ok, given, solution: q ? solution(q) : ok ? 'Respuesta aceptada por el profesor.' : 'Respuesta no aceptada.' };
  if (q) room.d.onResult?.(room.player(pid)?.profile ?? '', q.id, ok);
  const p = room.player(pid);
  if (ok && p) {
    p.stars++;
    room.fx('star', `${p.name} responde bien: quita 1 pieza (+1 ★)`, { by: pid, amount: 1 });
  } else if (p) {
    room.fx('info', `${p.name} ${given.startsWith('—') ? 'no responde' : 'falla'}: tiene que quitar 2 piezas`, { by: pid });
  }
  t.pulls = ok ? 1 : 2;
  t.pending = null;
  t.stage = 'pull';
  room.s.timer = null;
}

export function jengaAnswer(room: Room, pid: string, qid: string, a: Answer): Result {
  const t = room.s.task;
  if (t?.kind !== 'jenga' || t.stage !== 'answer') return fail('Ahora no se responde.');
  if (t.turn !== pid) return fail('No es tu turno.');
  if (!t.q || t.q.id !== qid) return fail('Esa pregunta ya no está activa.');
  const q = room.d.bank.get(t.q.id);
  if (!q) return fail('Pregunta desconocida.');
  const g = grade(q, t.q.inst, a, false);
  if (g.status === 'review') {
    t.stage = 'judge';
    t.pending = { given: g.given, expected: solution(q) };
    room.s.timer = null;
  } else {
    resolveJenga(room, t, g.status === 'correct', g.given);
  }
  room.touch();
  return OK;
}

export function jengaPull(room: Room, pid: string, level: number, slot: number): Result {
  const t = room.s.task;
  if (t?.kind !== 'jenga' || t.stage !== 'pull') return fail('Ahora no se puede quitar ninguna pieza.');
  if (t.turn !== pid) return fail('No es tu turno.');
  if (!Number.isInteger(level) || !Number.isInteger(slot) || slot < 0 || slot > 2 || level < 0 || level >= t.levels.length) return fail('Esa pieza no existe.');
  if (!t.levels[level][slot]) return fail('Ahí ya no hay pieza.');
  if (level > maxPullLevel(t.levels)) return fail('No se puede sacar de los pisos de arriba.');
  const risk = towerRisk(t.levels);
  t.levels[level][slot] = 0;
  t.lastPull = { level, slot, by: pid };
  const p = room.player(pid);
  if (unstable(t.levels) || room.d.rand() < risk) return collapse(room, t, pid);
  // La pieza se coloca arriba: completa el último piso o empieza uno nuevo.
  const top = t.levels[t.levels.length - 1];
  if (filled(top) < 3) top[top.indexOf(0)] = 1;
  else t.levels.push([1, 0, 0]);
  t.pulls--;
  room.fx('jenga-pull', `${p?.name ?? '¿?'} saca una pieza del piso ${level + 1}`, { by: pid, amount: level });
  if (t.pulls <= 0) {
    nextTurn(room, t);
    askJenga(room, t);
  }
  room.touch();
  return OK;
}

function collapse(room: Room, t: JengaTask, pid: string): Result {
  t.stage = 'fallen';
  t.loser = pid;
  t.pulls = 0;
  room.s.timer = null;
  const loser = room.player(pid);
  room.fx('jenga-fall', `💥 ¡La torre se cae! ${loser?.name ?? '¿?'} pierde esta partida`, { by: pid });
  for (const p of room.s.players) {
    if (p.id === pid) continue;
    p.stars += 3;
    room.fx('star', `${p.name} sobrevive a la torre: +3 ★`, { by: p.id, amount: 3 });
  }
  room.touch();
  return OK;
}

function nextTurn(room: Room, t: JengaTask) {
  if (!t.order.length) return;
  const i = t.order.indexOf(t.turn ?? '');
  for (let k = 1; k <= t.order.length; k++) {
    const id = t.order[(i + k) % t.order.length];
    if (room.player(id)?.connected || k === t.order.length) { t.turn = id; return; }
  }
}

// ───────────── control del profesor ─────────────
export function taskCtl(room: Room, op: string, pid?: string, n?: number, ok?: boolean): Result {
  const t = room.s.task;
  if (room.s.phase !== 'task' || !t) return fail('No hay ninguna actividad en marcha.');
  switch (op) {
    case 'show':
      if (t.kind !== 'rolle' && t.kind !== 'wort' && t.kind !== 'frei') return fail('Solo en las actividades de escritura.');
      if (!pid || !room.player(pid)) return fail('Elige un alumno.');
      if (t.stage === 'write') { t.stage = 'show'; room.s.timer = null; }
      t.showing = pid;
      break;
    case 'star': {
      if (!pid || !room.player(pid)) return fail('Elige un alumno.');
      const d = Math.max(-3, Math.min(3, Math.round(n ?? 1)));
      if (t.kind === 'jenga') {
        const p = room.player(pid)!;
        p.stars = Math.max(0, p.stars + d);
      } else {
        t.bonus[pid] = Math.max(0, (t.bonus[pid] ?? 0) + d);
      }
      room.fx('star', `Profesor: ${room.player(pid)?.name} ${d > 0 ? '+' : ''}${d} ★`, { by: pid, amount: d });
      break;
    }
    case 'goal':
      if (t.kind !== 'szene') return fail('Solo en las escenas.');
      if (!pid || !t.goals[pid] || !Number.isInteger(n) || (n as number) < 0 || (n as number) > 2) return fail('Objetivo no válido.');
      t.goals[pid][n as number] = !t.goals[pid][n as number];
      break;
    case 'reroll':
      if (t.kind !== 'szene') return fail('Solo en las escenas.');
      t.scene = pickScene(room);
      assignRoles(room, t);
      t.stage = 'prep';
      room.s.timer = { endsAt: room.now + TIMES.szene * 1000, left: null, total: TIMES.szene };
      break;
    case 'judge':
      if (t.kind !== 'jenga' || (t.stage !== 'judge' && !(t.stage === 'answer' && t.speak))) return fail('No hay ninguna respuesta que juzgar.');
      resolveJenga(room, t, !!ok, t.pending?.given ?? (ok ? 'Respuesta oral' : 'Respuesta oral (no aceptada)'));
      break;
    case 'skip':
      if (t.kind !== 'jenga' || t.stage === 'fallen') return fail('Ahora no se puede pasar turno.');
      nextTurn(room, t);
      askJenga(room, t);
      break;
    case 'reset':
      if (t.kind !== 'jenga') return fail('Solo en el Jenga.');
      t.levels = freshTower();
      t.games++;
      t.order = t.order.filter((id) => room.player(id));
      if (t.loser && t.order.includes(t.loser)) t.turn = t.loser;
      else nextTurn(room, t);
      t.loser = null;
      t.last = null;
      t.lastPull = null;
      askJenga(room, t);
      room.fx('info', 'Nueva torre');
      break;
    default:
      return fail('Acción desconocida.');
  }
  room.touch();
  return OK;
}

/** «Siguiente» del profesor dentro de una actividad: avanza de etapa o la termina. */
export function taskNext(room: Room): Result | null {
  const t = room.s.task;
  if (!t) return null;
  if ((t.kind === 'rolle' || t.kind === 'wort' || t.kind === 'frei') && t.stage === 'write') {
    t.stage = 'show';
    t.showing = room.s.players[0]?.id ?? null;
    room.s.timer = null;
    room.touch();
    return OK;
  }
  if (t.kind === 'szene' && t.stage !== 'score') {
    if (t.stage === 'prep') {
      t.stage = 'play';
      room.s.timer = { endsAt: room.now + SCENE_PLAY * 1000, left: null, total: SCENE_PLAY };
    } else {
      t.stage = 'score';
      room.s.timer = null;
    }
    room.touch();
    return OK;
  }
  return null;
}

/** Fin del tiempo dentro de una actividad. Devuelve true si cambió algo. */
export function taskTick(room: Room): boolean {
  const t = room.s.task;
  if (!t) return false;
  if (t.kind === 'jenga') {
    if (t.stage === 'answer' && !t.speak) {
      resolveJenga(room, t, false, '— (sin respuesta)');
      room.touch();
      return true;
    }
    if (t.stage === 'answer' && t.speak) {
      // Pregunta oral: el tiempo se acaba, pero decide el profesor.
      room.s.timer = { endsAt: null, left: 0, total: room.s.timer?.total ?? 45 };
      return true;
    }
    return false;
  }
  if (t.kind === 'szene') {
    taskNext(room);
    return true;
  }
  return !!taskNext(room);
}

/** Estrellas pendientes de la actividad en curso (se suman al terminarla). */
export function pendingStars(t: TaskState | null, pid: string): number {
  if (!t) return 0;
  if (t.kind === 'szene') return sceneStars(t, pid);
  if (t.kind === 'jenga') return 0;
  return t.sets[pid] ? entry(t, pid).stars : 0;
}

export function endTask(room: Room): { pid: string; n: number }[] {
  const t = room.s.task;
  const out: { pid: string; n: number }[] = [];
  if (!t) return out;
  for (const p of room.s.players) {
    const n = pendingStars(t, p.id);
    if (n > 0) {
      p.stars += n;
      room.fx('star', `${p.name} gana ${n} ★`, { by: p.id, amount: n });
    }
    out.push({ pid: p.id, n });
  }
  room.s.task = null;
  room.s.timer = null;
  return out;
}

export function removeFromTask(room: Room, pid: string) {
  const t = room.s.task;
  if (t?.kind !== 'jenga') return;
  if (t.turn === pid) {
    nextTurn(room, t);
    if (t.turn === pid) t.turn = null;
    if (t.stage !== 'fallen' && t.turn) askJenga(room, t);
  }
  t.order = t.order.filter((x) => x !== pid);
}

// ───────────── vista ─────────────
export function taskView(room: Room, viewer: { teacher: true } | { pid: string }): TaskView | null {
  const t = room.s.task;
  if (!t) return null;
  const teacher = 'teacher' in viewer;
  const me = teacher ? null : viewer.pid;
  if (t.kind === 'szene') {
    const sc = SCENES[t.scene];
    const reveal = teacher || t.stage === 'score';
    return {
      kind: 'szene', stage: t.stage, scene: { id: sc.id, title: sc.title, place: sc.place, setup: sc.setup },
      roles: Object.fromEntries(Object.entries(t.roles).map(([pid, r]) => [pid, { role: sc.roles[r].role, ...(reveal || pid === me ? { card: sc.roles[r] } : {}) }])),
      goals: t.goals, bonus: t.bonus,
    };
  }
  if (t.kind === 'jenga') {
    const q = t.q ? room.d.bank.get(t.q.id) : undefined;
    return {
      kind: 'jenga', stage: t.stage, levels: t.levels, turn: t.turn, order: t.order, pulls: t.pulls,
      q: q && t.q && t.stage === 'answer' ? publicView(q, t.q.inst) : null, speak: t.stage === 'answer' || t.stage === 'judge' ? t.speak : null,
      last: t.last, lastPull: t.lastPull, loser: t.loser, games: t.games, risk: towerRisk(t.levels),
      ...(t.pending ? { judge: t.pending } : {}),
    };
  }
  const open = teacher || t.stage === 'show';
  const sets: Record<string, { words: { de: string; es: string }[]; prompt: string; base?: string }> = {};
  const entries: Record<string, WriteEntry> = {};
  for (const [pid, set] of Object.entries(t.sets)) {
    if (!room.player(pid)) continue;
    const mine = pid === me;
    if (open || mine) sets[pid] = { words: learned(set.words).map((w) => ({ de: w.de, es: w.es })), prompt: set.prompt, ...(mine && set.base ? { base: set.base } : {}) };
    const e = entry(t, pid);
    entries[pid] = open || mine ? e : { ...e, text: '' };
  }
  return { kind: t.kind, stage: t.stage, showing: t.showing, sets, ...(t.prompts ? { prompts: t.prompts, choice: t.choice } : {}), entries };
}
