import { useEffect, useMemo, useState } from 'react';
import { COMMON_ITEMS, ITEMS, PLAN, blockDef } from '../../shared/rules.ts';
import type { BlockId, CtlAction, ItemId, RoomView } from '../../shared/types.ts';
import { Timer } from '../components/bits.tsx';
import { Leaderboard } from '../components/Leaderboard.tsx';
import { Question, QuestionHead } from '../components/Question.tsx';
import { Reading } from '../components/Reading.tsx';
import { ClassReveal, Final, Intro, RoundEnd, WildPicker } from '../components/Screens.tsx';
import { Shell } from '../components/Shell.tsx';
import { sfx } from '../fx/sound.ts';
import { Net, useNet } from '../net.ts';
import { navigate, store } from '../util.ts';

export function Teacher({ code }: { code: string }) {
  const net = useMemo(() => {
    const creating = code === 'new';
    const token = creating ? undefined : store.get(`bc:t:${code}`) ?? undefined;
    return new Net(creating ? { t: 'hello', role: 'teacher', create: true } : { t: 'hello', role: 'teacher', room: code, token }, (m) => {
      store.set(`bc:t:${m.room}`, m.token);
      store.set('bc:last-teacher', m.room);
      if (code !== m.room) history.replaceState(null, '', `/t/${m.room}`);
    });
  }, [code]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  const v = st.view;
  const [err, setErr] = useState<string | null>(null);
  const [hide, setHide] = useState(false);
  const [peek, setPeek] = useState(false);

  const ctl = async (a: CtlAction) => {
    const r = await net.request({ t: 'ctl', a });
    setErr(r.ok ? null : r.error ?? 'Error');
    if (r.ok && a.k === 'next') sfx.next();
  };

  useEffect(() => {
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'v') setPeek(false); };
    addEventListener('keyup', up);
    return () => removeEventListener('keyup', up);
  }, []);

  if (st.fatal) {
    return (
      <div className="home">
        <h1 className="home-title" style={{ fontSize: '2.4rem' }}>Sin acceso a la sala</h1>
        <p className="err-msg">{st.error}</p>
        <button className="btn primary" onClick={() => navigate('/t/new')}>Crear una sala nueva</button>
      </div>
    );
  }
  if (!v) return <div className="home"><p className="dim">Conectando con el servidor…</p></div>;

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') { e.preventDefault(); if (v.phase === 'question') ctl({ k: 'lock' }); else if (v.phase !== 'review') ctl({ k: 'next' }); }
    else if (k === 'c') ctl({ k: 'lock' });
    else if (k === 's') ctl({ k: v.timer?.endsAt === null ? 'resume' : 'pause' });
    else if (k === '+') ctl({ k: 'addTime', s: 15 });
    else if (k === 'h') setHide((x) => !x);
    else if (k === 'v') setPeek(true);
  };

  return (
    <Shell st={st} teacher onBlock={(b) => ctl({ k: 'block', block: b })} onKey={onKey} hudExtra={<span className="code-chip" title="Código de la sala">{v.code}</span>}>
      {v.phase === 'lobby' ? <Lobby v={v} onStart={() => ctl({ k: 'next' })} /> : (
        <div className="teacher">
          <div className="stage">
            <Stage v={v} offset={st.offset} peek={peek} />
            {v.phase === 'review' && <Review v={v} ctl={ctl} />}
            {!hide && <Controls v={v} ctl={ctl} setPeek={setPeek} onHide={() => setHide(true)} />}
            {hide && <p className="dim" style={{ fontSize: '0.8rem' }}>Controles ocultos · <kbd>H</kbd> para mostrarlos · <kbd>Espacio</kbd> sigue funcionando</p>}
            {err && <p className="err-msg" role="alert">{err}</p>}
          </div>
          <aside className="rail">
            <div className="panel" id="lb"><Leaderboard players={v.players} /></div>
            {v.block === 'lesen' && v.phase !== 'intro' && <div className="panel reading-side"><Reading compact /></div>}
            <Activity v={v} />
            {!hide && <Tools v={v} ctl={ctl} />}
          </aside>
        </div>
      )}
    </Shell>
  );
}

function useLanUrl(code: string) {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    if (!/^(localhost|127\.)/.test(location.hostname)) return;
    fetch('/api/info').then((r) => r.json()).then((d: { ips: string[]; port: number }) => {
      if (d.ips?.[0]) setBase(`${location.protocol}//${d.ips[0]}:${location.port || d.port}`);
    }).catch(() => undefined);
  }, []);
  return { base, url: `${base}/p/${code}` };
}

function Lobby({ v, onStart }: { v: RoomView; onStart: () => void }) {
  const { base, url } = useLanUrl(v.code);
  return (
    <div className="teacher">
      <section className="stage">
        <p className="dim" style={{ margin: 0 }}>Entrad en <span className="lobby-url">{base.replace(/^https?:\/\//, '')}</span> y escribid el código</p>
        <div className="lobby-code">{v.code}</div>
        <p className="dim" style={{ margin: 0 }}>Enlace directo: <span className="lobby-url">{url}</span></p>
        <div className="row">
          <button className="btn primary lg" onClick={onStart} disabled={!v.players.length}>Empezar clase <kbd>Espacio</kbd></button>
          {!v.players.length && <span className="dim">Esperando a los alumnos…</span>}
        </div>
        <ol className="dim" style={{ margin: 0, paddingLeft: 18 }}>
          {PLAN.map((b) => <li key={b.id}>{b.name} · {b.min} min</li>)}
        </ol>
      </section>
      <aside className="rail"><div className="panel" id="lb"><Leaderboard players={v.players} /></div></aside>
    </div>
  );
}

function Stage({ v, offset, peek }: { v: RoomView; offset: number; peek: boolean }) {
  if (v.phase === 'intro') return <><Intro view={v} />{v.timer && <Timer timer={v.timer} offset={offset} />}</>;
  if (v.phase === 'roundEnd') return <RoundEnd view={v} />;
  if (v.phase === 'final') return <Final view={v} teacher />;
  if (v.phase === 'wild') return <><WildPicker view={v} /><Timer timer={v.timer} offset={offset} /></>;
  if (!v.q) return null;
  const used = v.uses.map((u) => `${v.players.find((p) => p.id === u.by)?.name}: ${ITEMS[u.item].name}${u.target ? ` → ${v.players.find((p) => p.id === u.target)?.name}` : ''}`);
  return (
    <section className="panel qpanel" key={v.q.id}>
      <QuestionHead q={v.q} no={v.qNo} total={v.qTotal} />
      {(v.phase === 'question' || v.phase === 'review') && (
        <>
          <Timer timer={v.timer} offset={offset} onLow={() => sfx.tick()} />
          <div style={{ height: 14 }} />
          <Question key={v.q.id} q={v.q} mode="view" />
          <div className="answered" style={{ marginTop: 16 }}>
            {v.players.map((p) => (
              <span key={p.id} className={`who${p.answered ? ' yes' : ''}${p.connected ? '' : ' off'}`}><i />{p.name}</span>
            ))}
          </div>
          {used.length > 0 && <p className="dim" style={{ marginBottom: 0 }}>Objetos en juego: {used.join(' · ')}</p>}
          {peek && v.teacher && <div className="solution" style={{ marginTop: 14 }}>{v.teacher.solution}</div>}
        </>
      )}
      {v.phase === 'reveal' && (
        <>
          <h2 className="prompt" style={{ fontSize: 'clamp(1.1rem, 0.9rem + 1vw, 1.8rem)' }}>{v.q.type === 'gap' ? `${v.q.prompt} ${v.q.text}` : v.q.prompt}</h2>
          <ClassReveal view={v} />
        </>
      )}
    </section>
  );
}

function Review({ v, ctl }: { v: RoomView; ctl: (a: CtlAction) => void }) {
  const list = v.teacher?.review ?? [];
  return (
    <section className="panel stack" aria-label="Revisión">
      <b>Revisa {list.length === 1 ? 'esta respuesta' : `estas ${list.length} respuestas`} antes de corregir</b>
      {list.map((r) => (
        <div key={r.pid} className="review-item">
          <span><b>{v.players.find((p) => p.id === r.pid)?.name}:</b> <span lang="de">{r.given}</span></span>
          <span className="dim">Esperada: <span lang="de">{r.expected}</span>{r.note ? ` · ${r.note}` : ''}</span>
          <div className="row">
            <button className="btn primary sm" onClick={() => ctl({ k: 'judge', pid: r.pid, ok: true })}>Aceptar</button>
            <button className="btn sm" onClick={() => ctl({ k: 'judge', pid: r.pid, ok: false })}>Rechazar</button>
          </div>
        </div>
      ))}
      {list.length > 1 && (
        <div className="row">
          <button className="btn sm" onClick={() => ctl({ k: 'judgeAll', ok: true })}>Aceptar todas</button>
          <button className="btn sm" onClick={() => ctl({ k: 'judgeAll', ok: false })}>Rechazar todas</button>
        </div>
      )}
    </section>
  );
}

function Controls({ v, ctl, setPeek, onHide }: { v: RoomView; ctl: (a: CtlAction) => void; setPeek: (b: boolean) => void; onHide: () => void }) {
  const i = PLAN.findIndex((b) => b.id === v.block);
  const nextBlock = PLAN[i + 1];
  const left = v.teacher?.queueLeft ?? 0;
  const label = v.phase === 'intro' ? 'Primera pregunta'
    : v.phase === 'reveal' ? (v.wildPending && left ? 'Siguiente: comodín' : left ? 'Siguiente pregunta' : 'Terminar ronda')
    : v.phase === 'roundEnd' ? (nextBlock ? `Empezar ${nextBlock.name}` : 'Resultados')
    : 'Siguiente';
  const live = v.phase === 'question';
  const paused = v.timer?.endsAt === null && (v.timer?.left ?? 0) > 0;
  return (
    <section className="panel stack" aria-label="Controles del profesor">
      <div className="controls">
        {live ? <button className="btn signal lg" onClick={() => ctl({ k: 'lock' })}>Cerrar y corregir <kbd>C</kbd></button>
          : v.phase !== 'final' && v.phase !== 'review' && v.phase !== 'wild' && <button className="btn primary lg" onClick={() => ctl({ k: 'next' })}>{label} <kbd>Espacio</kbd></button>}
        {v.timer && <button className="btn" onClick={() => ctl({ k: paused ? 'resume' : 'pause' })}>{paused ? 'Continuar' : 'Pausa'} <kbd>S</kbd></button>}
        {v.timer && <button className="btn" onClick={() => ctl({ k: 'addTime', s: 15 })}>+15 s</button>}
        {(live || v.phase === 'review' || v.phase === 'wild') && <button className="btn" onClick={() => ctl({ k: 'skip' })}>Anular pregunta</button>}
        {(live || v.phase === 'review') && (
          <button className="btn" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>Ver solución (mantener) <kbd>V</kbd></button>
        )}
        <button className={`btn${v.itemsOn ? '' : ' on'}`} onClick={() => ctl({ k: 'items', on: !v.itemsOn })}>{v.itemsOn ? 'Pausar objetos' : 'Objetos pausados'}</button>
        <button className="btn ghost" onClick={onHide}>Modo proyector <kbd>H</kbd></button>
      </div>
      {blockDef(v.block)?.theme === 'boss' && <span className="dim">Final Boss: todas las preguntas admiten BlackCard.</span>}
    </section>
  );
}

function Activity({ v }: { v: RoomView }) {
  const log = [...v.log].reverse().slice(0, 14);
  return (
    <div className="panel">
      <b>Actividad</b>
      <div className="log" style={{ marginTop: 8 }}>
        {log.map((f) => (
          <div key={f.id} className={['steal', 'bc-lose', 'sabotaged'].includes(f.kind) ? 'alarm' : ['item', 'unlock', 'bc-win', 'block'].includes(f.kind) ? 'hot' : ''}>{f.text}</div>
        ))}
        {!log.length && <div>Aquí aparecerán los objetos, robos y recompensas.</div>}
      </div>
    </div>
  );
}

function Tools({ v, ctl }: { v: RoomView; ctl: (a: CtlAction) => void }) {
  const [give, setGive] = useState<ItemId>('shield');
  return (
    <details className="tools panel">
      <summary>Puntos, objetos y alumnos</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {v.players.map((p) => (
          <div key={p.id} className="stack" style={{ gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--graphite)' }}>
            <div className="row"><b>{p.name}</b><span className="dim">{(v.teacher?.inventories[p.id] ?? []).map((i) => ITEMS[i].name).join(', ') || 'sin objetos'}</span></div>
            <div className="row">
              {[-5, -1, 1, 5].map((d) => <button key={d} className="btn sm" onClick={() => ctl({ k: 'points', pid: p.id, delta: d })}>{d > 0 ? `+${d}` : d}</button>)}
              <button className="btn sm" onClick={() => ctl({ k: 'give', pid: p.id, item: give })}>Dar {ITEMS[give].name}</button>
              <button className="btn ghost sm" onClick={() => confirm(`¿Sacar a ${p.name} de la sala? Perderá su puntuación.`) && ctl({ k: 'kick', pid: p.id })}>Expulsar</button>
            </div>
          </div>
        ))}
        <label className="row">Objeto a dar:
          <select className="field" style={{ width: 'auto', minHeight: 36 }} value={give} onChange={(e) => setGive(e.target.value as ItemId)}>
            {(Object.keys(ITEMS) as ItemId[]).map((i) => <option key={i} value={i}>{ITEMS[i].name}</option>)}
          </select>
        </label>
        <b>Objetos activos</b>
        <div className="toggles">
          {(['blackcard', ...COMMON_ITEMS] as ItemId[]).map((i) => {
            const off = v.itemsOff.includes(i);
            return <button key={i} className={`btn sm${off ? ' on' : ''}`} onClick={() => ctl({ k: 'items', on: off, item: i })}>{off ? '✕ ' : ''}{ITEMS[i].name}</button>;
          })}
        </div>
        <span className="dim" style={{ fontSize: '0.8rem' }}>Banco: {v.teacher?.bankSize} preguntas · usadas en esta sesión: {v.teacher?.usedCount}</span>
        <BlockJump v={v} ctl={ctl} />
      </div>
    </details>
  );
}

function BlockJump({ v, ctl }: { v: RoomView; ctl: (a: CtlAction) => void }) {
  return (
    <div className="row">
      <span className="dim">Ir a:</span>
      {PLAN.map((b) => <button key={b.id} className={`btn sm${v.block === b.id ? ' on' : ''}`} onClick={() => ctl({ k: 'block', block: b.id as BlockId })}>{b.name}</button>)}
    </div>
  );
}
