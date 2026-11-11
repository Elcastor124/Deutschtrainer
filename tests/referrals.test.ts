// Invita a un amigo (server/referrals.ts + días regalados en server/plus-billing.ts): reglas y antiabuso.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CLAIM_WINDOW_MS, IP_PER_DAY, MAX_REWARDS, REFERRAL_DAYS, Referrals } from '../server/referrals.ts';
import { PlusBilling } from '../server/plus-billing.ts';
import { isKnownRoute, routeTitle, SITEMAP_PATHS } from '../shared/routes.ts';

const DAY = 86_400_000;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function setup() {
  let t = 1_800_000_000_000;
  const now = () => t;
  const r = new Referrals({ now });
  return { r, now, tick: (ms: number) => { t += ms; } };
}
const acc = (id: string, createdAt: number) => ({ id, createdAt });

describe('Referrals', () => {
  it('cada cuenta tiene un código estable, legible y único', () => {
    const { r } = setup();
    const a = r.codeOf('acc_a'), b = r.codeOf('acc_b');
    expect(a).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(r.codeOf('acc_a')).toBe(a);
    expect(a).not.toBe(b);
    expect(r.ownerOf(a.toLowerCase())).toBe('acc_a');
    expect(r.ownerOf(` ${a.slice(0, 3)}-${a.slice(3)} `)).toBe('acc_a');
  });

  it('el amigo usa el código: queda pendiente; con su primera actividad se premia a los dos', () => {
    const { r, now } = setup();
    const code = r.codeOf('acc_host');
    const c = r.claim(acc('acc_new', now()), code, 'ip1', '2027-01-15');
    expect(c.ok).toBe(true);
    expect(r.mine('acc_host', () => 'Nuevo').friends).toEqual([{ alias: 'Nuevo', status: 'pending', at: now() }]);
    expect(r.activate('acc_new')).toEqual({ invitee: 'acc_new', inviter: 'acc_host' });
    expect(r.activate('acc_new')).toBeNull(); // solo una vez
    expect(r.mine('acc_host', () => 'Nuevo').rewarded).toBe(1);
    expect(r.mine('acc_new', () => 'Host').invitedBy).toEqual({ alias: 'Host', status: 'rewarded' });
  });

  it('antiabuso: código inexistente, el tuyo propio, dos códigos, cuentas viejas y tope por IP y día', () => {
    const { r, now } = setup();
    const code = r.codeOf('acc_host');
    expect(r.claim(acc('acc_x', now()), 'ZZZZZZ', 'ip', 'd')).toMatchObject({ ok: false, code: 'code' });
    expect(r.claim(acc('acc_host', now()), code, 'ip', 'd')).toMatchObject({ ok: false, code: 'self' });
    expect(r.claim(acc('acc_old', now() - CLAIM_WINDOW_MS - 1), code, 'ip', 'd')).toMatchObject({ ok: false, code: 'old' });
    expect(r.claim(acc('acc_1', now()), code, 'ip', 'd').ok).toBe(true);
    expect(r.claim(acc('acc_1', now()), r.codeOf('acc_other'), 'ip', 'd')).toMatchObject({ ok: false, code: 'already' });
    for (let i = 2; i <= IP_PER_DAY; i++) expect(r.claim(acc(`acc_${i}`, now()), code, 'ip', 'd').ok).toBe(true);
    expect(r.claim(acc('acc_99', now()), code, 'ip', 'd')).toMatchObject({ ok: false, code: 'ip' });
    expect(r.claim(acc('acc_99', now()), code, 'otra-ip', 'd').ok).toBe(true);
    expect(r.claim(acc('acc_98', now()), code, 'ip', 'd2').ok).toBe(true); // otro día, otra vez permitido
  });

  it(`quien invita gana como mucho ${MAX_REWARDS} semanas; el amigo siempre gana la suya`, () => {
    const { r, now } = setup();
    const code = r.codeOf('acc_host');
    for (let i = 0; i < MAX_REWARDS + 2; i++) {
      expect(r.claim(acc(`acc_f${i}`, now()), code, `ip${i}`, 'd').ok).toBe(true);
      const got = r.activate(`acc_f${i}`)!;
      expect(got.invitee).toBe(`acc_f${i}`);
      expect(got.inviter).toBe(i < MAX_REWARDS ? 'acc_host' : null);
    }
  });

  it('el profesor anula: desaparece de la lista del alumno; borrar una cuenta limpia su código', () => {
    const { r, now } = setup();
    const code = r.codeOf('acc_host');
    r.claim(acc('acc_new', now()), code, 'ip', 'd'); r.activate('acc_new');
    expect(r.cancel('acc_new')?.status).toBe('rewarded');
    expect(r.cancel('acc_new')).toBeNull();
    expect(r.mine('acc_host', () => 'x').friends).toEqual([]);
    r.forget('acc_host');
    expect(r.ownerOf(code)).toBeNull();
  });

  it('se guarda en disco y se recupera', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ref-')); dirs.push(dir);
    const a = new Referrals({ dataDir: dir }); const code = a.codeOf('acc_host');
    a.claim(acc('acc_new', Date.now()), code, 'ip', 'd'); a.flush();
    const b = new Referrals({ dataDir: dir });
    expect(b.ownerOf(code)).toBe('acc_host');
    expect(b.data.byInvitee.acc_new.status).toBe('pending');
  });
});

describe('PlusBilling: días regalados por invitar', () => {
  it('se suman desde hoy (Free) o desde el final (Plus con fecha) y no cuentan como ingresos', () => {
    let t = 1_800_000_000_000; const b = new PlusBilling({ now: () => t });
    expect(b.grantDays('free1', REFERRAL_DAYS, 'referral', 'in:x')).toEqual({ granted: true, until: t + 7 * DAY });
    b.pay('paid', 1); const until = b.untilOf('paid')!;
    b.grantDays('paid', REFERRAL_DAYS, 'referral', 'by:y');
    expect(b.untilOf('paid')).toBe(until + 7 * DAY);
    expect(b.info('paid').bonusDays).toBe(7);
    expect(b.info('paid').paidEur).toBe(12.5);
    const s = b.summary([{ id: 'free1', alias: 'f', plus: true }, { id: 'paid', alias: 'p', plus: true }], () => 'm');
    expect(s.incomeTotalEur).toBe(12.5);
  });
  it('Plus «sin fecha» (activado a mano) no se toca; anular resta los días sin dejar la fecha en el pasado', () => {
    let t = 1_800_000_000_000; const b = new PlusBilling({ now: () => t });
    expect(b.grantDays('manual', 7, 'referral', 'in:z', true)).toEqual({ granted: false, until: null });
    expect(b.untilOf('manual')).toBeNull();
    b.grantDays('f', 7, 'referral', 'in:q');
    t += 2 * DAY;
    expect(b.revokeDays('f', 'in:q')).toBe(7);
    expect(b.untilOf('f')).toBe(t);
    expect(b.revokeDays('f', 'in:q')).toBe(0);
  });
});

describe('rutas: títulos, 404 y sitemap', () => {
  it('cada página tiene su propio título y las desconocidas son 404', () => {
    const paths = ['/', '/curso', '/practica', '/juegos', '/examenes', '/ranking', '/mi', '/klaus', '/escribir', '/unterricht', '/hablar', '/tablon', '/plus', '/invitar'];
    const titles = paths.map(routeTitle);
    expect(new Set(titles).size).toBe(paths.length);
    for (const p of [...paths, '/i/ABC234', '/teoria/akkusativ', '/teacher/schueler/x', '/t/ABCD', '/p/ABCD']) expect(isKnownRoute(p), p).toBe(true);
    for (const p of ['/no-existe-xyz', '/curso/x/y', '/i/', '/plusss']) expect(isKnownRoute(p), p).toBe(false);
    expect(routeTitle('/no-existe')).toBeNull();
  });
  it('el sitemap solo anuncia páginas públicas', () => {
    expect(SITEMAP_PATHS).toContain('/');
    expect(SITEMAP_PATHS).toContain('/plus');
    for (const p of SITEMAP_PATHS) expect(p).not.toMatch(/teacher|profesor|\/mi$|cuenta|invitar|\/i\//);
  });
});
