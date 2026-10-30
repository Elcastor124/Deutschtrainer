// Cuentas de alumno: seguridad de credenciales, separación de la identidad del profesor y ranking opcional con alias.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore, validateAlias, validatePassword } from '../server/accounts.ts';
import { createPlayApi } from '../server/play-api.ts';
import { ProgressLog } from '../server/progress.ts';
import { createGuard } from '../server/security.ts';
import { TeacherDirectory } from '../server/teacher-auth.ts';
import { loadBank } from '../server/bank/index.ts';

const dirs: string[] = [], servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'bc-acc-')); dirs.push(d); return d; };
const PW = 'correct-horse-battery';

describe('validación', () => {
  it('alias: longitud, caracteres, reservados, ofensivos, teléfonos y webs', () => {
    for (const ok of ['Ana', 'Ana_Lee', 'lola.99', 'Ünal-3', '张伟伟']) expect(validateAlias(ok), ok).toBeNull();
    for (const bad of ['ab', 'a'.repeat(17), 'con espacio', 'a@b.com', '<b>x</b>', 'admin', 'Profesor', 'Lehrer', 'K_l_a_u_s', 'puta99', 'Hitler1', '1234567890', 'foto.com', '', undefined, 42, null]) expect(validateAlias(bad as any), String(bad)).not.toBeNull();
  });
  it('contraseña: mínimo 10, sin ser el alias ni triviales', () => {
    expect(validatePassword(PW, 'Ana')).toBeNull();
    for (const bad of ['corta', 'aaaaaaaaaaaa', 'password1234', 'ana-ana-ana-ana', '1234567890abc', 'x'.repeat(200), undefined, 7]) expect(validatePassword(bad as any, 'Ana'), String(bad)).not.toBeNull();
  });
});

describe('AccountStore', () => {
  it('guarda un hash scrypt salado (modo 0600), nunca la contraseña ni el token en claro', async () => {
    const dir = tmp(); const store = new AccountStore(dir);
    const r = await store.register('Ana_Lee', PW);
    if (!r.ok) throw new Error(r.error);
    const raw = readFileSync(join(dir, 'accounts.json'), 'utf8');
    expect(raw).not.toContain(PW); expect(raw).not.toContain(r.token); expect(raw).not.toContain(r.token.slice(4));
    expect(statSync(join(dir, 'accounts.json')).mode & 0o777).toBe(0o600);
    expect(r.token).toMatch(/^dts_[A-Za-z0-9_-]{43}$/);
    expect(r.account.id).toMatch(/^acc_[0-9a-f]{32}$/);
  });
  it('login correcto/incorrecto con el mismo mensaje (no revela qué alias existen); alias único sin distinguir mayúsculas', async () => {
    const store = new AccountStore(tmp());
    await store.register('Ana_Lee', PW);
    const a = await store.login('ana_lee', PW), b = await store.login('ana_lee', 'otra-contraseña'), c = await store.login('NoExiste', PW);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, status: 401, error: 'Alias o contraseña incorrectos.' });
    expect(c).toEqual(b);
    expect(await store.register('ANA_LEE', PW)).toMatchObject({ ok: false, status: 409 });
  });
  it('las sesiones caducan (30 días), se pueden cerrar y no valen tokens de profesor ni inventados', async () => {
    let t = 1_000_000; const store = new AccountStore(tmp(), () => t);
    const r = await store.register('Ana_Lee', PW); if (!r.ok) throw new Error();
    expect(store.verify(r.token)?.alias).toBe('Ana_Lee');
    for (const bad of [undefined, '', 'x', `dtk_${'a'.repeat(12)}.${'A'.repeat(43)}`, `dts_${'A'.repeat(43)}`, 42]) expect(store.verify(bad as any)).toBeNull();
    t += 31 * 86_400_000; expect(store.verify(r.token)).toBeNull();
    const l = await store.login('Ana_Lee', PW); if (!l.ok) throw new Error();
    store.logout(l.token); expect(store.verify(l.token)).toBeNull();
  });
  it('máximo 5 sesiones simultáneas (la más antigua se cierra)', async () => {
    const store = new AccountStore(tmp());
    const first = await store.register('Ana_Lee', PW); if (!first.ok) throw new Error();
    const toks = [first.token]; for (let i = 0; i < 5; i++) { const l = await store.login('Ana_Lee', PW); if (l.ok) toks.push(l.token); }
    expect(store.verify(toks[0])).toBeNull(); expect(store.verify(toks[5])).not.toBeNull();
  });
  it('persiste y sobrevive a un reinicio; un accounts.json corrupto no tumba el servidor', async () => {
    const dir = tmp(); const a = new AccountStore(dir);
    const r = await a.register('Ana_Lee', PW); if (!r.ok) throw new Error();
    const b = new AccountStore(dir);
    expect(b.verify(r.token)?.alias).toBe('Ana_Lee'); expect((await b.login('Ana_Lee', PW)).ok).toBe(true);
    const bad = tmp(); (await import('node:fs')).writeFileSync(join(bad, 'accounts.json'), '{roto');
    expect(new AccountStore(bad).count).toBe(0);
  });
});

async function api(env: Record<string, string> = {}, dir = tmp()) {
  const guard = createGuard({ dataDir: dir, env: env as NodeJS.ProcessEnv });
  const accounts = new AccountStore(dir); const log = new ProgressLog();
  const handler = createPlayApi({ accounts, guard, log: () => log, bank: loadBank() });
  const removed: string[] = []; handler.setOnRemoved((id) => removed.push(id));
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, input?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Student-Session': token } : {}), ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: res.status, body: await res.json() as any };
  };
  const reg = async (alias: string, extra: Record<string, unknown> = {}) => (await call('/api/account/register', { alias, password: PW, ...extra })).body;
  return { call, reg, accounts, log, guard, removed, dir };
}

describe('API de cuentas', () => {
  it('registro, sesión, /me y cierre de sesión; sin cabecera no hay acceso', async () => {
    const s = await api();
    const r = await s.reg('Ana_Lee');
    expect(r.account).toEqual({ alias: 'Ana_Lee', rankingOptIn: false }); // el ranking es OPCIONAL: apagado por defecto
    expect(JSON.stringify(r)).not.toMatch(/acc_|hash|salt/);        // el id interno nunca sale
    expect((await s.call('/api/account/me', undefined, r.token)).body.account.alias).toBe('Ana_Lee');
    expect((await s.call('/api/account/me')).status).toBe(401);
    expect((await s.call('/api/account/me', undefined, 'dts_falso')).status).toBe(401);
    await s.call('/api/account/logout', {}, r.token);
    expect((await s.call('/api/account/me', undefined, r.token)).status).toBe(401);
  });
  it('la identidad de alumno y la de profesor están separadas: una clave de profesor no abre cuentas y al revés', async () => {
    const dir = tmp(); const { key } = new TeacherDirectory(dir).issue('Marta');
    const s = await api({}, dir);
    expect((await s.call('/api/account/me', undefined, key)).status).toBe(401);          // clave de profesor como sesión de alumno
    expect((await s.call('/api/account/progress', undefined, undefined, { 'X-Teacher-Key': key })).status).toBe(401); // cabecera de profesor: ignorada
    const r = await s.reg('Ana_Lee');
    expect(new TeacherDirectory(dir).verify(r.token)).toBeNull();                          // sesión de alumno como clave de profesor
    expect(s.guard.teacherFor(r.token, '1.1.1.1')).toMatchObject({ ok: false });
  });
  it('fuerza bruta: bloqueo por cuenta y por IP tras varios fallos, sin impedir a otras cuentas', async () => {
    const s = await api({ LOGIN_FAILS_PER_ALIAS: '3', LOGIN_FAILS_PER_IP: '100' });
    await s.reg('Ana_Lee'); await s.reg('Ben_Box');
    for (let i = 0; i < 3; i++) expect((await s.call('/api/account/login', { alias: 'Ana_Lee', password: `mala-${i}-mala-mala` })).status).toBe(401);
    const locked = await s.call('/api/account/login', { alias: 'Ana_Lee', password: PW });
    expect(locked.status).toBe(429); expect(locked.body.error).toMatch(/bloqueada/);       // ni la contraseña correcta entra mientras dure el bloqueo
    expect((await s.call('/api/account/login', { alias: 'Ben_Box', password: PW })).status).toBe(200);
    const ip = await api({ LOGIN_FAILS_PER_IP: '4', LOGIN_FAILS_PER_ALIAS: '100' });
    for (let i = 0; i < 4; i++) await ip.call('/api/account/login', { alias: `Nadie${i}`, password: 'xxxxxxxxxxxx' });
    expect((await ip.call('/api/account/login', { alias: 'Nadie9', password: 'xxxxxxxxxxxx' })).status).toBe(429);
  });
  it('registros limitados por IP', async () => {
    const s = await api({ REGISTER_PER_IP_HOUR: '2' });
    expect((await s.call('/api/account/register', { alias: 'Uno_1', password: PW })).status).toBe(200);
    expect((await s.call('/api/account/register', { alias: 'Dos_2', password: PW })).status).toBe(200);
    expect((await s.call('/api/account/register', { alias: 'Tres_3', password: PW })).status).toBe(429);
  });
  it('rechaza alias o contraseñas no válidos y cuerpos enormes o mal formados', async () => {
    const s = await api();
    expect((await s.call('/api/account/register', { alias: 'admin', password: PW })).status).toBe(400);
    expect((await s.call('/api/account/register', { alias: 'Ana_Lee', password: 'corta' })).status).toBe(400);
    expect((await s.call('/api/account/register', { alias: 'x'.repeat(5000), password: PW })).status).toBe(413);
    const bad = await fetch(`${(servers[0].address() as any) && `http://127.0.0.1:${(servers[0].address() as any).port}`}/api/account/register`, { method: 'POST', body: '{no json' });
    expect(bad.status).toBe(400);
    expect((await s.call('/api/account/register', { alias: 'Ana_Lee', password: PW })).status).toBe(200);
    expect((await s.call('/api/account/register', { alias: 'ana_lee', password: PW })).status).toBe(409);
  });
});

describe('ranking semanal opcional con alias autorizado', () => {
  const rec = (log: ProgressLog, id: string, n: number) => { for (let i = 0; i < n; i++) log.record({ profile: id, kind: 'answer', source: 'practice', qid: `q${i}`, topic: 'dativ', ok: true }); };
  it('solo salen las cuentas que lo activaron y con alias aprobado; sin nombres reales, ids, horarios ni estadísticas', async () => {
    const s = await api();
    const a = await s.reg('Ana_Lee', { rankingOptIn: true }); await s.reg('Ben_Box'); await s.reg('Cleo_C', { rankingOptIn: true });
    const id = (alias: string) => s.accounts.byId([...(s.accounts as any).accounts].find((x: any) => x.alias === alias).id)!.id;
    rec(s.log, id('Ana_Lee'), 5); rec(s.log, id('Ben_Box'), 9); rec(s.log, id('Cleo_C'), 3);
    rec(s.log, 'device-profile-1', 20); // un perfil de dispositivo antiguo tampoco entra en este ranking
    let lb = (await s.call('/api/play/leaderboard')).body;
    expect(lb.entries.map((e: any) => e.alias)).toEqual(['Ana_Lee', 'Cleo_C']);       // Ben no lo activó
    expect(lb.entries.every((e: any) => Object.keys(e).sort().join() === 'alias,points,rank')).toBe(true);
    expect(JSON.stringify(lb)).not.toMatch(/acc_|"at"|streak|accuracy|topic/);
    // moderación: un alias bloqueado desaparece del ranking
    s.accounts.setAliasStatus('Cleo_C', 'blocked');
    lb = (await s.call('/api/play/leaderboard')).body; expect(lb.entries.map((e: any) => e.alias)).toEqual(['Ana_Lee']);
    // el alumno puede activarlo/desactivarlo cuando quiera
    await s.call('/api/account/settings', { rankingOptIn: false }, a.token);
    lb = (await s.call('/api/play/leaderboard')).body; expect(lb.entries).toEqual([]);
    expect((await s.call('/api/account/settings', { rankingOptIn: 'si' }, a.token)).status).toBe(400);
  });
  it('el progreso privado exige sesión y solo devuelve el de la propia cuenta', async () => {
    const s = await api();
    const a = await s.reg('Ana_Lee'), b = await s.reg('Ben_Box');
    const aid = [...(s.accounts as any).accounts].find((x: any) => x.alias === 'Ana_Lee').id;
    rec(s.log, aid, 4);
    expect((await s.call('/api/account/progress')).status).toBe(401);
    const mine = (await s.call('/api/account/progress', undefined, a.token)).body;
    const theirs = (await s.call('/api/account/progress', undefined, b.token)).body;
    expect(mine.weekPoints).toBeGreaterThan(0); expect(theirs.weekPoints).toBe(0);
    expect(mine.rank).toBeNull();                      // sin ranking activado no se publica posición
    expect(theirs.advice[0]).toMatch(/primera actividad/);
  });
  it('baja de la cuenta: pide contraseña, borra cuenta e historial y libera el alias', async () => {
    const s = await api();
    const a = await s.reg('Ana_Lee');
    const aid = [...(s.accounts as any).accounts].find((x: any) => x.alias === 'Ana_Lee').id;
    rec(s.log, aid, 3);
    expect((await s.call('/api/account/delete', { password: 'mala-contraseña-x' }, a.token)).status).toBe(401);
    expect((await s.call('/api/account/delete', { password: PW }, a.token)).status).toBe(200);
    expect(s.removed).toEqual([aid]);
    expect(s.log.events.filter((e) => e.profile === aid)).toHaveLength(0);
    expect((await s.call('/api/account/me', undefined, a.token)).status).toBe(401);
    expect((await s.call('/api/account/register', { alias: 'Ana_Lee', password: PW })).status).toBe(200);
  });
  it('cambiar contraseña: exige la actual, valida la nueva y cierra las demás sesiones', async () => {
    const s = await api();
    const a = await s.reg('Ana_Lee');
    const other = (await s.call('/api/account/login', { alias: 'Ana_Lee', password: PW })).body.token;
    expect((await s.call('/api/account/password', { current: 'no-es-esta-xx', next: 'otra-clave-larga-1' }, a.token)).status).toBe(401);
    expect((await s.call('/api/account/password', { current: PW, next: 'corta' }, a.token)).status).toBe(400);
    expect((await s.call('/api/account/password', { current: PW, next: PW }, a.token)).status).toBe(400);
    expect((await s.call('/api/account/password', { current: PW, next: 'otra-clave-larga-1' })).status).toBe(401);
    expect((await s.call('/api/account/password', { current: PW, next: 'otra-clave-larga-1' }, a.token)).status).toBe(200);
    expect((await s.call('/api/account/me', undefined, a.token)).status).toBe(200);      // esta sesión sigue
    expect((await s.call('/api/account/me', undefined, other)).status).toBe(401);        // las demás se cierran
    expect((await s.call('/api/account/login', { alias: 'Ana_Lee', password: PW })).status).toBe(401);
    expect((await s.call('/api/account/login', { alias: 'Ana_Lee', password: 'otra-clave-larga-1' })).status).toBe(200);
  });
  it('ranking por semanas: esta y la pasada, límite, «yo» con sesión, y nunca datos de quien no lo activó', async () => {
    let t = Date.parse('2026-10-30T12:00:00Z');
    const dir = tmp(); const guard = createGuard({ dataDir: dir, env: {} as NodeJS.ProcessEnv });
    const accounts = new AccountStore(dir); const log = new ProgressLog({ now: () => t });
    const handler = createPlayApi({ accounts, guard, log: () => log, bank: loadBank() });
    const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const get = async (q: string, token?: string) => (await fetch(`${base}/api/play/leaderboard${q}`, { headers: token ? { 'X-Student-Session': token } : {} })).json() as Promise<any>;
    const reg = async (alias: string, opt: boolean) => { const r = await accounts.register(alias, PW, opt); if (!r.ok) throw new Error(); return r; };
    const ana = await reg('Ana_Lee', true), ben = await reg('Ben_Box', true), hid = await reg('Oculto_1', false);
    const pts = (id: string, n: number) => log.record({ profile: id, kind: 'game', source: 'practice', points: n });
    t -= 7 * 86_400_000; pts(ben.account.id, 40); t += 7 * 86_400_000;   // semana pasada: Ben
    pts(ana.account.id, 30); pts(ben.account.id, 20); pts(hid.account.id, 50);  // esta semana
    const cur = await get('?week=current');
    expect(cur).toMatchObject({ which: 'current', week: '2026-W44', range: { from: '2026-10-26', to: '2026-11-01' }, players: 2, resetsAt: Date.parse('2026-11-01T23:00:00Z') });
    expect(cur.entries).toEqual([{ rank: 1, alias: 'Ana_Lee', points: 30 }, { rank: 2, alias: 'Ben_Box', points: 20 }]);
    expect(cur.me).toBeUndefined();
    expect(JSON.stringify(cur)).not.toMatch(/Oculto|acc_/);
    const prev = await get('?week=previous');
    expect(prev).toMatchObject({ which: 'previous', week: '2026-W43', players: 1, entries: [{ rank: 1, alias: 'Ben_Box', points: 40 }] });
    expect((await get('?limit=1')).entries).toHaveLength(1);
    expect((await get('?limit=9999')).entries.length).toBeLessThanOrEqual(50);
    expect((await get('', ana.token)).me).toEqual({ alias: 'Ana_Lee', points: 30, rank: 1, optedIn: true });
    expect((await get('', hid.token)).me).toEqual({ alias: 'Oculto_1', points: 50, rank: null, optedIn: false }); // sus puntos solo los ve él
  });
  it('el catálogo es público e informa de niveles, temas y de que Deutsch Deck aún no existe', async () => {
    const s = await api();
    const c = (await s.call('/api/play/catalog')).body;
    expect(c.levels.map((l: any) => l.id)).toEqual(['A1', 'A2', 'B1']);
    expect(c.games.find((g: any) => g.id === 'deck')).toMatchObject({ available: false });
    expect(c.games.find((g: any) => g.id === 'boxing')).toMatchObject({ modes: ['solo', 'private'], levels: ['A2'] });
    expect(c.topics.find((t: any) => t.id === 'dativ').pool.A1).toBeGreaterThan(0);
  });
});
