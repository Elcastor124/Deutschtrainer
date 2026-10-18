// Piezas pequeñas: contador digital, temporizador de LEDs, estado de conexión, estrellas.
import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/types.ts';
import type { Conn } from '../net.ts';
import { mmss, useTick } from '../util.ts';
import { DotGlyph, STAR_ROWS } from './Glyph.tsx';

/** Número que rueda hasta su nuevo valor y se ilumina al cambiar (sube: blanco · baja: rojo). */
export function Counter({ value, className, id }: { value: number; className?: string; id?: string }) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<'' | 'up' | 'down'>('');
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    setDir(value > a ? 'up' : 'down');
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 750);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else { from.current = value; setTimeout(() => setDir(''), 500); }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <span id={id} className={`${className ?? ''} ctr${dir ? ` ctr-${dir}` : ''}`}>{shown}</span>;
}

/** Segundos restantes según la hora del servidor. */
export function timeLeft(t: RoomView['timer'], offset: number): number | null {
  if (!t) return null;
  if (t.endsAt === null) return (t.left ?? 0) / 1000;
  return Math.max(0, (t.endsAt - (Date.now() + offset)) / 1000);
}

const SEGMENTS = 30;

/** Temporizador como tira de LEDs (Glyph de Nothing): los segmentos se apagan; los 5 últimos segundos, en rojo. */
export function Timer({ timer, offset, onLow, big }: { timer: RoomView['timer']; offset: number; onLow?: (s: number) => void; big?: boolean }) {
  useTick(100, !!timer && timer.endsAt !== null);
  const left = timeLeft(timer, offset);
  const last = useRef<number>(-1);
  useEffect(() => {
    if (left === null || !onLow) return;
    const s = Math.ceil(left);
    if (s !== last.current && s <= 5 && s > 0 && timer?.endsAt !== null) onLow(s);
    last.current = s;
  });
  const lowNow = left !== null && !!timer && left <= 5 && left > 0 && timer.endsAt !== null;
  // Últimos segundos: toda la pantalla late en rojo (ver .aura en styles.css).
  useEffect(() => {
    document.body.classList.toggle('t-low', lowNow);
    return () => document.body.classList.remove('t-low');
  }, [lowNow]);
  if (left === null || !timer) return null;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, timer.total)));
  const lit = Math.ceil(frac * SEGMENTS);
  const paused = timer.endsAt === null && left > 0;
  const low = left <= 5 && left > 0 && !paused;
  const done = left <= 0;
  return (
    <div className={`timer${low ? ' low' : ''}${paused ? ' paused' : ''}${done ? ' done' : ''}${big ? ' big' : ''}`} role="timer" aria-label={`Quedan ${Math.ceil(left)} segundos`}>
      <div className="segs" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}
      </div>
      <span className="t">{paused ? 'PAUSA' : done ? 'ZEIT!' : mmss(left)}</span>
    </div>
  );
}

export function ConnPill({ conn }: { conn: Conn }) {
  const label = conn === 'online' ? 'En línea' : conn === 'connecting' ? 'Conectando…' : 'Sin conexión, reintentando';
  return <span className={`conn ${conn}`} title={label} role="status"><i /><span className="lbl">{label}</span></span>;
}

export function Stars({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`stars ${className}`} aria-label={`${n} estrellas`}>
      <DotGlyph rows={STAR_ROWS} className="star-g" color="#E9B949" dim="transparent" />
      <Counter value={n} className="dotnum" />
    </span>
  );
}
