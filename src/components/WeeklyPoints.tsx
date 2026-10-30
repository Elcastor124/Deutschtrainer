import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchWeekly, weekLabel, type Leaderboard, type MyProgress } from '../progress-client.ts';
import './weekly-points.css';

export type WeeklyState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ready'; me: MyProgress; board: Leaderboard | null };

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// En el servidor (renderToString) no hay layout: usar useEffect evita avisos.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Contador animado (ease-out ~900 ms). Sin animación con prefers-reduced-motion. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const from = useRef(0);
  useIsoLayoutEffect(() => {
    const start = from.current;
    from.current = target;
    if (reduced() || start === target || typeof requestAnimationFrame !== 'function') { setValue(target); return; }
    setValue(start);
    const t0 = performance.now(), dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3;
      setValue(Math.round(start + (target - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

function Flame({ lit }: { lit: boolean }) {
  return (
    <svg className={`wp-flame${lit ? ' is-lit' : ''}`} viewBox="0 0 24 32" aria-hidden="true" focusable="false">
      <path className="wp-flame-outer" d="M12 1c1.2 5.4 7.6 8.6 7.6 17.2A7.6 7.6 0 0 1 12 31a7.6 7.6 0 0 1-7.6-7.6c0-4.6 2.6-7 3.9-9.7.6 2.2 1.6 3.3 2.9 3.8C10.4 12.4 10.9 6 12 1Z" />
      <path className="wp-flame-inner" d="M12 15.5c.7 3 4 4.6 4 8.7A4 4 0 0 1 12 28.4a4 4 0 0 1-4-4.2c0-2.4 1.4-3.6 2.1-5 .4 1.1.9 1.7 1.6 2-.3-1.9-.3-3.6.3-5.7Z" />
    </svg>
  );
}

function Counter({ points }: { points: number }) {
  const shown = useCountUp(points);
  return (
    <div className="wp-score" data-points={points} aria-label={`${points} puntos esta semana`}>
      <span className="wp-score-num" aria-hidden="true">{shown}</span>
      <span className="wp-score-unit" aria-hidden="true">pts</span>
    </div>
  );
}

function Streak({ days }: { days: number }) {
  return (
    <div className={`wp-streak${days > 0 ? ' is-on' : ''}`} title="Días seguidos practicando">
      <Flame lit={days > 0} />
      <div>
        <span className="wp-streak-num">{days} {days === 1 ? 'día' : 'días'}</span>
        <span className="wp-streak-label">{days > 0 ? 'Serie · racha' : 'Sin racha'}</span>
      </div>
    </div>
  );
}

function Bars({ history }: { history: MyProgress['history'] }) {
  const max = Math.max(1, ...history.map((h) => h.points));
  return (
    <figure className="wp-chart">
      <figcaption className="wp-label">Últimas 8 semanas</figcaption>
      <ol className="wp-bars">
        {history.map((h, i) => {
          const current = i === history.length - 1;
          return (
            <li key={h.week} className={`wp-bar${current ? ' is-now' : ''}`} title={`${weekLabel(h.week)}: ${h.points} pts`}>
              <span className="wp-bar-fill" style={{ height: `${Math.max(h.points ? 6 : 2, Math.round((h.points / max) * 100))}%`, animationDelay: `${i * 45}ms` }} />
              <span className="wp-bar-week">{weekLabel(h.week)}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function Podium({ board, me }: { board: Leaderboard; me: MyProgress }) {
  const top = board.entries.slice(0, 3);
  if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <section className="wp-podium" aria-label="Rangliste de la semana">
      <h3 className="wp-label">Rangliste · ranking semanal</h3>
      <ol className="wp-steps">
        {order.map((e) => (
          <li key={`${e.rank}-${e.name}`} className={`wp-step wp-step-${Math.min(e.rank, 3)}${me.rank === e.rank && me.name === e.name ? ' is-me' : ''}`}>
            <span className="wp-step-name">{e.name}</span>
            <span className="wp-step-pts">{e.points}</span>
            <span className="wp-step-block" aria-label={`Puesto ${e.rank}`}>{e.rank}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Vista pura (testeable con renderToStaticMarkup). */
export function WeeklyPointsView({ state, compact = false }: { state: WeeklyState; compact?: boolean }) {
  const cls = `wp${compact ? ' wp-compact' : ''}`;
  if (state.status === 'loading') {
    return <section className={`${cls} is-loading`} aria-busy="true" aria-label="Puntos semanales"><div className="wp-skel" /><div className="wp-skel wp-skel-short" /></section>;
  }
  if (state.status === 'offline') {
    return (
      <section className={`${cls} is-offline`} aria-label="Puntos semanales">
        <p className="wp-kicker">Wochenpunkte</p>
        <p className="wp-empty">Sin conexión con el servidor. Tus puntos se verán cuando vuelva la conexión.</p>
      </section>
    );
  }
  const { me, board } = state;
  const empty = !me.known || (me.weekPoints === 0 && me.history.every((h) => h.points === 0));
  return (
    <section className={cls} aria-label="Puntos semanales">
      <header className="wp-head">
        <div className="wp-head-main">
          <p className="wp-kicker">Wochenpunkte <span>· {weekLabel(me.week)}</span></p>
          <Counter points={me.weekPoints} />
          {me.rank ? <p className="wp-rank">Puesto <b>{me.rank}</b> de {me.players} esta semana</p> : null}
        </div>
        <Streak days={me.streak} />
      </header>
      {empty ? <p className="wp-empty"><b>Los geht’s!</b> Empieza a practicar para sumar puntos.</p> : null}
      {!compact && !empty ? <Bars history={me.history} /> : null}
      {!compact && board ? <Podium board={board} me={me} /> : null}
      <a className="wp-ranking-link" href="/ranking">Ver el ranking semanal completo →</a>
      {!compact && me.recommended.length ? (
        <nav className="wp-reco" aria-label="Recomendado para ti">
          <h3 className="wp-label">Recomendado para ti</h3>
          <ul>
            {me.recommended.map((t) => {
              const stat = me.topics.find((x) => x.topic === t);
              return (
                <li key={t}>
                  <a href={`/practica?temas=${encodeURIComponent(t)}`}>
                    <span className="wp-reco-topic">{t}</span>
                    {stat ? <span className="wp-reco-acc">{Math.round(stat.accuracy * 100)}%</span> : null}
                    <span className="wp-reco-go" aria-hidden="true">→</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}

/** Widget autónomo: carga /api/progress/me y /leaderboard y refresca al volver a la pestaña. */
export function WeeklyPoints({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<WeeklyState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    let ctl: AbortController | null = null;
    const load = async () => {
      ctl?.abort();
      ctl = new AbortController();
      const { me, board } = await fetchWeekly(ctl.signal, !compact);
      if (!alive) return;
      if (!me.ok) { setState((s) => (s.status === 'ready' ? s : { status: 'offline' })); return; }
      setState({ status: 'ready', me: me.data, board: board && board.ok ? board.data : null });
    };
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; ctl?.abort(); document.removeEventListener('visibilitychange', onVisible); };
  }, [compact]);
  return <WeeklyPointsView state={state} compact={compact} />;
}
