// Sala privada del modo libre (BlackCard / Wort-Jenga): vestíbulo con «Estoy listo» y barra de «siguiente» automático.
// No hay profesor: el servidor avanza solo; si todos pulsan «listo», antes.
import { useState } from 'react';
import type { RoomView } from '../../shared/types.ts';
import type { Net } from '../net.ts';
import { navigate, useTick } from '../util.ts';

export function PrivateLobby({ view, me, net }: { view: RoomView; me: string; net: Net }) {
  const p = view.private!;
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mine = p.ready.includes(me);
  const connected = view.players.filter((x) => x.connected);
  const host = p.host === me;
  const link = typeof location !== 'undefined' ? `${location.origin}/p/${view.code}` : '';
  const act = async (msg: Parameters<Net['request']>[0]) => { setErr(null); const r = await net.request(msg); if (!r.ok) setErr(r.error ?? 'Error'); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } };
  return (
    <section className="private-lobby" data-private-lobby="">
      <p className="dt-eyebrow">Sala privada · {p.game === 'jenga' ? 'Wort-Jenga' : 'BlackCard'} · sin profesor</p>
      <div className="private-code">
        <span>Código</span><b className="dotnum">{view.code}</b>
        <button type="button" className="btn sm" onClick={copy}>{copied ? 'Enlace copiado ✓' : 'Copiar enlace'}</button>
      </div>
      <p className="private-hint">Comparte el código solo con quien quieras invitar. Empezáis cuando <b>todos</b> los presentes pulsen «Estoy listo» (mínimo 2).</p>
      <ul className="private-roster" aria-label="Jugadores">
        {view.players.map((x) => (
          <li key={x.id} className={x.connected ? '' : 'off'}>
            <span className={`private-dot${p.ready.includes(x.id) ? ' on' : ''}`} aria-hidden="true" />
            <b>{x.name}</b>{x.id === p.host && <small>anfitrión</small>}{x.id === me && <small>tú</small>}
            <span className="private-state">{!x.connected ? 'desconectado' : p.ready.includes(x.id) ? 'listo' : 'esperando'}</span>
            {host && x.id !== me && <button type="button" className="btn sm ghost" onClick={() => act({ t: 'pkick', pid: x.id })} aria-label={`Expulsar a ${x.name}`}>Expulsar</button>}
          </li>
        ))}
      </ul>
      <div className="row">
        <button type="button" className="btn primary lg" data-private-ready="" disabled={mine} onClick={() => act({ t: 'pnext' })}>{mine ? (connected.length < 2 ? 'Listo · falta alguien' : 'Listo · esperando al resto') : 'Estoy listo'}</button>
        <button type="button" className="btn ghost" onClick={() => navigate('/libre')}>Salir</button>
      </div>
      {err && <p className="err-msg" role="alert">{err}</p>}
    </section>
  );
}

/** Entre preguntas, rondas o turnos: cuenta atrás hasta que el servidor avanza y botón para avanzar antes si todos están listos. */
export function PrivateNext({ view, me, net, offset }: { view: RoomView; me: string; net: Net; offset: number }) {
  const p = view.private;
  useTick(250, !!p?.next);
  if (!p || p.next === null || view.phase === 'lobby' || view.phase === 'final') return null;
  const left = Math.max(0, Math.ceil((p.next - (Date.now() + offset)) / 1000));
  const jengaPull = view.task?.kind === 'jenga' && view.task.stage === 'pull';
  const connected = view.players.filter((x) => x.connected).length;
  const voted = p.ready.length;
  return (
    <div className="private-next" role="status" data-private-next="">
      {jengaPull
        ? <span>{view.task?.kind === 'jenga' && view.task.turn === me ? 'Saca tu pieza' : 'Esperando a que saque su pieza'}: si no, el servidor saca una segura en <b>{left} s</b>.</span>
        : <span>Siguiente en <b>{left} s</b> · {voted}/{connected} listos</span>}
      {!jengaPull && <button type="button" className="btn sm" disabled={p.ready.includes(me)} onClick={() => void net.request({ t: 'pnext' })}>{p.ready.includes(me) ? 'Listo ✓' : 'Listo para seguir'}</button>}
    </div>
  );
}
