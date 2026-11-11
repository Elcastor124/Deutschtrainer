// «Solicita tu suscripción Plus»: tarjeta única que se enseña donde el plan Free llega a su límite
// (Klaus, diapositivas del curso, práctica) y en /plus. No hay pagos en la web: Bizum al número con el alias como
// concepto (o WhatsApp/llamada) y el profesor pulsa «Pago recibido» en Teacher OS (+1 mes). Prueba gratis de 3 días
// que el alumno activa él mismo, una vez por cuenta (POST /api/plus/trial; lo decide el servidor).
import { useEffect, useState, type MouseEvent } from 'react';
import { playRequest } from '../play-client.ts';
import { navigate } from '../util.ts';
import './plus-offer.css';

export const PLUS_PHONE = '+34 611 778 791';
const PHONE_DIGITS = PLUS_PHONE.replace(/\D/g, '');
export const PLUS_PRICE = '12,50 €/mes';

export type PlusReason = 'klaus' | 'hablar' | 'escribir' | 'clase' | 'diapos' | 'practica' | 'general';
const WHY: Record<PlusReason, string> = {
  klaus: 'Klaus es parte de Plus.',
  hablar: 'Redet mit Klaus es parte de Plus.',
  escribir: 'Schreibt mit Klaus es parte de Plus.',
  clase: 'Unterricht mit Klaus es parte de Plus.',
  diapos: 'Hoy ya has empezado tus 2 Lektionen.',
  practica: 'Hoy ya has hecho tus 2 prácticas.',
  general: 'Deutschtrainer Plus.',
};

const waLink = (alias?: string | null) => {
  const msg = `Hola! Quiero solicitar la suscripción Deutschtrainer Plus${alias ? ` para mi cuenta «${alias}»` : ''}.`;
  return `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(msg)}`;
};

export interface PlusMe { plan: 'free' | 'plus'; until: number | null; trial: boolean; trialUsed: boolean; trialDays: number; price: number }

/** Botón «Probar Plus 3 días»: solo con cuenta y si nunca la usó. Tras activarla recarga para abrir todo. */
function TrialButton({ alias }: { alias?: string | null }) {
  const [me, setMe] = useState<PlusMe | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!alias) return; playRequest<PlusMe>('/api/plus/me').then(setMe).catch(() => setMe(null)); }, [alias]);
  if (!alias) return <p className="po-trial-note"><a href="/registro" onClick={(e) => { e.preventDefault(); navigate('/registro?volver=/plus'); }}>Crea tu cuenta gratis</a> y prueba Plus 3 días sin pagar.</p>;
  if (!me || me.plan === 'plus' || me.trialUsed) return null;
  const start = async () => {
    setBusy(true); setErr(null);
    try { await playRequest<PlusMe>('/api/plus/trial', {}); location.reload(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="po-trial" data-plus-trial>
      <button type="button" className="btn primary" disabled={busy} onClick={() => void start()}>{busy ? 'Activando…' : `Probar Plus ${me.trialDays} días gratis`}</button>
      <span>Sin pagar nada. Una vez por cuenta; al acabar vuelves a Free solo.</span>
      {err && <span className="libre-err" role="alert">{err}</span>}
    </div>
  );
}

export function PlusOffer({ reason = 'general', alias, compact = false, onClose }: { reason?: PlusReason; alias?: string | null; compact?: boolean; onClose?: () => void }) {
  const go = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); onClose?.(); navigate(href); };
  return (
    <section className={`po${compact ? ' po-compact' : ''}`} data-plus-offer={reason} aria-labelledby={`po-t-${reason}`}>
      <p className="po-tag"><span className="po-dot" aria-hidden="true" />Plus · {PLUS_PRICE}</p>
      <h2 id={`po-t-${reason}`}>{WHY[reason]}</h2>
      <p className="po-lead">Solicita tu suscripción Plus escribiendo a este número:</p>
      <a className="po-phone" href={waLink(alias)} target="_blank" rel="noopener noreferrer" data-plus-phone>
        <span className="dotnum">{PLUS_PHONE}</span>
        <small>Escribir por WhatsApp →</small>
      </a>
      {!compact && (
        <ul className="po-list">
          <li><b>Klaus AI</b> Redet (hablar, también por voz), Schreibt (escribir) y Unterricht (clases).</li>
          <li><b>Curso sin límite</b> todas las Lektionen y diapositivas, cuando quieras.</li>
          <li><b>Práctica sin límite</b> todas las sesiones que quieras al día.</li>
        </ul>
      )}
      <TrialButton alias={alias} />
      <p className="po-how" data-plus-bizum>Paga <b>{PLUS_PRICE}</b> por <b>Bizum</b> a ese número{alias ? <> con el concepto <b>«{alias}»</b></> : ' con tu alias como concepto'}. En cuanto llegue, tu profesor confirma el pago y se abre todo al momento durante un mes. Cada mes, otro Bizum.</p>
      <p className="po-act">
        <a className="btn primary" href={waLink(alias)} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>
        <a className="btn" href={`tel:+${PHONE_DIGITS}`}>Llamar</a>
        {onClose ? <button type="button" className="btn ghost" onClick={onClose}>Ahora no</button> : <a className="btn ghost" href="/curso" onClick={go('/curso')}>Seguir con el curso</a>}
      </p>
    </section>
  );
}
