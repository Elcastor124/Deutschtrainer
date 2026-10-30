import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { BOXING_MOVES, type BoxingAction, type BoxingFighter, type BoxingResolution, type BoxingView, type BoxingWelcome } from '../../shared/boxing.ts';
import { BoxingClient, boxingRequest, readBoxingSession, saveBoxingSession } from '../boxing-client.ts';
import { BoxingRing } from '../components/BoxingRing.tsx';
import { navigate, store, useSetting } from '../util.ts';
import '../boxing.css';

type ActionHandler = (action: BoxingAction) => void;
const queryCode = () => new URLSearchParams(location.search).get('code')?.trim().toUpperCase() ?? '';
function initialSession() {
  const code = queryCode();
  const last = readBoxingSession();
  return code ? last?.code === code ? last : readBoxingSession(code) : last;
}

export function Boxing() {
  const [session, setSession] = useState<BoxingWelcome | null>(initialSession);
  const [sound, setSound] = useSetting('dt:boxing:sound', false);
  const [entryKey, setEntryKey] = useState(0);
  useEffect(() => {
    const onPop = () => { setSession(initialSession()); setEntryKey((key) => key + 1); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const enter = (welcome: BoxingWelcome) => {
    saveBoxingSession(welcome);
    history.replaceState(null, '', `/boxeo?code=${encodeURIComponent(welcome.code)}`);
    setSession(welcome);
  };
  const exit = () => {
    setSession(null);
    setEntryKey((key) => key + 1);
    history.replaceState(null, '', '/boxeo');
  };
  return <main className="boxing">
    <header className="bx-header">
      <a className="bx-crumb" href="/#juegos" aria-label="Volver a los juegos" onClick={(event) => { event.preventDefault(); navigate('/#juegos'); }}><span>Juegos</span><span aria-hidden="true">/</span><b>Boxeo</b></a>
      <div className="bx-header-actions">
        <button className="bx-text-button bx-sound" type="button" aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? '♪ Sonido activado' : '♪ Sonido apagado'}</button>
        {session ? <button className="bx-text-button" onClick={exit}>Salir</button> : <a className="bx-text-button" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>← Volver al hub</a>}
      </div>
    </header>
    {session ? <BoxingRoom key={`${session.code}:${session.role}`} session={session} sound={sound} onExit={exit} /> : <BoxingLanding key={entryKey} onEnter={enter} />}
  </main>;
}

const demoFighters: BoxingFighter[] = ['Esquina roja', 'Esquina azul'].map((name, i) => ({ id: `demo-${i}`, name, hp: 100, stamina: 3, correct: 0, wrong: 0, damage: 0, connected: true, answered: false, lockedMove: false }));
type DemoEvent = [BoxingResolution['fighters'][number]['move'], number, boolean, boolean];
const demoScript: [DemoEvent, DemoEvent][] = [
  [['jab', 0, false, false], ['guard', 2, true, false]],
  [['dodge', 0, false, true], ['cross', 0, false, false]],
  [['hook', 0, false, false], ['recover', 16, false, false]],
  [['jab', 8, false, false], ['jab', 8, false, false]],
];
/** Attract-mode loop for the landing hero: scripted exchanges, never a real game state. */
function useDemoResult() {
  const [step, setStep] = useState(0);
  useEffect(() => { const timer = setInterval(() => setStep((value) => value + 1), 3200); return () => clearInterval(timer); }, []);
  const script = demoScript[step % demoScript.length];
  const fighters = script.map(([move, damageTaken, blocked, dodged], i) => ({ id: `demo-${i}`, move, correct: move !== 'recover', damageTaken, blocked, dodged, damageDealt: script[1 - i][1] }));
  return { exchange: step + 1, fighters, explanation: '', answer: '' } satisfies BoxingResolution;
}

function BoxingLanding({ onEnter }: { onEnter: (welcome: BoxingWelcome) => void }) {
  const [code, setCode] = useState(queryCode);
  const [name, setName] = useState(() => store.get('dt:boxing:name') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const last = readBoxingSession();
  const demo = useDemoResult();
  useEffect(() => () => controller.current?.abort(), []);
  const request = async (kind: 'create' | 'join') => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(kind); setError(null);
    const abort = controller.current = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const payload = kind === 'create' ? {} : { code: code.trim().toUpperCase(), name: name.trim() };
      let welcome: BoxingWelcome;
      try { welcome = await boxingRequest<BoxingWelcome>(kind, payload, undefined, abort.signal); } catch (cause) {
        // Un código que no es de una sala de profesor puede ser de una partida privada del modo libre (API de jugador).
        if (kind !== 'join' || !(cause instanceof Error) || cause.message !== 'No existe esa sala.') throw cause;
        welcome = await boxingRequest<BoxingWelcome>('join', payload, undefined, abort.signal, true);
      }
      if (abort.signal.aborted) return;
      if (typeof welcome.token !== 'string' || !welcome.code || !['teacher', 'player'].includes(welcome.role)) throw new Error('La sesión no se ha confirmado. Reintenta.');
      if (kind === 'join') store.set('dt:boxing:name', name.trim());
      onEnter(welcome);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'El servidor tarda en responder. Comprueba la conexión y reintenta.');
    } finally { clearTimeout(timeout); submitting.current = false; setPending(null); }
  };
  return <>
    <div className="bx-intro bx-landing-intro"><div><p className="bx-eyebrow">TEMA 1 / A1—A2 · DUELO EN DIRECTO</p><h1>Tu alemán.<br /><em>Tu mejor golpe.</em></h1><p className="bx-lead">Piensa la respuesta. Elige tu movimiento. En este ring gana el conocimiento, no la velocidad.</p></div><span className="bx-edition" aria-hidden="true">WISSEN<br />SCHLÄGT<br /><b>TEMPO.</b></span></div>
    <div className="bx-landing-grid">
      <div className="bx-landing-scene"><BoxingRing fighters={demoFighters} result={demo} /><div className="bx-rules"><span><b>01</b> Responde en alemán</span><span><b>02</b> Gestiona tu energía</span><span><b>03</b> Elige sin prisas</span></div></div>
      <section className="bx-entry-panel">
        <div className="bx-entry-title"><span className="bx-eyebrow">ALUMNADO</span><h2>Sube al ring.</h2></div>
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void request('join'); }} className="bx-join-form">
          <label>Tu nombre<input data-box-name="" className="bx-input" name="name" autoComplete="given-name" maxLength={24} placeholder="¿Cómo te llamas?" required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Código de sala<input data-box-code="" className="bx-input bx-code-input" name="code" autoComplete="off" autoCapitalize="characters" maxLength={8} placeholder="ABCD" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
          <button data-box-join="" className="bx-button bx-primary" disabled={!!pending || !name.trim() || !code.trim()}>{pending === 'join' ? 'Entrando…' : 'Entrar al combate'}<span aria-hidden="true">↗</span></button>
        </form>
        <div className="bx-teacher-entry"><div><b>¿Eres el profesor?</b><span>Crea una sala para dos alumnos y proyecta el ring.</span></div><button data-box-create="" className="bx-button bx-secondary" type="button" disabled={!!pending} onClick={() => { void request('create'); }}>{pending === 'create' ? 'Creando…' : 'Crear sala'}</button></div>
        {last && <button className="bx-resume" onClick={() => onEnter(last)}>↪ Reanudar sala {last.code} · {last.role === 'teacher' ? 'Profesor' : 'Alumno'}</button>}
        {error && <div className="bx-error" role="alert">{error}<button className="bx-text-button" onClick={() => { void request(name.trim() && code.trim() ? 'join' : 'create'); }}>Reintentar</button></div>}
      </section>
    </div>
    <footer className="bx-footer"><span>2 ALUMNOS + 1 PROFESOR</span><span>Respuestas simultáneas. Sin premio por rapidez.</span></footer>
  </>;
}

function BoxingRoom({ session, sound, onExit }: { session: BoxingWelcome; sound: boolean; onExit: () => void }) {
  const client = useMemo(() => new BoxingClient(session), [session]);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(() => { client.start(); return () => client.close(); }, [client]);
  const view = state.view;
  return <>
    <div className="bx-match-heading"><div><p className="bx-eyebrow">{session.role === 'teacher' ? 'MODO PROYECTOR / PROFESOR' : session.free ? 'MODO LIBRE / SIN PROFESOR' : 'TU ESQUINA / ALUMNO'}</p><h1>{view?.phase === 'finished' ? 'Fin del combate.' : view?.phase === 'lobby' ? 'El ring os espera.' : 'Piensa. Elige. Boxen.'}</h1></div><div className={`bx-connection ${state.connection}`} role="status"><i />{state.connection === 'online' ? 'En directo' : state.connection === 'offline' ? 'Reconectando' : 'Conectando…'}<b data-box-room="">{session.code}</b></div></div>
    {state.error && <div className="bx-error" role="alert"><span>{state.error} Tu sesión se conserva.</span><button className="bx-text-button" disabled={state.busy} onClick={() => { void client.refresh(); }}>Reintentar conexión</button></div>}
    {view ? <>
      {(view.role === 'teacher' || (view.free?.mode === 'private' && view.phase === 'lobby')) && <RoomShare code={view.code} compact={view.phase !== 'lobby'} />}
      <BoxingArena view={view} busy={state.busy || state.connection !== 'online'} sound={sound} onAction={(action) => { void client.action(action); }} onLeave={onExit} />
    </> : <div className="bx-loading"><div className="bx-loading-ring" aria-hidden="true" /><h2>Preparando tu esquina…</h2><p>Conectando con la sala {session.code}. No cierres el servidor del profesor.</p><button className="bx-button bx-secondary" onClick={() => { void client.refresh(); }}>Reintentar</button><button className="bx-text-button" onClick={onExit}>Volver a la entrada</button></div>}
    <footer className="bx-footer"><span>WISSEN SCHLÄGT TEMPO</span><span>El conocimiento desbloquea acciones. La energía decide cuáles.</span></footer>
  </>;
}

function RoomShare({ code, compact }: { code: string; compact: boolean }) {
  const local = /^(localhost|127\.[\d.]+|\[?::1\]?)$/.test(location.hostname);
  const [base, setBase] = useState<string | null>(local ? null : location.origin);
  const [copied, setCopied] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  useEffect(() => {
    if (!local) return;
    const controller = new AbortController();
    fetch('/api/info', { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((info: { ips: string[]; port: number }) => {
      if (!info.ips?.[0]) throw new Error();
      const port = location.port || info.port;
      setBase(`${location.protocol}//${info.ips[0]}${port ? `:${port}` : ''}`);
    }).catch(() => { if (!controller.signal.aborted) setNetworkError(true); });
    return () => controller.abort();
  }, [local]);
  const url = base ? `${base}/boxeo?code=${encodeURIComponent(code)}` : '';
  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {
      const input = document.createElement('textarea'); input.value = url; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
      try { ok = document.execCommand('copy'); } catch { /* El enlace también se puede seleccionar a mano. */ }
      input.remove();
    }
    setCopied(ok);
  };
  return <section className={`bx-share${compact ? ' compact' : ''}`} aria-label="Invitar a la sala"><div className="bx-share-code"><span>CÓDIGO</span><b>{code}</b></div><div className="bx-share-link"><b>Dos esquinas. Un mismo ring.</b>{url ? <span className="bx-url">{url}</span> : <span>{networkError ? 'No se ha detectado la IP local. Abre esta web desde la dirección de red del profesor.' : 'Buscando la dirección de tu red…'}</span>}<small>{local ? 'Misma wifi o red local. ' : ''}El servidor del profesor debe seguir encendido.</small></div><button className="bx-button bx-secondary" disabled={!url} onClick={() => { void copy(); }}>{copied ? 'Enlace copiado ✓' : 'Copiar enlace'}</button></section>;
}

export function BoxingArena({ view, busy, sound, onAction, onLeave }: { view: BoxingView; busy: boolean; sound: boolean; onAction: ActionHandler; onLeave?: () => void }) {
  const resultVisible = view.phase === 'result' || view.phase === 'finished';
  const me = view.fighters.find((fighter) => fighter.id === view.me);
  const canPlay = !busy && !view.paused;
  const answered = view.fighters.filter((fighter) => fighter.answered).length;
  const phaseLabel = view.phase === 'lobby' ? 'PREPARACIÓN' : view.phase === 'question' ? '01 / CONOCIMIENTO' : view.phase === 'action' ? '02 / ESTRATEGIA' : view.phase === 'finished' ? 'COMBATE COMPLETADO' : '03 / INTERCAMBIO';
  return <>
    <div data-box-phase={view.phase} data-box-exchange={view.exchange} className={`bx-arena ${view.role === 'teacher' ? 'is-teacher' : 'is-player'}`}>
      <section className="bx-visual" aria-label="Combate"><div className="bx-round-strip"><span>{phaseLabel}</span><b>{view.exchange ? <>ASALTO <strong>{view.exchange}</strong>/{view.maxExchanges}</> : 'PREPARADOS'}</b></div>
        <div className="bx-scoreboards">{[0, 1].map((index) => <FighterHud key={index} fighter={view.fighters[index]} index={index} mine={view.fighters[index]?.id === view.me} />)}</div>
        <BoxingRing fighters={view.fighters} result={resultVisible ? view.result : undefined} paused={view.paused} sound={sound} round={view.exchange} phase={view.phase} winner={view.phase === 'finished' ? view.winner : undefined} />
        <div className="bx-simultaneous"><span aria-hidden="true">⇄</span><p>Sin ventaja por responder antes. <b>El intercambio se resuelve cuando ambos han elegido.</b></p></div>
      </section>
      <section className="bx-play-panel" aria-label={view.role === 'teacher' ? 'Panel del profesor' : 'Tu turno'}>
        {view.paused && <div className="bx-paused" role="status">Ⅱ Combate en pausa. El profesor lo reanudará.</div>}
        {view.phase === 'lobby' ? <>
          <p className="bx-eyebrow">ANTES DE LA CAMPANA</p><h2>{view.role === 'teacher' ? 'Reúne a tus púgiles.' : 'Ya estás en el ring.'}</h2><p className="bx-panel-copy">{view.role === 'teacher' ? 'Comparte el enlace. Cuando haya dos alumnos conectados, empieza el combate.' : 'Esperamos a los dos alumnos y a que el profesor dé la salida. No hay prisa.'}</p>
          <Roster fighters={view.fighters} />
          {view.free?.mode === 'private' && <FreeLobby view={view} busy={busy} onAction={onAction} />}
          <div className="bx-how"><b>La cabeza antes que los guantes.</b><p>Acierta para desbloquear jab, directo, crochet, defensa o esquiva. Si fallas, recuperas energía para el siguiente asalto.</p></div>
        </> : resultVisible ? <ResultPanel view={view} /> : <>
          <div className="bx-question-meta"><span className="bx-eyebrow">{view.question?.topic ?? 'DEUTSCH A1—A2'}</span><span>{answered}/2 respuestas</span></div>
          <h2 data-box-prompt="" className="bx-question" lang="de">{view.question?.prompt ?? 'Preparando la siguiente pregunta…'}</h2>
          {view.question && <div className={`bx-answers${view.role === 'teacher' ? ' read-only' : ''}`} role="group" aria-label="Opciones de respuesta">{view.question.options.map((option, index) => view.role === 'teacher' ? <div className="bx-answer" key={index}><span>{String.fromCharCode(65 + index)}</span><b lang="de">{option}</b></div> : <button className={`bx-answer${view.ownAnswer === index ? ' selected' : ''}`} type="button" data-answer={index} data-box-option={index} key={index} disabled={!canPlay || view.phase !== 'question' || view.ownAnswer !== undefined || !!me?.answered} onClick={() => onAction({ type: 'answer', questionId: view.question!.id, answer: index })}><span>{String.fromCharCode(65 + index)}</span><b lang="de">{option}</b>{view.ownAnswer === index && <i aria-label="Respuesta elegida">✓</i>}</button>)}</div>}
          {view.phase === 'question' && <div className="bx-turn-status" role="status">{view.role === 'teacher' ? 'Las respuestas son privadas hasta el resultado.' : view.ownAnswer !== undefined || me?.answered ? 'Respuesta bloqueada. Esperamos al otro alumno…' : 'Elige con calma. Tu respuesta queda bloqueada al enviarla.'}</div>}
          {view.phase === 'action' && view.role === 'teacher' && <div className="bx-turn-status" role="status">Ambas respuestas recibidas. Los alumnos eligen su estrategia en privado.</div>}
          {view.phase === 'action' && view.role === 'player' && (view.ownCorrect ? <>
            <div className="bx-unlocked"><b>✓ Correcto. Elige tu movimiento.</b><span>Tu energía: {me?.stamina ?? 0} · Las elecciones del rival siguen ocultas.</span></div>
            <div className="bx-moves" role="group" aria-label="Movimientos desbloqueados">{BOXING_MOVES.map((move) => <button key={move.id} data-move-choice={move.id} data-box-move={move.id} className={`bx-move${view.ownMove === move.id ? ' selected' : ''}`} disabled={!canPlay || !!view.ownMove || !!me?.lockedMove || (me?.stamina ?? 0) < move.cost} onClick={() => { if (view.question) onAction({ type: 'move', questionId: view.question.id, move: move.id }); }} title={move.description}><span className={`bx-move-icon ${move.id}`} aria-hidden="true"><MoveIcon move={move.id} /></span><b>{move.name}</b><span className="bx-move-cost" aria-label={move.cost ? `${move.cost} de energía` : 'Recupera energía'}>{move.cost ? Array.from({ length: move.cost }, (_, i) => <i key={i} />) : <em>+1</em>}<span>{move.cost ? `${move.cost} energía` : 'recupera'}</span></span><small>{move.description}</small></button>)}</div>
            {(view.ownMove || me?.lockedMove) && <p className="bx-turn-status" role="status">Movimiento bloqueado. Esperando al rival…</p>}
          </> : <div className="bx-recover" role="status"><span aria-hidden="true">↻</span><div><b>Este asalto toca recuperar.</b><p>No has acertado. Recuperarás energía automáticamente. La explicación llega con el resultado.</p></div></div>)}
          <Roster fighters={view.fighters} compact phase={view.phase} />
        </>}
        {view.role === 'teacher' && <TeacherControls view={view} busy={busy} onAction={onAction} />}
        {view.role === 'player' && resultVisible && (view.free
          ? <div className="bx-teacher-controls">{view.phase === 'result' ? <><button className="bx-button bx-primary" disabled={busy} data-box-control="next" onClick={() => onAction({ type: 'next' })}>Siguiente asalto<span aria-hidden="true">→</span></button><p className="bx-turn-status" role="status">Si nadie pulsa, el siguiente asalto empieza solo.</p></> : <><p className="bx-turn-status" role="status">Combate terminado. {view.free.mode === 'solo' ? 'Tus respuestas y explicaciones quedan arriba.' : 'Para una revancha, crea otra sala.'}</p>{onLeave && <button className="bx-button bx-primary" onClick={onLeave}>Salir</button>}</>}</div>
          : <p className="bx-turn-status" role="status">{view.phase === 'finished' ? 'El profesor puede iniciar una revancha.' : 'El profesor dará paso al siguiente asalto.'}</p>)}
      </section>
    </div>
  </>;
}

/** Partida privada sin profesor: cada jugador pulsa «Estoy listo»; cuando lo están los dos, empieza sola. */
function FreeLobby({ view, busy, onAction }: { view: BoxingView; busy: boolean; onAction: ActionHandler }) {
  const mine = !!view.me && !!view.free?.ready.includes(view.me);
  const two = view.fighters.length === 2;
  return <div className="bx-teacher-controls" data-box-free-lobby="">
    <p className="bx-turn-status" role="status">{two ? 'Cuando los dos estéis listos, empieza el combate. Sin profesor.' : 'Comparte el código con tu amigo y espera a que entre.'}</p>
    <button className="bx-button bx-primary" disabled={busy || mine || !two} data-box-control="ready" onClick={() => onAction({ type: 'ready' })}>{mine ? 'Listo · esperando al rival' : 'Estoy listo'}<span aria-hidden="true">→</span></button>
  </div>;
}

function FighterHud({ fighter, index, mine }: { fighter?: BoxingFighter; index: number; mine: boolean }) {
  const hp = Math.max(0, Math.min(100, fighter?.hp ?? 100));
  const stamina = fighter?.stamina ?? 0;
  return <div className={`bx-fighter-hud ${index ? 'blue' : 'red'}${mine ? ' mine' : ''}${fighter && hp < 30 ? ' low' : ''}`}>
    <div className="bx-fighter-name"><span className={`bx-online-dot${fighter?.connected ? ' online' : ''}`} title={fighter?.connected ? 'Conectado' : 'Desconectado o esperando'} /><b>{fighter?.name ?? `Esquina ${index ? 'azul' : 'roja'}`}</b>{mine && <small>TÚ</small>}<strong className="bx-hp-number">{fighter?.hp ?? '—'}</strong></div>
    <div className="bx-hp"><div className="bx-hp-track" role="meter" aria-label={`Vida de ${fighter?.name ?? 'esquina vacía'}`} aria-valuenow={fighter?.hp ?? 100} aria-valuemin={0} aria-valuemax={100}><i className="ghost" style={{ width: `${hp}%` }} /><i className="fill" style={{ width: `${hp}%` }} /></div></div>
    <div className="bx-stamina"><span>ENERGÍA</span><div aria-label={`${stamina} de energía`}>{Array.from({ length: Math.max(5, stamina) }, (_, i) => <i key={i} className={i < stamina ? 'full' : ''} />)}</div></div>
  </div>;
}
function MoveIcon({ move }: { move: string }) {
  const paths: Record<string, string> = {
    jab: 'M4 16 H22 M17 10 L23 16 L17 22',
    cross: 'M3 12 H24 M3 20 H24 M19 7 L26 16 L19 25',
    hook: 'M5 25 Q5 7 20 7 M15 3 L21 7 L16 12',
    guard: 'M16 3 L27 8 V16 Q27 24 16 29 Q5 24 5 16 V8 Z',
    dodge: 'M24 6 Q8 10 10 26 M5 21 L10 27 L16 22',
  };
  return <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={paths[move]} /></svg>;
}
function Roster({ fighters, compact = false, phase = 'lobby' }: { fighters: BoxingFighter[]; compact?: boolean; phase?: BoxingView['phase'] }) {
  return <div className={`bx-roster${compact ? ' compact' : ''}`} aria-label="Estado de los alumnos">{[0, 1].map((index) => { const fighter = fighters[index]; return <div key={index}><span className={`bx-online-dot${fighter?.connected ? ' online' : ''}`} /><b>{fighter?.name ?? `Esperando alumno ${index + 1}`}</b><span>{!fighter ? 'Plaza libre' : !fighter.connected ? 'Sin conexión' : phase === 'action' ? fighter.lockedMove ? 'Elección recibida' : 'Preparando' : phase === 'question' ? fighter.answered ? 'Respuesta recibida' : 'Pensando' : 'En línea'}</span></div>; })}</div>;
}
function TeacherControls({ view, busy, onAction }: { view: BoxingView; busy: boolean; onAction: ActionHandler }) {
  const ready = view.fighters.length === 2 && view.fighters.every((fighter) => fighter.connected);
  const [confirmRestart, setConfirmRestart] = useState(false);
  return <div className="bx-teacher-controls">
    {view.phase === 'lobby' && <button className="bx-button bx-primary" disabled={busy || !ready} data-box-control="start" onClick={() => onAction({ type: 'start' })}>Empezar combate<span aria-hidden="true">→</span></button>}
    {view.phase === 'result' && <button className="bx-button bx-primary" disabled={busy || view.paused} data-box-control="next" onClick={() => onAction({ type: 'next' })}>Siguiente asalto<span aria-hidden="true">→</span></button>}
    {view.phase !== 'lobby' && view.phase !== 'finished' && <div className="bx-control-row"><button className="bx-button bx-secondary" disabled={busy} data-box-control={view.paused ? 'resume' : 'pause'} onClick={() => onAction({ type: view.paused ? 'resume' : 'pause' })}>{view.paused ? '▷ Reanudar' : 'Ⅱ Pausar'}</button>{(view.phase === 'question' || view.phase === 'action') && <button className="bx-button bx-secondary" disabled={busy || view.paused} data-box-control="reveal" onClick={() => onAction({ type: 'reveal' })}>Cerrar sin responder</button>}</div>}
    {view.phase !== 'lobby' && (confirmRestart ? <div className="bx-control-row"><span>¿Empezar desde cero?</span><button className="bx-text-button" disabled={busy} data-box-control="restart" onClick={() => { setConfirmRestart(false); onAction({ type: 'restart' }); }}>Sí, reiniciar</button><button className="bx-text-button" onClick={() => setConfirmRestart(false)}>Cancelar</button></div> : <button className="bx-resume" disabled={busy} onClick={() => setConfirmRestart(true)}>{view.phase === 'finished' ? '↻ Preparar revancha' : '↻ Reiniciar combate'}</button>)}
  </div>;
}
function ResultPanel({ view }: { view: BoxingView }) {
  const winner = view.winner === 'draw' ? 'Empate. Buen combate.' : view.fighters.find((fighter) => fighter.id === view.winner)?.name;
  const ranking = [...view.fighters].sort((a, b) => b.hp - a.hp || b.correct - a.correct || b.damage - a.damage);
  const mine = view.result?.fighters.find((event) => event.id === view.me);
  return <>{mine && view.result && <div className={`bx-verdict ${mine.correct ? 'ok' : 'bad'}`}><span aria-hidden="true">{mine.correct ? '✓' : '✗'}</span><b>{mine.correct ? 'Richtig! Respuesta correcta.' : 'Falsch. Esta vez no.'}</b></div>}<p className="bx-eyebrow">{view.phase === 'finished' ? 'DIE ENTSCHEIDUNG / RESULTADO FINAL' : 'ASALTO RESUELTO / APRENDEMOS'}</p><h2>{view.phase === 'finished' ? view.winner === 'draw' ? winner : winner ? `${winner} gana el combate.` : 'Combate completado.' : 'Cada asalto enseña.'}</h2>
    {view.result && <div className="bx-solution"><span>RESPUESTA CORRECTA</span><strong lang="de">{view.result.answer}</strong><p>{view.result.explanation}</p></div>}
    <div className="bx-ranking"><h3>Clasificación</h3><div className="bx-ranking-head"><span>PÚGIL</span><span>HP</span><span>ACIERTOS</span><span>DAÑO</span></div>{ranking.map((fighter, i) => <div key={fighter.id} className={fighter.id === view.me ? 'mine' : ''}><b><i>{i + 1}</i>{fighter.name}</b><strong>{fighter.hp}</strong><span>{fighter.correct}</span><span>{fighter.damage}</span></div>)}</div>
    {view.result && <div className="bx-result-notes">{view.result.fighters.map((event) => <p key={event.id}><b>{view.fighters.find((fighter) => fighter.id === event.id)?.name}:</b> {event.move === 'recover' ? 'recupera energía' : BOXING_MOVES.find((move) => move.id === event.move)?.name}{event.dodged ? ' · esquiva efectiva' : event.blocked ? ' · bloqueo efectivo' : ''} · {event.damageDealt} de daño.</p>)}</div>}
  </>;
}
