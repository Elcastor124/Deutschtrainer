import { useEffect, useState } from 'react';

export const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* modo privado */ }
  },
  del(k: string) {
    try { localStorage.removeItem(k); } catch { /* modo privado */ }
  },
};

/**
 * Sesión de ALUMNO. El token vive SOLO en una cookie HttpOnly que pone el servidor: JavaScript nunca lo ve ni lo guarda.
 * Aquí solo queda el indicador «hay sesión» ('cookie'), que viaja como `X-Student-Session: cookie` / `session: 'cookie'`
 * para decir «usa mi cookie». (Un token antiguo `dts_…` guardado por versiones anteriores sigue valiendo hasta que caduque.)
 */
export const studentSession = (): string | undefined => store.get('dt:student-session') || undefined;
export const setStudentSession = (on: string | null) => { if (on) store.set('dt:student-session', 'cookie'); else store.del('dt:student-session'); };

/** Clave de profesor emitida por el servidor (npm run teacher -- add …). Opcional mientras dure la transición (TEACHER_AUTH). */
export const teacherKey = (): string | undefined => store.get('dt:teacher-key') || undefined;

export function profileId(): string {
  let id = store.get('bc:profile');
  if (!id) {
    id = (crypto.randomUUID?.() ?? `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
    store.set('bc:profile', id);
  }
  return id;
}

export function navigate(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath(): string {
  const [p, setP] = useState(location.pathname);
  useEffect(() => {
    const on = () => setP(location.pathname);
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  return p;
}

/** Re-render periódico (para temporizadores). */
export function useTick(ms = 200, on = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms, on]);
}

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

// ── Ajustes locales (por espectador) ──
export function useSetting(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    const s = store.get(key);
    return s === null ? def : s === '1';
  });
  const set = (x: boolean) => { store.set(key, x ? '1' : '0'); setV(x); };
  return [v, set];
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
