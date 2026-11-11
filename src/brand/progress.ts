import { useCallback, useEffect, useState } from 'react';
import { PROGRESS_KEY, parseProgress, serializeProgress, toggleStep } from '../course.ts';
import { cachedAlias } from '../play-client.ts';
import { store } from '../util.ts';

const EVT = 'dt:course-progress';
const API = '/api/course/progress';

/** Clave local por cuenta. Antes era una sola (dt:course:v1) para todo el navegador: en un ordenador compartido
 *  todos los alumnos veían el mismo porcentaje. Con cuenta, la verdad está en el servidor; esto es solo caché. */
const keyFor = (alias: string | null) => (alias ? `${PROGRESS_KEY}:${alias.toLowerCase()}` : PROGRESS_KEY);
const readLocal = (alias: string | null) => parseProgress(typeof localStorage === 'undefined' ? null : store.get(keyFor(alias)));

async function call(body?: unknown): Promise<Set<string> | null> {
  try {
    const r = await fetch(API, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!r.ok) return null;
    return parseProgress(JSON.stringify((await r.json() as { done?: string[] }).done ?? []));
  } catch { return null; }
}

/** Progreso del curso de QUIEN está conectado (cuenta → servidor) o, sin cuenta, de este navegador. */
export function useCourseProgress() {
  const [alias, setAlias] = useState<string | null>(() => (typeof localStorage === 'undefined' ? null : cachedAlias()));
  const [done, setDone] = useState<Set<string>>(() => readLocal(alias));
  /** Pasos marcados en este navegador antes de que el progreso fuera por cuenta (se recuperan solo si el alumno lo pide). */
  const [legacy, setLegacy] = useState(0);

  useEffect(() => {
    const onAccount = () => setAlias(cachedAlias());
    addEventListener('dt:account', onAccount);
    return () => removeEventListener('dt:account', onAccount);
  }, []);

  useEffect(() => {
    let alive = true;
    setDone(readLocal(alias));
    const sync = () => setDone(readLocal(alias));
    const onStorage = (e: StorageEvent) => { if (e.key === keyFor(alias)) sync(); };
    addEventListener(EVT, sync); addEventListener('storage', onStorage);
    if (alias) {
      void call().then((s) => {
        if (!alive || !s) return;
        store.set(keyFor(alias), serializeProgress(s)); setDone(s);
        const old = parseProgress(store.get(PROGRESS_KEY));
        setLegacy(s.size === 0 && old.size > 0 ? old.size : 0);
      });
    } else setLegacy(0);
    return () => { alive = false; removeEventListener(EVT, sync); removeEventListener('storage', onStorage); };
  }, [alias]);

  const toggle = useCallback((id: string, on?: boolean) => {
    const next = toggleStep(readLocal(alias), id, on);
    store.set(keyFor(alias), serializeProgress(next));
    setDone(next); dispatchEvent(new Event(EVT));
    if (alias) void call({ id, on: next.has(id) }).then((s) => { if (s) { store.set(keyFor(alias), serializeProgress(s)); setDone(s); } });
  }, [alias]);

  /** Sube a la cuenta lo marcado en este navegador antes del cambio (solo si el alumno lo pide: puede ser de otro). */
  const importLegacy = useCallback(async () => {
    if (!alias) return;
    const s = await call({ done: [...parseProgress(store.get(PROGRESS_KEY))] });
    if (s) { store.set(keyFor(alias), serializeProgress(s)); setDone(s); setLegacy(0); store.del(PROGRESS_KEY); dispatchEvent(new Event(EVT)); }
  }, [alias]);
  const dismissLegacy = useCallback(() => { store.del(PROGRESS_KEY); setLegacy(0); }, []);

  return { done, toggle, legacy, importLegacy, dismissLegacy, signedIn: !!alias };
}
