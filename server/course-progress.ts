// Progreso del curso (pasos «Ver / Practicar / Repaso» marcados) POR CUENTA.
// Antes solo vivía en localStorage del navegador (clave dt:course:v1): en un ordenador compartido (clase, casa) todos los
// alumnos que entraban veían el mismo porcentaje, y al cambiar de dispositivo el alumno lo perdía.
//   GET  /api/course/progress            → { done: string[] }  (cuenta de la cookie)
//   POST /api/course/progress { done }   → fusiona (unión) y guarda; también sirve para subir lo que había en el dispositivo
//   POST /api/course/progress { id, on } → marca / desmarca un paso
// Sin cuenta: 401 (el cliente se queda con lo local). Datos en DATA_DIR/course-progress.json (fichero nuevo; no toca otros).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ALL_STEP_IDS } from '../src/course.ts';
import { sameOriginJson } from './cookies.ts';
import { identify } from './play-api.ts';
import type { AccountStore } from './accounts.ts';

interface Entry { done: string[]; updatedAt: number }
interface Data { version: 1; accounts: Record<string, Entry> }
const VALID = new Set(ALL_STEP_IDS);
const clean = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && VALID.has(x)))] : []);

export class CourseProgressStore {
  readonly file: string | null;
  data: Data = { version: 1, accounts: {} };
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(dataDir?: string) {
    this.file = dataDir ? join(dataDir, 'course-progress.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1 && raw.accounts && typeof raw.accounts === 'object') this.data = { version: 1, accounts: raw.accounts }; }
      catch (e) { console.error('[course-progress] no se pudo leer; se empieza vacío:', (e as Error).message); }
    }
  }
  get(id: string): string[] { return ALL_STEP_IDS.filter((s) => this.data.accounts[id]?.done.includes(s)); }
  merge(id: string, done: string[], now: number): string[] {
    const cur = new Set(this.get(id)); for (const s of clean(done)) cur.add(s);
    this.data.accounts[id] = { done: ALL_STEP_IDS.filter((s) => cur.has(s)), updatedAt: now }; this.save();
    return this.get(id);
  }
  set(id: string, step: string, on: boolean, now: number): string[] {
    if (!VALID.has(step)) return this.get(id);
    const cur = new Set(this.get(id)); if (on) cur.add(step); else cur.delete(step);
    this.data.accounts[id] = { done: ALL_STEP_IDS.filter((s) => cur.has(s)), updatedAt: now }; this.save();
    return this.get(id);
  }
  forget(id: string) { if (this.data.accounts[id]) { delete this.data.accounts[id]; this.save(); } }
  save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

export function createCourseProgress({ accounts, store, now = Date.now }: { accounts: AccountStore; store: CourseProgressStore; now?: () => number }) {
  const handler = (req: IncomingMessage, res: ServerResponse): boolean => {
    const path = new URL(req.url || '/', 'http://x').pathname;
    if (path !== '/api/course/progress') return false;
    const who = identify(accounts, req);
    if (who.kind !== 'account') { json(res, 401, { error: 'Inicia sesión para guardar tu progreso del curso.' }); return true; }
    const id = who.account.id;
    if (req.method === 'GET') { json(res, 200, { done: store.get(id) }); return true; }
    if (req.method !== 'POST') { json(res, 405, { error: 'Método no permitido.' }); return true; }
    if (!sameOriginJson(req)) { json(res, 400, { error: 'Petición no válida.' }); return true; }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 16_384) req.destroy(); });
    req.on('end', () => {
      let b: Record<string, unknown>;
      try { b = JSON.parse(raw || '{}'); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json(res, 400, { error: 'JSON no válido.' }); }
      if (typeof b.id === 'string') return json(res, 200, { done: store.set(id, b.id, b.on !== false, now()) });
      return json(res, 200, { done: store.merge(id, clean(b.done), now()) });
    });
    return true;
  };
  return Object.assign(handler, { forget: (id: string) => store.forget(id), flush: () => store.flush() });
}
