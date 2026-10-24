import { useRef, type ReactNode } from 'react';
import { followLearningLink } from '../components/LearningNav.tsx';
import { useMagnetic } from './motion.ts';

/** Botón/enlace principal con efecto magnético y brillo que sigue al cursor. */
export function MagneticLink({ href, children, variant = 'primary', className = '', external, onClick }: {
  href: string; children: ReactNode; variant?: 'primary' | 'ghost' | 'gold'; className?: string; external?: boolean; onClick?: () => void;
}) {
  const ref = useMagnetic<HTMLAnchorElement>(0.22);
  const inner = useRef<HTMLSpanElement>(null);
  return (
    <a ref={ref} href={href} className={`dt-btn dt-btn-${variant} ${className}`} onClick={(e) => { onClick?.(); followLearningLink(e); }}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <span ref={inner} className="dt-btn-label">{children}</span>
    </a>
  );
}
