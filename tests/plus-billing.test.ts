import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { addMonths, PlusBilling } from '../server/plus-billing.ts';
import { nudgeFor, type Daily } from '../src/components/DailyNudge.tsx';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const DAY = 86_400_000;

describe('Plus mes a mes (server/plus-billing.ts)', () => {
  it('addMonths respeta fin de mes', () => {
    expect(new Date(addMonths(new Date(2026, 0, 31, 12).getTime(), 1)).getDate()).toBe(28);   // 31 ene → 28 feb
    expect(new Date(addMonths(new Date(2026, 10, 11, 12).getTime(), 1)).getMonth()).toBe(11);  // 11 nov → 11 dic
  });
  it('pago desde hoy si caducó; desde el fin si sigue activo; caduca solo; persiste en disco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dt-plus-')); dirs.push(dir);
    let now = new Date(2026, 10, 11, 12).getTime();
    const b = new PlusBilling({ dataDir: dir, now: () => now });
    expect(b.untilOf('a')).toBeNull();
    const i1 = b.pay('a'); expect(new Date(i1.until!).getDate()).toBe(11); expect(new Date(i1.until!).getMonth()).toBe(11);
    const i2 = b.pay('a'); expect(new Date(i2.until!).getMonth()).toBe(0);                       // acumula: 11 ene
    expect(i2.paidEur).toBe(25);
    now = i2.until! + 1; expect(b.expired('a')).toBe(true);
    const i3 = b.pay('a'); expect(i3.until! - now).toBeGreaterThan(27 * DAY);                    // caducado: desde hoy
    b.flush();
    expect(new PlusBilling({ dataDir: dir, now: () => now }).info('a').payments).toHaveLength(3);
  });
  it('prueba de 3 días: una vez por cuenta y no si ya tiene Plus', () => {
    const now = Date.now(); const b = new PlusBilling({ now: () => now });
    expect(b.startTrial('x', true)).toMatchObject({ ok: false });
    const r = b.startTrial('y', false); expect(r.ok).toBe(true);
    expect(b.untilOf('y')).toBe(now + 3 * DAY); expect(b.info('y').trial).toBe(true);
    expect(b.startTrial('y', false)).toMatchObject({ ok: false, error: expect.stringMatching(/Ya usaste/) });
  });
});

describe('aviso diario (DailyNudge.nudgeFor)', () => {
  const base: Daily = { day: '2026-11-11', alias: 'Ana', streak: 4, activeToday: false, missionDone: false, due: 3, plan: 'free', lektionenLeft: 2, practiceLeft: 2, plusUntil: null, trial: false, trialUsed: false };
  it('racha en riesgo → misión', () => { const n = nudgeFor(base); expect(n.href).toBe('/mision'); expect(n.text).toMatch(/4 días de racha/); expect(n.text).toMatch(/3 repasos/); });
  it('misión hecha → Lektionen del día; sin cupo y sin prueba → Probar Plus', () => {
    expect(nudgeFor({ ...base, missionDone: true, activeToday: true }).href).toBe('/curso');
    expect(nudgeFor({ ...base, missionDone: true, activeToday: true, lektionenLeft: 0 })).toMatchObject({ href: '/plus', tone: 'gold' });
  });
  it('Plus que acaba en ≤3 días o caducado → renovar', () => {
    const now = Date.now();
    expect(nudgeFor({ ...base, plan: 'plus', plusUntil: now + 1.5 * DAY }, now).text).toMatch(/acaba en 2 días|acaba mañana/);
    expect(nudgeFor({ ...base, plan: 'free', plusUntil: now - DAY }, now).text).toMatch(/caducado/);
    expect(nudgeFor({ ...base, plan: 'plus', plusUntil: now + 20 * DAY, missionDone: true, lektionenLeft: null }, now).href).toBe('/practica');
  });
});
