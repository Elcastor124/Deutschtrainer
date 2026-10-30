// Lootbox de Klaus: solo el 1.º de una semana cerrada la recibe (una vez); la skin es de cada cuenta.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../server/accounts.ts';
import { createPlayApi } from '../server/play-api.ts';
import { ProgressLog } from '../server/progress.ts';
import { createGuard } from '../server/security.ts';
import { loadBank } from '../server/bank/index.ts';
import { KLAUS_SKINS, rollSkin } from '../shared/klaus-skins.ts';

const dirs: string[] = [], servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const PW = 'correct-horse-battery';

describe('skins de Klaus', () => {
  it('el catálogo tiene ids únicos y la tirada nunca repite una skin que ya tienes', () => {
    expect(new Set(KLAUS_SKINS.map((s) => s.id)).size).toBe(KLAUS_SKINS.length);
    expect(KLAUS_SKINS.length).toBeGreaterThan(40);
    const owned: string[] = [];
    for (let i = 0; i < KLAUS_SKINS.length - 1; i++) { const s = rollSkin(owned, (i * 0.37) % 1)!; expect(owned).not.toContain(s.id); owned.push(s.id); }
    expect(rollSkin(owned, 0.5)).toBeNull();
  });
  it('ganador semanal: 1 lootbox una vez; abrir, equipar solo lo propio; el resto no se ve afectado', async () => {
    let t = Date.parse('2026-10-30T12:00:00Z');
    const dir = mkdtempSync(join(tmpdir(), 'bc-klaus-')); dirs.push(dir);
    const guard = createGuard({ dataDir: dir, env: {} as NodeJS.ProcessEnv });
    const accounts = new AccountStore(dir); const log = new ProgressLog({ now: () => t });
    const handler = createPlayApi({ accounts, guard, log: () => log, bank: loadBank() });
    const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const call = async (path: string, token: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'X-Student-Session': token, ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json() as any };
    };
    const ana = await accounts.register('Ana_Lee', PW, true), ben = await accounts.register('Ben_Box', PW, true);
    if (!ana.ok || !ben.ok) throw new Error();
    t -= 7 * 86_400_000;
    log.record({ profile: ana.account.id, kind: 'game', source: 'practice', points: 50 });
    log.record({ profile: ben.account.id, kind: 'game', source: 'practice', points: 10 });
    t += 7 * 86_400_000;
    expect((await call('/api/account/klaus', ana.token)).body).toEqual({ owned: ['default'], equipped: 'default', boxes: 1 });
    expect((await call('/api/account/klaus', ana.token)).body.boxes).toBe(1); // no se vuelve a dar
    expect((await call('/api/account/klaus', ben.token)).body.boxes).toBe(0);
    expect((await call('/api/account/klaus/open', ben.token, {})).status).toBe(400);
    const opened = await call('/api/account/klaus/open', ana.token, {});
    expect(opened.status).toBe(200);
    expect(opened.body.boxes).toBe(0);
    expect(opened.body.owned).toContain(opened.body.skin);
    expect((await call('/api/account/klaus/equip', ben.token, { skin: opened.body.skin })).status).toBe(400);
    expect((await call('/api/account/klaus/equip', ana.token, { skin: opened.body.skin })).body.equipped).toBe(opened.body.skin);
    expect((await call('/api/account/klaus', ben.token)).body.equipped).toBe('default');
  });
});
