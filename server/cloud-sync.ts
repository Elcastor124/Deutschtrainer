// Copia de seguridad de DATA_DIR en Supabase (Postgres vía REST), para hostings sin disco persistente (p. ej. Render free).
// Al arrancar se recuperan los ficheros; mientras corre, los *.json que cambian se suben cada pocos segundos y al apagar.
// Sin SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no hace nada (desarrollo local, tests, servidores con disco).
//
// Tabla (se crea una vez en el SQL Editor de Supabase; RLS activado y SIN políticas = solo la service role la ve):
//   create table if not exists dt_files (path text primary key, content text not null, updated_at timestamptz not null default now());
//   alter table dt_files enable row level security;
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLE = 'dt_files';
/** Solo ficheros de datos de primer nivel: ni temporales (*.tmp), ni ocultos (.server.lock), ni subcarpetas. */
const tracked = (name: string) => /^[\w.-]+\.json$/.test(name) && !name.startsWith('.');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export interface CloudSync { enabled: boolean; flush(): Promise<void>; stop(): void }
type Fetch = typeof fetch;

export function cloudConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = (env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  return url && key ? { url, key } : null;
}

/** Descarga los ficheros guardados y los escribe en dataDir (antes de que los lean los almacenes). Devuelve cuántos. */
export async function restoreFromCloud(dataDir: string, env: NodeJS.ProcessEnv = process.env, f: Fetch = fetch): Promise<number> {
  const cfg = cloudConfig(env); if (!cfg) return 0;
  const r = await f(`${cfg.url}/rest/v1/${TABLE}?select=path,content`, { headers: headers(cfg.key) });
  if (!r.ok) throw new Error(`Supabase respondió ${r.status} al leer ${TABLE}: ${(await r.text()).slice(0, 200)}`);
  const rows = await r.json() as { path: string; content: string }[];
  mkdirSync(dataDir, { recursive: true });
  let n = 0;
  for (const row of rows) {
    if (!tracked(row.path) || typeof row.content !== 'string') continue;
    const file = join(dataDir, row.path), tmp = `${file}.restore.tmp`;
    writeFileSync(tmp, row.content, { mode: 0o600 }); renameSync(tmp, file); n++;
  }
  return n;
}

/** Sube los *.json que cambian (por contenido) cada `everyMs`. */
export function startCloudSync(dataDir: string, { env = process.env, f = fetch, everyMs = 5000, log = console }: { env?: NodeJS.ProcessEnv; f?: Fetch; everyMs?: number; log?: Pick<Console, 'log' | 'error'> } = {}): CloudSync {
  const cfg = cloudConfig(env);
  if (!cfg) return { enabled: false, flush: async () => {}, stop: () => {} };
  const sent = new Map<string, string>();
  // Lo restaurado ya está en la nube: no se vuelve a subir si no cambia.
  for (const name of list()) sent.set(name, sha(readFileSync(join(dataDir, name), 'utf8')));
  let running: Promise<void> | null = null, failing = false;

  function list() { return existsSync(dataDir) ? readdirSync(dataDir).filter(tracked) : []; }
  async function push() {
    const rows: { path: string; content: string; updated_at: string }[] = [];
    for (const name of list()) {
      let content: string; try { content = readFileSync(join(dataDir, name), 'utf8'); } catch { continue; }
      const h = sha(content);
      if (sent.get(name) !== h) rows.push({ path: name, content, updated_at: new Date().toISOString() });
    }
    if (!rows.length) return;
    const r = await f(`${cfg!.url}/rest/v1/${TABLE}`, { method: 'POST', headers: { ...headers(cfg!.key), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    for (const row of rows) sent.set(row.path, sha(row.content));
    if (failing) { failing = false; log.log('[cloud] sincronización recuperada'); }
  }
  const flush = () => (running ??= push().catch((e: Error) => { if (!failing) log.error(`[cloud] no se pudo guardar en Supabase (se reintenta): ${e.message}`); failing = true; }).finally(() => { running = null; }));
  const timer = setInterval(() => { void flush(); }, everyMs); timer.unref?.();
  return { enabled: true, flush, stop: () => clearInterval(timer) };
}

/** Claves antiguas (JWT «eyJ…»): apikey + Authorization. Claves nuevas (sb_secret_…): solo apikey. */
function headers(key: string): Record<string, string> { return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key }; }
