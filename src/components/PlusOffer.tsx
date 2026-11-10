// «Solicita tu suscripción Plus»: tarjeta única que se enseña donde el plan Free llega a su límite
// (Klaus, diapositivas del curso, práctica) y en /plus. No hay pagos en la web: se pide por WhatsApp o teléfono
// y el profesor activa Plus en Teacher OS.
import type { MouseEvent } from 'react';
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
      <p className="po-how">Cuando lo confirmemos, tu profesor activa Plus en tu cuenta{alias ? <> (<b>{alias}</b>)</> : null} y se abre todo al momento.</p>
      <p className="po-act">
        <a className="btn primary" href={waLink(alias)} target="_blank" rel="noopener noreferrer">Solicitar Plus</a>
        <a className="btn" href={`tel:+${PHONE_DIGITS}`}>Llamar</a>
        {onClose ? <button type="button" className="btn ghost" onClick={onClose}>Ahora no</button> : <a className="btn ghost" href="/curso" onClick={go('/curso')}>Seguir con el curso</a>}
      </p>
    </section>
  );
}
