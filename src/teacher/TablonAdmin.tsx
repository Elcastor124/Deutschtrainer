// Teacher OS · Tablón: el profesor ve TODAS las peticiones (con el alias del autor), cambia el estado
// (abierta → en marcha → hecha / descartada), responde y quita tickets del tablón. Usa las rutas de profesor
// del servidor (/api/tablon/admin…, protegidas con la sesión de Teacher OS).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORY_LABEL, STATUS_LABEL, type TicketStatus, type TicketView } from '../tablon-client.ts';

type AdminTicket = TicketView & { alias: string };
const STATUSES: TicketStatus[] = ['abierto', 'en-curso', 'hecho', 'descartado'];

async function admin<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/tablon/admin${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => null) as ({ error?: string } & T) | null;
  if (!r.ok) throw new Error(data?.error ?? 'No se pudo completar la acción.');
  return data as T;
}
const when = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export function TablonAdmin() {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pendientes' | TicketStatus | 'todas'>('pendientes');
  const load = useCallback(() => { admin<{ tickets: AdminTicket[] }>('').then((d) => setTickets(d.tickets)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (tickets ?? []).filter((t) => t.status === s).length])) as Record<TicketStatus, number>, [tickets]);
  const list = useMemo(() => (tickets ?? []).filter((t) => filter === 'todas' ? true : filter === 'pendientes' ? t.status === 'abierto' || t.status === 'en-curso' : t.status === filter)
    .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt), [tickets, filter]);

  const replace = (t: AdminTicket) => setTickets((l) => (l ?? []).map((x) => (x.id === t.id ? t : x)));
  if (error) return <p className="libre-err" role="alert">{error}</p>;
  if (!tickets) return <div className="tos-skel" aria-busy="true" />;
  return (
    <div className="tos-page" data-tos="tablon">
      <header className="tos-page-head"><div><p className="dt-eyebrow">Tablón</p><h1>Peticiones del alumnado</h1>
        <p className="tos-sub">{counts.abierto} abiertas · {counts['en-curso']} en marcha · {counts.hecho} hechas · {counts.descartado} descartadas. Lo que marques aquí lo ven los alumnos en <a href="/tablon" target="_blank" rel="noopener">el tablón ↗</a>.</p></div></header>
      <div className="tos-toolbar" role="group" aria-label="Filtrar peticiones">
        {([['pendientes', `Pendientes (${counts.abierto + counts['en-curso']})`], ['hecho', `Hechas (${counts.hecho})`], ['descartado', `Descartadas (${counts.descartado})`], ['todas', `Todas (${tickets.length})`]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`btn sm${filter === id ? ' primary' : ' ghost'}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {list.length ? <ul className="tos-tb">{list.map((t) => <AdminCard key={t.id} t={t} onChange={replace} onGone={() => setTickets((l) => (l ?? []).filter((x) => x.id !== t.id))} />)}</ul>
        : <p className="tos-sub">Nada por aquí.</p>}
    </div>
  );
}

function AdminCard({ t, onChange, onGone }: { t: AdminTicket; onChange: (t: AdminTicket) => void; onGone: () => void }) {
  const [reply, setReply] = useState(t.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const update = async (patch: { status?: TicketStatus; reply?: string }) => {
    setBusy(true); setMsg(null);
    try { const r = await admin<{ ticket: AdminTicket }>('/update', { id: t.id, ...patch }); onChange(r.ticket); setMsg('Guardado.'); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`¿Quitar del tablón la petición #${t.n} «${t.title}»? No se puede deshacer.`)) return;
    setBusy(true);
    try { await admin('/delete', { id: t.id }); onGone(); } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };
  return (
    <li className={`tos-tb-item s-${t.status}`} data-ticket={t.id}>
      <p className="tos-tb-meta"><b className="dotnum">#{String(t.n).padStart(3, '0')}</b> <span className="tos-pill">{CATEGORY_LABEL[t.category]}</span> <span className={`tos-pill tb-st s-${t.status}`}>{STATUS_LABEL[t.status]}</span> <span>{t.alias}</span> · <span>{when(t.createdAt)}</span> · <span>{t.votes} {t.votes === 1 ? 'apoyo' : 'apoyos'}</span></p>
      <h3>{t.title}</h3>
      <p className="tos-tb-body">{t.body}</p>
      <div className="libre-row" role="group" aria-label="Estado">
        {t.status !== 'hecho' && <button type="button" className="btn sm primary" disabled={busy} onClick={() => void update({ status: 'hecho' })}>Marcar como solucionada</button>}
        {t.status === 'abierto' && <button type="button" className="btn sm" disabled={busy} onClick={() => void update({ status: 'en-curso' })}>En marcha</button>}
        {(t.status === 'hecho' || t.status === 'descartado') && <button type="button" className="btn sm" disabled={busy} onClick={() => void update({ status: 'abierto' })}>Reabrir</button>}
        {t.status !== 'descartado' && <button type="button" className="btn sm ghost" disabled={busy} onClick={() => void update({ status: 'descartado' })}>Descartar</button>}
        <button type="button" className="btn sm ghost tos-danger" disabled={busy} onClick={() => void remove()}>Quitar del tablón</button>
      </div>
      <form className="tos-inline" onSubmit={(e) => { e.preventDefault(); void update({ reply }); }}>
        <input className="field" value={reply} maxLength={600} onChange={(e) => setReply(e.target.value)} placeholder="Respuesta pública (opcional)" aria-label={`Respuesta a la petición #${t.n}`} />
        <button className="btn sm" disabled={busy || reply === (t.reply ?? '')}>Responder</button>
      </form>
      {msg && <p className="libre-note" role="status">{msg}</p>}
    </li>
  );
}
