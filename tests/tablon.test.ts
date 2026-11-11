// Tablón (/api/tablon): quién puede abrir peticiones, validación, límites, apoyos, privacidad del autor y gestión del profesor.
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountStore, hasBadWords } from '../server/accounts.ts';
import { cleanText, createTablon, TABLON_LIMITS, TablonStore } from '../server/tablon.ts';

const dirs: string[] = [], servers: Server[] = [];
// Escribe lo pendiente antes de borrar la carpeta temporal (si no, el guardado diferido escribe en una carpeta ya borrada).
const flushes: (() => void)[] = [];
afterEach(async () => { for (const f of flushes.splice(0)) f(); for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); } for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const PW = 'zorro-azul-mesa-72-lluvia';

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'tablon-')); dirs.push(dir);
  const accounts = new AccountStore(dir), store = new TablonStore(dir);
  const active = new Set<string>(); let teacher = false; let clock = 1_800_000_000_000;
  const handler = createTablon({ accounts, store, hasActivity: (id) => active.has(id), teacherOk: () => teacher, now: () => clock });
  const server = createServer((req, res) => { if (!handler(req, res)) { res.writeHead(404); res.end(); } }); servers.push(server);
  flushes.push(() => handler.flush());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, input?: unknown, token?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Student-Session': token } : {}), ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };
  const user = async (alias: string, act = true) => { const r = await accounts.register(alias, PW); if (!r.ok) throw new Error(r.error); if (act) active.add(r.account.id); return { token: r.token, id: r.account.id }; };
  return { call, user, store, dir, accounts, active, setTeacher: (v: boolean) => { teacher = v; }, tick: (ms: number) => { clock += ms; } };
}
const ok = { category: 'contenido', title: 'Más ejercicios de Dativ', body: 'Me gustaría tener más ejercicios de Dativ con preposiciones.' };

describe('Tablón', () => {
  it('cualquiera puede leerlo; sin cuenta no se publica ni se apoya', async () => {
    const s = await setup();
    const r = await s.call('/api/tablon');
    expect(r.status).toBe(200); expect(r.body.tickets).toEqual([]); expect(r.body.me).toBeNull();
    expect((await s.call('/api/tablon/ticket', ok)).status).toBe(401);
    expect((await s.call('/api/tablon/vote', { id: 'x' })).status).toBe(401);
  });

  it('una cuenta sin actividad no puede abrir peticiones, y se le explica por qué', async () => {
    const s = await setup(); const nueva = await s.user('Nina_Neu', false);
    const me = (await s.call('/api/tablon', undefined, nueva.token)).body.me;
    expect(me).toMatchObject({ active: false, canPost: false, canVote: false });
    expect(me.reason).toMatch(/al menos una actividad/);
    const r = await s.call('/api/tablon/ticket', ok, nueva.token);
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/al menos una actividad/);
    // En cuanto el servidor registra una actividad, ya puede.
    s.active.add(nueva.id);
    expect((await s.call('/api/tablon/ticket', ok, nueva.token)).status).toBe(200);
  });

  it('con actividad: abre un ticket; los demás lo ven sin el alias del autor', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box');
    const r = await s.call('/api/tablon/ticket', ok, ana.token);
    expect(r.status).toBe(200); expect(r.body.ticket).toMatchObject({ n: 1, status: 'abierto', mine: true, votes: 0, title: ok.title });
    const pub = await s.call('/api/tablon');
    expect(pub.body.tickets).toHaveLength(1);
    expect(JSON.stringify(pub.body)).not.toContain('Ana_Lee'); expect(JSON.stringify(pub.body)).not.toContain(ana.id);
    const asBen = await s.call('/api/tablon', undefined, ben.token);
    expect(asBen.body.tickets[0].mine).toBe(false);
    // Persistencia en disco
    s.store.flush(); expect(JSON.parse(readFileSync(join(s.dir, 'tablon.json'), 'utf8')).tickets[0].title).toBe(ok.title);
  });

  it('valida y limpia: tipo, longitudes, enlaces, palabras malsonantes y duplicados', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    expect((await s.call('/api/tablon/ticket', { ...ok, category: 'hack' }, ana.token)).status).toBe(400);
    expect((await s.call('/api/tablon/ticket', { ...ok, title: 'hey' }, ana.token)).status).toBe(400);
    expect((await s.call('/api/tablon/ticket', { ...ok, body: 'corto' }, ana.token)).status).toBe(400);
    expect((await s.call('/api/tablon/ticket', { ...ok, body: 'Mira esto en https://example.com por favor' }, ana.token)).status).toBe(400);
    expect((await s.call('/api/tablon/ticket', { ...ok, body: 'Esto es una mierda, cambiadlo ya' }, ana.token)).status).toBe(400);
    const r = await s.call('/api/tablon/ticket', { ...ok, title: '  Más   ejercicios\u0000 de Dativ  ' }, ana.token);
    expect(r.status).toBe(200); expect(r.body.ticket.title).toBe('Más ejercicios de Dativ');
    expect((await s.call('/api/tablon/ticket', ok, ana.token)).status).toBe(409);
    expect((await s.call('/api/tablon/ticket', ok, ana.token, { Origin: 'https://evil.example' })).status).toBe(400);
  });

  it('límite: 3 peticiones abiertas por cuenta y 3 al día', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    for (let i = 0; i < 3; i++) expect((await s.call('/api/tablon/ticket', { ...ok, title: `Petición número ${i}` }, ana.token)).status).toBe(200);
    const r = await s.call('/api/tablon/ticket', { ...ok, title: 'Petición número 4' }, ana.token);
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/3 peticiones abiertas/);
    // Retirar una abierta libera hueco, pero el límite diario sigue.
    const mine = (await s.call('/api/tablon', undefined, ana.token)).body.tickets;
    expect((await s.call('/api/tablon/withdraw', { id: mine[0].id }, ana.token)).status).toBe(200);
    expect((await s.call('/api/tablon/ticket', { ...ok, title: 'Petición número 5' }, ana.token)).body.error).toMatch(/24 horas/);
    s.tick(25 * 3600_000);
    expect((await s.call('/api/tablon/ticket', { ...ok, title: 'Petición número 5' }, ana.token)).status).toBe(200);
  });

  it('apoyos: uno por cuenta, se puede retirar, no a la propia y solo con actividad', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box'), cleo = await s.user('Cleo_Cat', false);
    const id = (await s.call('/api/tablon/ticket', ok, ana.token)).body.ticket.id;
    expect((await s.call('/api/tablon/vote', { id }, ana.token)).status).toBe(400);
    expect((await s.call('/api/tablon/vote', { id }, cleo.token)).status).toBe(403);
    const v = await s.call('/api/tablon/vote', { id }, ben.token);
    expect(v.body.ticket).toMatchObject({ votes: 1, voted: true });
    expect((await s.call('/api/tablon/vote', { id }, ben.token)).body.ticket).toMatchObject({ votes: 0, voted: false });
  });

  it('solo el autor retira, y solo si sigue abierta', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box');
    const id = (await s.call('/api/tablon/ticket', ok, ana.token)).body.ticket.id;
    expect((await s.call('/api/tablon/withdraw', { id }, ben.token)).status).toBe(404);
    s.setTeacher(true); await s.call('/api/tablon/admin/update', { id, status: 'en-curso' });
    expect((await s.call('/api/tablon/withdraw', { id }, ana.token)).status).toBe(409);
  });

  it('profesor: ve el alias, cambia el estado y responde; los descartados solo los ve su autor', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box');
    const id = (await s.call('/api/tablon/ticket', ok, ana.token)).body.ticket.id;
    expect((await s.call('/api/tablon/admin')).status).toBe(401);
    expect((await s.call('/api/tablon/admin/update', { id, status: 'hecho' })).status).toBe(401);
    s.setTeacher(true);
    expect((await s.call('/api/tablon/admin')).body.tickets[0].alias).toBe('Ana_Lee');
    expect((await s.call('/api/tablon/admin/update', { id, status: 'cerrado' })).status).toBe(400);
    const u = await s.call('/api/tablon/admin/update', { id, status: 'hecho', reply: 'Añadidos 10 ejercicios nuevos en la clase de Dativ.' });
    expect(u.body.ticket).toMatchObject({ status: 'hecho', reply: 'Añadidos 10 ejercicios nuevos en la clase de Dativ.' });
    expect((await s.call('/api/tablon')).body.tickets[0]).toMatchObject({ status: 'hecho', reply: expect.stringContaining('Dativ') });
    await s.call('/api/tablon/admin/update', { id, status: 'descartado' });
    expect((await s.call('/api/tablon', undefined, ben.token)).body.tickets).toHaveLength(0);
    expect((await s.call('/api/tablon', undefined, ana.token)).body.tickets).toHaveLength(1);
  });

  it('profesor: quita un ticket del tablón (desaparece para todos); un alumno no puede', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    const id = (await s.call('/api/tablon/ticket', ok, ana.token)).body.ticket.id;
    expect((await s.call('/api/tablon/admin/delete', { id }, ana.token)).status).toBe(401);
    s.setTeacher(true);
    expect((await s.call('/api/tablon/admin/delete', { id: 'tk_nada' })).status).toBe(404);
    expect((await s.call('/api/tablon/admin/delete', { id })).body).toEqual({ ok: true });
    expect((await s.call('/api/tablon')).body.tickets).toEqual([]);
    expect((await s.call('/api/tablon', undefined, ana.token)).body.tickets).toEqual([]);
    expect((await s.call('/api/tablon/admin')).body.tickets).toEqual([]);
  });

  it('al borrar una cuenta desaparecen sus peticiones y sus apoyos', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee'), ben = await s.user('Ben_Box');
    const id = (await s.call('/api/tablon/ticket', ok, ana.token)).body.ticket.id;
    await s.call('/api/tablon/ticket', { ...ok, title: 'Otra petición de Ben' }, ben.token);
    await s.call('/api/tablon/vote', { id }, ben.token);
    s.store.forget(ben.id);
    const t = (await s.call('/api/tablon')).body.tickets;
    expect(t).toHaveLength(1); expect(t[0].votes).toBe(0);
  });

  it('cuerpo acotado y JSON obligatorio', async () => {
    const s = await setup(); const ana = await s.user('Ana_Lee');
    expect((await s.call('/api/tablon/ticket', { ...ok, body: 'x'.repeat(5000) }, ana.token)).status).toBe(413);
    expect(TABLON_LIMITS.bodyMax).toBeLessThan(4096);
  });
});

describe('filtros de texto', () => {
  it('hasBadWords: palabras exactas o raíces largas, sin falsos positivos comunes', () => {
    expect(hasBadWords('Esto es una mierda')).toBe(true);
    expect(hasBadWords('FUCK this')).toBe(true);
    expect(hasBadWords('Sechs Aufgaben más, por favor')).toBe(false);
    expect(hasBadWords('el sexto ejercicio está mal')).toBe(false);
    expect(hasBadWords('Quiero más práctica de Perfekt')).toBe(false);
  });
  it('cleanText quita controles y colapsa espacios', () => {
    expect(cleanText(' a\u0000\u200Bb   c ', 10)).toBe('ab c');
    expect(cleanText('l1\r\n\r\n\r\n\r\nl2', 50, true)).toBe('l1\n\nl2');
    expect(cleanText(42, 10)).toBe('');
  });
});
