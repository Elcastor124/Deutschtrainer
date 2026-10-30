// Credenciales de profesor respaldadas por el servidor + política de admisión (Guard).
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeacherDirectory } from '../server/teacher-auth.ts';
import { createGuard } from '../server/security.ts';

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'bc-auth-')); dirs.push(d); return d; };
afterEach(() => { vi.restoreAllMocks(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('TeacherDirectory', () => {
  it('emite una clave aleatoria, guarda solo su hash salado (modo 0600) y la verifica', () => {
    const dir = tmp();
    const t = new TeacherDirectory(dir);
    const { id, key } = t.issue('Marta');
    expect(key).toMatch(/^dtk_[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/);
    const raw = readFileSync(join(dir, 'teachers.json'), 'utf8');
    expect(raw).not.toContain(key.split('.')[1]); // el secreto nunca se guarda en claro
    expect(statSync(join(dir, 'teachers.json')).mode & 0o777).toBe(0o600);
    expect(t.verify(key)).toBe(id);
    expect(new TeacherDirectory(dir).verify(key)).toBe(id); // sobrevive a un reinicio
  });
  it('rechaza claves falsas, manipuladas, de otro profesor, de tipo erróneo o revocadas', () => {
    const t = new TeacherDirectory(tmp());
    const a = t.issue('A'), b = t.issue('B');
    const [pre, secret] = a.key.split('.');
    for (const bad of [undefined, null, 42, {}, '', 'x', `${pre}.${'A'.repeat(43)}`, `${pre}.${secret.slice(0, -1)}${secret.endsWith('A') ? 'B' : 'A'}`, `dtk_${'0'.repeat(12)}.${secret}`, `${b.key.split('.')[0]}.${secret}`]) expect(t.verify(bad as any), String(bad)).toBeNull();
    expect(t.verify(b.key)).toBe(b.id);
    expect(t.revoke(b.id)).toBe(true);
    expect(t.verify(b.key)).toBeNull();
    expect(t.verify(a.key)).toBe(a.id);
    expect(t.revoke(b.id)).toBe(false);
  });
  it('un teachers.json corrupto no tumba el servidor: se ignora y se avisa', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'teachers.json'), '{no es json');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = new TeacherDirectory(dir);
    expect(t.activeCount).toBe(0);
    expect(err).toHaveBeenCalled();
  });
  it('una clave creada por el CLI (otro proceso) vale sin reiniciar el servidor', () => {
    const dir = tmp();
    const server = new TeacherDirectory(dir);
    const cli = new TeacherDirectory(dir);
    const { id, key } = cli.issue('Nuevo');
    expect(server.verify(key)).toBe(id); // el servidor detecta el cambio del fichero sin reiniciar…
    cli.revoke(id);
    expect(server.verify(key)).toBeNull(); // …y también la revocación
  });
});

describe('Guard: creación de salas y credenciales', () => {
  const g = (env: Record<string, string> = {}, dir = tmp()) => createGuard({ dataDir: dir, env: env as NodeJS.ProcessEnv });

  it('optional (por defecto): crear sin clave sigue funcionando y se cuenta como legacy', () => {
    const guard = g();
    expect(guard.admitCreate('class', '1.1.1.1', 0)).toEqual({ ok: true });
    expect(guard.stats()).toMatchObject({ mode: 'optional', legacyRoomCreates: 1 });
  });
  it('con clave válida la sala queda ligada al profesor y no cuenta como legacy', () => {
    const dir = tmp();
    const { id, key } = new TeacherDirectory(dir).issue('Marta');
    const guard = g({}, dir);
    expect(guard.admitCreate('class', '1.1.1.1', 0, key)).toEqual({ ok: true, owner: id });
    expect(guard.stats().legacyRoomCreates).toBe(0);
  });
  it('una clave inválida se rechaza (401) incluso en optional, y tras 10 fallos la IP queda bloqueada', () => {
    const guard = g();
    for (let i = 0; i < 10; i++) expect(guard.admitCreate('class', '2.2.2.2', 0, 'dtk_bad')).toMatchObject({ ok: false, status: 401 });
    const locked = guard.admitCreate('class', '2.2.2.2', 0, 'dtk_bad');
    expect(locked).toMatchObject({ ok: false, status: 401 });
    expect((locked as any).error).toMatch(/Demasiados intentos/);
    expect(guard.admitCreate('class', '3.3.3.3', 0)).toEqual({ ok: true }); // otra IP no se ve afectada
  });
  it('required: exige clave para crear salas de clase/Road/Boxeo, pero NO para la práctica de los alumnos', () => {
    const dir = tmp();
    const { key } = new TeacherDirectory(dir).issue('Marta');
    const guard = g({ TEACHER_AUTH: 'required' }, dir);
    for (const kind of ['class', 'road', 'boxing'] as const) {
      expect(guard.admitCreate(kind, '1.1.1.1', 0)).toMatchObject({ ok: false, status: 401 });
      expect(guard.admitCreate(kind, '1.1.1.1', 0, key)).toMatchObject({ ok: true });
    }
    expect(guard.admitCreate('practice', '1.1.1.1', 0)).toEqual({ ok: true });
  });
  it('required SIN profesores registrados es FAIL-CLOSED: no se crean salas de profesor, pero la práctica sigue', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const guard = g({ TEACHER_AUTH: 'required' });
    expect(guard.mode).toBe('required');
    for (const kind of ['class', 'road', 'boxing'] as const) {
      expect(guard.admitCreate(kind, '1.1.1.1', 0)).toMatchObject({ ok: false, status: 503 });
      expect(guard.admitCreate(kind, '1.1.1.1', 0, 'dtk_cualquiera')).toMatchObject({ ok: false, status: 503 });
    }
    expect(guard.admitCreate('practice', '1.1.1.1', 0)).toEqual({ ok: true });
    expect(err).toHaveBeenCalled();
  });
  it('un teachers.json ilegible con required también cierra (no abre)', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'teachers.json'), '{roto');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(g({ TEACHER_AUTH: 'required' }, dir).admitCreate('class', '1.1.1.1', 0)).toMatchObject({ ok: false, status: 503 });
  });
  it('off ignora las claves (rollback inmediato de la migración)', () => {
    const guard = g({ TEACHER_AUTH: 'off' });
    expect(guard.admitCreate('class', '1.1.1.1', 0, 'cualquier-cosa')).toEqual({ ok: true });
  });
  it('límite de creación por IP y tope global de salas', () => {
    const guard = g({ ROOM_CREATE_PER_HOUR: '3', MAX_CLASS_ROOMS: '5' });
    for (let i = 0; i < 3; i++) expect(guard.admitCreate('class', '9.9.9.9', i).ok).toBe(true);
    expect(guard.admitCreate('class', '9.9.9.9', 3)).toMatchObject({ ok: false, status: 429 });
    expect(guard.admitCreate('class', '8.8.8.8', 5)).toMatchObject({ ok: false, status: 503 }); // tope global
    expect(guard.admitCreate('class', '8.8.8.8', 4).ok).toBe(true);
  });
  it('códigos de alumno: bloqueo por IP tras N fallos y freno global aunque el atacante cambie de IP', () => {
    const guard = g({ CODE_FAILS_PER_IP: '3', CODE_FAILS_GLOBAL_PER_HOUR: '5' });
    expect(guard.codeLocked('1.1.1.1')).toBeNull();
    for (let i = 0; i < 3; i++) guard.codeFailed('1.1.1.1');
    expect(guard.codeLocked('1.1.1.1')).toMatch(/Espera/);
    expect(guard.codeLocked('2.2.2.2')).toBeNull();
    guard.codeFailed('2.2.2.2'); guard.codeFailed('2.2.2.2');
    expect(guard.codeLocked('3.3.3.3')).toMatch(/pausada/); // global
  });
});
