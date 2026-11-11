// Progreso del curso por cuenta. Antes vivía solo en localStorage (una clave para todo el navegador): en un ordenador
// compartido todos los alumnos veían el mismo porcentaje del curso. Ahora el servidor lo guarda por cuenta.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../server/accounts.ts';
import { CourseProgressStore, createCourseProgress } from '../server/course-progress.ts';
import { ALL_STEP_IDS, overallProgress } from '../src/course.ts';

const dirs: string[] = [], servers: Server[] = [], flushes: (() => void)[] = [];
afterEach(async () => { for (const f of flushes.splice(0)) f(); for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const PW = 'zorro-azul-mesa-72-lluvia';

async function setup(dir = mkdtempSync(join(tmpdir(), 'cprog-'))) {
  dirs.push(dir);
  const accounts = new AccountStore(dir), store = new CourseProgressStore(dir);
  const h = createCourseProgress({ accounts, store, now: () => 1 });
  const server = createServer((req, res) => { if (!h(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server); flushes.push(() => h.flush());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (input?: unknown, token?: string) => {
    const r = await fetch(base + '/api/course/progress', { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Student-Session': token } : {}) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  const user = async (alias: string) => { const r = await accounts.register(alias, PW); if (!r.ok) throw new Error(r.error); return r.token; };
  return { call, user, h, dir };
}

describe('progreso del curso por cuenta', () => {
  it('cada alumno tiene su propio porcentaje (antes era el mismo para todos en un navegador)', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box');
    const [a, b, c] = ALL_STEP_IDS;
    await s.call({ id: a, on: true }, ana); await s.call({ id: b, on: true }, ana);
    await s.call({ id: c, on: true }, ben);
    const pa = (await s.call(undefined, ana)).body.done, pb = (await s.call(undefined, ben)).body.done;
    expect(pa).toEqual([a, b]); expect(pb).toEqual([c]);
    expect(overallProgress(new Set(pa)).done).toBe(2); expect(overallProgress(new Set(pb)).done).toBe(1);
  });
  it('desmarcar, fusionar lo del dispositivo e ignorar pasos inventados', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    const [a, b] = ALL_STEP_IDS;
    await s.call({ id: a, on: true }, ana);
    expect((await s.call({ done: [b, 'hack:step', 42] }, ana)).body.done).toEqual([a, b]);
    expect((await s.call({ id: a, on: false }, ana)).body.done).toEqual([b]);
    expect((await s.call({ id: 'no-existe', on: true }, ana)).body.done).toEqual([b]);
  });
  it('sin cuenta: 401 (se queda en el navegador); y se conserva tras reiniciar el servidor', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    expect((await s.call()).status).toBe(401);
    expect((await s.call({ id: ALL_STEP_IDS[0], on: true })).status).toBe(401);
    await s.call({ id: ALL_STEP_IDS[3], on: true }, ana); s.h.flush();
    const again = new CourseProgressStore(s.dir);
    const id = Object.keys(again.data.accounts)[0];
    expect(again.get(id)).toEqual([ALL_STEP_IDS[3]]);
  });
});
