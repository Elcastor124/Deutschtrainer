import { useCallback, useEffect, useState } from 'react';
import { PROGRESS_KEY, parseProgress, serializeProgress, toggleStep } from '../course.ts';
import { store } from '../util.ts';

const EVT = 'dt:course-progress';

/** Progreso del curso en este dispositivo (localStorage), sincronizado entre vistas y pestañas. */
export function useCourseProgress() {
  const [done, setDone] = useState<Set<string>>(() => parseProgress(typeof localStorage === 'undefined' ? null : store.get(PROGRESS_KEY)));
  useEffect(() => {
    const sync = () => setDone(parseProgress(store.get(PROGRESS_KEY)));
    const onStorage = (e: StorageEvent) => { if (e.key === PROGRESS_KEY) sync(); };
    addEventListener(EVT, sync);
    addEventListener('storage', onStorage);
    return () => { removeEventListener(EVT, sync); removeEventListener('storage', onStorage); };
  }, []);
  const toggle = useCallback((id: string, on?: boolean) => {
    const next = toggleStep(parseProgress(store.get(PROGRESS_KEY)), id, on);
    store.set(PROGRESS_KEY, serializeProgress(next));
    setDone(next);
    dispatchEvent(new Event(EVT));
  }, []);
  return { done, toggle };
}
