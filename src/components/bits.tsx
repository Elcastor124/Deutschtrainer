// Piezas pequeñas: contador digital, temporizador, estado de conexión.
import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/types.ts';
import type { Conn } from '../net.ts';
import { mmss, useTick } from '../util.ts';

/** Número que rueda hasta su nuevo valor. */
export function Counter({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <span className={className}>{shown}</span>;
}

/** Segundos restantes según la hora del servidor. */
export function timeLeft(t: RoomView['timer'], offset: number): number | null {
  if (!t) return null;
  if (t.endsAt === null) return (t.left ?? 0) / 1000;
  return Math.max(0, (t.endsAt - (Date.now() + offset)) / 1000);
}

export function Timer({ timer, offset, onLow }: { timer: RoomView['timer']; offset: number; onLow?: (s: number) => void }) {
  useTick(200, !!timer);
  const left = timeLeft(timer, offset);
  const last = useRef<number>(-1);
  useEffect(() => {
    if (left === null || !onLow) return;
    const s = Math.ceil(left);
    if (s !== last.current && s <= 5 && s > 0 && timer?.endsAt !== null) onLow(s);
    last.current = s;
  });
  if (left === null || !timer) return null;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, timer.total)));
  const cls = `timer${left <= 5 && left > 0 && timer.endsAt !== null ? ' low' : ''}${timer.endsAt === null ? ' paused' : ''}`;
  return (
    <div className={cls} role="timer" aria-label={`Quedan ${Math.ceil(left)} segundos`}>
      <div className="bar"><i style={{ transform: `scaleX(${frac})` }} /></div>
      <span className="t">{timer.endsAt === null && left > 0 ? '❚❚' : mmss(left)}</span>
    </div>
  );
}

export function ConnPill({ conn }: { conn: Conn }) {
  const label = conn === 'online' ? 'En línea' : conn === 'connecting' ? 'Conectando…' : 'Sin conexión · reintentando';
  return <span className={`conn ${conn}`} title={label}><i /><span className="lbl">{label}</span></span>;
}
