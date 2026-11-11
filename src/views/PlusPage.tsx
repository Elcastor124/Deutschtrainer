// /plus — qué incluye Plus y cómo pedirlo (sin pagos en la web: WhatsApp / teléfono; el profesor lo activa en Teacher OS).
// También es el destino al que el servidor redirige cuando el plan Free intenta abrir una Lektion más de las 2 del día.
import { useEffect, useState } from 'react';
import { PlusOffer, type PlusReason } from '../components/PlusOffer.tsx';
import { cachedAlias } from '../play-client.ts';
import { freeStatus, type FreeStatus } from '../free-client.ts';
import { playRequest } from '../play-client.ts';
import type { PlusMe } from '../components/PlusOffer.tsx';

export function PlusPage() {
  const q = new URLSearchParams(location.search);
  const motivo = q.get('motivo');
  const reason: PlusReason = motivo === 'diapos' || motivo === 'practica' || motivo === 'hablar' || motivo === 'escribir' || motivo === 'clase' ? motivo : 'general';
  const [st, setSt] = useState<FreeStatus | null>(null);
  const [me, setMe] = useState<PlusMe | null>(null);
  useEffect(() => { freeStatus().then(setSt).catch(() => setSt(null)); if (cachedAlias()) playRequest<PlusMe>('/api/plus/me').then(setMe).catch(() => setMe(null)); }, []);
  const untilTxt = me?.until ? new Date(me.until).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : null;
  const isPlus = st?.plan === 'plus';
  return (
    <main className="dt-page po-page-wrap">
      <div className="po-page">
        <div className="po-page-copy">
          <p className="dt-eyebrow">Deutschtrainer Plus</p>
          <h1>Free o Plus<b className="dt-punkt">.</b></h1>
          {isPlus
            ? <p data-plus-active>Tu cuenta ya tiene <b>{me?.trial ? 'la prueba de Plus' : 'Plus'}</b>{untilTxt ? <> hasta el <b>{untilTxt}</b></> : null}: Klaus, todo el curso y la práctica sin límite.{untilTxt ? ' Para seguir, escríbenos antes de esa fecha para renovar el mes.' : ''}</p>
            : <p>Con el plan Free tienes cada día 2 Lektionen nuevas del curso y 2 prácticas. Exámenes, juegos y teoría, siempre abiertos.</p>}
          <table className="po-table">
            <thead><tr><th scope="col" /><th scope="col">Free</th><th scope="col">Plus</th></tr></thead>
            <tbody>
              <tr><th scope="row">Lektionen nuevas (diapositivas)</th><td>2 al día</td><td className="gold">Sin límite</td></tr>
              <tr><th scope="row">Práctica sin reloj</th><td>2 al día</td><td className="gold">Sin límite</td></tr>
              <tr><th scope="row">Klaus · Redet, Schreibt, Unterricht</th><td>—</td><td className="gold">Incluido</td></tr>
              <tr><th scope="row">Exámenes, juegos, teoría, Tablón</th><td>Sí</td><td>Sí</td></tr>
            </tbody>
          </table>
        </div>
        {!isPlus && <PlusOffer reason={reason} alias={cachedAlias()} />}
      </div>
    </main>
  );
}
