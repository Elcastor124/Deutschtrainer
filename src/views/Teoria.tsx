// /teoria/<lektion> — «Ver la teoría» desde la presentación: explicaciones, tablas y comparaciones de las clases de Klaus
// que cubren esa Lektion. Pública (sin ejercicios ni soluciones) y con un botón directo a cada clase de Klaus.
import { useEffect, useState, type CSSProperties } from 'react';
import type { PublicActivity } from '../../shared/lesson.ts';
import { findUnit, klausLessonHref, presentationHref } from '../course.ts';
import { followLearningLink } from '../components/LearningNav.tsx';
import { Activity } from './Klasse.tsx';
import '../klasse.css';
import '../teoria.css';

interface TheoryLesson { id: string; title: string; level: string; unit: string; objectives: string[]; verified: boolean; items: PublicActivity[] }

export function Teoria({ unitId }: { unitId: string }) {
  const unit = findUnit(unitId);
  const [lessons, setLessons] = useState<TheoryLesson[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!unit?.klaus?.length) return;
    let live = true;
    fetch(`/api/klaus/teoria?lecciones=${unit.klaus.join(',')}`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error ?? 'No se pudo cargar la teoría.'); return d as { lessons: TheoryLesson[] }; })
      .then((d) => { if (live) setLessons(d.lessons); }).catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [unit]);

  if (!unit || !unit.klaus?.length) return (
    <main className="dt-page th-page">
      <header className="th-head"><p className="dt-eyebrow">Theorie</p><h1>Teoría<b className="dt-punkt">.</b></h1></header>
      <p className="th-muted">Esta Lektion no tiene teoría preparada. <a className="dt-link" href="/curso" onClick={followLearningLink}>Volver al curso</a></p>
    </main>
  );

  return (
    <main className="dt-page th-page">
      <header className="th-head">
        <a className="th-back" href={`/curso#${unit.id}`} onClick={followLearningLink}>← Lektion {unit.n}</a>
        <p className="dt-eyebrow">Theorie · Lektion {unit.n} · {unit.level}</p>
        <h1>{unit.title}<b className="dt-punkt">.</b></h1>
        <p className="th-lede">La gramática de esta Lektion, explicada paso a paso. Léela con calma y, cuando quieras practicarla, entra en la clase de Klaus del tema.</p>
        <div className="th-actions">
          {unit.presentation && <a className="btn" href={presentationHref(unit.presentation)} target="_blank" rel="noopener noreferrer">Abrir presentación</a>}
          <a className="btn primary" href={klausLessonHref(unit.klaus[0])} onClick={followLearningLink} data-theory-class="">Clase con Klaus →</a>
        </div>
        {lessons && lessons.length > 1 && (
          <nav className="th-toc" aria-label="Temas de esta teoría">
            {lessons.map((l, i) => <a key={l.id} href={`#t-${l.id}`} onClick={followLearningLink}><span className="dotnum">{String(i + 1).padStart(2, '0')}</span>{l.title}</a>)}
          </nav>
        )}
      </header>
      {err && <p className="kx-err" role="alert">{err}</p>}
      {!lessons && !err && <p className="th-muted" role="status">Cargando la teoría…</p>}
      {lessons?.map((l, li) => (
        <section key={l.id} className="th-lesson" id={`t-${l.id}`} aria-labelledby={`th-${l.id}`} style={{ '--i': li } as CSSProperties}>
          <div className="th-lesson-head">
            <p className="kx-mono">{l.level} · {l.unit.replace(/^[A-C][12] · /, '')}{!l.verified && <span className="kx-draft" title="Contenido pendiente de revisión del profesor.">Borrador</span>}</p>
            <h2 id={`th-${l.id}`}>{l.title}</h2>
            <ul className="th-goals">{l.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </div>
          <div className="th-items">
            {l.items.map((a) => (
              <article key={a.id} className="th-item kx-stage" data-theory-item={a.kind}>
                <h3 className="kx-title">{a.title}</h3>
                <Activity a={a} busy={false} locked onAnswer={() => {}} />
              </article>
            ))}
          </div>
          <a className="th-cta" href={klausLessonHref(l.id)} onClick={followLearningLink}>
            <span className="kx-mono">Unterricht mit Klaus</span><b>Practicar «{l.title}» con Klaus</b><i aria-hidden="true">→</i>
          </a>
        </section>
      ))}
    </main>
  );
}
