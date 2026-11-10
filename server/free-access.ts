// Límites del plan Free fuera de Klaus (Klaus entero ya es solo Plus):
//  - Diapositivas del curso: cada día se pueden ABRIR como mucho 2 Lektionen nuevas; las ya abiertas se releen siempre.
//  - Práctica (/practica): 2 sesiones nuevas al día. Reanudar una práctica empezada no cuenta.
//  - Sin cuenta: ni diapositivas ni práctica (la cuenta es gratis). Los juegos (BlackCard, Jenga, Boxen) no se tocan.
// Plus y el profesor no tienen límite. El servidor decide; el cliente solo enseña el estado.
// Se guarda en DATA_DIR/free-access.json (cloud-sync lo sube a Supabase como el resto de *.json; nunca borra datos de otros).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const FREE_LIMITS = { lektionenPerDay: 2, practicePerDay: 2 } as const;
export type Plan = 'free' | 'plus';

interface AccountAccess { lektionen: Record<string, string>; days: Record<string, { lektionen: string[]; practice: number }> }
interface Data { version: 1; accounts: Record<string, AccountAccess> }

export type Verdict =
  | { ok: true; plan: Plan | 'teacher'; counted: boolean }
  | { ok: false; status: 401 | 402; code: 'account' | 'plus'; error: string };

export class FreeAccess {
  data: Data = { version: 1, accounts: {} };
  readonly file: string | null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(opts: { dataDir?: string; now?: () => number; day: (at: number) => string; enabled?: boolean }) {
    this.now = opts.now ?? Date.now; this.day = opts.day; this.enabled = opts.enabled ?? true;
    this.file = opts.dataDir ? join(opts.dataDir, 'free-access.json') : null;
    if (this.file && existsSync(this.file)) {
      try { const raw = JSON.parse(readFileSync(this.file, 'utf8')); if (raw?.version === 1 && raw.accounts) this.data = { version: 1, accounts: raw.accounts }; }
      catch (e) { console.error('[free] no se pudo leer free-access.json; se empieza vacío:', (e as Error).message); }
    }
  }
  now: () => number; day: (at: number) => string; enabled: boolean;

  #acc(id: string) { return (this.data.accounts[id] ??= { lektionen: {}, days: {} }); }
  #today(id: string) {
    const a = this.#acc(id), d = this.day(this.now());
    // Solo se guarda el día en curso: los contadores viejos no crecen sin fin.
    for (const k of Object.keys(a.days)) if (k !== d) delete a.days[k];
    return (a.days[d] ??= { lektionen: [], practice: 0 });
  }

  /** Abrir las diapositivas de una Lektion (clave estable: número de unidad del curso). */
  openLektion(who: { accountId: string; plan: Plan } | null, lektion: string, teacher = false): Verdict {
    if (teacher || !this.enabled) return { ok: true, plan: teacher ? 'teacher' : who?.plan ?? 'free', counted: false };
    if (!who) return { ok: false, status: 401, code: 'account', error: 'Crea tu cuenta gratis para abrir las diapositivas del curso.' };
    if (who.plan === 'plus') return { ok: true, plan: 'plus', counted: false };
    const a = this.#acc(who.accountId);
    if (a.lektionen[lektion]) return { ok: true, plan: 'free', counted: false };
    const t = this.#today(who.accountId);
    if (t.lektionen.length >= FREE_LIMITS.lektionenPerDay) return { ok: false, status: 402, code: 'plus', error: `Con el plan Free puedes empezar ${FREE_LIMITS.lektionenPerDay} Lektionen nuevas al día. Mañana se abren dos más, o pásate a Plus.` };
    a.lektionen[lektion] = this.day(this.now()); t.lektionen.push(lektion); this.#save();
    return { ok: true, plan: 'free', counted: true };
  }

  /** Empezar una práctica nueva (/practica). */
  startPractice(who: { accountId: string; plan: Plan } | null, teacher = false): Verdict {
    if (teacher || !this.enabled) return { ok: true, plan: teacher ? 'teacher' : who?.plan ?? 'free', counted: false };
    if (!who) return { ok: false, status: 401, code: 'account', error: 'Crea tu cuenta gratis (o inicia sesión) para practicar.' };
    if (who.plan === 'plus') return { ok: true, plan: 'plus', counted: false };
    const t = this.#today(who.accountId);
    if (t.practice >= FREE_LIMITS.practicePerDay) return { ok: false, status: 402, code: 'plus', error: `Con el plan Free tienes ${FREE_LIMITS.practicePerDay} prácticas al día y ya las has hecho. Mañana tienes dos más, o pásate a Plus.` };
    t.practice++; this.#save();
    return { ok: true, plan: 'free', counted: true };
  }

  status(accountId: string, plan: Plan) {
    const a = this.data.accounts[accountId], d = this.day(this.now());
    const t = a?.days[d] ?? { lektionen: [], practice: 0 };
    return {
      plan, enabled: this.enabled, limits: FREE_LIMITS,
      lektionen: { opened: Object.keys(a?.lektionen ?? {}).sort(), today: t.lektionen, left: plan === 'plus' || !this.enabled ? null : Math.max(0, FREE_LIMITS.lektionenPerDay - t.lektionen.length) },
      practice: { used: t.practice, left: plan === 'plus' || !this.enabled ? null : Math.max(0, FREE_LIMITS.practicePerDay - t.practice) },
    };
  }

  forget(accountId: string) { delete this.data.accounts[accountId]; this.#save(); }
  #save() { if (!this.file || this.#timer) return; this.#timer = setTimeout(() => { this.#timer = null; this.flush(); }, 300); this.#timer.unref?.(); }
  flush() {
    if (!this.file) return; if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); renameSync(tmp, this.file);
  }
}

/** /presentaciones/<id>.html|pdf → número de Lektion (según catalogo.json), o null si no es una diapositiva del curso. */
export function lektionOfPresentation(pathname: string, catalog: { id: string; unit?: number }[]): string | null {
  const m = /^\/presentaciones\/([\w-]+)\.(html|pdf)$/.exec(pathname);
  if (!m) return null;
  const e = catalog.find((c) => c.id === m[1]);
  return e?.unit ? String(e.unit) : null;
}
