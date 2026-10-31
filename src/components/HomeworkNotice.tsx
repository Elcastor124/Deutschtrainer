// Aviso al entrar: si el alumno tiene deberes pendientes o notas nuevas del profesor, se lo decimos una vez por sesión.
import { useEffect, useState } from 'react';
import { getInbox, type GradeItem, type HomeworkItem } from '../play-client.ts';
import { navigate, store, studentSession } from '../util.ts';
import { sfx } from '../fx/sound.ts';
import '../student-home.css';

const SEEN_GRADES = 'dt:grades-seen';
const SESSION_KEY = 'dt:inbox-shown';

export function HomeworkNotice({ path }: { path: string }) {
  const [box, setBox] = useState<{ pending: HomeworkItem[]; fresh: GradeItem[] } | null>(null);
  useEffect(() => {
    const check = async () => {
      if (!studentSession()) { setBox(null); return; }
      try {
        const r = await getInbox();
        const seen = new Set<string>(JSON.parse(store.get(SEEN_GRADES) ?? '[]'));
        const pending = r.homework.filter((h) => !h.done), fresh = r.grades.filter((g) => !seen.has(g.id));
        const sig = [...pending.map((h) => h.id), ...fresh.map((g) => g.id)].join(',');
        let shown = ''; try { shown = sessionStorage.getItem(SESSION_KEY) ?? ''; } catch { /* sin sessionStorage */ }
        if (sig && sig !== shown) { setBox({ pending, fresh }); sfx.item(); }
      } catch { /* sin sesión válida o sin red: no molestamos */ }
    };
    void check();
    addEventListener('dt:account', check);
    return () => removeEventListener('dt:account', check);
  }, []);
  if (!box || path.startsWith('/teacher') || path.startsWith('/profesor')) return null;
  const close = () => {
    try { sessionStorage.setItem(SESSION_KEY, [...box.pending.map((h) => h.id), ...box.fresh.map((g) => g.id)].join(',')); } catch { /* */ }
    const seen = new Set<string>(JSON.parse(store.get(SEEN_GRADES) ?? '[]')); for (const g of box.fresh) seen.add(g.id);
    store.set(SEEN_GRADES, JSON.stringify([...seen].slice(-300)));
    setBox(null);
  };
  const open = (hash: string) => { close(); navigate(`/mi${hash}`); };
  return (
    <aside className="hw-notice" role="status" aria-live="polite" aria-label="Avisos de tu profesor">
      <p className="dt-eyebrow">Von deinem Lehrer</p>
      {box.pending.length > 0 && <>
        <h2>Tienes {box.pending.length === 1 ? 'deberes pendientes' : `${box.pending.length} deberes pendientes`}</h2>
        <ul>{box.pending.slice(0, 3).map((h) => <li key={h.id}><b>{h.title}</b>{h.due && <small> · para el {new Date(`${h.due}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small>}</li>)}</ul>
      </>}
      {box.fresh.length > 0 && <p className="hw-grade">Nueva nota: <b>{box.fresh[0].title}</b> · <span>{String(box.fresh[0].score).replace('.', ',')}</span>{box.fresh.length > 1 ? ` (+${box.fresh.length - 1})` : ''}</p>}
      <div className="hw-actions">
        <button type="button" className="dt-btn dt-btn-primary sm" onClick={() => open(box.pending.length ? '#deberes' : '#notas')}><span className="dt-btn-label">{box.pending.length ? 'Hacer los deberes' : 'Ver mis notas'} →</span></button>
        <button type="button" className="dt-btn dt-btn-ghost sm" onClick={close}><span className="dt-btn-label">Más tarde</span></button>
      </div>
    </aside>
  );
}
