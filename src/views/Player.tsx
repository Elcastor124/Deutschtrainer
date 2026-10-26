import { useEffect, useMemo, useState } from 'react';
import { ITEMS, STREAK_REWARD, blockDef } from '../../shared/rules.ts';
import type { Answer, ChestPub, ItemId, Topic } from '../../shared/types.ts';
import { Counter, Stars, Timer } from '../components/bits.tsx';
import { ChestOpener } from '../components/Chest.tsx';
import { Inventory } from '../components/Inventory.tsx';
import { Leaderboard } from '../components/Leaderboard.tsx';
import { PickupModal } from '../components/Overlays.tsx';
import { Question, QuestionHead } from '../components/Question.tsx';
import { Reading } from '../components/Reading.tsx';
import { DotTitle, Final, Intro, MyReveal, RoundEnd, WildPicker } from '../components/Screens.tsx';
import { Shell } from '../components/Shell.tsx';
import { TaskPlay } from '../components/Tasks.tsx';
import { sfx } from '../fx/sound.ts';
import { Net, useNet, type NetState } from '../net.ts';
import { navigate, profileId, store } from '../util.ts';
import { PracticeProgress } from '../brand/PracticeProgress.tsx';
import { usePracticeFeedback } from '../brand/usePracticeFeedback.ts';
import { readEffectsEnabled } from '../brand/effects.ts';

export function Player({ code }: { code: string }) {
  const [name, setName] = useState(() => store.get('bc:name') ?? '');
  const [ready, setReady] = useState(() => !!store.get(`bc:p:${code}`) || !!store.get('bc:name'));
  if (!ready) {
    return (
      <form className="home join-form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { store.set('bc:name', name.trim()); setReady(true); } }}>
        <DotTitle text={`Sala ${code}`} className="home-title" />
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

export function PlayScreen({ net, st, onNewPractice, onChangeTopics }: { net: Net; st: NetState; onNewPractice?: () => void; onChangeTopics?: () => void }) {
  const v = st.view;
  const feel = usePracticeFeedback(v);
  const me = v?.me;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initial, setInitial] = useState<Answer | null>(null);
  const [chest, setChest] = useState<ChestPub | null>(null);
  const qid = v?.q?.id;
  useEffect(() => { setInitial(null); setErr(null); }, [qid]);
  // Cada pregunta o pantalla nueva empieza arriba (en Chromebooks y móviles la página puede quedar desplazada).
  const screenKey = `${v?.block}-${v?.phase === 'reveal' ? 'question' : v?.phase}-${qid ?? ''}-${v?.task?.kind ?? ''}`;
  useEffect(() => { scrollTo({ top: 0, behavior: readEffectsEnabled() ? 'smooth' : 'instant' }); }, [screenKey]);
  // Si el cofre ya no existe (abierto en otra pestaña), se cierra la escena… salvo que se esté revelando.
  useEffect(() => { if (chest && me && !me.chests.some((c) => c.id === chest.id) && !document.querySelector('.chest-ovl .prize, .chest-big.waiting')) setChest(null); }, [me?.chests.length]);

  const practice = v?.mode === 'practice';
  const submit = async (a: Answer) => {
    if (!v?.q || busy) return;
    setBusy(true);
    setErr(null);
    const r = await net.request({ t: 'answer', qid: v.q.id, a });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'No se ha podido enviar.'); sfx.bad(); }
    else if (r.retry) { setInitial(a); sfx.rewind(); document.body.classList.add('rewinding'); setTimeout(() => document.body.classList.remove('rewinding'), 700); }
  };
  const next = async () => {
    if (busy) return;
    setBusy(true);
    const r = await net.request({ t: 'pnext' });
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'Error');
  };
  const onKey = (e: KeyboardEvent) => {
    // Keep native Enter/Space activation on controls; a nav switch must not advance the exercise.
    if ((e.target as HTMLElement | null)?.closest('button,a,summary,input,textarea,select,[role="switch"],[contenteditable="true"]')) return;
    if (practice && v?.phase === 'reveal' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void next(); }
  };

  if (!v || !me) return <Shell st={st}><p className="dim boot">Conectando con el servidor…</p></Shell>;
  const rank = v.players.findIndex((p) => p.id === me.id) + 1;
  const pub = v.players.find((p) => p.id === me.id);
  const answeredN = v.players.filter((p) => p.answered).length;
  const act2 = blockDef(v.block)?.act === 2;
  const streakLit = pub ? (pub.streak % STREAK_REWARD === 0 && pub.streak > 0 ? STREAK_REWARD : pub.streak % STREAK_REWARD) : 0;

  return (
    <Shell st={st} me={me.id} onKey={onKey} hudExtra={!practice ? <span className="code-chip" title="Código de la sala">{v.code}</span> : undefined}>
      <div className={`player${act2 ? ' act2' : ''}`}>
        <div className="col-main">
          <div className="me-strip">
            <span className="lcd" aria-label="Tus puntos">
              <Counter id="my-score" className="me-score" value={pub?.score ?? 0} />
              <small>puntos</small>
            </span>
            <span className="me-meta">
              <b>{me.name}</b>
              <span>{practice ? `Práctica: ${v.practice?.correct ?? 0} de ${v.practice?.done ?? 0} bien` : `Puesto ${rank} de ${v.players.length}`}</span>
            </span>
            {!practice && !act2 && (
              <span className="streak" title={`Racha: ${pub?.streak ?? 0}. Cada ${STREAK_REWARD} aciertos seguidos, un cofre.`}>
                <span className="leds">{Array.from({ length: STREAK_REWARD }, (_, i) => <i key={i} className={i < streakLit ? 'on' : ''} />)}</span>
                <small>{pub && pub.streak >= 2 ? `racha ×${pub.streak}` : 'racha'}</small>
              </span>
            )}
            {(act2 || (pub?.stars ?? 0) > 0) && <Stars n={pub?.stars ?? 0} className="me-stars" />}
            <span className="spacer" />
            {pub?.shield && <span className="chip shield">Escudo activo</span>}
            {pub?.sabotaged && <span className="chip diff-hard">Saboteado: tu próximo acierto vale ½</span>}
            {me.used && <span className="chip bc">{ITEMS[me.used].name} activado</span>}
          </div>

          {practice && <PracticeProgress view={v} />}

          {v.phase === 'question' && me.incoming.length > 0 && (
            <div className="alert" role="alert">
              <b>{me.incoming.map((x) => `${v.players.find((p) => p.id === x.by)?.name} usa ${ITEMS[x.kind].name}`).join(' · ')} contra ti.</b>
              <span className="dim">{me.inventory.includes('shield') && !pub?.shield ? 'Activa tu SHIELD ahora para bloquearlo.' : pub?.shield ? 'Tu escudo lo bloqueará.' : 'Solo un SHIELD lo bloquea.'}</span>
            </div>
          )}

          {v.phase === 'lobby' && (
            <section className="intro lobby-wait">
              <div className="intro-idx"><span className="big-n">OK</span><span>Estás dentro<br />Sala {v.code}</span></div>
              <DotTitle text="Gleich geht's los!" />
              <p className="sub">Espera a que el profesor empiece. Mientras tanto: <kbd>D</kbd> abre el diccionario.</p>
              <div className="lobby-roster">{v.players.map((p, i) => <span key={p.id} className={p.id === me.id ? 'me' : ''} style={{ '--k': i } as React.CSSProperties}>{p.name}</span>)}</div>
            </section>
          )}
          {v.phase === 'intro' && <Intro view={v} />}
          {v.phase === 'intro' && v.timer && <Timer timer={v.timer} offset={st.offset} big />}
          {v.phase === 'roundEnd' && <RoundEnd view={v} />}
          {v.phase === 'wild' && (
            <>
              <WildPicker view={v} onPick={async (t: Topic) => { const r = await net.request({ t: 'wild', topic: t }); if (!r.ok) setErr(r.error ?? 'Error'); }} />
              <Timer timer={v.timer} offset={st.offset} />
            </>
          )}
          {v.phase === 'final' && <Final view={v} onPractice={onNewPractice} />}
          {v.phase === 'final' && practice && onChangeTopics && (
            <div className="row practice-more"><button className="btn" onClick={onChangeTopics}>Cambiar temas o número de preguntas</button></div>
          )}
          {v.phase === 'task' && <TaskPlay view={v} net={net} offset={st.offset} />}

          {practice && v.q?.topic === 'lesen' && (
            <details className="panel reading-drawer" open key={v.reading}>
              <summary>Texto de la lectura</summary>
              <div className="reading-side"><Reading id={v.reading} compact /></div>
            </details>
          )}

          {(v.phase === 'question' || v.phase === 'review' || v.phase === 'reveal') && v.q && (
            <section className={`panel qpanel screen${v.phase === 'reveal' ? ' is-reveal' : ''}`} key={v.q.id} data-practice-feedback={practice && feel ? feel.kind : undefined} data-practice-feedback-id={practice ? feel?.id : undefined}>
              <QuestionHead q={v.q} no={v.qNo} total={v.qTotal} />
              {v.phase === 'question' && v.timer && <Timer timer={v.timer} offset={st.offset} onLow={(s) => sfx.tick(5 - s)} />}
              {v.phase === 'question' && me.state === 'retry' && (
                <div className="alert retry" role="status"><b>No es correcto.</b> Second Chance: tienes otro intento por la mitad de puntos.</div>
              )}
              {v.phase !== 'reveal' && (
                <Question key={`${v.q.id}-${me.state === 'retry' ? 'r' : 'a'}`} q={v.q} mode={v.phase === 'question' && me.state !== 'sent' ? 'play' : 'view'}
                  busy={busy} onSubmit={submit} initial={initial} />
              )}
              {v.phase === 'reveal' && (
                <>
                  {v.q.type !== 'mc' && <h2 className="prompt small">{v.q.type === 'gap' ? `${v.q.prompt} ${v.q.text}` : v.q.prompt}</h2>}
                  <MyReveal view={v} />
                  {practice && <div className="row" style={{ marginTop: 16 }}><span className="spacer" /><button className="btn primary lg" onClick={next}>Siguiente <kbd>Enter</kbd></button></div>}
                </>
              )}
              {v.phase === 'question' && me.state === 'sent' && (
                <div className="status-line locked"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Respuesta registrada en el servidor. Esperando al resto ({answeredN}/{v.players.filter((p) => p.connected).length})…</div>
              )}
              {v.phase === 'review' && <div className="status-line"><span className="dots" aria-hidden="true"><i /><i /><i /></span>El profesor está revisando una respuesta abierta…</div>}
              {busy && <div className="status-line"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Enviando…</div>}
              {err && <div className="status-line bad" role="alert">{err}</div>}
            </section>
          )}
          {!practice && v.block === 'lesen' && v.phase !== 'intro' && v.phase !== 'roundEnd' && (
            <details className="panel reading-drawer" open>
              <summary>Texto de la lectura</summary>
              <div className="reading-side"><Reading id={v.reading} compact /></div>
            </details>
          )}
        </div>

        {!practice && (
          <aside className="col-side">
            {!act2 && <Inventory view={v} onUse={(item: ItemId, target?: string) => net.request({ t: 'item', item, target })} onChest={setChest} />}
            <div className="panel side-lb"><Leaderboard players={v.players} me={me.id} compact stars={act2} /></div>
          </aside>
        )}
      </div>
      {chest && <ChestOpener key={chest.id} chest={chest} view={v} onOpen={() => net.request({ t: 'open', chest: chest.id })} onClose={() => setChest(null)} />}
      {!chest && <PickupModal view={v} onPick={async (d) => { const r = await net.request({ t: 'pickup', discard: d }); if (!r.ok) setErr(r.error ?? 'Error'); }} />}
    </Shell>
  );
}
