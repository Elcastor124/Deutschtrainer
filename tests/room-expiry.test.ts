// Road y Boxeo: expiración por inactividad sin interrumpir partidas activas, y límites HTTP.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRoadHandler } from '../server/road.ts';
import { createBoxingHandler } from '../server/boxing.ts';
import { createGuard } from '../server/security.ts';
import { TeacherDirectory } from '../server/teacher-auth.ts';

const H = 3_600_000;
const servers: Server[] = [], dirs: string[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function serve(kind: 'road' | 'boxing', env: Record<string, string> = {}, dataDir?: string) {
  const dir = dataDir ?? mkdtempSync(join(tmpdir(), `bc-exp-${kind}-`)); if (!dataDir) dirs.push(dir);
  let time = 10 * H;
  const guard = createGuard({ dataDir: dir, env: env as NodeJS.ProcessEnv });
  const make = () => (kind === 'road' ? createRoadHandler({ dataDir: dir, now: () => time, guard }) : createBoxingHandler({ dataDir: dir, now: () => time, guard }));
  let handler = make();
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/${kind}/`;
  const request = async (path: string, input?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: res.status, body: await res.json() as any };
  };
  const create = (headers?: Record<string, string>) => request('create', kind === 'road' ? { levelId: 'level-1' } : {}, undefined, headers);
  const state = (code: string, token: string) => request(`state?code=${code}`, undefined, token);
  return { request, create, state, sweep: () => handler.sweep(time), advance: (ms: number) => { time += ms; }, restart: () => { handler = make(); }, dir, guard };
}

for (const kind of ['road', 'boxing'] as const) {
  describe(`${kind}: expiración por inactividad`, () => {
    it('elimina la sala tras 24 h sin actividad y la deja de servir (404)', async () => {
      const s = await serve(kind);
      const t = (await s.create()).body;
      s.advance(23 * H);
      expect(s.sweep()).toBe(0);
      expect((await s.state(t.code, t.token)).status).toBe(200); // sigue viva (y esta petición cuenta como actividad)
      s.advance(25 * H);
      expect(s.sweep()).toBe(1);
      expect((await s.state(t.code, t.token)).status).toBe(404);
    });
    it('una partida con tráfico autenticado (incluido el sondeo del proyector/alumno) nunca caduca', async () => {
      const s = await serve(kind);
      const t = (await s.create()).body;
      for (let i = 0; i < 6; i++) { s.advance(20 * H); expect((await s.state(t.code, t.token)).status).toBe(200); expect(s.sweep()).toBe(0); }
    });
    it('peticiones con token inválido NO mantienen viva una sala abandonada', async () => {
      const s = await serve(kind);
      const t = (await s.create()).body;
      for (let i = 0; i < 4; i++) { s.advance(8 * H); expect((await s.state(t.code, 'token-falso-aaaa')).status).toBe(401); }
      expect(s.sweep()).toBe(1);
    });
    it('salas guardadas por una versión anterior (sin marca) reciben un TTL completo de gracia al arrancar, no se borran', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'bc-exp-legacy-')); dirs.push(dir);
      const first = await serve(kind, {}, dir);
      const t = (await first.create()).body;
      const file = join(dir, `${kind}.json`);
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      delete saved.rooms[t.code].lastActive; // como las de antes de esta versión
      writeFileSync(file, JSON.stringify(saved));
      first.restart(); // reinicio del servidor: recarga desde disco
      const s = first;
      expect(s.sweep()).toBe(0);
      s.advance(23 * H); expect(s.sweep()).toBe(0);
      s.advance(2 * H); expect(s.sweep()).toBe(1);
    });
    it('la limpieza persiste: tras expirar y reiniciar, la sala no vuelve', async () => {
      const s = await serve(kind);
      const t = (await s.create()).body;
      s.advance(30 * H); expect(s.sweep()).toBe(1);
      s.restart();
      expect((await s.state(t.code, t.token)).status).toBe(404);
    });
  });

  describe(`${kind}: límites y credenciales de profesor`, () => {
    it('limita la creación por IP (429) y respeta el tope global de salas (503)', async () => {
      const s = await serve(kind, { ROOM_CREATE_PER_HOUR: '2' });
      expect((await s.create()).status).toBe(200);
      expect((await s.create()).status).toBe(200);
      const r = await s.create();
      expect(r.status).toBe(429);
      expect(r.body.error).toMatch(/Espera/);
      const cap = await serve(kind, { MAX_ROAD_ROOMS: '1', MAX_BOXING_ROOMS: '1' });
      expect((await cap.create()).status).toBe(200);
      expect((await cap.create()).status).toBe(503);
    });
    it('TEACHER_AUTH=required: sin clave 401, con clave válida 200; alumnos y salas existentes no se ven afectados', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'bc-exp-auth-')); dirs.push(dir);
      const { key } = new TeacherDirectory(dir).issue('Marta');
      const s = await serve(kind, { TEACHER_AUTH: 'required' }, dir);
      expect((await s.create()).status).toBe(401);
      expect((await s.create({ 'X-Teacher-Key': 'dtk_falsa' })).status).toBe(401);
      const ok = await s.create({ 'X-Teacher-Key': key });
      expect(ok.status).toBe(200);
      const join_ = await s.request('join', { code: ok.body.code, name: 'Ana' });
      expect(join_.status).toBe(200); // el alumno entra sin ninguna credencial
      expect((await s.state(ok.body.code, join_.body.token)).status).toBe(200);
    });
    it('adivinar códigos de sala se frena por IP (429) sin afectar a las salas válidas de otras IP', async () => {
      const s = await serve(kind, { ROOM_MISS_PER_10MIN: '5' });
      const t = (await s.create()).body;
      const bad = kind === 'road' ? 'AAAAAA' : 'ZZZZ';
      for (let i = 0; i < 5; i++) expect((await s.request('join', { code: bad, name: 'x' })).status).toBe(404);
      expect((await s.request('join', { code: bad, name: 'x' })).status).toBe(429);
      expect((await s.request('join', { code: t.code, name: 'real' })).status).toBe(429); // misma IP bloqueada también para la buena
    });
  });
}
