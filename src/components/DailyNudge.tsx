// Aviso diario al entrar (solo dentro de la web, sin push ni email): una línea con lo que toca hoy.
// Lo decide el servidor (/api/daily). Una vez por día y sesión: «Cerrar» lo oculta hasta mañana.
import { useEffect, useState, type MouseEvent } from 'react';
import { cachedAlias, playRequest } from '../play-client.ts';
import { navigate, store } from '../util.ts';
import './daily-nudge.css';

export interface Daily {
  day: string; alias: string; streak: number; activeToday: boolean; missionDone: boolean; due: number; plan: 'free' | 'plus';
  lektionenLeft: number | null; practiceLeft: number | null; plusUntil: number | null; trial: boolean; trialUsed: boolean;
}

/** Mensaje y acción principal del día. Exportado para las pruebas. */
export function nudgeFor(d: Daily, now = Date.now()): { text: string; href: string; cta: string; tone: 'plain' | 'warn' | 'gold' } {
  const left = d.plusUntil !== null ? Math.ceil((d.plusUntil - now) / 86_400_000) : null;
  if (d.plan === 'plus' && left !== null && left <= 3) return { text: `${d.trial ? 'Tu prueba de Plus' : 'Tu Plus'} acaba ${left <= 0 ? 'hoy' : left === 1 ? 'mañana' : `en ${left} días`}. Renuévalo para no perder a Klaus.`, href: '/plus', cta: 'Renovar Plus', tone: 'gold' };
  if (d.plan === 'free' && d.plusUntil !== null && left !== null && left <= 0) return { text: 'Tu Plus ha caducado: vuelves al plan Free. Renuévalo cuando quieras.', href: '/plus', cta: 'Renovar Plus', tone: 'gold' };
  const streak = d.streak > 0 && !d.activeToday ? `Llevas ${d.streak} ${d.streak === 1 ? 'día' : 'días'} de racha: no la pierdas hoy. ` : d.activeToday && d.streak > 1 ? `Racha de ${d.streak} días. ` : '';
  if (!d.missionDone) return { text: `${streak}Tu misión de hoy (5 min) te espera${d.due ? ` · ${d.due} repasos pendientes` : ''}.`, href: '/mision', cta: 'Empezar misión', tone: streak && !d.activeToday ? 'warn' : 'plain' };
  if (d.lektionenLeft !== null && d.lektionenLeft > 0) return { text: `${streak}Misión hecha. Hoy puedes empezar ${d.lektionenLeft} ${d.lektionenLeft === 1 ? 'Lektion nueva' : 'Lektionen nuevas'}.`, href: '/curso', cta: 'Ir al curso', tone: 'plain' };
  if (d.plan === 'free' && !d.trialUsed) return { text: `${streak}Has hecho lo de hoy. ¿Pruebas Plus gratis 3 días? Klaus, curso y práctica sin límite.`, href: '/plus', cta: 'Probar Plus', tone: 'gold' };
  return { text: `${streak}Misión de hoy completada. Bien hecho.`, href: '/practica', cta: 'Practicar más', tone: 'plain' };
}

const HIDE = (day: string) => `dt:nudge-hidden:${day}`;
// Solo en portadas (inicio, mi espacio, curso, juegos, exámenes): nunca en medio de una práctica, examen, juego o Klaus.
const SHOWN_ON = /^\/(mi|curso|juegos|examenes|road-to-b1|ranking|tablon)?\/?$/;

export function DailyNudge({ path }: { path: string }) {
  const [d, setD] = useState<Daily | null>(null);
  const [hidden, setHidden] = useState(false);
  const off = !SHOWN_ON.test(path);
  useEffect(() => {
    if (off || !cachedAlias()) { setD(null); return; }
    let live = true;
    playRequest<Daily>('/api/daily').then((x) => { if (live) { setD(x); setHidden(store.get(HIDE(x.day)) === '1'); } }).catch(() => live && setD(null));
    return () => { live = false; };
  }, [path, off]);
  if (!d || hidden || off) return null;
  const n = nudgeFor(d);
  const go = (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate(n.href); };
  const close = () => { store.set(HIDE(d.day), '1'); setHidden(true); };
  return (
    <aside className={`dn dn-${n.tone}`} data-daily-nudge={n.tone} aria-label="Aviso de hoy">
      <span className="dn-dot" aria-hidden="true" />
      <p>{n.text}</p>
      <a className="btn sm primary" href={n.href} onClick={go}>{n.cta}</a>
      <button type="button" className="dn-x" aria-label="Cerrar el aviso de hoy" onClick={close}>×</button>
    </aside>
  );
}
