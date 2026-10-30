// Persistencia sencilla en JSON (escritura atómica con debounce). Guarda salas y perfiles de práctica.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Stat } from './select.ts';

export interface Profile { id: string; code: string; name: string; stats: Record<string, Stat>; createdAt: number }
interface Data<R> { rooms: Record<string, R>; profiles: Record<string, Profile> }

export class Store<R> {
  dir: string;
  file: string;
  data: Data<R>;
  private timer: NodeJS.Timeout | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.file = join(dir, 'state.json');
    mkdirSync(dir, { recursive: true });
    this.data = { rooms: {}, profiles: {} };
    if (existsSync(this.file)) {
      try {
        this.data = { rooms: {}, profiles: {}, ...JSON.parse(readFileSync(this.file, 'utf8')) };
      } catch (e) {
        console.error('[store] no se pudo leer state.json, se empieza vacío:', (e as Error).message);
      }
    }
  }

  saveSoon(delay = 300) {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, delay);
  }

  flush() {
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); // contiene tokens de sala: solo el usuario del servidor
    renameSync(tmp, this.file);
  }

  profileByCode(code: string): Profile | undefined {
    const c = code.trim().toUpperCase();
    return Object.values(this.data.profiles).find((p) => p.code === c);
  }
}
