import { useEffect, useState } from 'react';
import { loadCatalog, type Presentation } from '../catalog.ts';
import { courseOrder } from '../course.ts';

export function PresentationCards({ entries }: { entries: Presentation[] }) {
  const sorted = [...entries].sort((a, b) => courseOrder(a.id) - courseOrder(b.id));
  return <div className="learning-grid">{sorted.map((entry) => (
    <article className="panel home-card" key={entry.id}>
      <span className="learning-eyebrow">{entry.unit ? `LEKTION ${entry.unit}` : 'PRESENTACIÓN'} {entry.level && `· ${entry.level}`}</span>
      <h3>{entry.title}</h3><p>{entry.description}</p>
      <div className="chips">{entry.topics.map((topic) => <span className="badge" key={topic}>{topic}</span>)}</div>
      <div className="row">
        <a className="btn" href={entry.file} target="_blank" rel="noopener noreferrer">Abrir presentación<span className="sr">: {entry.title}</span></a>
        {entry.pdf && <a className="btn ghost" href={entry.pdf} target="_blank" rel="noopener noreferrer">Ver PDF<span className="sr">: {entry.title}</span></a>}
      </div>
    </article>
  ))}</div>;
}

export function Presentations() {
  const [entries, setEntries] = useState<Presentation[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setError(false);
    setEntries(null);
    void loadCatalog().then((items) => { if (current) setEntries(items); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [attempt]);
  return (
    <section className="stack learning-section" aria-labelledby="presentations-title">
      <h2 id="presentations-title">Presentaciones</h2>
      <p className="home-sub">Explicaciones y ejemplos de clase. Abre una presentación o consulta su PDF cuando esté disponible.</p>
      {error ? <div className="panel stack" role="alert"><p>No hemos podido cargar los materiales. Puedes seguir practicando y volver a intentarlo.</p><button className="btn" onClick={() => setAttempt((value) => value + 1)}>Reintentar cargar materiales</button></div>
        : entries === null ? <p role="status">Cargando presentaciones…</p>
        : entries.length === 0 ? <p role="status">Todavía no hay presentaciones en el catálogo.</p>
        : <PresentationCards entries={entries} />}
    </section>
  );
}
