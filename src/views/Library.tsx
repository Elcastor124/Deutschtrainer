// /biblioteca (y /tema/1) — Biblioteca de materiales: estanterías por tema con carpetas semi 3D.
// Al abrir una carpeta se abre su presentación; el PDF, si existe, es una acción secundaria.
import { useEffect, useState, type CSSProperties } from 'react';
import { loadCatalog, type Presentation } from '../catalog.ts';
import { COURSE, courseOrder } from '../course.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import '../library.css';

/** Temas de la biblioteca. Cada tema agrupa las Lektionen de la ruta; para añadir Tema 2, añade otra entrada. */
export const LIBRARY_TOPICS = [
  { id: 'tema-1', label: 'Tema 1', de: 'Verstehen und anwenden', level: 'A1–A2', units: COURSE.filter((u) => !u.exam).map((u) => u.n) },
] as const;

const unitTitle = (n?: number) => COURSE.find((u) => u.n === n)?.title.split(' · ')[0] ?? '';

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
  const pdfs = items.filter((p) => p.pdf).length;

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

      <section className="lib-cabinet" role="tabpanel" aria-label={`${t.label} · ${t.de}`}>
        <div className="lib-plate">
          <span className="dotnum">{t.label}</span>
          <span lang="de">{t.de}</span>
          <span className="lib-count">{entries ? `${items.length} presentaciones · ${pdfs} PDF` : ' '}</span>
        </div>
        {error ? <div className="lib-msg" role="alert"><p>No hemos podido cargar los materiales.</p><button className="dt-btn dt-btn-ghost sm" onClick={() => setAttempt((n) => n + 1)}><span className="dt-btn-label">Reintentar</span></button></div>
          : entries === null ? <p className="lib-msg" role="status">Cargando materiales…</p>
          : <ul className="lib-shelf">{items.map((p, i) => <Folder key={p.id} p={p} i={i} />)}</ul>}
      </section>

      <p className="lib-foot"><a className="dt-link" href="/tema/1/taller" onClick={followLearningLink}>Taller de escritura y escenas</a></p>
    </main>
  );
}

function Folder({ p, i }: { p: Presentation; i: number }) {
  const review = COURSE.some((u) => u.review?.id === p.id);
  return (
    <li className={`lib-item${review ? ' is-review' : ''}`} style={{ '--i': i } as CSSProperties}>
      <a className="lib-folder" href={p.file} target="_blank" rel="noopener noreferrer" aria-label={`Abrir presentación: ${p.title}`}>
        <span className="lib-back" aria-hidden="true"><span className="lib-tab dotnum">L{String(p.unit ?? 0).padStart(2, '0')}</span></span>
        <span className="lib-sheet s1" aria-hidden="true" /><span className="lib-sheet s2" aria-hidden="true" />
        <span className="lib-front">
          <span className="lib-unit">Lektion {p.unit} · {unitTitle(p.unit)}{review ? ' · repaso' : ''}</span>
          <b className="lib-title">{p.title}</b>
          <span className="lib-desc">{p.description}</span>
          <span className="lib-meta">{p.level && <i>{p.level}</i>}{p.topics.slice(0, 3).map((x) => <i key={x}>{x}</i>)}</span>
        </span>
      </a>
      {p.pdf && <a className="lib-pdf" href={p.pdf} target="_blank" rel="noopener noreferrer">PDF<span className="sr">: {p.title}</span></a>}
    </li>
  );
}
