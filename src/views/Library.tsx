// /biblioteca (y /tema/1) — Biblioteca como estantería 3D: un mueble por tema, las presentaciones son libros vistos de frente.
// Al pasar el ratón (o tocar) un libro sale de la balda y aparece su ficha; clic abre la presentación.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { loadCatalog, type Presentation } from '../catalog.ts';
import { COURSE, courseOrder } from '../course.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import '../library.css';

/** Temas de la biblioteca. Cada tema agrupa las Lektionen de la ruta; para añadir Tema 2, añade otra entrada. */
export const LIBRARY_TOPICS = [
  { id: 'tema-1', label: 'Tema 1', de: 'Verstehen und anwenden', level: 'A1–A2', units: COURSE.filter((u) => !u.exam).map((u) => u.n) },
] as const;

const unitTitle = (n?: number) => COURSE.find((u) => u.n === n)?.title.split(' · ')[0] ?? '';
const isReview = (id: string) => COURSE.some((u) => u.review?.id === id);
/** Lomo estable por libro: color de cubierta, ancho y alto salen del id (no cambian entre visitas). */
const COVERS = ['#7d1612', '#1b1b1b', '#2c2c2c', '#a51e18', '#141414', '#3b2f12', '#5a0f0c', '#e6e0d2'];
function spine(id: string, review: boolean) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cover = review ? '#3b2f12' : COVERS[h % COVERS.length];
  return { cover, light: cover === '#e6e0d2', w: 50 + (h % 5) * 4, h: 228 + ((h >> 3) % 6) * 8 };
}

export function Library() {
  const [entries, setEntries] = useState<Presentation[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [topic, setTopic] = useState<string>(LIBRARY_TOPICS[0].id);
  useEffect(() => {
    let live = true; setError(false);
    void loadCatalog().then((x) => { if (live) setEntries(x); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [attempt]);
  const t = LIBRARY_TOPICS.find((x) => x.id === topic) ?? LIBRARY_TOPICS[0];
  const items = (entries ?? []).filter((p) => p.unit !== undefined && (t.units as readonly number[]).includes(p.unit)).sort((a, b) => courseOrder(a.id) - courseOrder(b.id));

  return (
    <main className="dt-page lib-page">
      <header className="lib-head">
        <div>
          <p className="dt-eyebrow">Bibliothek · Materiales</p>
          <h1>Biblioteca<b className="dt-punkt">.</b></h1>
        </div>
        <div className="lib-head-side">
          <div className="lib-tabs" role="tablist" aria-label="Temas">
            {LIBRARY_TOPICS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === t.id} className={x.id === t.id ? 'on' : ''} onClick={() => setTopic(x.id)}>{x.label}<small>{x.level}</small></button>)}
          </div>
          <a className="dt-btn dt-btn-ghost sm" href="/curso" onClick={followLearningLink}><span className="dt-btn-label">Ruta del curso</span></a>
        </div>
      </header>

      <section className="bs-case" role="tabpanel" aria-label={`${t.label} · ${t.de}`}>
        <div className="bs-sign"><span className="dotnum">{t.label}</span><small lang="de">{t.de}</small></div>
        {error ? <div className="lib-msg" role="alert"><p>No hemos podido cargar los materiales.</p><button className="dt-btn dt-btn-ghost sm" onClick={() => setAttempt((n) => n + 1)}><span className="dt-btn-label">Reintentar</span></button></div>
          : entries === null ? <p className="lib-msg" role="status">Cargando materiales…</p>
          : <Shelves items={items} />}
      </section>

      <p className="lib-foot"><a className="dt-link" href="/tema/1/taller" onClick={followLearningLink}>Taller de escritura y escenas</a></p>
    </main>
  );
}

/** Reparte los libros en baldas según el ancho disponible. */
function Shelves({ items }: { items: Presentation[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const rows: Presentation[][] = [];
  let row: Presentation[] = [], used = 0;
  for (const p of items) {
    const w = spine(p.id, isReview(p.id)).w + 6;
    if (row.length && used + w > width - 40) { rows.push(row); row = []; used = 0; }
    row.push(p); used += w;
  }
  if (row.length) rows.push(row);
  return <div className="bs-rows" ref={box}>{rows.map((r, i) => <Shelf key={i} books={r} />)}</div>;
}

function Shelf({ books }: { books: Presentation[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const row = useRef<HTMLUListElement>(null);
  const touch = useRef(false);
  const show = (id: string, el: HTMLElement) => { setActive(id); setAt(el.offsetLeft + el.offsetWidth / 2); };
  const p = books.find((b) => b.id === active);
  const rowW = row.current?.clientWidth ?? 600;
  return (
    <div className="bs-shelf" onMouseLeave={() => setActive(null)}>
      <ul className="bs-books" ref={row}>
        {books.map((b, i) => {
          const review = isReview(b.id); const s = spine(b.id, review);
          return (
            <li key={b.id} className={`bs-book${active === b.id ? ' is-out' : ''}${s.light ? ' is-light' : ''}`} style={{ '--c': s.cover, '--bw': `${s.w}px`, '--bh': `${s.h}px`, '--i': i } as CSSProperties}>
              <a href={b.file} target="_blank" rel="noopener noreferrer" aria-describedby={active === b.id ? 'bs-card' : undefined}
                onMouseEnter={(e) => show(b.id, e.currentTarget.parentElement!)} onFocus={(e) => show(b.id, e.currentTarget.parentElement!)}
                onPointerDown={(e: RPointerEvent) => { touch.current = e.pointerType !== 'mouse'; }}
                onClick={(e) => { if (touch.current && active !== b.id) { e.preventDefault(); show(b.id, e.currentTarget.parentElement!); } }}>
                <span className="bs-top" aria-hidden="true" />
                <span className="bs-spine">
                  <span className="bs-code dotnum">L{String(b.unit ?? 0).padStart(2, '0')}</span>
                  <span className="bs-title">{b.title.split(' · ')[0]}</span>
                  <span className="bs-bands" aria-hidden="true" />
                </span>
                <span className="sr">: abrir presentación</span>
              </a>
            </li>
          );
        })}
        <li className="bs-end" aria-hidden="true" />
      </ul>
      <div className="bs-plank" aria-hidden="true" />
      {p && (
        <div className="bs-card" id="bs-card" role="tooltip" style={{ left: at + 330 < rowW ? at + 44 : Math.max(0, at - 344) } as CSSProperties}>
          <p className="bs-card-k">Lektion {p.unit} · {unitTitle(p.unit)}{isReview(p.id) ? ' · repaso' : ''}</p>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <p className="bs-card-meta">{p.level && <i>{p.level}</i>}{p.topics.map((x) => <i key={x}>{x}</i>)}</p>
          <div className="bs-card-actions">
            <a className="dt-btn dt-btn-primary sm" href={p.file} target="_blank" rel="noopener noreferrer"><span className="dt-btn-label">Abrir presentación →</span></a>
            {p.pdf && <a className="dt-link" href={p.pdf} target="_blank" rel="noopener noreferrer">PDF</a>}
          </div>
        </div>
      )}
    </div>
  );
}
