// Copia en Supabase: restaura antes de arrancar, sube solo lo que cambia y no hace nada sin configuración.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { restoreFromCloud, startCloudSync } from '../server/cloud-sync.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'dt-cloud-')); dirs.push(d); return d; };
const env = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' } as NodeJS.ProcessEnv;

/** Supabase falso: una tabla en memoria con la misma API REST que usamos. */
function fakeSupabase() {
  const table = new Map<string, string>(); const calls: { method: string; url: string; headers: Record<string, string> }[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>; calls.push({ method: init.method ?? 'GET', url, headers });
    if (headers.apikey !== 'sb_secret_test') return new Response('unauthorized', { status: 401 });
    if ((init.method ?? 'GET') === 'GET') return Response.json([...table].map(([path, content]) => ({ path, content })));
    for (const row of JSON.parse(String(init.body)) as { path: string; content: string }[]) table.set(row.path, row.content);
    return new Response(null, { status: 201 });
  }) as typeof fetch;
  return { table, calls, f };
}

describe('cloud-sync (Supabase)', () => {
  it('sin variables de entorno no hace nada', async () => {
    const d = tmp();
    expect(await restoreFromCloud(d, {} as NodeJS.ProcessEnv)).toBe(0);
    expect(startCloudSync(d, { env: {} as NodeJS.ProcessEnv }).enabled).toBe(false);
  });
  it('restaura los .json guardados y descarta rutas raras', async () => {
    const s = fakeSupabase(); s.table.set('accounts.json', '{"version":1,"accounts":[]}'); s.table.set('../evil.json', 'x'); s.table.set('.server.lock', 'x');
    const d = tmp();
    expect(await restoreFromCloud(d, env, s.f)).toBe(1);
    expect(readFileSync(join(d, 'accounts.json'), 'utf8')).toBe('{"version":1,"accounts":[]}');
    expect(s.calls[0].url).toBe('https://x.supabase.co/rest/v1/dt_files?select=path,content');
    expect(s.calls[0].headers.Authorization).toBeUndefined(); // clave nueva: solo apikey
  });
  it('sube solo los ficheros cambiados, nunca temporales ni el candado', async () => {
    const s = fakeSupabase(); const d = tmp();
    writeFileSync(join(d, 'accounts.json'), 'A1'); writeFileSync(join(d, 'x.json.123.tmp'), 'T'); writeFileSync(join(d, '.server.lock'), 'L');
    const sync = startCloudSync(d, { env, f: s.f, everyMs: 60_000, log: { log() {}, error() {} } });
    await sync.flush();
    expect([...s.table.keys()]).toEqual([]); // ya existía al arrancar (= restaurado): no se resube
    writeFileSync(join(d, 'accounts.json'), 'A2'); writeFileSync(join(d, 'teacher-data.json'), 'T1');
    await sync.flush();
    expect(Object.fromEntries(s.table)).toEqual({ 'accounts.json': 'A2', 'teacher-data.json': 'T1' });
    const posts = s.calls.filter((c) => c.method === 'POST').length;
    await sync.flush(); expect(s.calls.filter((c) => c.method === 'POST').length).toBe(posts); // sin cambios, sin subida
    sync.stop();
  });
  it('si Supabase falla, reintenta en la siguiente vuelta sin perder el cambio', async () => {
    const s = fakeSupabase(); const d = tmp(); let down = true;
    const f = (async (u: string, i?: RequestInit) => (down ? new Response('boom', { status: 503 }) : s.f(u, i))) as typeof fetch;
    const errors: string[] = [];
    const sync = startCloudSync(d, { env, f, everyMs: 60_000, log: { log() {}, error: (m: string) => errors.push(m) } });
    writeFileSync(join(d, 'accounts.json'), 'A1');
    await sync.flush(); expect(errors.length).toBe(1); expect(s.table.size).toBe(0);
    down = false; await sync.flush(); expect(s.table.get('accounts.json')).toBe('A1');
    sync.stop();
  });
});
