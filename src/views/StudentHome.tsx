// /mi — espacio personal del alumno tras iniciar sesión. Todo sale de datos reales del servidor (progreso, retos derivados
// de su actividad, repasos y clases que le asigna su profesor); los estados vacíos lo dicen sin inventar nada.
import { useEffect, useState } from 'react';
import { GAMES, LEVEL_LABEL } from '../../shared/play.ts';
import { TOPICS } from '../../shared/rules.ts';
import { getDashboard, getAchievements, refreshAccount, setHomeworkDone, type Dashboard } from '../play-client.ts';
import { navigate, store } from '../util.ts';
import '../libre.css';
import '../account.css';
import '../student-home.css';

const go = (path: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); navigate(path); };
const topicName = (t: string) => (TOPICS as Record<string, { de: string }>)[t]?.de ?? t;
const GAME_ICON: Record<string, string> = { blackcard: '♠', jenga: '▤', boxing: '◎', deck: '▧' };
const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

function Spark({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => [i, v] as const).filter(([, v]) => v !== null) as [number, number][];
  if (pts.length < 2) return <span className="sh-note">Aún pocas semanas para ver una tendencia.</span>;
  const w = 160, h = 40, max = Math.max(1, ...pts.map(([, v]) => v));
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return <svg className="sh-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Puntos de las últimas semanas"><path d={d} /></svg>;
}

export function StudentHome() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void refreshAccount().then((a) => {
      if (!a) { navigate('/entrar?volver=/mi'); return; }
      getDashboard().then(setD).catch((e: Error) => setError(e.message));
      getAchievements().then((r) => setDone(r.achievements.filter((x) => x.unlocked).length)).catch(() => setDone(null));
    });
  }, []);
  if (error) return <main className="sh"><p className="libre-err" role="alert">{error}</p></main>;
  if (!d) return <main className="sh"><div className="rk-skel" aria-busy="true" aria-label="Cargando tu espacio" /></main>;
  const s = d.summary;
  const resume = (() => { try { const v = JSON.parse(store.get('bc:practice') ?? 'null'); return v?.account ? v : null; } catch { return null; } })();
  const live = d.classes.filter((c) => c.status === 'live' && c.room);
  const weak = [...new Set([...d.reviews.flatMap((r) => r.topics), ...s.recommended])].slice(0, 6);
  return (
    <main className="sh" data-student-home="">
      <header className="sh-hero">
        <span className="acc-avatar" aria-hidden="true">{d.account.alias.slice(0, 1).toUpperCase()}</span>
        <div>
          <p className="dt-eyebrow">Mein Bereich</p>
          <h1>Hallo, {d.account.alias}!</h1>
          <p className="sh-tags">
            {d.level ? <span className="sh-chip">Nivel {LEVEL_LABEL[d.level]}</span> : <span className="sh-chip dim">Sin nivel asignado</span>}
            {d.groups.map((g) => <span key={g} className="sh-chip">{g}</span>)}
            <span className="sh-chip gold">{s.weekPoints} pts esta semana</span>
          </p>
        </div>
        <a className="btn" href="/cuenta" onClick={go('/cuenta')}>Mi cuenta</a>
      </header>

      {live.length > 0 && (
        <section className="sh-live" aria-label="Clase en directo">
          <span className="sh-dot" aria-hidden="true" />
          <div><b>Tu clase «{live[0].title}» está en marcha</b><span>Código {live[0].room}</span></div>
          <a className="btn primary" href={`/p/${live[0].room}`} onClick={go(`/p/${live[0].room}`)}>Unirme ahora</a>
        </section>
      )}

      {(d.homework?.length ?? 0) > 0 && (
        <section className="sh-hw" id="deberes" aria-labelledby="sh-hw-t">
          <div className="sh-hw-head"><h2 id="sh-hw-t">Deberes</h2><span className="sh-chip">{d.homework!.filter((h) => !h.done).length} pendientes</span></div>
          <ul className="sh-hw-list">{d.homework!.map((h) => (
            <li key={h.id} className={h.done ? 'is-done' : ''}>
              <label className="sh-hw-check"><input type="checkbox" checked={h.done} onChange={async (e) => { const r = await setHomeworkDone(h.id, e.target.checked); setD({ ...d, homework: r.homework }); }} /><span className="sr">Marcar «{h.title}» como hecho</span></label>
              <div><b>{h.title}</b>{h.text && <p>{h.text}</p>}<small>{h.due ? `Para el ${new Date(`${h.due}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Sin fecha límite'}</small></div>
              {h.topics.length > 0 && <a className="btn sm" href={`/practica?temas=${h.topics.join(',')}`} onClick={go(`/practica?temas=${h.topics.join(',')}`)}>Practicar {h.topics.map(topicName).join(', ')} →</a>}
            </li>))}</ul>
        </section>
      )}

      {(d.grades?.length ?? 0) > 0 && (
        <section className="sh-grades" id="notas" aria-labelledby="sh-gr-t">
          <h2 id="sh-gr-t">Mis notas</h2>
          <ul>{d.grades!.map((g) => <li key={g.id}><span className={`sh-score ${g.score >= 5 ? 'ok' : 'ko'}`}>{String(g.score).replace('.', ',')}</span><div><b>{g.title}</b>{g.comment && <p>«{g.comment}»</p>}<small>{new Date(g.at).toLocaleDateString('es-ES')} · {g.by}</small></div></li>)}</ul>
        </section>
      )}

      <section className="sh-continue" aria-label="Continuar estudiando">
        <div>
          <p className="dt-eyebrow">Continuar estudiando</p>
          <h2>{resume ? 'Tienes una práctica a medias' : weak[0] ? `Hoy toca: ${topicName(weak[0])}` : 'Empieza tu primera práctica'}</h2>
          <p className="libre-note">{resume ? 'Retómala donde la dejaste.' : weak[0] ? 'Es el tema que más te conviene repasar ahora mismo.' : '10 preguntas con corrección y explicación. Tus resultados se guardan solos.'}</p>
        </div>
        <a className="btn primary lg" href="/practica" onClick={go(weak[0] && !resume ? `/practica?temas=${weak[0]}` : '/practica')}>{resume ? 'Continuar' : 'Practicar'} →</a>
      </section>

      <section aria-label="Juegos" className="sh-block">
        <h2>Juegos</h2>
        <div className="sh-games">
          {GAMES.map((g) => g.available
            ? <a key={g.id} className="sh-game" href={`/libre?juego=${g.id}`} onClick={go(`/libre?juego=${g.id}`)}><i aria-hidden="true">{GAME_ICON[g.id]}</i><b>{g.name}</b><span>{g.modes.includes('private') ? 'Solo o con amigos' : 'Solo'}</span></a>
            : <div key={g.id} className="sh-game off" aria-disabled="true"><i aria-hidden="true">{GAME_ICON[g.id]}</i><b>{g.name}</b><span>Próximamente</span></div>)}
        </div>
      </section>

      <div className="sh-grid">
        <section className="libre-card" aria-label="Temas para practicar">
          <h2>Temas que te conviene practicar</h2>
          {d.reviews.length > 0 && <p className="libre-note">Tu profesor te ha asignado repaso{d.reviews[0].note ? `: «${d.reviews[0].note}»` : '.'}</p>}
          {weak.length ? <ul className="sh-topics">{weak.map((t) => {
            const st = s.topics.find((x) => x.topic === t);
            const assigned = d.reviews.some((r) => r.topics.includes(t));
            return <li key={t}><a href={`/practica?temas=${t}`} onClick={go(`/practica?temas=${t}`)}><b>{topicName(t)}</b>{assigned && <small className="sh-chip gold">del profe</small>}<span>{st ? `${Math.round(st.accuracy * 100)} % · ${st.attempts} intentos` : 'Sin intentos aún'}</span><i aria-hidden="true">→</i></a></li>;
          })}</ul> : <p className="sh-empty">Cuando practiques, aquí aparecerán los temas en los que más fallas.</p>}
        </section>

        <section className="libre-card" aria-label="Retos semanales">
          <h2>Retos de la semana</h2>
          <ul className="sh-challenges">{d.challenges.map((c) => (
            <li key={c.id} className={c.done ? 'done' : ''}>
              <span>{c.done ? '✓ ' : ''}{c.title}</span>
              <span className="sh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={c.value}><i style={{ width: `${(c.value / c.goal) * 100}%` }} /></span>
              <small>{c.value}/{c.goal}</small>
            </li>))}</ul>
          <p className="libre-note">Se reinician el lunes. Cuentan respuestas y actividades, no el tiempo conectado.</p>
        </section>

        <section className="libre-card" aria-label="Tu progreso">
          <h2>Tu progreso</h2>
          <div className="libre-stats">
            <div className="libre-stat"><span>Esta semana</span><b>{s.weekPoints}</b></div>
            <div className="libre-stat"><span>Racha</span><b>{s.streak}</b></div>
            <div className="libre-stat"><span>Logros</span><b>{done ?? '—'}</b></div>
          </div>
          <Spark values={s.history.map((h) => h.points)} />
          <div className="libre-row"><a className="btn sm" href="/cuenta" onClick={go('/cuenta')}>Ver todo mi progreso</a><a className="btn sm" href="/ranking" onClick={go('/ranking')}>Ranking</a></div>
        </section>

        <section className="libre-card" aria-label="Mis clases">
          <h2>Mis clases</h2>
          {d.classes.length ? <ul className="sh-classes">{d.classes.map((c) => (
            <li key={c.id}><b>{c.title}</b><span>{fmtDate(c.date)} · {c.topics.map(topicName).join(', ') || 'temas variados'}</span>{c.status === 'live' && c.room ? <a className="btn sm primary" href={`/p/${c.room}`} onClick={go(`/p/${c.room}`)}>Unirme</a> : <small className="sh-chip">Planificada</small>}</li>
          ))}</ul> : <p className="sh-empty">No tienes clases programadas. Si tu profesor te da un código, entra desde <a href="/jugar" onClick={go('/jugar')}>Unirse a una clase</a>.</p>}
        </section>

        <section className="libre-card sh-wide" aria-label="Actividades recientes">
          <h2>Actividades recientes</h2>
          {s.activities.length ? <ul className="sh-acts">{s.activities.slice(0, 6).map((a) => (
            <li key={a.at}><i aria-hidden="true">{GAME_ICON[a.game] ?? '·'}</i><b>{GAMES.find((g) => g.id === a.game)?.name ?? a.game}</b><span>{a.level ?? 'mixto'}</span><span className="sh-score">{a.correct}/{a.total}</span><small>{new Date(a.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small></li>
          ))}</ul> : <p className="sh-empty">Todavía no has completado ninguna actividad. Una práctica de 8 preguntas o más cuenta como la primera.</p>}
        </section>
      </div>
    </main>
  );
}
