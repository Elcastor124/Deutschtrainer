// Ayuda de Klaus en la práctica: pista (nivel 1) y regla (nivel 2) bajo demanda. La solución la da la corrección normal.
// Los fallos de la práctica ya quedan en el registro de progreso y alimentan la misión diaria.
import { useState } from 'react';
import { playRequest } from '../play-client.ts';
import '../mission.css';

interface Hint { level: number; text: string; example?: string }
export function TutorHint({ qid }: { qid: string }) {
  const [hints, setHints] = useState<Hint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const ask = async () => {
    const level = hints.length + 1; if (level > 2) return;
    try { const r = await playRequest<{ hint: Hint }>(`/api/tutor/hint?qid=${encodeURIComponent(qid)}&level=${level}`); setHints([...hints, r.hint]); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="tutor-hint" aria-live="polite">
      {hints.map((h) => <p key={h.level}><b>Klaus{h.level === 2 ? ' · regla' : ''}:</b> {h.text}{h.example ? <> <i lang="de">({h.example})</i></> : null}</p>)}
      {err && <p className="dim">{err}</p>}
      {hints.length < 2 && <button type="button" className="btn sm ghost" onClick={() => void ask()}>{hints.length ? 'Otra pista de Klaus' : '🐾 Pista de Klaus'}</button>}
    </div>
  );
}
