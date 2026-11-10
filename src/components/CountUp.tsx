// Cifra que cuenta hasta su valor una vez, al entrar en pantalla. Sin efectos: muestra el valor directamente.
import { useEffect, useRef, useState } from 'react';
import { useEffectsEnabled } from '../brand/effects.ts';

export function CountUp({ value, ms = 720, className = '' }: { value: number; ms?: number; className?: string }) {
  const fx = useEffectsEnabled();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(fx ? 0 : value);
  useEffect(() => {
    if (!fx || !ref.current || value <= 0) { setShown(value); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        setShown(Math.round(value * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, fx, ms]);
  return <span ref={ref} className={`m-num ${className}`.trim()} aria-label={String(value)}><span aria-hidden="true">{shown}</span></span>;
}
