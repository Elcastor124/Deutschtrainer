import { useState } from 'react';
import { parseParagraph, readingById } from '../../shared/reading.ts';
import { sfx } from '../fx/sound.ts';

/** Texto de Leseverstehen: las palabras subrayadas muestran su traducción al pulsarlas. */
export function Reading({ id, compact }: { id?: string; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const r = readingById(id);
  return (
    <article className="reading" lang="de" onClick={(e) => { if (!(e.target as HTMLElement).closest('.gl')) setOpen(null); }}>
      {!compact && <h2>{r.title}</h2>}
      {!compact && <p className="reading-sub" lang="es">{r.sub} · pulsa las palabras subrayadas</p>}
      {compact && <p className="reading-sub"><b>{r.title}</b></p>}
      {r.paragraphs.map((p, pi) => (
        <p key={pi}>
          {parseParagraph(p).map((c, ci) => {
            if (!c.gloss) return <span key={ci}>{c.text}</span>;
            const k = `${pi}-${ci}`;
            return (
              <button key={k} type="button" className={`gl${open === k ? ' open' : ''}`} aria-expanded={open === k}
                onClick={() => { sfx.key(); setOpen(open === k ? null : k); }}>
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
