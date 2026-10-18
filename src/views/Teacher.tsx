import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CHESTS, COMMON_ITEMS, ITEMS, PLAN, PLAN_MIN, blockDef } from '../../shared/rules.ts';
import type { BlockId, ChestTier, CtlAction, ItemId, RoomView } from '../../shared/types.ts';
import { Timer } from '../components/bits.tsx';
import { Leaderboard } from '../components/Leaderboard.tsx';
import { Question, QuestionHead } from '../components/Question.tsx';
import { Reading } from '../components/Reading.tsx';
import { ClassReveal, Final, Intro, RoundEnd, WildPicker } from '../components/Screens.tsx';
import { Shell } from '../components/Shell.tsx';
import { TaskControls, TaskStage } from '../components/Tasks.tsx';
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
    if (r.ok && (a.k === 'next' || a.k === 'block')) scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cada respuesta que llega suena en el proyector.
  const answeredN = v?.players.filter((p) => p.answered).length ?? 0;
  useEffect(() => { if (answeredN > 0) sfx.lock(); }, [answeredN]);
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
    <Shell st={st} teacher onBlock={(b) => ctl({ k: 'block', block: b })} onKey={onKey} hudExtra={<CodeChip code={v.code} />}>
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
            <div className="panel" id="lb"><Leaderboard players={v.players} stars={blockDef(v.block)?.act === 2} items={v.blockItems} /></div>
            {v.block === 'lesen' && v.phase !== 'intro' && <div className="panel reading-side"><Reading id={v.reading} compact /></div>}
            <Activity v={v} />
            {!hide && <Tools v={v} ctl={ctl} />}
          </aside>
        </div>
      )}
    </Shell>
  );
}

/** Código de la sala en el HUD: al pulsarlo copia el enlace directo para los alumnos. */
function CodeChip({ code }: { code: string }) {
  const { url } = useLanUrl(code);
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="code-chip" title="Copiar el enlace para los alumnos" onClick={async () => {
      let done = false;
      try { await navigator.clipboard.writeText(url); done = true; } catch {
        // Sin permiso de portapapeles (http en la red local): copia clásica con un campo temporal.
        const t = document.createElement('textarea');
        t.value = url;
        document.body.appendChild(t);
        t.select();
        try { done = document.execCommand('copy'); } catch { done = false; }
        t.remove();
      }
      setOk(done);
      setTimeout(() => setOk(false), 1500);
    }}>{ok ? 'COPIADO' : code}</button>
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
    <div className="lobby">
      <section className="lobby-main">
        <p className="lobby-line">Entrad en <span className="lobby-url">{base.replace(/^https?:\/\//, '')}</span> y escribid el código</p>
        <div className="lobby-code" aria-label={`Código ${v.code}`}>{[...v.code].map((c, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{c}</span>)}</div>
        <p className="lobby-line">Enlace directo: <span className="lobby-url">{url}</span></p>
        <div className="row">
          <button className="btn primary xl" onClick={onStart} disabled={!v.players.length}>Empezar la clase <kbd>Espacio</kbd></button>
          {!v.players.length && <span className="dim">Esperando a los alumnos…</span>}
        </div>
      </section>
      <aside className="lobby-side">
        <div className="slots-grid" aria-label="Alumnos en la sala">
          {Array.from({ length: Math.max(4, v.players.length) }, (_, i) => {
            const p = v.players[i];
            return <div key={p?.id ?? `e${i}`} className={`slot-pad${p ? ' on' : ''}`}><i className="led" />{p ? <b>{p.name}</b> : <span>libre</span>}</div>;
          })}
        </div>
        <div className="plan-list">
          <b className="label">Plan de clase · {PLAN_MIN} min</b>
          {[1, 2].map((act) => (
            <ol key={act} className={`plan-act a${act}`}>
              <li className="act-h">{act === 1 ? 'Akt I · das Spiel' : 'Akt II · nach dem Spiel'}</li>
              {PLAN.filter((b) => b.act === act).map((b) => <li key={b.id}><span>{b.name}</span><span className="dim">{b.min}′</span></li>)}
            </ol>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Stage({ v, offset, peek }: { v: RoomView; offset: number; peek: boolean }) {
  if (v.phase === 'intro') return <><Intro view={v} />{v.timer && <Timer timer={v.timer} offset={offset} big />}</>;
  if (v.phase === 'roundEnd') return <RoundEnd view={v} />;
  if (v.phase === 'final') return <Final view={v} teacher />;
  if (v.phase === 'wild') return <><WildPicker view={v} /><Timer timer={v.timer} offset={offset} /></>;
  if (v.phase === 'task') return <TaskStage view={v} offset={offset} />;
  if (!v.q) return null;
  const used = v.uses.map((u) => `${v.players.find((p) => p.id === u.by)?.name}: ${ITEMS[u.item].name}${u.target ? ` → ${v.players.find((p) => p.id === u.target)?.name}` : ''}`);
  return (
    <section className={`panel qpanel screen${v.phase === 'reveal' ? ' is-reveal' : ''}`} key={v.q.id}>
      <QuestionHead q={v.q} no={v.qNo} total={v.qTotal} />
      {(v.phase === 'question' || v.phase === 'review') && (
        <>
          <Timer timer={v.timer} offset={offset} onLow={(s) => sfx.tick(5 - s)} />
          <Question key={v.q.id} q={v.q} mode="display" />
          <div className="answered">
            <span className="label">Respuestas</span>
            {v.players.map((p) => (
              <span key={p.id} className={`who${p.answered ? ' yes' : ''}${p.connected ? '' : ' off'}`}><i className="led" />{p.name}</span>
            ))}
            <span className="count">{v.players.filter((p) => p.answered).length}/{v.players.filter((p) => p.connected).length}</span>
          </div>
          {used.length > 0 && <p className="dim" style={{ marginBottom: 0 }}>Objetos en juego: {used.join(' · ')}</p>}
          {peek && v.teacher && <div className="solution" style={{ marginTop: 14 }}>{v.teacher.solution}</div>}
        </>
      )}
      {v.phase === 'reveal' && (
        <>
          {v.q.type !== 'mc' && <h2 className="prompt small">{v.q.type === 'gap' ? `${v.q.prompt} ${v.q.text}` : v.q.prompt}</h2>}
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
  const task = v.task;
  const label = v.phase === 'intro' ? (blockDef(v.block)?.kind === 'task' ? 'Empezar actividad' : 'Primera pregunta')
    : v.phase === 'reveal' ? (v.wildPending && left ? 'Siguiente: comodín' : left ? 'Siguiente pregunta' : 'Terminar ronda')
    : v.phase === 'roundEnd' || v.phase === 'final' ? (nextBlock ? `Empezar ${nextBlock.name}` : 'Fin')
    : v.phase === 'task' ? (task && task.kind !== 'szene' && task.kind !== 'jenga' && task.stage === 'write' ? 'Terminar y leer los textos'
      : task?.kind === 'szene' && task.stage === 'prep' ? '¡Acción!' : task?.kind === 'szene' && task.stage === 'play' ? 'Valorar objetivos' : 'Terminar actividad')
    : 'Siguiente';
  const live = v.phase === 'question';
  const paused = v.timer?.endsAt === null && (v.timer?.left ?? 0) > 0;
  return (
    <section className="panel stack" aria-label="Controles del profesor">
      <div className="controls">
        {live ? <button className="btn signal lg" onClick={() => ctl({ k: 'lock' })}>Cerrar y corregir <kbd>C</kbd></button>
          : v.phase !== 'review' && v.phase !== 'wild' && !(v.phase === 'final' && !nextBlock) && <button className="btn primary lg" onClick={() => ctl({ k: 'next' })}>{label} <kbd>Espacio</kbd></button>}
        {v.timer && <button className="btn" onClick={() => ctl({ k: paused ? 'resume' : 'pause' })}>{paused ? 'Continuar' : 'Pausa'} <kbd>S</kbd></button>}
        {v.timer && <button className="btn" onClick={() => ctl({ k: 'addTime', s: 15 })}>+15 s</button>}
        {(live || v.phase === 'review' || v.phase === 'wild') && <button className="btn" onClick={() => ctl({ k: 'skip' })}>Anular pregunta</button>}
        {(live || v.phase === 'review') && (
          <button className="btn" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>Ver solución (mantener) <kbd>V</kbd></button>
        )}
        {v.blockItems && <button className={`btn${v.itemsOn ? '' : ' on'}`} onClick={() => ctl({ k: 'items', on: !v.itemsOn })}>{v.itemsOn ? 'Pausar objetos' : 'Objetos pausados'}</button>}
        <button className="btn ghost" onClick={onHide}>Ocultar controles <kbd>H</kbd></button>
      </div>
      {v.phase === 'task' && <TaskControls view={v} ctl={ctl} />}
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
  const [tier, setTier] = useState<ChestTier>('bronze');
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
              <button className="btn sm" onClick={() => ctl({ k: 'chest', pid: p.id, tier })}>Dar {CHESTS[tier].name.toLowerCase()}</button>
              <button className="btn ghost sm" onClick={() => confirm(`¿Sacar a ${p.name} de la sala? Perderá su puntuación.`) && ctl({ k: 'kick', pid: p.id })}>Expulsar</button>
            </div>
          </div>
        ))}
        <label className="row">Objeto a dar:
          <select className="field" style={{ width: 'auto', minHeight: 36 }} value={give} onChange={(e) => setGive(e.target.value as ItemId)}>
            {(Object.keys(ITEMS) as ItemId[]).map((i) => <option key={i} value={i}>{ITEMS[i].name}</option>)}
          </select>
        </label>
        <label className="row">Cofre a dar:
          <select className="field" style={{ width: 'auto', minHeight: 36 }} value={tier} onChange={(e) => setTier(e.target.value as ChestTier)}>
            {(Object.keys(CHESTS) as ChestTier[]).filter((t) => t !== 'black').map((t) => <option key={t} value={t}>{CHESTS[t].name}</option>)}
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
