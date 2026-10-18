import { useEffect, useMemo, useState } from 'react';
import { ITEMS } from '../../shared/rules.ts';
import type { Answer, ItemId, Topic } from '../../shared/types.ts';
import { Counter, Timer } from '../components/bits.tsx';
import { Inventory } from '../components/Inventory.tsx';
import { Leaderboard } from '../components/Leaderboard.tsx';
import { PickupModal } from '../components/Overlays.tsx';
import { Question, QuestionHead } from '../components/Question.tsx';
import { Reading } from '../components/Reading.tsx';
import { Final, Intro, MyReveal, RoundEnd, WildPicker } from '../components/Screens.tsx';
import { Shell } from '../components/Shell.tsx';
import { sfx } from '../fx/sound.ts';
import { Net, useNet, type NetState } from '../net.ts';
import { navigate, profileId, store } from '../util.ts';

export function Player({ code }: { code: string }) {
  const [name, setName] = useState(() => store.get('bc:name') ?? '');
  const [ready, setReady] = useState(() => !!store.get(`bc:p:${code}`) || !!store.get('bc:name'));
  if (!ready) {
    return (
      <form className="home" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { store.set('bc:name', name.trim()); setReady(true); } }}>
        <h1 className="home-title" style={{ fontSize: 'clamp(2rem, 1.4rem + 3vw, 3.6rem)' }}>Sala <span className="red">{code}</span></h1>
        <input className="field big" placeholder="Tu nombre" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Tu nombre" />
        <button className="btn primary lg" disabled={!name.trim()}>Entrar</button>
      </form>
    );
  }
  return <PlayerConn code={code} onReset={() => { store.del(`bc:p:${code}`); setReady(false); }} />;
}

function PlayerConn({ code, onReset }: { code: string; onReset: () => void }) {
  const net = useMemo(() => new Net(
    { t: 'hello', role: 'player', room: code, token: store.get(`bc:p:${code}`) ?? undefined, name: store.get('bc:name') ?? undefined, profile: profileId() },
    (m) => { store.set(`bc:p:${code}`, m.token); if (m.profile) store.set('bc:profile', m.profile); if (m.profileCode) store.set('bc:pcode', m.profileCode); },
  ), [code]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  if (st.fatal) {
    return (
      <div className="home">
        <p className="err-msg">{st.error}</p>
        <div className="row">
          <button className="btn primary" onClick={onReset}>Entrar con mi nombre</button>
          <button className="btn" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      </div>
    );
  }
  return <PlayScreen net={net} st={st} />;
}

export function PlayScreen({ net, st, onNewPractice }: { net: Net; st: NetState; onNewPractice?: () => void }) {
  const v = st.view;
  const me = v?.me;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initial, setInitial] = useState<Answer | null>(null);
  const qid = v?.q?.id;
  useEffect(() => { setInitial(null); setErr(null); }, [qid]);

  const practice = v?.mode === 'practice';
  const submit = async (a: Answer) => {
    if (!v?.q || busy) return;
    setBusy(true);
    setErr(null);
    const r = await net.request({ t: 'answer', qid: v.q.id, a });
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'No se ha podido enviar.');
    else if (r.retry) { setInitial(a); sfx.bad(); }
  };
  const next = async () => {
    const r = await net.request({ t: 'pnext' });
    if (!r.ok) setErr(r.error ?? 'Error');
  };
  const onKey = (e: KeyboardEvent) => {
    if (practice && v?.phase === 'reveal' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void next(); }
  };

  if (!v || !me) return <Shell st={st}><p className="dim">Conectando con el servidor…</p></Shell>;
  const rank = v.players.findIndex((p) => p.id === me.id) + 1;
  const pub = v.players.find((p) => p.id === me.id);
  const answeredN = v.players.filter((p) => p.answered).length;

  return (
    <Shell st={st} me={me.id} onKey={onKey} hudExtra={!practice ? <span className="code-chip">{v.code}</span> : undefined}>
      <div className="player">
        <div style={{ minWidth: 0 }}>
          <div className="me-strip">
            <span id="my-score" className="me-score" aria-label="Tus puntos"><Counter value={pub?.score ?? 0} /></span>
            <span className="me-meta">
              <b>{me.name}</b>
              <span>{practice ? `Práctica · ${v.practice?.correct ?? 0}/${v.practice?.done ?? 0} aciertos` : `Puesto ${rank} de ${v.players.length}`}{pub && pub.streak >= 2 ? ` · racha ×${pub.streak}` : ''}</span>
            </span>
            <span className="spacer" />
            {pub?.shield && <span className="chip">🛡 Escudo activo</span>}
            {pub?.sabotaged && <span className="chip diff-hard">Saboteado: tu próximo acierto vale ½</span>}
            {me.used && <span className="chip bc">{ITEMS[me.used].name} activado</span>}
          </div>

          {v.phase === 'question' && me.incoming.length > 0 && (
            <div className="alert" role="alert">
              <b>⚠ {me.incoming.map((x) => `${v.players.find((p) => p.id === x.by)?.name} usa ${ITEMS[x.kind].name}`).join(' · ')} contra ti.</b>
              <span className="dim">{me.inventory.includes('shield') && !pub?.shield ? 'Activa tu SHIELD ahora para bloquearlo.' : pub?.shield ? 'Tu escudo lo bloqueará.' : 'Solo un SHIELD lo bloquea.'}</span>
            </div>
          )}

          {v.phase === 'lobby' && (
            <section className="intro">
              <h1>Estás dentro</h1>
              <p className="sub">Espera a que el profesor empiece la clase. Mientras tanto: <kbd>D</kbd> abre el diccionario.</p>
            </section>
          )}
          {v.phase === 'intro' && <Intro view={v} />}
          {v.phase === 'intro' && v.timer && <Timer timer={v.timer} offset={st.offset} />}
          {v.phase === 'roundEnd' && <RoundEnd view={v} />}
          {v.phase === 'wild' && (
            <>
              <WildPicker view={v} onPick={async (t: Topic) => { const r = await net.request({ t: 'wild', topic: t }); if (!r.ok) setErr(r.error ?? 'Error'); }} />
              <Timer timer={v.timer} offset={st.offset} />
            </>
          )}
          {v.phase === 'final' && <Final view={v} onPractice={onNewPractice} />}

          {(v.phase === 'question' || v.phase === 'review' || v.phase === 'reveal') && v.q && (
            <section className="panel qpanel" key={v.q.id}>
              <QuestionHead q={v.q} no={v.qNo} total={v.qTotal} />
              {v.phase === 'question' && v.timer && <><Timer timer={v.timer} offset={st.offset} onLow={() => sfx.tick()} /><div style={{ height: 14 }} /></>}
              {v.phase === 'question' && me.state === 'retry' && (
                <div className="alert" role="status"><b>✗ No es correcto.</b> Second Chance: tienes otro intento por la mitad de puntos.</div>
              )}
              {v.phase !== 'reveal' && (
                <Question key={`${v.q.id}-${me.state === 'retry' ? 'r' : 'a'}`} q={v.q} mode={v.phase === 'question' && me.state !== 'sent' ? 'play' : 'view'}
                  busy={busy} onSubmit={submit} initial={initial} />
              )}
              {v.phase === 'reveal' && (
                <>
                  <h2 className="prompt" style={{ fontSize: 'clamp(1.05rem, 0.95rem + 0.6vw, 1.5rem)' }}>{v.q.type === 'gap' ? `${v.q.prompt} ${v.q.text}` : v.q.prompt}</h2>
                  <MyReveal view={v} />
                  {practice && <div className="row" style={{ marginTop: 16 }}><span className="spacer" /><button className="btn primary lg" onClick={next}>Siguiente <kbd>Enter</kbd></button></div>}
                </>
              )}
              {v.phase === 'question' && me.state === 'sent' && (
                <div className="status-line"><span className="spinner" />Respuesta recibida por el servidor. Esperando al resto ({answeredN}/{v.players.filter((p) => p.connected).length})…</div>
              )}
              {v.phase === 'review' && <div className="status-line"><span className="spinner" />El profesor está revisando una respuesta abierta…</div>}
              {busy && <div className="status-line"><span className="spinner" />Enviando…</div>}
              {err && <div className="status-line bad" role="alert">{err}</div>}
            </section>
          )}
          {v.block === 'lesen' && v.phase !== 'intro' && v.phase !== 'roundEnd' && (
            <details className="panel" style={{ marginTop: 14 }} open>
              <summary className="dim">Texto: Ein verrückter Samstag</summary>
              <div className="reading-side" style={{ marginTop: 10 }}><Reading compact /></div>
            </details>
          )}
        </div>

        {!practice && (
          <aside className="stack">
            <Inventory view={v} onUse={(item: ItemId, target?: string) => net.request({ t: 'item', item, target })} />
            <div className="panel"><Leaderboard players={v.players} me={me.id} compact /></div>
          </aside>
        )}
      </div>
      <PickupModal view={v} onPick={async (d) => { const r = await net.request({ t: 'pickup', discard: d }); if (!r.ok) setErr(r.error ?? 'Error'); }} />
    </Shell>
  );
}
