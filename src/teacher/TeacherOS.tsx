// TEACHER OS — centro de operaciones de la academia (/teacher). Solo profesores: el servidor comprueba la sesión en cada
// petición (cookie HttpOnly emitida tras verificar una clave provisionada en privado). Aquí no se guarda ninguna credencial.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { TOPICS } from '../../shared/rules.ts';
import { navigate, store, usePath } from '../util.ts';
import { AccuracyBars, DiffStack, TrendChart } from './charts.tsx';
import { tapi, TeacherApiError, type Analytics, type Detail, type Group, type LibraryItem, type Overview, type PlannedSession, type StudentRow } from './api.ts';
import '../libre.css';
import './teacher.css';

const topicName = (t: string) => (TOPICS as Record<string, { de: string }>)[t]?.de ?? t;
const TOPIC_IDS = Object.keys(TOPICS);
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`);
const ago = (t: number | null) => { if (!t) return 'nunca'; const d = Math.floor((Date.now() - t) / 86_400_000); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`; };
const go = (path: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); navigate(path); };
const today = () => new Date().toLocaleDateString('sv-SE');
const GAMES: Record<string, string> = { blackcard: 'BlackCard', jenga: 'Wort-Jenga', boxing: 'Boxeo', road: 'Road to B1', none: 'Solo presentación' };

/** URL que crea la sala con el sistema de clases existente (mismo código, mismos Chromebooks). */
export function launchUrl(game: string, topics: string[]) {
  if (game === 'boxing') return '/boxeo';
  if (game === 'road') return '/road-to-b1';
  const q = new URLSearchParams(); if (game === 'jenga') q.set('juego', 'jenga'); if (topics.length) q.set('temas', topics.join(','));
  const s = q.toString().replace(/%2C/g, ',');
  return `/t/new${s ? `?${s}` : ''}`;
}

const NAV = [
  { id: '', label: 'Übersicht', es: 'Resumen', icon: 'M4 13h7V4H4zM13 20h7v-9h-7zM4 20h7v-5H4zM13 4v5h7V4z' },
  { id: 'schueler', label: 'Schüler', es: 'Alumnos', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6' },
  { id: 'unterricht', label: 'Unterricht', es: 'Clases', icon: 'M3 5h18v12H3zM8 21h8M12 17v4' },
  { id: 'analyse', label: 'Analyse', es: 'Análisis', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'bibliothek', label: 'Bibliothek', es: 'Biblioteca', icon: 'M4 4h5v16H4zM10 4h5v16h-5zM16 5l4 1-3 14-4-1z' },
  { id: 'einstellungen', label: 'Einstellungen', es: 'Ajustes', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
] as const;
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { setError(null); fn().then(setData).catch((e: Error) => setError(e.message)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, setData };
}
function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="tos-empty"><svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><circle cx="24" cy="24" r="20" /><path d="M16 26h16M18 20h.01M30 20h.01" /></svg><b>{title}</b>{children && <span>{children}</span>}{action}</div>;
}
function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return <div className={`tos-stat${accent ? ' accent' : ''}`}><span>{label}</span><b className="dotnum">{value}</b>{hint && <small>{hint}</small>}</div>;
}
function Card({ title, children, actions, className = '' }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return <section className={`tos-card ${className}`}><header><h2>{title}</h2>{actions}</header>{children}</section>;
}

/** Pestañas accesibles: flechas izquierda/derecha, Inicio/Fin. */
function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (n === null) return; e.preventDefault();
    const j = (n + tabs.length) % tabs.length; onChange(tabs[j].id); refs.current[j]?.focus();
  };
  return <div className="tos-tabs" role="tablist" aria-label={label}>{tabs.map((t, i) => <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`} tabIndex={value === t.id ? 0 : -1} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)} onKeyDown={(e) => key(e, i)}>{t.label}</button>)}</div>;
}

// ───────────── Acceso ─────────────
function Login({ onIn, closed }: { onIn: () => void; closed: boolean }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(null); try { await tapi('login', { key: key.trim() }); setKey(''); onIn(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return (
    <main className="tos-login" data-teacher-login="">
      <div className="tos-login-card">
        <p className="dt-eyebrow">Teacher OS · acceso privado</p>
        <h1>Lehrerzimmer.</h1>
        <p className="libre-lead">El panel de tu academia. Solo para profesores con una clave emitida en el servidor.</p>
        {closed ? <p className="libre-err" role="alert">Este servidor aún no tiene profesores registrados. Por seguridad, Teacher OS está cerrado hasta que el administrador cree uno en privado con <code>npm run teacher -- add "Nombre"</code>.</p> : (
          <form onSubmit={submit} className="auth-form">
            <label className="acc-field"><span>Clave de profesor</span><input className="field" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" required autoFocus placeholder="dtk_…" spellCheck={false} /></label>
            {error && <p className="libre-err" role="alert">{error}</p>}
            <button className="btn primary lg" disabled={busy || !key.trim()}>{busy ? 'Comprobando…' : 'Entrar en Teacher OS'}</button>
            <p className="libre-note">La clave no se guarda en este navegador: el servidor abre una sesión segura de 12 horas.</p>
          </form>
        )}
        <a className="tos-back" href="/" onClick={go('/')}>← Volver a Deutschtrainer</a>
      </div>
    </main>
  );
}

// ───────────── Übersicht ─────────────
function Overview_() {
  const { data: o, error } = useLoad(() => tapi<Overview>('overview'), []);
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!o) return <div className="tos-skel" aria-busy="true" />;
  return (
    <div className="tos-page" data-tos="overview">
      <header className="tos-page-head">
        <div><p className="dt-eyebrow">Übersicht · {o.academy}</p><h1>Guten Tag.</h1><p className="tos-sub">{o.attention.length ? `${o.attention.length} ${o.attention.length === 1 ? 'cosa necesita' : 'cosas necesitan'} tu atención.` : 'Nada urgente ahora mismo.'}</p></div>
        <div className="tos-quick">
          <a className="btn primary lg" href="/teacher/unterricht?nueva=1" onClick={go('/teacher/unterricht?nueva=1')}>Preparar una clase</a>
          <a className="btn" href="/t/new" onClick={go('/t/new')}>Clase rápida</a>
        </div>
      </header>
      <div className="tos-stats">
        <Stat label="Alumnos" value={o.students.total} hint={o.students.disabled ? `${o.students.disabled} desactivados` : 'cuentas activas'} />
        <Stat label="Activos (7 días)" value={o.students.active7} hint={o.students.total ? `${Math.round((o.students.active7 / o.students.total) * 100)} % del total` : undefined} accent />
        <Stat label="Actividades (7 días)" value={o.activities.week} hint={`${o.activities.total} en total`} />
        <Stat label="Clases" value={o.sessions.done} hint={`${o.sessions.planned} planificadas · ${o.sessions.classRooms30} salas en 30 días`} />
      </div>
      <div className="tos-cols">
        <Card title="Evolución del grupo" className="span2"><TrendChart points={o.trend} minN={o.minN} label="Respuestas y precisión del grupo por semana" /></Card>
        <Card title="Necesita atención">
          {o.attention.length ? <ul className="tos-list">{o.attention.map((a, i) => <li key={i}><a href={`/teacher/schueler/${a.id}`} onClick={go(`/teacher/schueler/${a.id}`)}><b>{a.alias}</b><span>{a.reason}</span></a></li>)}</ul>
            : <Empty title="Todo en orden">Aquí aparecerán alumnos sin actividad o con resultados que conviene repasar.</Empty>}
        </Card>
        <Card title="Temas con más errores (30 días)">
          {o.weakTopics.length ? <ul className="tos-list">{o.weakTopics.map((t) => <li key={t.topic}><div className="tos-row"><b>{t.name}</b><span className="tos-pill warn">{pct(t.accuracy)}</span></div><small>n={t.n} respuestas · {t.students} alumnos</small></li>)}</ul>
            : <Empty title="Datos insuficientes">Se muestran temas con al menos {o.minN} respuestas en los últimos 30 días.</Empty>}
        </Card>
        <Card title="Requiere revisión">
          {o.review.length ? <ul className="tos-list">{o.review.map((r) => <li key={r.code}><a href={`/t/${r.code}`} onClick={go(`/t/${r.code}`)}><b>Sala {r.code}</b><span>{r.pending} respuesta(s) abiertas esperan tu corrección</span></a></li>)}</ul>
            : <Empty title="Sin pendientes">Las respuestas abiertas de tus clases en directo aparecerán aquí.</Empty>}
        </Card>
        <Card title="Próximas clases" actions={<a className="btn sm" href="/teacher/unterricht" onClick={go('/teacher/unterricht')}>Ver todas</a>}>
          {o.upcoming.length ? <ul className="tos-list">{o.upcoming.map((s) => <li key={s.id}><div className="tos-row"><b>{s.title}</b><span className="tos-pill">{s.date}</span></div><small>{GAMES[s.game]} · {s.topics.map(topicName).join(', ') || 'temas variados'}</small></li>)}</ul>
            : <Empty title="Nada programado" action={<a className="btn sm" href="/teacher/unterricht?nueva=1" onClick={go('/teacher/unterricht?nueva=1')}>Planificar</a>} />}
        </Card>
        <Card title="En directo ahora">
          {o.live.length ? <ul className="tos-list">{o.live.map((r) => <li key={r.code}><a href={`/t/${r.code}`} onClick={go(`/t/${r.code}`)}><b>Sala {r.code}</b><span>{r.connected}/{r.players} conectados · {r.block ?? 'vestíbulo'}</span></a></li>)}</ul>
            : <Empty title="Ninguna sala abierta" />}
        </Card>
      </div>
    </div>
  );
}

// ───────────── Schüler ─────────────
function Students() {
  const { data, error, reload } = useLoad(() => tapi<{ students: StudentRow[]; groups: Group[] }>('students'), []);
  const [q, setQ] = useState(''); const [g, setG] = useState(''); const [lv, setLv] = useState('');
  const [adding, setAdding] = useState(false); const [created, setCreated] = useState<{ alias: string; password: string } | null>(null);
  const [newGroup, setNewGroup] = useState('');
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!data) return <div className="tos-skel" aria-busy="true" />;
  const rows = data.students.filter((s) => (!q || s.alias.toLowerCase().includes(q.toLowerCase())) && (!g || s.groups.includes(g)) && (!lv || (lv === 'none' ? !s.level : s.level === lv)));
  const gname = (id: string) => data.groups.find((x) => x.id === id)?.name ?? '';
  return (
    <div className="tos-page" data-tos="students">
      <header className="tos-page-head">
        <div><p className="dt-eyebrow">Schüler</p><h1>Alumnos</h1><p className="tos-sub">{data.students.length} cuentas · {data.groups.length} grupos</p></div>
        <div className="tos-quick"><button className="btn primary lg" onClick={() => { setAdding(true); setCreated(null); }}>Añadir alumno</button></div>
      </header>
      {adding && <AddStudent groups={data.groups} onDone={(c) => { setCreated(c); setAdding(false); reload(); }} onCancel={() => setAdding(false)} />}
      {created && <div className="tos-callout" role="status"><b>Cuenta creada: {created.alias}</b><span>Contraseña temporal (se muestra solo ahora): <code className="tos-secret">{created.password}</code></span><span className="libre-note">Dásela en mano al alumno. Podrá cambiarla en «Mi cuenta». Si la pierde, restablécela desde su ficha.</span><button className="btn sm" onClick={() => setCreated(null)}>Hecho</button></div>}
      <div className="tos-toolbar">
        <input className="field" type="search" placeholder="Buscar alias…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alumno" />
        <select className="field" value={g} onChange={(e) => setG(e.target.value)} aria-label="Filtrar por grupo"><option value="">Todos los grupos</option>{data.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select className="field" value={lv} onChange={(e) => setLv(e.target.value)} aria-label="Filtrar por nivel"><option value="">Todos los niveles</option><option>A1</option><option>A2</option><option>B1</option><option value="none">Sin nivel</option></select>
      </div>
      {rows.length ? (
        <div className="tos-table-wrap">
          <table className="tos-table">
            <thead><tr><th>Alumno</th><th>Nivel</th><th>Grupos</th><th>Última actividad</th><th title="Respuestas en 7 días">7 d</th><th title="Precisión en 30 días, con su n">Precisión 30 d</th><th>Racha</th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id} className={s.disabled ? 'off' : ''} tabIndex={0} onClick={() => navigate(`/teacher/schueler/${s.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/teacher/schueler/${s.id}`); }}>
                <td><span className="tos-avatar" aria-hidden="true">{s.alias[0].toUpperCase()}</span><b>{s.alias}</b>{s.disabled && <span className="tos-pill">desactivada</span>}</td>
                <td>{s.level ?? <span className="dim">—</span>}</td>
                <td>{s.groups.map(gname).join(', ') || <span className="dim">—</span>}</td>
                <td>{ago(s.lastActive)}</td>
                <td>{s.answers7}</td>
                <td>{s.accuracy30 === null ? <span className="dim">—</span> : <>{pct(s.accuracy30)} <small className="dim">n={s.answers30}</small></>}</td>
                <td>{s.streak}</td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Empty title={data.students.length ? 'Ningún alumno con esos filtros' : 'Todavía no hay alumnos'}>{data.students.length ? undefined : 'Los alumnos aparecen aquí al crear su cuenta en «Crear cuenta», o puedes darlos de alta tú con una contraseña temporal.'}</Empty>}
      <Card title="Grupos">
        <form className="tos-inline" onSubmit={async (e) => { e.preventDefault(); if (!newGroup.trim()) return; await tapi('groups', { name: newGroup }); setNewGroup(''); reload(); }}>
          <input className="field" placeholder="Nuevo grupo, p. ej. «A2 martes 18h»" value={newGroup} maxLength={40} onChange={(e) => setNewGroup(e.target.value)} aria-label="Nombre del grupo" />
          <button className="btn" disabled={!newGroup.trim()}>Crear grupo</button>
        </form>
        {data.groups.length ? <ul className="tos-chips">{data.groups.map((x) => <li key={x.id}><span>{x.name} <small className="dim">{data.students.filter((s) => s.groups.includes(x.id)).length}</small></span><button className="tos-x" aria-label={`Borrar grupo ${x.name}`} onClick={async () => { if (confirm(`¿Borrar el grupo «${x.name}»? Los alumnos no se borran.`)) { await tapi(`groups/${x.id}/delete`, {}); reload(); } }}>×</button></li>)}</ul> : <p className="tos-empty-inline">Sin grupos todavía.</p>}
      </Card>
    </div>
  );
}

function AddStudent({ groups, onDone, onCancel }: { groups: Group[]; onDone: (c: { alias: string; password: string }) => void; onCancel: () => void }) {
  const [alias, setAlias] = useState(''); const [level, setLevel] = useState(''); const [group, setGroup] = useState(''); const [error, setError] = useState<string | null>(null);
  return (
    <form className="tos-card tos-form" onSubmit={async (e) => {
      e.preventDefault(); setError(null);
      try { const r = await tapi<{ id: string; alias: string; password: string }>('students', { alias, ...(level ? { level } : {}) }); if (group) await tapi(`students/${r.id}`, { groups: [group] }); onDone(r); } catch (err) { setError((err as Error).message); }
    }}>
      <h2>Añadir alumno</h2>
      <p className="libre-note">Se crea con un alias (nada de nombres reales ni correo) y una contraseña temporal que verás una sola vez.</p>
      <div className="tos-grid3">
        <label className="acc-field"><span>Alias</span><input className="field" value={alias} maxLength={16} required autoFocus onChange={(e) => setAlias(e.target.value)} /></label>
        <label className="acc-field"><span>Nivel</span><select className="field" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Sin asignar</option><option>A1</option><option>A2</option><option>B1</option></select></label>
        <label className="acc-field"><span>Grupo</span><select className="field" value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Ninguno</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      </div>
      {error && <p className="libre-err" role="alert">{error}</p>}
      <div className="libre-row"><button className="btn primary" disabled={!alias.trim()}>Crear cuenta</button><button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

type Tab = 'uebersicht' | 'fortschritt' | 'grammatik' | 'aktivitaeten' | 'notizen';
function StudentDetail({ id }: { id: string }) {
  const { data: d, error, reload, setData } = useLoad(() => tapi<Detail>(`students/${id}`), [id]);
  const { data: groups } = useLoad(() => tapi<{ groups: Group[] }>('groups'), []);
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'uebersicht');
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState(''); const [reviewTopics, setReviewTopics] = useState<string[]>([]); const [reviewNote, setReviewNote] = useState('');
  const [att, setAtt] = useState({ date: today(), status: 'present' as 'present' | 'absent' | 'late' });
  if (error) return <div className="tos-page"><p className="libre-err" role="alert">{error}</p><a href="/teacher/schueler" onClick={go('/teacher/schueler')}>← Alumnos</a></div>;
  if (!d) return <div className="tos-skel" aria-busy="true" />;
  const s = d.student;
  const patch = async (body: Record<string, unknown>) => { try { await tapi(`students/${id}`, body); reload(); } catch (e) { setMsg((e as Error).message); } };
  const tabs: { id: Tab; label: string }[] = [{ id: 'uebersicht', label: 'Übersicht' }, { id: 'fortschritt', label: 'Fortschritt' }, { id: 'grammatik', label: 'Grammatik' }, { id: 'aktivitaeten', label: 'Aktivitäten' }, { id: 'notizen', label: 'Lehrernotizen' }];
  const changeTab = (t: Tab) => { setTab(t); history.replaceState(null, '', `/teacher/schueler/${id}?tab=${t}`); };
  return (
    <div className="tos-page" data-tos="student">
      <a className="tos-back" href="/teacher/schueler" onClick={go('/teacher/schueler')}>← Alumnos</a>
      <header className="tos-student-head">
        <span className="tos-avatar lg" aria-hidden="true">{s.alias[0].toUpperCase()}</span>
        <div><h1>{s.alias}</h1><p className="tos-sub">{s.createdByTeacher ? 'Alta por el profesor' : 'Se registró solo'} · última actividad {ago(s.lastActive)}{s.disabled ? ' · cuenta desactivada' : ''}</p></div>
        <div className="tos-head-controls">
          <label className="acc-field"><span>Nivel</span><select className="field" value={s.level ?? ''} onChange={(e) => void patch({ level: e.target.value || null })}><option value="">Sin asignar</option><option>A1</option><option>A2</option><option>B1</option></select></label>
          <fieldset className="tos-groups"><legend>Grupos</legend>{groups?.groups.length ? groups.groups.map((g) => <label key={g.id}><input type="checkbox" checked={s.groups.includes(g.id)} onChange={(e) => void patch({ groups: e.target.checked ? [...s.groups, g.id] : s.groups.filter((x) => x !== g.id) })} /> {g.name}</label>) : <span className="dim">Sin grupos</span>}</fieldset>
        </div>
      </header>
      {msg && <p className="libre-err" role="alert">{msg}</p>}
      <Tabs tabs={tabs} value={tab} onChange={changeTab} label="Ficha del alumno" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tos-panel">
        {tab === 'uebersicht' && <>
          <div className="tos-stats">
            <Stat label="Respuestas" value={d.overview.answers} hint={d.overview.answers ? `${pct(d.overview.correct / d.overview.answers)} correctas` : undefined} />
            <Stat label="Actividades" value={d.overview.activities} />
            <Stat label="Días activos (28)" value={d.overview.activeDays28} hint="frecuencia de práctica" />
            <Stat label="Racha" value={s.streak} accent />
          </div>
          <div className="tos-cols">
            <Card title="Le conviene repasar">{d.overview.recommended.length ? <ul className="tos-chips">{d.overview.recommended.map((t) => <li key={t}><span>{topicName(t)}</span></li>)}</ul> : <Empty title="Datos insuficientes">Se recomiendan temas con al menos 2 intentos y menos del 85 % de acierto.</Empty>}</Card>
            <Card title="Errores recurrentes">{d.errors.length ? <ul className="tos-list">{d.errors.slice(0, 6).map((e) => <li key={e.qid}><span lang="de">{e.prompt}</span><small>{e.wrong} fallos de {e.n} · {topicName(e.topic)}</small></li>)}</ul> : <Empty title="Sin errores repetidos" />}</Card>
            <Card title="Asignar repaso" className="span2">
              <p className="libre-note">El alumno verá estos temas en su espacio («del profe») y podrá practicarlos con un clic.</p>
              <ul className="tos-chips pick">{TOPIC_IDS.map((t) => <li key={t}><label><input type="checkbox" checked={reviewTopics.includes(t)} onChange={(e) => setReviewTopics((x) => (e.target.checked ? [...x, t] : x.filter((y) => y !== t)))} /> {topicName(t)}</label></li>)}</ul>
              <div className="tos-inline"><input className="field" placeholder="Indicación para el alumno (opcional, la verá)" value={reviewNote} maxLength={200} onChange={(e) => setReviewNote(e.target.value)} /><button className="btn primary" disabled={!reviewTopics.length} onClick={async () => { await tapi(`students/${id}/review`, { topics: reviewTopics, note: reviewNote || undefined }); setReviewTopics([]); setReviewNote(''); reload(); }}>Asignar</button></div>
              {d.reviews.length > 0 && <ul className="tos-list">{d.reviews.map((r) => <li key={r.id}><div className="tos-row"><b>{r.topics.map(topicName).join(', ')}</b><button className="tos-x" aria-label="Quitar repaso" onClick={async () => { await tapi(`students/${id}/review`, { delete: r.id }); reload(); }}>×</button></div><small>{new Date(r.at).toLocaleDateString('es-ES')} · {r.by}{r.note ? ` · «${r.note}»` : ''}</small></li>)}</ul>}
            </Card>
            <Card title="Cuenta" className="span2">
              <div className="libre-row">
                <button className="btn" onClick={async () => { const r = await tapi<{ password: string }>(`students/${id}/reset-password`, {}); setMsg(null); alert(`Nueva contraseña temporal para ${s.alias}:\n\n${r.password}\n\nSe muestra solo ahora. Sus sesiones abiertas se han cerrado.`); }}>Restablecer contraseña</button>
                <button className={`btn${s.disabled ? ' primary' : ''}`} onClick={() => { if (s.disabled || confirm(`¿Desactivar la cuenta de ${s.alias}? No podrá entrar, pero sus datos se conservan.`)) void patch({ disabled: !s.disabled }); }}>{s.disabled ? 'Reactivar cuenta' : 'Desactivar cuenta'}</button>
              </div>
            </Card>
          </div>
        </>}
        {tab === 'fortschritt' && <Card title="Evolución semanal (12 semanas)"><TrendChart points={d.progress} minN={d.minN} label={`Evolución de ${s.alias}`} />
          <div className="tos-table-wrap"><table className="tos-table compact"><thead><tr><th>Semana</th><th>Respuestas</th><th>Precisión</th><th>Actividades</th><th>Puntos</th></tr></thead><tbody>{d.progress.filter((p) => p.n || p.activities).reverse().map((p) => <tr key={p.week}><td>{p.week}</td><td>{p.n}</td><td>{p.n < d.minN && p.n ? <>{pct(p.accuracy)} <small className="dim">(pocos datos)</small></> : pct(p.accuracy)}</td><td>{p.activities}</td><td>{p.points}</td></tr>)}</tbody></table></div>
        </Card>}
        {tab === 'grammatik' && <Card title="Resultados por tema y dificultad">
          {d.grammar.length ? <div className="tos-table-wrap"><table className="tos-table"><thead><tr><th>Tema</th><th>n</th><th>Precisión</th><th>Por dificultad</th></tr></thead><tbody>{d.grammar.map((g) => <tr key={g.topic}><td><b>{g.name}</b></td><td>{g.n}</td><td>{g.n < d.minN ? <>{pct(g.accuracy)} <small className="dim">(datos insuficientes)</small></> : pct(g.accuracy)}</td><td><DiffStack byDiff={g.byDiff} /></td></tr>)}</tbody></table></div> : <Empty title="Sin respuestas todavía" />}
        </Card>}
        {tab === 'aktivitaeten' && <Card title="Historial de juegos y ejercicios">
          {d.activities.length ? <ul className="tos-list">{d.activities.map((a) => <li key={a.at}><div className="tos-row"><b>{GAMES[a.game] ?? a.game} {a.level ?? ''}</b><span className="tos-pill">{a.correct}/{a.total}</span></div><small>{new Date(a.at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}{a.room && !a.room.startsWith('P') ? ` · sala ${a.room}` : ''} · {a.points} pts</small></li>)}</ul> : <Empty title="Aún no ha completado actividades" />}
        </Card>}
        {tab === 'notizen' && <div className="tos-cols">
          <Card title="Lehrernotizen (privadas)">
            <p className="libre-note">Solo las ven los profesores. Nunca aparecen al alumno ni en rutas públicas.</p>
            <form className="tos-note-form" onSubmit={async (e) => { e.preventDefault(); const r = await tapi<{ notes: Detail['notes'] }>(`students/${id}/notes`, { text: note }); setData({ ...d, notes: r.notes }); setNote(''); }}>
              <textarea className="field" rows={3} maxLength={2000} placeholder="Observación pedagógica…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nueva nota" />
              <button className="btn primary" disabled={!note.trim()}>Guardar nota</button>
            </form>
            {d.notes.length ? <ul className="tos-notes">{d.notes.map((n) => <li key={n.id}><p>{n.text}</p><small>{new Date(n.at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })} · {n.by}</small><button className="tos-x" aria-label="Borrar nota" onClick={async () => { if (!confirm('¿Borrar esta nota?')) return; const r = await tapi<{ notes: Detail['notes'] }>(`students/${id}/notes`, { delete: n.id }); setData({ ...d, notes: r.notes }); }}>×</button></li>)}</ul> : <Empty title="Sin notas" />}
          </Card>
          <Card title="Asistencia">
            <form className="tos-inline" onSubmit={async (e) => { e.preventDefault(); const r = await tapi<{ attendance: Detail['attendance'] }>(`students/${id}/attendance`, att); setData({ ...d, attendance: r.attendance }); }}>
              <input className="field" type="date" value={att.date} onChange={(e) => setAtt({ ...att, date: e.target.value })} aria-label="Fecha" />
              <select className="field" value={att.status} onChange={(e) => setAtt({ ...att, status: e.target.value as 'present' })} aria-label="Estado"><option value="present">Presente</option><option value="late">Tarde</option><option value="absent">Ausente</option></select>
              <button className="btn">Registrar</button>
            </form>
            {d.attendance.length ? <ul className="tos-list">{d.attendance.slice(0, 20).map((a) => <li key={a.date}><div className="tos-row"><span>{a.date}</span><span className={`tos-pill ${a.status === 'absent' ? 'warn' : a.status === 'late' ? 'gold' : 'ok'}`}>{{ present: 'Presente', late: 'Tarde', absent: 'Ausente' }[a.status]}</span></div></li>)}</ul> : <Empty title="Sin registros" />}
          </Card>
        </div>}
      </div>
    </div>
  );
}

// ───────────── Unterricht ─────────────
function Lessons() {
  const { data, error, reload } = useLoad(() => tapi<{ sessions: PlannedSession[]; groups: Group[]; live: Overview['live'] }>('sessions'), []);
  const { data: lib } = useLoad(() => tapi<{ items: LibraryItem[] }>('library'), []);
  const { data: studs } = useLoad(() => tapi<{ students: StudentRow[] }>('students'), []);
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('nueva'));
  const [f, setF] = useState({ title: '', date: today(), groupId: '', studentIds: [] as string[], game: 'blackcard', topics: [] as string[], level: '', presentation: '' });
  const [results, setResults] = useState<{ id: string; rows: { key: string; alias: string; n: number; accuracy: number | null }[] } | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!data) return <div className="tos-skel" aria-busy="true" />;
  const start = async (s: PlannedSession) => {
    // La sala se crea con el sistema de clases de siempre (código + Chromebooks). Al recibir el código, Teacher OS la vincula a esta clase.
    store.set('dt:tos-session', s.id);
    navigate(launchUrl(s.game, s.topics));
  };
  const groups = new Map(data.groups.map((g) => [g.id, g.name]));
  const section = (title: string, list: PlannedSession[], emptyText: string) => (
    <Card title={title}>
      {list.length ? <ul className="tos-sessions">{list.map((s) => (
        <li key={s.id}>
          <div className="tos-session-main"><b>{s.title}</b><span>{s.date} · {GAMES[s.game]} · {s.topics.map(topicName).join(', ') || 'temas variados'}{s.level ? ` · ${s.level}` : ''}{s.groupId ? ` · ${groups.get(s.groupId) ?? ''}` : ''}{s.studentIds?.length ? ` · ${s.studentIds.length} alumnos` : ''}</span>{s.presentation && <small>Presentación: {lib?.items.find((i) => i.id === s.presentation)?.title ?? s.presentation}</small>}</div>
          <div className="tos-session-actions">
            {s.status === 'planned' && <button className="btn primary sm" onClick={() => void start(s)}>Iniciar</button>}
            {s.status === 'live' && <>{s.room && <a className="btn sm" href={`/t/${s.room}`} onClick={go(`/t/${s.room}`)}>Recuperar sala {s.room}</a>}<button className="btn sm" onClick={async () => { await tapi(`sessions/${s.id}/end`, {}); reload(); }}>Terminar</button></>}
            {s.status === 'done' && <button className="btn sm" onClick={async () => { const r = await tapi<{ results: { students: { key: string; alias: string; n: number; accuracy: number | null }[] } }>(`sessions/${s.id}`); setResults({ id: s.id, rows: r.results.students }); }}>Resultados</button>}
            {s.presentation && lib?.items.find((i) => i.id === s.presentation)?.open && <a className="btn sm ghost" href={lib.items.find((i) => i.id === s.presentation)!.open!} target="_blank" rel="noopener">Presentación ↗</a>}
            <button className="tos-x" aria-label={`Borrar ${s.title}`} onClick={async () => { if (confirm(`¿Borrar «${s.title}»?`)) { await tapi(`sessions/${s.id}/delete`, {}); reload(); } }}>×</button>
          </div>
          {results?.id === s.id && <div className="tos-results">{results.rows.length ? <AccuracyBars rows={results.rows.map((r) => ({ key: r.alias, n: r.n, correct: Math.round((r.accuracy ?? 0) * r.n), accuracy: r.accuracy }))} minN={10} label="Resultados por alumno" /> : <p className="tos-empty-inline">Sin respuestas de alumnos con cuenta en esta sala{s.room ? '' : ' (no se vinculó ninguna sala)'}.</p>}</div>}
        </li>))}</ul> : <p className="tos-empty-inline">{emptyText}</p>}
    </Card>
  );
  return (
    <div className="tos-page" data-tos="lessons">
      <header className="tos-page-head">
        <div><p className="dt-eyebrow">Unterricht</p><h1>Clases</h1><p className="tos-sub">Planifica, inicia con el sistema de salas de siempre (código y Chromebooks) y consulta los resultados.</p></div>
        <div className="tos-quick"><button className="btn primary lg" onClick={() => setOpen((x) => !x)}>{open ? 'Cerrar' : 'Nueva clase'}</button></div>
      </header>
      {open && (
        <form className="tos-card tos-form" onSubmit={async (e) => {
          e.preventDefault(); setError2(null);
          try { await tapi('sessions', { ...f, groupId: f.groupId || undefined, level: f.level || undefined, presentation: f.presentation || undefined, studentIds: f.studentIds.length ? f.studentIds : undefined }); setOpen(false); setF({ ...f, title: '', topics: [], studentIds: [] }); reload(); } catch (err) { setError2((err as Error).message); }
        }}>
          <h2>Nueva clase</h2>
          <div className="tos-grid3">
            <label className="acc-field"><span>Título</span><input className="field" value={f.title} maxLength={80} required onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Dativ con juegos" /></label>
            <label className="acc-field"><span>Fecha</span><input className="field" type="date" value={f.date} required onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="acc-field"><span>Juego</span><select className="field" value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}>{Object.entries(GAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="acc-field"><span>Grupo</span><select className="field" value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}><option value="">Sin grupo</option>{data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label className="acc-field"><span>Dificultad</span><select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">Mezclada</option><option>A1</option><option>A2</option><option value="B1">B1 Training</option></select></label>
            <label className="acc-field"><span>Presentación</span><select className="field" value={f.presentation} onChange={(e) => setF({ ...f, presentation: e.target.value })}><option value="">Ninguna</option>{lib?.items.filter((i) => i.type === 'presentacion').map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
          </div>
          <fieldset className="tos-fieldset"><legend>Temas</legend><ul className="tos-chips pick">{TOPIC_IDS.map((t) => <li key={t}><label><input type="checkbox" checked={f.topics.includes(t)} onChange={(e) => setF({ ...f, topics: e.target.checked ? [...f.topics, t] : f.topics.filter((x) => x !== t) })} /> {topicName(t)}</label></li>)}</ul></fieldset>
          {!!studs?.students.length && <fieldset className="tos-fieldset"><legend>Alumnos concretos (opcional)</legend><ul className="tos-chips pick">{studs.students.filter((s) => !s.disabled).map((s) => <li key={s.id}><label><input type="checkbox" checked={f.studentIds.includes(s.id)} onChange={(e) => setF({ ...f, studentIds: e.target.checked ? [...f.studentIds, s.id] : f.studentIds.filter((x) => x !== s.id) })} /> {s.alias}</label></li>)}</ul></fieldset>}
          {error2 && <p className="libre-err" role="alert">{error2}</p>}
          <div className="libre-row"><button className="btn primary" disabled={!f.title.trim()}>Guardar clase</button><span className="libre-note">Los alumnos del grupo la verán en su espacio y, cuando la inicies, un botón para unirse.</span></div>
        </form>
      )}
      {data.live.length > 0 && <Card title="Salas en directo"><ul className="tos-list">{data.live.map((r) => <li key={r.code}><a href={`/t/${r.code}`} onClick={go(`/t/${r.code}`)}><b>Sala {r.code}</b><span>{r.connected}/{r.players} conectados · {r.block ?? 'vestíbulo'}{r.review ? ` · ${r.review} por revisar` : ''}</span></a></li>)}</ul></Card>}
      {section('En marcha', data.sessions.filter((s) => s.status === 'live'), 'Ninguna clase en marcha.')}
      {section('Planificadas', data.sessions.filter((s) => s.status === 'planned').sort((a, b) => a.date.localeCompare(b.date)), 'Sin clases planificadas. Crea una con «Nueva clase».')}
      {section('Realizadas', data.sessions.filter((s) => s.status === 'done'), 'Aquí quedarán tus clases terminadas con sus resultados.')}
    </div>
  );
}

// ───────────── Analyse ─────────────
function AnalysePage() {
  const { data: studs } = useLoad(() => tapi<{ students: StudentRow[] }>('students'), []);
  const [f, setF] = useState({ days: '30', student: '', topic: '', diff: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const { data: a, error } = useLoad(() => tapi<Analytics>(`analytics?${qs}`), [qs]);
  const diffName = (k: string) => ({ easy: 'Fácil', medium: 'Media', hard: 'Difícil', special: 'Examen', desconocida: 'Sin dato' } as Record<string, string>)[k] ?? k;
  const dayName = (k: string) => ({ Mon: 'Lunes', Tue: 'Martes', Wed: 'Miércoles', Thu: 'Jueves', Fri: 'Viernes', Sat: 'Sábado', Sun: 'Domingo' } as Record<string, string>)[k] ?? k;
  const srcName = (k: string) => ({ practice: 'Práctica', class: 'Clase', jenga: 'Wort-Jenga', boxing: 'Boxeo', road: 'Road to B1' } as Record<string, string>)[k] ?? k;
  return (
    <div className="tos-page" data-tos="analyse">
      <header className="tos-page-head"><div><p className="dt-eyebrow">Analyse</p><h1>Rendimiento</h1><p className="tos-sub">Estadística descriptiva de respuestas reales. Cada valor lleva su número de observaciones.</p></div></header>
      <div className="tos-toolbar">
        <select className="field" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} aria-label="Período"><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="365">Un año</option></select>
        <select className="field" value={f.student} onChange={(e) => setF({ ...f, student: e.target.value })} aria-label="Alumno"><option value="">Todos los alumnos</option>{studs?.students.map((s) => <option key={s.id} value={s.id}>{s.alias}</option>)}</select>
        <select className="field" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} aria-label="Tema"><option value="">Todos los temas</option>{TOPIC_IDS.map((t) => <option key={t} value={t}>{topicName(t)}</option>)}</select>
        <select className="field" value={f.diff} onChange={(e) => setF({ ...f, diff: e.target.value })} aria-label="Dificultad"><option value="">Toda dificultad</option><option value="easy">Fácil</option><option value="medium">Media</option><option value="hard">Difícil</option><option value="special">Examen</option></select>
      </div>
      {error && <p className="libre-err" role="alert">{error}</p>}
      {a && <>
        <div className="tos-stats">
          <Stat label="Respuestas (n)" value={a.n} /><Stat label="Alumnos" value={a.students} /><Stat label="Precisión" value={a.sufficient ? pct(a.accuracy) : '—'} hint={a.sufficient ? undefined : 'datos insuficientes'} accent />
        </div>
        {!a.sufficient && <div className="tos-callout warn" role="status"><b>Datos insuficientes</b><span>Con menos de {a.minN} respuestas en este filtro no se puede sacar ninguna conclusión. Amplía el período o quita filtros.</span></div>}
        <div className="tos-cols">
          <Card title="Por dificultad"><AccuracyBars rows={a.byDiff} minN={a.minN} label="Precisión por dificultad" names={diffName} /></Card>
          <Card title="Por tema"><AccuracyBars rows={a.byTopic} minN={a.minN} label="Precisión por tema" names={topicName} /></Card>
          <Card title="Por día de la semana"><AccuracyBars rows={a.byWeekday} minN={a.minN} label="Precisión por día" names={dayName} /></Card>
          <Card title="Por franja horaria"><AccuracyBars rows={a.byHour} minN={a.minN} label="Precisión por hora" /></Card>
          <Card title="Por tipo de actividad" className="span2"><AccuracyBars rows={a.bySource} minN={a.minN} label="Precisión por actividad" names={srcName} /></Card>
        </div>
        <p className="libre-note">{a.note} Las diferencias entre grupos pequeños suelen deberse al azar. Estos datos describen respuestas, no capacidades de nadie.</p>
      </>}
    </div>
  );
}

// ───────────── Bibliothek ─────────────
function Library() {
  const { data, error } = useLoad(() => tapi<{ items: LibraryItem[] }>('library'), []);
  const [q, setQ] = useState(''); const [lv, setLv] = useState(''); const [type, setType] = useState(''); const [topic, setTopic] = useState('');
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!data) return <div className="tos-skel" aria-busy="true" />;
  const topicsAll = [...new Set(data.items.flatMap((i) => i.topics.map((t) => topicName(t))))].sort();
  const items = data.items.filter((i) => (!lv || i.levels.includes(lv)) && (!type || i.type === type) && (!topic || i.topics.map(topicName).includes(topic)) && (!q || `${i.title} ${i.description}`.toLowerCase().includes(q.toLowerCase())));
  const TYPE: Record<string, string> = { presentacion: 'Presentación', juego: 'Juego', examen: 'Examen', actividad: 'Actividad', repaso: 'Repaso' };
  // Presentaciones → temas del banco para lanzar un juego sobre ellas.
  const bankTopics = (i: LibraryItem) => TOPIC_IDS.filter((t) => i.topics.some((x) => { const a = x.toLowerCase(), b = topicName(t).toLowerCase(); return a === t || a.includes(b.split(' ')[0]) || b.includes(a); }));
  return (
    <div className="tos-page" data-tos="library">
      <header className="tos-page-head"><div><p className="dt-eyebrow">Bibliothek</p><h1>Biblioteca</h1><p className="tos-sub">{data.items.length} recursos: presentaciones, juegos, examen y repasos por tema.</p></div></header>
      <div className="tos-toolbar">
        <input className="field" type="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar recurso" />
        <select className="field" value={lv} onChange={(e) => setLv(e.target.value)} aria-label="Nivel"><option value="">Todos los niveles</option><option>A1</option><option>A2</option><option value="B1">B1 Training</option></select>
        <select className="field" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="field" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Tema"><option value="">Todos los temas</option>{topicsAll.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {items.length ? <ul className="tos-lib">{items.map((i) => (
        <li key={i.id} className={`tos-lib-item t-${i.type}`}>
          <span className="tos-pill">{TYPE[i.type]}</span>
          <b>{i.title}</b><p>{i.description}</p>
          <div className="tos-tags">{i.levels.map((l) => <span key={l} className="tos-pill gold">{l}</span>)}{i.topics.slice(0, 4).map((t) => <span key={t} className="tos-pill">{topicName(t)}</span>)}</div>
          <div className="libre-row">
            {i.open && <a className="btn sm" href={i.open} target={i.type === 'presentacion' ? '_blank' : undefined} rel="noopener" onClick={i.type === 'presentacion' ? undefined : go(i.open)}>Abrir{i.type === 'presentacion' ? ' ↗' : ''}</a>}
            {i.pdf && <a className="btn sm ghost" href={i.pdf} target="_blank" rel="noopener">PDF</a>}
            {(i.launch || i.type === 'presentacion') && <button className="btn sm primary" onClick={() => navigate(launchUrl(i.launch ?? 'blackcard', i.type === 'presentacion' ? bankTopics(i) : i.topics.filter((t) => TOPIC_IDS.includes(t))))}>Lanzar en clase</button>}
          </div>
        </li>))}</ul> : <Empty title="Nada con esos filtros" />}
    </div>
  );
}

// ───────────── Einstellungen ─────────────
function Settings({ me, onOut, onChange }: { me: { name: string; academy: { name: string }; teachers: { name: string }[]; mode: string }; onOut: () => void; onChange: () => void }) {
  const [name, setName] = useState(me.academy.name); const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="tos-page" data-tos="settings">
      <header className="tos-page-head"><div><p className="dt-eyebrow">Einstellungen</p><h1>Ajustes de la academia</h1></div></header>
      <div className="tos-cols">
        <Card title="Academia"><form className="tos-inline" onSubmit={async (e) => { e.preventDefault(); try { await tapi('settings', { academy: name }); setMsg('Guardado.'); onChange(); } catch (err) { setMsg((err as Error).message); } }}><input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la academia" /><button className="btn primary">Guardar</button></form>{msg && <p className="libre-note" role="status">{msg}</p>}</Card>
        <Card title="Profesores"><ul className="tos-list">{me.teachers.map((t) => <li key={t.name}><b>{t.name}</b></li>)}</ul><p className="libre-note">Las claves se crean y revocan en el servidor, en privado: <code>npm run teacher -- add "Nombre"</code> · <code>list</code> · <code>revoke &lt;id&gt;</code>.</p></Card>
        <Card title="Seguridad y privacidad" className="span2">
          <ul className="tos-list">
            <li><b>Acceso de profesor: {me.mode === 'required' ? 'clave obligatoria (fail-closed)' : me.mode === 'off' ? 'desactivado' : 'opcional en transición'}</b><small>TEACHER_AUTH={me.mode}. Teacher OS exige siempre una sesión de profesor, sea cual sea este modo.</small></li>
            <li><b>Alumnado sin datos personales</b><small>Solo alias y contraseña (hash scrypt). Sin correo, nombre real ni fecha de nacimiento.</small></li>
            <li><b>Notas y asistencia privadas</b><small>Solo las ven los profesores; ninguna ruta de alumno o pública las devuelve.</small></li>
            <li><b>Ranking opcional</b><small>Desactivado por defecto; solo alias y puntos.</small></li>
          </ul>
        </Card>
      </div>
      <div className="libre-row"><button className="btn" onClick={onOut}>Cerrar sesión de Teacher OS</button></div>
    </div>
  );
}

// ───────────── Shell ─────────────
export function TeacherOS() {
  const path = usePath();
  const [me, setMe] = useState<{ name: string; academy: { name: string }; teachers: { name: string }[]; mode: string } | null | 'out' | 'closed'>(null);
  const check = useCallback(() => { tapi<NonNullable<typeof me>>('me').then(setMe).catch((e) => setMe(e instanceof TeacherApiError && e.status === 503 ? 'closed' : 'out')); }, []);
  useEffect(() => {
    check();
  }, [check]);
  if (me === null) return <div className="tos-skel full" aria-busy="true" />;
  if (me === 'out' || me === 'closed') {
    return <LoginGate onIn={check} />;
  }
  const seg = path.replace(/^\/teacher\/?/, '').split('/');
  const section = seg[0] ?? '';
  const out = async () => { await tapi('logout', {}).catch(() => {}); setMe('out'); };
  return (
    <div className="tos" data-teacher-os="">
      <aside className="tos-side" aria-label="Teacher OS">
        <div className="tos-brand"><span className="tos-logo" aria-hidden="true">T</span><div><b>Teacher OS</b><small>{me.academy.name}</small></div></div>
        <nav className="tos-nav">{NAV.map((n) => <a key={n.id} href={`/teacher${n.id ? `/${n.id}` : ''}`} onClick={go(`/teacher${n.id ? `/${n.id}` : ''}`)} aria-current={section === n.id ? 'page' : undefined}><Icon d={n.icon} /><span><b>{n.label}</b><small>{n.es}</small></span></a>)}</nav>
        <div className="tos-me"><span className="tos-avatar" aria-hidden="true">{me.name[0]?.toUpperCase()}</span><div><b>{me.name}</b><small>Profesor</small></div><button className="tos-x" onClick={() => void out()} aria-label="Cerrar sesión" title="Cerrar sesión">⏻</button></div>
      </aside>
      <main className="tos-main" id="contenido">
        {section === '' && <Overview_ />}
        {section === 'schueler' && (seg[1] ? <StudentDetail key={seg[1]} id={seg[1]} /> : <Students />)}
        {section === 'unterricht' && <Lessons />}
        {section === 'analyse' && <AnalysePage />}
        {section === 'bibliothek' && <Library />}
        {section === 'einstellungen' && <Settings me={me} onOut={() => void out()} onChange={check} />}
      </main>
    </div>
  );
}
function LoginGate({ onIn }: { onIn: () => void }) {
  const [closed, setClosed] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => setClosed(r.status === 503)).catch(() => setClosed(false)); }, []);
  if (closed === null) return <div className="tos-skel full" aria-busy="true" />;
  return <Login onIn={onIn} closed={closed} />;
}
