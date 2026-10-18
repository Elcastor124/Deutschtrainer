import { useState } from 'react';
import { READING, parseParagraph } from '../../shared/reading.ts';

/** Texto de Leseverstehen: las palabras subrayadas muestran su traducción al pulsarlas. */
export function Reading({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <article className="reading" lang="de" onClick={(e) => { if (!(e.target as HTMLElement).closest('.gl')) setOpen(null); }}>
      {!compact && <h2>{READING.title}</h2>}
      {!compact && <p className="dim" lang="es" style={{ fontSize: '0.8em', marginBottom: '1em' }}>{READING.sub} · pulsa las palabras subrayadas</p>}
      {READING.paragraphs.map((p, pi) => (
        <p key={pi}>
          {parseParagraph(p).map((c, ci) => {
            if (!c.gloss) return <span key={ci}>{c.text}</span>;
            const k = `${pi}-${ci}`;
            return (
              <button key={k} type="button" className={`gl${open === k ? ' open' : ''}`} aria-expanded={open === k}
                onClick={() => setOpen(open === k ? null : k)}>
                {c.text}
                {open === k && <span className="tip" lang="es" role="tooltip">{c.gloss}</span>}
              </button>
            );
          })}
        </p>
      ))}
    </article>
  );
}
