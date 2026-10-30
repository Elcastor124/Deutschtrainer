// /ranking — Rangliste semanal: podio animado, lista, tu posición y cómo se ganan los puntos.
// Solo alias de cuentas que activaron el ranking (el servidor ya filtra). Todo lo que haces en la práctica con cuenta cuenta aquí.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { RankingEntry, RankingView } from '../../shared/play.ts';
import { FREEPLAY_RULES } from '../../shared/play.ts';
import { getRanking, refreshAccount, setRanking } from '../play-client.ts';
import { useEffectsEnabled, useEffectsReducedMotion } from '../brand/effects.ts';
import { navigate, studentSession } from '../util.ts';
import '../ranking.css';

type Which = 'current' | 'previous';
/** Fases de la animación: entra (sube el podio), quieto, sale (se hunde antes de cambiar de semana). */
type Stage = 'enter' | 'idle' | 'exit';
const EXIT_MS = 520;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDay = (d: string) => { const [, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]}`; };
const kw = (week: string) => week.split('-W')[1]?.replace(/^0/, '') ?? '?';

/** Contador que sube hasta `target` empezando tras `delay` ms (instantáneo sin animaciones). */
function useCountUp(target: number, delay: number, animate: boolean, key: string) {
  const [v, setV] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate || typeof requestAnimationFrame !== 'function') { setV(target); return; }
    setV(0);
    let raf = 0;
    const t0 = performance.now() + delay, dur = 1100;
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / dur));
      setV(Math.round(target * (1 - (1 - k) ** 4)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, animate, key]);
  return v;
}

function useCountdown(to: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!to) return; const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, [to]);
  if (!to) return null;
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function Crown() {
  return (
    <svg className="rk-crown" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
      <path d="M4 34 L8 10 L22 22 L32 4 L42 22 L56 10 L60 34 Z" />
      <circle cx="8" cy="10" r="3.5" /><circle cx="32" cy="4" r="3.5" /><circle cx="56" cy="10" r="3.5" />
      <rect x="4" y="34" width="56" height="5" rx="2" />
    </svg>
  );
}

/** Confeti de CSS (determinista: siempre la misma lluvia, sin aleatoriedad en el render). */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    x: (i * 37) % 100, r: (i * 53) % 360, d: (i % 7) * 70, s: 0.7 + ((i * 13) % 6) / 10, c: ['var(--dt-gold)', 'var(--dt-red)', 'var(--dt-paper)', 'var(--silver)'][i % 4], w: i % 3 === 0 ? 10 : 6,
  })), []);
  return <div className="rk-confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ '--x': `${b.x}%`, '--r': `${b.r}deg`, '--d': `${b.d}ms`, '--s': b.s, '--c': b.c, '--w': `${b.w}px` } as CSSProperties} />)}</div>;
}

const PLACE = { 1: { cls: 'p1', h: 100, delay: 820, medal: 'Oro' }, 2: { cls: 'p2', h: 72, delay: 420, medal: 'Plata' }, 3: { cls: 'p3', h: 54, delay: 80, medal: 'Bronce' } } as const;

function Step({ place, entry, me, animate, cycle }: { place: 1 | 2 | 3; entry?: RankingEntry; me?: string; animate: boolean; cycle: string }) {
  const p = PLACE[place];
  const pts = useCountUp(entry?.points ?? 0, p.delay + 380, animate, cycle);
  const mine = !!entry && entry.alias === me;
  return (
    <li className={`rk-step rk-${p.cls}${entry ? '' : ' is-empty'}${mine ? ' is-me' : ''}`} style={{ '--h': p.h, '--delay': `${p.delay}ms` } as CSSProperties} aria-label={entry ? `${entry.rank}.º ${entry.alias}, ${entry.points} puntos` : `${place}.º puesto libre`}>
      <div className="rk-who">
        {place === 1 && entry && <Crown />}
        <span className="rk-avatar" aria-hidden="true">{entry ? entry.alias.slice(0, 1).toUpperCase() : '?'}</span>
        <b className="rk-alias">{entry ? entry.alias : '¿Serás tú?'}</b>
        {mine && <span className="rk-you">tú</span>}
        <span className="rk-points"><span className="dotnum">{entry ? pts : '—'}</span><small>pts</small></span>
      </div>
      <div className="rk-block">
        <span className="rk-place dotnum">{place}</span>
        <span className="rk-medal">{p.medal}</span>
      </div>
    </li>
  );
}

function Podium({ view, animate, effects, stage, cycle }: { view: RankingView; animate: boolean; effects: boolean; stage: Stage; cycle: string }) {
  // Empates comparten puesto (mismo número): el podio muestra las tres primeras posiciones de la lista ordenada.
  const top = view.entries.slice(0, 3);
  const at = (i: number) => top[i];
  const me = view.me?.alias;
  return (
    <section className={`rk-stage rk-${stage}${animate ? ' is-animated' : ''}`} aria-label="Podio de la semana">
      {effects && animate && top.length > 0 && <div className="rk-spot" aria-hidden="true" />}
      <ol className="rk-podium">
        <Step place={2} entry={at(1)} me={me} animate={animate} cycle={cycle} />
        <Step place={1} entry={at(0)} me={me} animate={animate} cycle={cycle} />
        <Step place={3} entry={at(2)} me={me} animate={animate} cycle={cycle} />
      </ol>
      {effects && animate && top.length > 0 && stage !== 'exit' && <Confetti key={cycle} />}
      <div className="rk-floor" aria-hidden="true" />
    </section>
  );
}

function Rows({ view, animate, stage }: { view: RankingView; animate: boolean; stage: Stage }) {
  const rest = view.entries.slice(3);
  const lead = Math.max(1, view.entries[0]?.points ?? 1);
  if (!rest.length) return null;
  return (
    <ol className={`rk-list rk-${stage}${animate ? ' is-animated' : ''}`} start={4} aria-label="Resto de la clasificación">
      {rest.map((e, i) => (
        <li key={`${e.rank}-${e.alias}`} className={e.alias === view.me?.alias ? 'is-me' : ''} style={{ '--i': i } as CSSProperties}>
          <span className="rk-rank dotnum">{e.rank}</span>
          <span className="rk-avatar sm" aria-hidden="true">{e.alias.slice(0, 1).toUpperCase()}</span>
          <b>{e.alias}{e.alias === view.me?.alias && <span className="rk-you">tú</span>}</b>
          <span className="rk-bar" aria-hidden="true"><i style={{ width: `${Math.round((e.points / lead) * 100)}%` }} /></span>
          <span className="rk-row-pts">{e.points}<small> pts</small></span>
        </li>
      ))}
    </ol>
  );
}

function MeCard({ view, onJoin }: { view: RankingView; onJoin: () => void }) {
  if (!studentSession() || !view.me) {
    return (
      <aside className="rk-me" data-rk-me="guest">
        <div><b>¿Quieres aparecer aquí?</b><span>Practica con tu cuenta: cada respuesta suma. Solo se ve tu alias.</span></div>
        <a className="btn primary" href="/registro?volver=/ranking" onClick={(e) => { e.preventDefault(); navigate('/registro?volver=/ranking'); }}>Crear cuenta</a>
      </aside>
    );
  }
  const m = view.me;
  if (!m.optedIn) {
    return (
      <aside className="rk-me" data-rk-me="hidden">
        <div><b>Llevas {m.points} puntos {view.which === 'current' ? 'esta semana' : 'esa semana'}</b><span>No apareces en el ranking: es opcional y está desactivado en tu cuenta. Solo se mostraría tu alias «{m.alias}».</span></div>
        <button className="btn primary" onClick={onJoin}>Aparecer en el ranking</button>
      </aside>
    );
  }
  const listed = view.entries.some((e) => e.alias === m.alias);
  return (
    <aside className="rk-me is-in" data-rk-me="in">
      <span className="rk-avatar sm" aria-hidden="true">{m.alias.slice(0, 1).toUpperCase()}</span>
      <div><b>{m.rank ? `Vas ${m.rank}.º de ${view.players}` : 'Aún sin puntos esta semana'}</b><span>{m.points} puntos · {listed ? 'apareces en la tabla' : m.rank ? 'sigue practicando para entrar en la tabla' : 'tu primera respuesta te mete en la carrera'}</span></div>
      <a className="btn" href="/practica" onClick={(e) => { e.preventDefault(); navigate('/practica'); }}>Practicar ahora</a>
    </aside>
  );
}

export function Ranking() {
  const [which, setWhich] = useState<Which>('current');
  const [view, setView] = useState<RankingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('enter');
  const [cycle, setCycle] = useState('0');
  const reduced = useEffectsReducedMotion();
  const effects = useEffectsEnabled();
  const animate = !reduced;
  const pending = useRef<RankingView | null>(null);
  const countdown = useCountdown(view?.which === 'current' ? view.resetsAt : null);

  const load = async (w: Which, swap: boolean) => {
    setError(null);
    try {
      void refreshAccount();
      const next = await getRanking(w, 50);
      if (!swap || !view || !animate) { setView(next); setStage('enter'); setCycle(`${w}:${Date.now()}`); return; }
      // Animación de salida: el podio se hunde y la lista se desvanece; después entra la otra semana.
      pending.current = next;
      setStage('exit');
      setTimeout(() => { if (pending.current) { setView(pending.current); pending.current = null; setStage('enter'); setCycle(`${w}:${Date.now()}`); } }, EXIT_MS);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(which, false); }, []);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') void load(which, false); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [which]);
  const switchTo = (w: Which) => { if (w === which) return; setWhich(w); void load(w, true); };
  const join = async () => { try { await setRanking(true); await load(which, false); } catch (e) { setError((e as Error).message); } };

  return (
    <main className="rk" data-ranking="">
      <header className="rk-head">
        <div>
          <p className="dt-eyebrow">Rangliste · {view ? `KW ${kw(view.week)}` : 'semana'}</p>
          <h1>Die Besten der Woche.</h1>
          <p className="rk-sub">
            {view ? <>{fmtDay(view.range.from)} – {fmtDay(view.range.to)}</> : '…'}
            {view?.which === 'current' && countdown && <span className="rk-pill" title="El ranking se reinicia el lunes a las 00:00 (hora de Madrid)">Se reinicia en {countdown}</span>}
            {view?.which === 'previous' && <span className="rk-pill">Semana cerrada</span>}
          </p>
        </div>
        <div className="rk-tabs" role="tablist" aria-label="Semana">
          <button role="tab" aria-selected={which === 'current'} className={which === 'current' ? 'on' : ''} onClick={() => switchTo('current')}>Esta semana</button>
          <button role="tab" aria-selected={which === 'previous'} className={which === 'previous' ? 'on' : ''} onClick={() => switchTo('previous')}>Semana pasada</button>
        </div>
      </header>

      {error && <p className="libre-err" role="alert">{error}</p>}
      {!view && !error && <div className="rk-skel" aria-busy="true" aria-label="Cargando ranking" />}
      {view && (
        <>
          <Podium view={view} animate={animate} effects={effects} stage={stage} cycle={cycle} />
          {view.entries.length === 0 && (
            <p className="rk-empty">{view.which === 'current' ? 'Nadie ha puntuado todavía esta semana. La primera respuesta correcta te sube al podio.' : 'Esa semana nadie apareció en el ranking.'}</p>
          )}
          <MeCard view={view} onJoin={() => void join()} />
          <div className="rk-stats" aria-label="Resumen">
            <div><span>En carrera</span><b className="dotnum">{view.players}</b></div>
            <div><span>Líder</span><b className="dotnum">{view.entries[0]?.points ?? 0}</b></div>
            <div><span>{view.which === 'current' ? 'Tus puntos' : 'Tus puntos esa semana'}</span><b className="dotnum">{view.me?.points ?? '—'}</b></div>
          </div>
          <Rows view={view} animate={animate} stage={stage} />
        </>
      )}

      <section className="rk-rules" aria-label="Cómo se suman puntos">
        <h2>Cómo se suman puntos</h2>
        <ul>
          {FREEPLAY_RULES.map((r) => <li key={r.title}><b>{r.points}</b><span><strong>{r.title}</strong>{r.text}</span></li>)}
        </ul>
        <p className="libre-note">🏆 <b>Premio semanal:</b> el 1.º de cada semana gana una lootbox con un Klaus nuevo. <a href="/klaus">Ver tu colección de Klaus</a>.</p>
        <p className="libre-note">Cuenta todo lo que haces con tu cuenta: la práctica, el modo libre y las salas privadas. El tiempo conectado no suma. Solo se publica tu alias, y solo si activas el ranking en tu cuenta.</p>
      </section>
    </main>
  );
}
