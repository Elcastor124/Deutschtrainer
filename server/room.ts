// Motor autoritativo de una sala. Toda la lógica de puntos, objetos y fases vive aquí.
// Es una clase pura (reloj y azar inyectados) para poder probarla sin red.
import { randomBytes } from 'node:crypto';
import { READINGS } from '../shared/reading.ts';
import {
  BC_BONUS, CHESTS, COMMON_ITEMS, DIFF_LABEL, GOLD_ITEMS, ITEMS, MAX_INV, PLAN, POINTS, STREAK_REWARD, THIEF_MAX, TOPICS, blockDef, checkUse, type UseCtx,
} from '../shared/rules.ts';
import type {
  Answer, BlockId, ChestTier, ErrorEntry, FinalView, Fx, ItemId, Phase, PlayerResult, Question, RevealView, RoomView, Status, TaskKind, Topic,
} from '../shared/types.ts';
import { grade, makeInstance, publicView, solution, type Instance } from './grade.ts';
import { buildQueue, drawTopic, practiceQueue, wildTopics, type SelCtx, type Stat } from './select.ts';
import { endTask, jengaAnswer, pendingStars, removeFromTask, startTask, taskNext, taskTick, taskView, type TaskState } from './tasks.ts';

export interface Player {
  id: string;
  token: string;
  profile: string;
  name: string;
  score: number;
  streak: number;
  best: number;
  correct: number;
  total: number;
  inv: ItemId[];
  bag: ItemId[];
  pickups: ItemId[];
  shield: boolean;
  /** id del jugador que lo ha saboteado (efecto pendiente). */
  sabot: string | null;
  connected: boolean;
  bcWon: number;
  bcLost: number;
  itemsUsed: number;
  stolen: number;
  errors: { qid: string; given: string }[];
  /** Cofres sin abrir: el contenido se decide al ganarlos (servidor) y se revela al abrirlos. */
  chests: ChestRec[];
  stars: number;
}

export interface ChestRec { id: string; tier: ChestTier; reason: string; item: ItemId; coins: number }

interface AnswerRec { a: Answer; given: string; status: Status; note?: string; attempt: number; final: boolean; at: number }
interface Timer { endsAt: number | null; left: number | null; total: number }

export interface RoomState {
  code: string;
  mode: 'class' | 'practice';
  teacherToken: string;
  createdAt: number;
  updatedAt: number;
  phase: Phase;
  block: BlockId | null;
  blockStartedAt: number | null;
  startedAt: number | null;
  queue: string[];
  used: string[];
  qNo: number;
  qTotal: number;
  q: { id: string; inst: Instance; review?: boolean } | null;
  timer: Timer | null;
  answers: Record<string, AnswerRec>;
  uses: Record<string, { item: ItemId; target?: string }>;
  reveal: RevealView | null;
  wildPending: string | null;
  wild: { by: string; options: Topic[]; endsAt: number } | null;
  itemsOn: boolean;
  itemsOff: ItemId[];
  starterGiven: boolean;
  roundEnd: { block: BlockId; rewards: { pid: string; tier: ChestTier }[]; stars?: { pid: string; n: number }[] } | null;
  /** Truhenfragen del bloque: acertarlas da un cofre de plata. */
  chestQs: string[];
  /** Lectura de la sesión (id de shared/reading.ts). */
  reading: string;
  task: TaskState | null;
  scenesUsed: number[];
  players: Player[];
  log: Fx[];
  fxSeq: number;
  practice?: { topics: Topic[]; requeued: string[]; done: number; correct: number };
}

export interface Deps {
  bank: Map<string, Question>;
  now: () => number;
  rand: () => number;
  onResult?: (profile: string, qid: string, ok: boolean) => void;
  profileCode?: (profile: string) => string;
  /** Preguntas que ya vieron estos perfiles en otras partidas (id → última vez). */
  seen?: (profiles: string[]) => Map<string, number>;
}

export type Result = { ok: true; retry?: boolean } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = (n = 4) => Array.from(randomBytes(n), (b) => CODE_ALPHA[b % CODE_ALPHA.length]).join('');
const newId = () => randomBytes(4).toString('hex');
const newToken = () => randomBytes(16).toString('hex');

function shuffled<T>(a: T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Limpia la respuesta que llega del cliente (tipos y tamaños). */
export function sanitizeAnswer(raw: unknown): Answer {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : undefined);
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);
  const ints = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => (Number.isInteger(x) ? x : -1)) : undefined);
  const out: Answer = {};
  if (int(a.choice) !== undefined) out.choice = int(a.choice);
  if (str(a.text, 300) !== undefined) out.text = str(a.text, 300);
  if (Array.isArray(a.gaps)) out.gaps = a.gaps.slice(0, 8).map((g) => (typeof g === 'string' ? g.slice(0, 60) : ''));
  if (ints(a.order, 40)) out.order = ints(a.order, 40);
  if (int(a.index) !== undefined) out.index = int(a.index);
  if (str(a.fix, 60) !== undefined) out.fix = str(a.fix, 60);
  if (ints(a.pairs, 10)) out.pairs = ints(a.pairs, 10);
  return out;
}

export class Room {
  s: RoomState;
  d: Deps;

  constructor(s: RoomState, d: Deps) {
    this.s = s;
    this.d = d;
  }

  static create(d: Deps, code: string, mode: 'class' | 'practice' = 'class'): Room {
    const now = d.now();
    return new Room({
      code, mode, teacherToken: newToken(), createdAt: now, updatedAt: now, phase: 'lobby', block: null, blockStartedAt: null, startedAt: null,
      queue: [], used: [], qNo: 0, qTotal: 0, q: null, timer: null, answers: {}, uses: {}, reveal: null, wildPending: null, wild: null,
      itemsOn: true, itemsOff: [], starterGiven: false, roundEnd: null, chestQs: [], reading: READINGS[0].id, task: null, scenesUsed: [],
      players: [], log: [], fxSeq: 0,
    }, d);
  }

  /** Completa salas guardadas con versiones anteriores del servidor. */
  static restore(s: RoomState, d: Deps): Room {
    s.chestQs ??= [];
    s.reading ??= READINGS[0].id;
    s.task ??= null;
    s.scenesUsed ??= [];
    for (const p of s.players) { p.chests ??= []; p.stars ??= 0; }
    return new Room(s, d);
  }

  // ───────────── utilidades ─────────────
  get now() { return this.d.now(); }
  get question(): Question | null { return this.s.q ? this.d.bank.get(this.s.q.id) ?? null : null; }
  player(id: string | null | undefined) { return this.s.players.find((p) => p.id === id); }
  byToken(token: string) { return this.s.players.find((p) => p.token === token); }
  private name(id: string | null | undefined) { return this.player(id)?.name ?? '¿?'; }
  private get practice() { return this.s.mode === 'practice'; }
  private get blockItems() { return !this.practice && !!blockDef(this.s.block)?.items; }

  fx(kind: Fx['kind'], text: string, extra: Partial<Fx> = {}) {
    this.s.log.push({ id: ++this.s.fxSeq, kind, text, at: this.now, ...extra });
    if (this.s.log.length > 40) this.s.log.splice(0, this.s.log.length - 40);
  }

  touch() { this.s.updatedAt = this.now; }

  /** Historial de estos alumnos en otras partidas: se prefieren preguntas nuevas para ellos. */
  selCtx(): SelCtx {
    return { reading: this.s.reading, seen: this.d.seen?.(this.s.players.map((p) => p.profile)) };
  }

  /** Lectura que estos alumnos han visto hace más tiempo (o nunca). */
  private chooseReading(): string {
    const seen = this.d.seen?.(this.s.players.map((p) => p.profile));
    if (!seen?.size) return READINGS[Math.floor(this.d.rand() * READINGS.length)].id;
    const last = (id: string) => Math.max(0, ...[...this.d.bank.values()].filter((q) => q.tags?.includes(`text:${id}`)).map((q) => seen.get(q.id) ?? 0));
    const ranked = READINGS.map((r) => ({ id: r.id, at: last(r.id), k: this.d.rand() })).sort((a, b) => a.at - b.at || a.k - b.k);
    return ranked[0].id;
  }

  private draw(p: Player): ItemId {
    const allowed = COMMON_ITEMS.filter((i) => !this.s.itemsOff.includes(i));
    if (!allowed.length) return 'shield';
    for (let k = 0; k < 24; k++) {
      if (!p.bag.length) p.bag = shuffled(COMMON_ITEMS, this.d.rand);
      const it = p.bag.pop() as ItemId;
      if (allowed.includes(it)) return it;
    }
    return allowed[0];
  }

  /** Entrega un objeto. Con el inventario lleno queda pendiente: el alumno decide qué descartar. */
  award(p: Player, item: ItemId, reason: string) {
    if (item === 'blackcard' && (p.inv.includes('blackcard') || p.pickups.includes('blackcard'))) item = this.draw(p);
    if (p.inv.length < MAX_INV) p.inv.push(item);
    else p.pickups.push(item);
    this.fx(item === 'blackcard' ? 'unlock' : 'reward', `${p.name} recibe ${ITEMS[item].name} · ${reason}`, { by: p.id, item });
  }

  /** Da un cofre. El contenido se decide ahora (servidor) y se revela al abrirlo. La BlackCard solo viene en el cofre negro. */
  grant(p: Player, tier: ChestTier, reason: string) {
    if (tier === 'black' && (p.inv.includes('blackcard') || p.pickups.includes('blackcard') || p.chests.some((c) => c.tier === 'black'))) tier = 'silver';
    let item: ItemId;
    if (tier === 'black') item = 'blackcard';
    else if (tier === 'gold') {
      const strong = GOLD_ITEMS.filter((i) => !this.s.itemsOff.includes(i));
      item = strong.length ? strong[Math.floor(this.d.rand() * strong.length)] : this.draw(p);
    } else item = this.draw(p);
    p.chests.push({ id: newId(), tier, reason, item, coins: CHESTS[tier].coins });
    this.fx(tier === 'black' ? 'unlock' : 'chest', `${p.name} gana un ${CHESTS[tier].name.toLowerCase()} · ${reason}`, { by: p.id, tier });
  }

  openChest(pid: string, chestId: string): Result {
    const p = this.player(pid);
    if (!p) return fail('Jugador desconocido.');
    const i = p.chests.findIndex((c) => c.id === chestId);
    if (i < 0) return fail('Ese cofre ya está abierto.');
    const [c] = p.chests.splice(i, 1);
    if (p.inv.length < MAX_INV) p.inv.push(c.item);
    else p.pickups.push(c.item);
    if (c.coins) p.score += c.coins;
    this.fx('chest-open', `${p.name} abre un ${CHESTS[c.tier].name.toLowerCase()}: ${ITEMS[c.item].name}${c.coins ? ` y +${c.coins} puntos` : ''}`,
      { by: pid, item: c.item, tier: c.tier, amount: c.coins });
    this.touch();
    return OK;
  }

  giveChest(pid: string, tier: ChestTier): Result {
    const p = this.player(pid);
    if (!p || !(tier in CHESTS)) return fail('Datos no válidos.');
    this.grant(p, tier, 'regalo del profesor');
    this.touch();
    return OK;
  }

  // ───────────── jugadores ─────────────
  join(rawName: string, profile: string): Player | Result {
    if (this.s.players.length >= 8) return fail('La sala está llena (máx. 8).');
    let name = (rawName || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Alumno';
    const base = name;
    for (let k = 2; this.s.players.some((p) => p.name.toLowerCase() === name.toLowerCase()); k++) name = `${base} ${k}`;
    const p: Player = {
      id: newId(), token: newToken(), profile, name, score: 0, streak: 0, best: 0, correct: 0, total: 0, inv: [], bag: [], pickups: [],
      shield: false, sabot: null, connected: true, bcWon: 0, bcLost: 0, itemsUsed: 0, stolen: 0, errors: [], chests: [], stars: 0,
    };
    this.s.players.push(p);
    this.fx('join', `${name} entra en la sala`, { by: p.id });
    if (this.s.starterGiven && !this.practice) this.grant(p, 'bronze', 'cofre inicial');
    this.touch();
    return p;
  }

  setConnected(pid: string, on: boolean) {
    const p = this.player(pid);
    if (!p || p.connected === on) return false;
    p.connected = on;
    // Si el último que faltaba se desconecta, la pregunta no se queda esperando.
    if (!on && this.s.phase === 'question' && this.allFinal()) this.lock();
    return true;
  }

  kick(pid: string): Result {
    const i = this.s.players.findIndex((p) => p.id === pid);
    if (i < 0) return fail('No existe ese jugador.');
    const [p] = this.s.players.splice(i, 1);
    delete this.s.answers[pid];
    delete this.s.uses[pid];
    for (const u of Object.values(this.s.uses)) if (u.target === pid) u.target = undefined;
    removeFromTask(this, pid);
    this.fx('info', `${p.name} ha salido de la sala`);
    return OK;
  }

  // ───────────── flujo de la clase ─────────────
  startBlock(id: BlockId): Result {
    if (this.practice) return fail('No disponible en práctica.');
    if (!blockDef(id)) return fail('Bloque desconocido.');
    if (this.s.phase === 'question' || this.s.phase === 'review' || this.s.phase === 'wild') this.cancelQuestion();
    if (this.s.wildPending) this.refundWild();
    if (this.s.task) endTask(this);
    this.expireRoundEffects();
    if (!this.s.startedAt) this.s.reading = this.chooseReading();
    Object.assign(this.s, { block: id, blockStartedAt: this.now, roundEnd: null, reveal: null, wild: null, q: null, timer: null, answers: {}, uses: {}, chestQs: [] });
    this.s.startedAt ??= this.now;
    const def = blockDef(id)!;
    if (def.kind === 'final') {
      this.s.phase = 'final';
      this.s.queue = [];
      this.touch();
      return OK;
    }
    this.s.queue = def.kind === 'quiz' ? buildQueue(id, this.d.bank, new Set(this.s.used), this.d.rand, this.selCtx()) : [];
    this.s.qNo = 0;
    this.s.qTotal = this.s.queue.length;
    this.s.phase = 'intro';
    if (id === 'lesen') this.s.timer = { endsAt: this.now + 240_000, left: null, total: 240 };
    if (def.items) {
      // Una Truhenfrage por ronda: media o fácil, en la primera parte de la ronda.
      const cand = this.s.queue.slice(0, Math.max(1, Math.ceil(this.s.queue.length * 0.75)))
        .filter((qid) => { const q = this.d.bank.get(qid); return q && !q.unlock && (q.diff === 'medium' || q.diff === 'easy'); });
      if (cand.length) this.s.chestQs = [cand[Math.floor(this.d.rand() * cand.length)]];
      if (!this.s.starterGiven) {
        this.s.starterGiven = true;
        for (const p of this.s.players) this.grant(p, 'bronze', 'cofre inicial');
      }
    }
    this.touch();
    return OK;
  }

  next(): Result {
    switch (this.s.phase) {
      case 'lobby': return this.startBlock(PLAN[0].id);
      case 'intro': {
        const def = blockDef(this.s.block);
        return def?.kind === 'task' ? startTask(this, def.id as TaskKind) : this.presentNext();
      }
      case 'task': {
        const r = taskNext(this);
        if (r) return r;
        const stars = endTask(this);
        Object.assign(this.s, { phase: 'roundEnd' as Phase, timer: null, roundEnd: { block: this.s.block as BlockId, rewards: [], stars } });
        this.touch();
        return OK;
      }
      case 'reveal':
        if (this.s.wildPending && this.s.queue.length) return this.startWild();
        return this.s.queue.length ? this.presentNext() : this.endRound();
      case 'roundEnd':
      case 'final': {
        if (this.practice) return fail('No hay nada más.');
        const i = PLAN.findIndex((b) => b.id === this.s.block);
        const nxt = PLAN[i + 1];
        return nxt ? this.startBlock(nxt.id) : fail('La clase ha terminado.');
      }
      case 'question': return fail('Primero cierra la pregunta.');
      case 'review': return fail('Primero revisa las respuestas pendientes.');
      default: return fail('No hay nada más.');
    }
  }

  private presentNext(forced?: string, review = false): Result {
    const id = forced ?? this.s.queue.shift();
    if (!id) return this.practice ? this.finishPractice() : this.endRound();
    const q = this.d.bank.get(id);
    if (!q) return this.presentNext();
    if (!this.s.used.includes(id)) this.s.used.push(id);
    this.s.q = { id, inst: makeInstance(q, this.d.rand), ...(review ? { review: true } : {}) };
    const t = publicView(q, this.s.q.inst).time;
    this.s.timer = this.practice ? null : { endsAt: this.now + t * 1000, left: null, total: t };
    Object.assign(this.s, { answers: {}, uses: {}, reveal: null, wild: null, phase: 'question' as Phase });
    this.s.qNo++;
    this.touch();
    return OK;
  }

  private endRound(): Result {
    const def = blockDef(this.s.block);
    const rewards: { pid: string; tier: ChestTier }[] = [];
    if (this.s.wildPending) this.refundWild();
    if (def?.reward && this.s.players.length) {
      // Todos reciben un cofre; quien va último, uno de plata (para que la partida siga abierta).
      const min = Math.min(...this.s.players.map((p) => p.score));
      const allEqual = this.s.players.every((p) => p.score === min);
      for (const p of this.s.players) {
        const tier: ChestTier = !allEqual && p.score === min ? 'silver' : 'bronze';
        this.grant(p, tier, `fin de ${def.name}`);
        rewards.push({ pid: p.id, tier });
      }
    }
    this.expireRoundEffects();
    Object.assign(this.s, { phase: 'roundEnd' as Phase, q: null, timer: null, reveal: null, roundEnd: { block: this.s.block as BlockId, rewards } });
    this.touch();
    return OK;
  }

  private expireRoundEffects() {
    for (const p of this.s.players) {
      if (p.shield) { p.shield = false; this.fx('expire', `El SHIELD de ${p.name} caduca (fin de ronda)`, { by: p.id, item: 'shield' }); }
      if (p.sabot) { p.sabot = null; this.fx('expire', `El SABOTAGE sobre ${p.name} caduca (fin de ronda)`, { by: p.id, item: 'sabotage' }); }
    }
  }

  private refundWild() {
    const p = this.player(this.s.wildPending);
    this.s.wildPending = null;
    if (p) this.award(p, 'wildcard', 'devuelto (no quedaban preguntas)');
  }

  private startWild(): Result {
    const by = this.s.wildPending as string;
    this.s.wildPending = null;
    const options = wildTopics(this.s.block as BlockId, this.d.bank, new Set([...this.s.used, ...this.s.queue]), this.d.rand, this.selCtx());
    if (options.length < 2) {
      const p = this.player(by);
      if (p) this.award(p, 'wildcard', 'devuelto (no había dos categorías)');
      return this.presentNext();
    }
    const endsAt = this.now + 12_000;
    this.s.wild = { by, options, endsAt };
    this.s.timer = { endsAt, left: null, total: 12 };
    this.s.phase = 'wild';
    this.fx('info', `${this.name(by)} usa el WILDCARD: elige categoría`, { by, item: 'wildcard' });
    return OK;
  }

  pickWild(pid: string, topic: Topic, auto = false): Result {
    const w = this.s.wild;
    if (this.s.phase !== 'wild' || !w) return fail('No hay ningún comodín pendiente.');
    if (!auto && w.by !== pid) return fail('El comodín no es tuyo.');
    if (!w.options.includes(topic)) return fail('Categoría no válida.');
    const i = this.s.queue.findIndex((id) => !this.d.bank.get(id)?.unlock);
    const diff = (i >= 0 ? this.d.bank.get(this.s.queue[i])?.diff : undefined) ?? 'medium';
    const id = drawTopic(this.s.block as BlockId, topic, diff, this.d.bank, new Set([...this.s.used, ...this.s.queue]), this.d.rand, this.selCtx());
    this.fx('info', `${auto ? 'Tiempo: ' : ''}${this.name(w.by)} elige «${TOPICS[topic].de}»`, { by: w.by, item: 'wildcard' });
    if (!id) return this.presentNext();
    if (i >= 0) this.s.queue.splice(i, 1);
    return this.presentNext(id);
  }

  // ───────────── respuestas ─────────────
  private allFinal() {
    const active = this.s.players.filter((p) => p.connected);
    return active.length > 0 && active.every((p) => this.s.answers[p.id]?.final);
  }

  answer(pid: string, qid: string, raw: Answer): Result {
    const p = this.player(pid);
    if (!p) return fail('Jugador desconocido.');
    if (this.s.phase === 'task' && this.s.task?.kind === 'jenga') return jengaAnswer(this, pid, qid, raw);
    if (this.s.phase !== 'question' || !this.s.q) return fail('La pregunta ya está cerrada.');
    if (this.s.q.id !== qid) return fail('Esa pregunta ya no está activa.');
    const rec = this.s.answers[pid];
    if (rec?.final) return fail('Ya has respondido.');
    const q = this.question as Question;
    const a = sanitizeAnswer(raw);
    const g = grade(q, this.s.q.inst, a, this.practice);
    const second = this.s.uses[pid]?.item === 'second';
    if (!rec && second && g.status === 'wrong') {
      this.s.answers[pid] = { a, given: g.given, status: 'wrong', note: g.note, attempt: 1, final: false, at: this.now };
      this.fx('info', `${p.name} falla y usa su SECOND CHANCE`, { by: pid, item: 'second' });
      this.touch();
      return { ok: true, retry: true };
    }
    this.s.answers[pid] = { a, given: g.given, status: g.status, note: g.note, attempt: rec ? 2 : 1, final: true, at: this.now };
    if (this.practice || this.allFinal()) this.lock();
    this.touch();
    return OK;
  }

  // ───────────── objetos ─────────────
  useCtx(p: Player): UseCtx {
    const q = this.question;
    const rec = this.s.answers[p.id];
    return {
      phase: this.s.phase, blockItems: this.blockItems, itemsOn: this.s.itemsOn, itemsOff: this.s.itemsOff,
      q: q && this.s.q ? publicView(q, this.s.q.inst) : null, inventory: p.inv, used: this.s.uses[p.id]?.item ?? null,
      state: rec ? (rec.final ? 'sent' : 'retry') : 'idle', shield: p.shield, wildPending: !!this.s.wildPending,
      lastQuestion: this.s.queue.length === 0, self: p.id,
      rivals: this.s.players.filter((x) => x.id !== p.id).map((x) => ({
        id: x.id, sabotaged: !!x.sabot, targeted: Object.values(this.s.uses).some((u) => u.target === x.id && !!ITEMS[u.item].target),
      })),
    };
  }

  useItem(pid: string, item: ItemId, target?: string): Result {
    const p = this.player(pid);
    if (!p) return fail('Jugador desconocido.');
    if (!(item in ITEMS)) return fail('Objeto desconocido.');
    const err = checkUse(this.useCtx(p), item, target);
    if (err) return fail(err);
    p.inv.splice(p.inv.indexOf(item), 1);
    p.itemsUsed++;
    if (item === 'shield') {
      p.shield = true;
      this.fx('item', `${p.name} activa SHIELD`, { by: pid, item });
    } else {
      this.s.uses[pid] = ITEMS[item].target ? { item, target } : { item };
      if (item === 'wildcard') this.s.wildPending = pid;
      const tgt = ITEMS[item].target ? ` contra ${this.name(target)}` : '';
      this.fx('item', `${p.name} activa ${ITEMS[item].name}${tgt}`, { by: pid, item, target });
    }
    this.touch();
    return OK;
  }

  resolvePickup(pid: string, discard: number): Result {
    const p = this.player(pid);
    if (!p || !p.pickups.length) return fail('No hay ningún objeto pendiente.');
    const item = p.pickups.shift() as ItemId;
    if (discard >= 0 && discard < p.inv.length) {
      const old = p.inv[discard];
      p.inv[discard] = item;
      this.fx('info', `${p.name} cambia ${ITEMS[old].name} por ${ITEMS[item].name}`, { by: pid, item });
    } else {
      this.fx('info', `${p.name} renuncia a ${ITEMS[item].name}`, { by: pid, item });
    }
    this.touch();
    return OK;
  }

  // ───────────── cierre y corrección ─────────────
  lock(): Result {
    if (this.s.phase !== 'question') return fail('No hay ninguna pregunta abierta.');
    this.s.timer = null;
    for (const r of Object.values(this.s.answers)) r.final = true;
    if (!this.practice && Object.values(this.s.answers).some((r) => r.status === 'review')) {
      this.s.phase = 'review';
      this.touch();
      return OK;
    }
    this.doReveal();
    return OK;
  }

  judge(pid: string, ok: boolean): Result {
    const r = this.s.answers[pid];
    if (this.s.phase !== 'review' || !r || r.status !== 'review') return fail('Esa respuesta no está pendiente de revisión.');
    r.status = ok ? 'correct' : 'wrong';
    r.note = ok ? 'Aceptada por el profesor.' : r.note;
    if (!Object.values(this.s.answers).some((x) => x.status === 'review')) this.doReveal();
    this.touch();
    return OK;
  }

  judgeAll(ok: boolean): Result {
    if (this.s.phase !== 'review') return fail('No hay respuestas pendientes.');
    for (const [pid, r] of Object.entries(this.s.answers)) if (r.status === 'review') this.judge(pid, ok);
    return OK;
  }

  private doReveal() {
    const q = this.question as Question;
    const base = POINTS[q.diff];
    const results: Record<string, PlayerResult> = {};

    // 1) Sabotajes de esta pregunta (antes de puntuar: pueden afectar al acierto actual del rival).
    for (const [pid, u] of Object.entries(this.s.uses)) {
      if (u.item !== 'sabotage') continue;
      const t = this.player(u.target);
      if (!t) continue;
      if (t.shield) {
        t.shield = false;
        this.fx('block', `🛡 ${t.name} bloquea el SABOTAGE de ${this.name(pid)}`, { by: t.id, target: pid, item: 'shield' });
      } else {
        t.sabot = pid;
        this.fx('sabotaged', `${t.name} está saboteado: su próximo acierto vale la mitad`, { by: pid, target: t.id, item: 'sabotage' });
      }
    }

    // 2) Puntos propios.
    for (const p of this.s.players) {
      const rec = this.s.answers[p.id];
      const u = this.s.uses[p.id];
      const status: PlayerResult['status'] = rec ? (rec.status === 'correct' ? 'correct' : 'wrong') : 'none';
      const lines: string[] = [];
      let delta = 0;
      if (rec || p.connected) p.total++;
      if (status === 'correct') {
        let pts = base;
        lines.push(`+${base} · ${DIFF_LABEL[q.diff]}`);
        if (rec.attempt === 2) { pts = Math.ceil(base / 2); lines.push(`½ Second Chance → +${pts}`); }
        if (u?.item === 'double') { pts *= 2; lines.push(`×2 Double XP → +${pts}`); }
        if (p.sabot) { pts = Math.ceil(pts / 2); lines.push(`½ Sabotage de ${this.name(p.sabot)} → +${pts}`); p.sabot = null; }
        delta += pts;
        if (u?.item === 'blackcard') {
          delta += BC_BONUS; lines.push(`+${BC_BONUS} BLACKCARD`); p.bcWon++;
          this.fx('bc-win', `🂠 ${p.name} gana la BLACKCARD: +${BC_BONUS}`, { by: p.id, item: 'blackcard', amount: BC_BONUS });
        }
        p.streak++;
        p.best = Math.max(p.best, p.streak);
        p.correct++;
      } else {
        if (u?.item === 'blackcard') {
          delta -= BC_BONUS; lines.push(`−${BC_BONUS} BLACKCARD`); p.bcLost++;
          this.fx('bc-lose', `🂠 ${p.name} pierde la BLACKCARD: −${BC_BONUS}`, { by: p.id, item: 'blackcard', amount: -BC_BONUS });
        }
        p.streak = 0;
        if (rec || p.connected) p.errors.push({ qid: q.id, given: rec?.given ?? '— (sin respuesta)' });
      }
      const before = p.score;
      p.score = Math.max(0, p.score + delta);
      results[p.id] = { status, given: rec?.given ?? '—', delta: p.score - before, lines, note: rec?.note, attempt: rec?.attempt };
    }

    // 3) Robos: solo si el ladrón ha acertado ESTA pregunta.
    for (const [pid, u] of Object.entries(this.s.uses)) {
      if (u.item !== 'thief') continue;
      const by = this.player(pid), t = this.player(u.target), r = results[pid];
      if (!by || !t || !r) continue;
      if (r.status !== 'correct') {
        r.lines.push('THIEF sin efecto (respuesta incorrecta)');
        this.fx('fizzle', `El THIEF de ${by.name} se pierde: no ha acertado`, { by: pid, target: t.id, item: 'thief' });
        continue;
      }
      if (t.shield) {
        t.shield = false;
        r.lines.push(`THIEF bloqueado por el SHIELD de ${t.name}`);
        results[t.id]?.lines.push('🛡 Robo bloqueado');
        this.fx('block', `🛡 ${t.name} bloquea el robo de ${by.name}`, { by: t.id, target: pid, item: 'shield' });
        continue;
      }
      const amt = Math.min(THIEF_MAX, t.score);
      t.score -= amt;
      by.score += amt;
      by.stolen += amt;
      r.delta += amt;
      r.lines.push(`+${amt} robados a ${t.name}`);
      if (results[t.id]) { results[t.id].delta -= amt; results[t.id].lines.push(`−${amt} robados por ${by.name}`); }
      this.fx('steal', `${by.name} roba ${amt} puntos a ${t.name}`, { by: pid, target: t.id, item: 'thief', amount: amt });
    }

    // 4) Cofres: Prüfungsfrage → negro (BlackCard) · reto especial → oro · Truhenfrage → plata · racha de 3 → bronce.
    if (this.blockItems) {
      for (const p of this.s.players) {
        if (results[p.id]?.status !== 'correct') continue;
        if (q.unlock) this.grant(p, 'black', 'Prüfungsfrage superada');
        if (q.diff === 'special') this.grant(p, 'gold', 'reto especial superado');
        if (this.s.chestQs.includes(q.id)) this.grant(p, 'silver', 'Truhenfrage');
        if (p.streak > 0 && p.streak % STREAK_REWARD === 0) this.grant(p, 'bronze', `racha de ${p.streak} aciertos`);
      }
    }

    // 5) Historial para el modo práctica.
    for (const p of this.s.players) {
      const st = results[p.id]?.status;
      if (st && st !== 'none') this.d.onResult?.(p.profile, q.id, st === 'correct');
    }
    if (this.s.practice) {
      const ok = results[this.s.players[0]?.id]?.status === 'correct';
      this.s.practice.done++;
      if (ok) this.s.practice.correct++;
      else if (!this.s.practice.requeued.includes(q.id)) {
        this.s.practice.requeued.push(q.id);
        this.s.queue.splice(Math.min(3, this.s.queue.length), 0, q.id);
        this.s.qTotal++;
      }
    }
    this.s.reveal = { qid: q.id, solution: solution(q), explain: q.explain, results };
    this.s.phase = 'reveal';
    this.s.timer = null;
    this.touch();
  }

  /** Anula la pregunta en curso y devuelve los objetos usados en ella. */
  private cancelQuestion() {
    for (const [pid, u] of Object.entries(this.s.uses)) {
      const p = this.player(pid);
      if (!p) continue;
      if (p.inv.length < MAX_INV) p.inv.push(u.item);
      else p.pickups.push(u.item);
      p.itemsUsed = Math.max(0, p.itemsUsed - 1);
      if (u.item === 'wildcard' && this.s.wildPending === pid) this.s.wildPending = null;
    }
    if (this.s.wild) {
      const p = this.player(this.s.wild.by);
      if (p) this.award(p, 'wildcard', 'devuelto');
    }
    Object.assign(this.s, { uses: {}, answers: {}, timer: null, wild: null });
  }

  skip(): Result {
    if (!['question', 'review', 'wild'].includes(this.s.phase)) return fail('No hay ninguna pregunta que anular.');
    const q = this.question;
    const wasWild = this.s.phase === 'wild';
    this.cancelQuestion();
    if (wasWild) return this.presentNext();
    this.fx('info', 'El profesor anula la pregunta: objetos devueltos');
    this.s.reveal = q ? { qid: q.id, solution: solution(q), explain: q.explain, skipped: true, results: {} } : null;
    this.s.phase = 'reveal';
    this.touch();
    return OK;
  }

  // ───────────── temporizador ─────────────
  pause(): Result {
    const t = this.s.timer;
    if (!t || t.endsAt === null) return fail('No hay un temporizador en marcha.');
    t.left = Math.max(0, t.endsAt - this.now);
    t.endsAt = null;
    this.fx('info', '⏸ Pausa');
    return OK;
  }

  resume(): Result {
    const t = this.s.timer;
    if (!t || t.left === null) return fail('El temporizador no está en pausa.');
    t.endsAt = this.now + t.left;
    t.left = null;
    this.fx('info', '▶ Continúa');
    return OK;
  }

  addTime(s: number): Result {
    const t = this.s.timer;
    if (!t) return fail('No hay temporizador.');
    const ms = Math.max(-60, Math.min(120, Math.round(s))) * 1000;
    if (t.endsAt !== null) t.endsAt = Math.max(this.now, t.endsAt + ms);
    else if (t.left !== null) t.left = Math.max(0, t.left + ms);
    t.total = Math.max(1, t.total + ms / 1000);
    return OK;
  }

  /** Llamado periódicamente por el servidor. Devuelve true si cambió algo. */
  tick(): boolean {
    const t = this.s.timer;
    if (!t || t.endsAt === null || this.now < t.endsAt) return false;
    if (this.s.phase === 'question') { this.lock(); return true; }
    if (this.s.phase === 'task') return taskTick(this);
    if (this.s.phase === 'wild' && this.s.wild) {
      const opts = this.s.wild.options;
      this.pickWild(this.s.wild.by, opts[Math.floor(this.d.rand() * opts.length)], true);
      return true;
    }
    t.left = 0;
    t.endsAt = null;
    this.fx('info', '⏱ Tiempo terminado');
    return true;
  }

  // ───────────── profesor ─────────────
  points(pid: string, delta: number): Result {
    const p = this.player(pid);
    if (!p) return fail('No existe ese jugador.');
    const d = Math.max(-50, Math.min(50, Math.round(delta)));
    const before = p.score;
    p.score = Math.max(0, p.score + d);
    this.fx('manual', `Profesor: ${p.name} ${d >= 0 ? '+' : ''}${p.score - before}`, { by: pid, amount: p.score - before });
    this.touch();
    return OK;
  }

  setItems(on: boolean, item?: ItemId): Result {
    if (item) {
      if (!(item in ITEMS)) return fail('Objeto desconocido.');
      this.s.itemsOff = on ? this.s.itemsOff.filter((i) => i !== item) : [...new Set([...this.s.itemsOff, item])];
      this.fx('info', `${ITEMS[item].name} ${on ? 'activado' : 'desactivado'} por el profesor`, { item });
    } else {
      this.s.itemsOn = on;
      this.fx('info', on ? 'Objetos activados' : 'Objetos desactivados temporalmente');
    }
    this.touch();
    return OK;
  }

  give(pid: string, item: ItemId): Result {
    const p = this.player(pid);
    if (!p || !(item in ITEMS)) return fail('Datos no válidos.');
    this.award(p, item, 'regalo del profesor');
    this.touch();
    return OK;
  }

  // ───────────── práctica ─────────────
  startPractice(p: Player, topics: Topic[], focus: boolean, stats: Record<string, Stat>): Result {
    this.s.practice = { topics, requeued: [], done: 0, correct: 0 };
    this.s.queue = practiceQueue(stats, topics, focus, this.d.bank, this.d.rand);
    this.s.qTotal = this.s.queue.length;
    this.s.startedAt = this.now;
    if (!this.s.players.includes(p)) this.s.players.push(p);
    return this.presentNext();
  }

  practiceNext(): Result {
    if (!this.practice) return fail('Solo en práctica.');
    if (this.s.phase !== 'reveal') return fail('Responde primero.');
    const id = this.s.queue.shift();
    if (!id) return this.finishPractice();
    return this.presentNext(id, !!this.s.practice?.requeued.includes(id) && this.s.used.includes(id));
  }

  private finishPractice(): Result {
    Object.assign(this.s, { phase: 'final' as Phase, q: null, timer: null });
    this.touch();
    return OK;
  }

  // ───────────── vistas ─────────────
  private errorEntry(qid: string, given: string): ErrorEntry | null {
    const q = this.d.bank.get(qid);
    if (!q) return null;
    return { qid, prompt: q.type === 'gap' ? `${q.prompt} ${q.text}` : q.prompt, solution: solution(q), explain: q.explain, given, topic: q.topic, src: q.src };
  }

  finalView(): FinalView {
    const sorted = [...this.s.players].sort((a, b) => b.score - a.score);
    const players = sorted.map((p) => ({
      id: p.id, name: p.name, score: p.score, rank: sorted.findIndex((x) => x.score === p.score) + 1, correct: p.correct, total: p.total,
      best: p.best, bcWon: p.bcWon, bcLost: p.bcLost, itemsUsed: p.itemsUsed, stolen: p.stolen, chests: p.chests.length, stars: p.stars,
      errors: p.errors.map((e) => this.errorEntry(e.qid, e.given)).filter((e): e is ErrorEntry => !!e),
    }));
    const agg = new Map<string, { count: number; names: string[]; given: string }>();
    for (const p of this.s.players) {
      for (const e of p.errors) {
        const a = agg.get(e.qid) ?? { count: 0, names: [], given: e.given };
        a.count++;
        if (!a.names.includes(p.name)) a.names.push(p.name);
        agg.set(e.qid, a);
      }
    }
    const classErrors = [...agg.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15)
      .map(([qid, a]) => ({ ...(this.errorEntry(qid, a.given) as ErrorEntry), count: a.count, names: a.names }))
      .filter((e) => e.qid);
    return { players, classErrors };
  }

  view(viewer: { teacher: true } | { pid: string }): RoomView {
    const s = this.s;
    const q = this.question;
    const pq = q && s.q ? { ...publicView(q, s.q.inst), ...(s.q.review ? { review: true } : {}), ...(s.chestQs.includes(s.q.id) ? { chest: true } : {}) } : null;
    const players = [...s.players].sort((a, b) => b.score - a.score).map((p) => ({
      id: p.id, name: p.name, score: p.score, streak: p.streak, connected: p.connected, shield: p.shield, sabotaged: !!p.sabot,
      items: p.inv.length, answered: !!s.answers[p.id]?.final, chests: p.chests.length, stars: p.stars + pendingStars(s.task, p.id),
    }));
    const v: RoomView = {
      code: s.code, mode: s.mode, phase: s.phase, block: s.block, blockStartedAt: s.blockStartedAt, startedAt: s.startedAt, serverNow: this.now,
      timer: s.timer ? { ...s.timer } : null, q: pq, qNo: s.qNo, qTotal: s.qTotal, players, reveal: s.reveal,
      itemsOn: s.itemsOn, itemsOff: s.itemsOff, blockItems: this.blockItems,
      uses: Object.entries(s.uses).map(([by, u]) => ({ by, item: u.item, ...(u.target ? { target: u.target } : {}) })),
      wild: s.wild, wildPending: s.wildPending, roundEnd: s.roundEnd, log: s.log.slice(-25),
      reading: s.reading, task: taskView(this, viewer),
    };
    if (s.practice) v.practice = { topics: s.practice.topics, done: s.practice.done, correct: s.practice.correct };
    if (s.phase === 'final') v.final = this.finalView();
    if ('teacher' in viewer) {
      v.teacher = {
        solution: q ? solution(q) : '',
        answers: Object.fromEntries(Object.entries(s.answers).map(([pid, r]) => [pid, { given: r.given, status: r.status, note: r.note, final: r.final, attempt: r.attempt }])),
        review: Object.entries(s.answers).filter(([, r]) => r.status === 'review')
          .map(([pid, r]) => ({ pid, given: r.given, expected: q ? solution(q) : '', note: r.note })),
        inventories: Object.fromEntries(s.players.map((p) => [p.id, p.inv])),
        queueLeft: s.queue.length,
        usedCount: s.used.length,
        bankSize: this.d.bank.size,
      };
    } else {
      const p = this.player(viewer.pid);
      if (p) {
        const r = s.answers[p.id];
        v.me = {
          id: p.id, name: p.name, inventory: p.inv, pickups: p.pickups, state: r ? (r.final ? 'sent' : 'retry') : 'idle',
          used: s.uses[p.id]?.item ?? null,
          incoming: Object.entries(s.uses).filter(([, u]) => u.target === p.id && ITEMS[u.item].target).map(([by, u]) => ({ kind: u.item as 'thief' | 'sabotage', by })),
          profileCode: this.d.profileCode?.(p.profile) ?? '',
          chests: p.chests.map((c) => ({ id: c.id, tier: c.tier, reason: c.reason })),
        };
      }
    }
    return v;
  }
}
