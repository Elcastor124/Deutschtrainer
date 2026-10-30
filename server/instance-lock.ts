// El estado del juego vive en memoria y en DATA_DIR: dos procesos sobre el mismo directorio se pisarían los ficheros y
// tendrían salas, límites y TTL distintos. Esta cerradura (con latido) lo detecta y evita la corrupción.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const STALE_MS = 30_000;
const BEAT_MS = 10_000;

export interface InstanceLock { release(): void }

/**
 * Adquiere la cerradura de DATA_DIR. Si otro proceso la tiene viva (latido reciente) espera hasta `waitMs`
 * (cubre reinicios/despliegues en los que el anterior aún está cerrando) y, si sigue viva, lanza error.
 * Una cerradura de un proceso caído caduca sola a los 30 s.
 */
export async function acquireInstanceLock(dataDir: string, { waitMs = 35_000, now = Date.now, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {}): Promise<InstanceLock> {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, '.server.lock');
  const id = randomUUID();
  const read = (): { id: string; beat: number } | null => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
  const deadline = now() + waitMs;
  const payload = () => JSON.stringify({ id, pid: process.pid, beat: now() });
  // Creación exclusiva ('wx'): si dos procesos arrancan a la vez, solo uno la consigue.
  for (;;) {
    try { writeFileSync(file, payload(), { mode: 0o600, flag: 'wx' }); break; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    const cur = read();
    if (!cur || now() - Number(cur.beat) > STALE_MS) { rmSync(file, { force: true }); continue; }
    if (now() >= deadline) throw new Error(`Otra instancia del servidor está usando ${dataDir} (cerradura viva). Ejecuta UNA sola instancia por directorio de datos.`);
    await sleep(1000);
  }
  const beat = () => writeFileSync(file, payload(), { mode: 0o600 });
  const timer = setInterval(beat, BEAT_MS);
  timer.unref();
  return { release() { clearInterval(timer); if (read()?.id === id) rmSync(file, { force: true }); } };
}
