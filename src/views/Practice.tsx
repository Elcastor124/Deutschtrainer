import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { TOPICS } from '../../shared/rules.ts';
import type { Topic } from '../../shared/types.ts';
import { Net, useNet } from '../net.ts';
import { navigate, profileId, store } from '../util.ts';
import { PlayScreen } from './Player.tsx';
import { followLearningLink } from '../components/LearningNav.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';

type Hello = Extract<ConstructorParameters<typeof Net>[0], { role: 'practice' }>;
interface Opts { topics: Topic[]; focus: boolean; size: number }
interface Saved { room: string; token: string; opts?: Opts }

export const PRACTICE_SIZES = [10, 15, 25] as const;
const KEY = 'bc:practice';

function readSaved(): Saved | null {
  try {
    const v = JSON.parse(store.get(KEY) ?? 'null');
    return v && typeof v.room === 'string' && typeof v.token === 'string' ? v : null;
  } catch { return null; }
}

/** ?temas=dativ,akkusativ (enlaces del curso) preselecciona temas. */
export function topicsFromQuery(search: string): Topic[] {
  const raw = new URLSearchParams(search).get('temas') ?? '';
  return [...new Set(raw.split(',').map((t) => t.trim()).filter((t): t is Topic => Object.hasOwn(TOPICS, t)))];
}

export function Practice() {
  const saved = readSaved();
  const [hello, setHelloRaw] = useState<Hello | null>(null);
  const [run, setRun] = useState(0);
  const setHello = (h: Hello | null) => { setRun((x) => x + 1); setHelloRaw(h); };
  const [name, setName] = useState(store.get('bc:name') ?? '');
  const [topics, setTopics] = useState<Topic[]>(() => topicsFromQuery(typeof location !== 'undefined' ? location.search : ''));
  const [focus, setFocus] = useState(false);
  const [size, setSize] = useState<number>(() => Number(store.get('bc:psize')) || 15);
  const [pcode, setPcode] = useState('');
  const myCode = store.get('bc:pcode');

  const resume = (s: Saved) => setHello({
    t: 'hello', role: 'practice', room: s.room, token: s.token, profile: profileId(), name: store.get('bc:name') ?? undefined,
    ...(s.opts ? { topics: s.opts.topics, focus: s.opts.focus, size: s.opts.size } : {}),
  });
  // Recarga a mitad de práctica: se retoma sola (sin pasar por el formulario).
  useEffect(() => { if (saved) resume(saved); }, []);

  if (hello) {
    const again = () => setHello({ t: 'hello', role: 'practice', profile: profileId(), name: store.get('bc:name') ?? hello.name, topics: hello.topics, focus: hello.focus, size: hello.size });
    const toForm = () => { store.del(KEY); setHello(null); };
    return <PracticeConn key={run} hello={hello} onAgain={again} onForm={toForm} />;
  }

  const start = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !pcode.trim()) return;
    store.set('bc:name', name.trim());
    store.set('bc:psize', String(size));
    setHello({ t: 'hello', role: 'practice', name: name.trim(), topics, focus, size, profile: profileId(), ...(pcode.trim() ? { profileCode: pcode.trim().toUpperCase() } : {}) });
  };
  const toggle = (t: Topic) => setTopics((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  return (
    <form className="home" onSubmit={start} style={{ alignContent: 'start', paddingTop: '8vh' }}>
      <h1 className="home-title" style={{ fontSize: 'clamp(2.2rem, 1.4rem + 4vw, 4.6rem)' }}>Tema 1<b>// práctica</b></h1>
      <p className="home-sub">Todo el banco de preguntas preparado, en sesiones sin tiempo. Cada práctica trae preguntas nuevas y mezcla un repaso de lo que fallaste en otras sesiones. Si fallas una, vuelve a salir unas preguntas después.</p>
      <p className="home-sub small">Necesitas conexión con el servidor. Los talleres de escritura y ensayo de escenas tienen su propio espacio de práctica.</p>
      <div className="row"><a className="btn" href="/tema/1" onClick={followLearningLink}>Ver materiales de Tema 1</a><a className="btn" href="/tema/1/taller" onClick={followLearningLink}>Practicar escritura y escenas</a></div>
      {saved && (
        <div className="panel row" style={{ width: '100%' }}>
          <span>Tienes una práctica a medias: retomándola…</span><span className="spacer" />
          <button type="button" className="btn primary" onClick={() => resume(saved)}>Continuar</button>
          <button type="button" className="btn ghost" onClick={() => { store.del(KEY); location.reload(); }}>Empezar otra</button>
        </div>
      )}
      <div className="panel stack" style={{ width: '100%' }}>
        <label className="stack" style={{ gap: 6 }}>Tu nombre
          <input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span>Temas <span className="dim">(sin marcar = todos)</span></span>
          <div className="chips">
            {(Object.keys(TOPICS) as Topic[]).map((t) => (
              <button key={t} type="button" className={`btn sm${topics.includes(t) ? ' on' : ''}`} aria-pressed={topics.includes(t)} onClick={() => toggle(t)}>{TOPICS[t].de}</button>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }} role="radiogroup" aria-label="Preguntas por sesión">
          <span>Preguntas por sesión</span>
          <div className="chips">
            {PRACTICE_SIZES.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={size === n} className={`btn sm${size === n ? ' on' : ''}`} onClick={() => setSize(n)}>{n}</button>
            ))}
          </div>
        </div>
        <label className="row"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /> Repasar sobre todo lo que he fallado (se completa con preguntas nuevas)</label>
        <label className="stack" style={{ gap: 6 }}>
          <span>¿Otro ordenador? Código de alumno <span className="dim">(aparece al final de la clase{myCode ? `; el tuyo: ${myCode}` : ''})</span></span>
          <input className="field dot" style={{ letterSpacing: '0.15em' }} value={pcode} maxLength={6} onChange={(e) => setPcode(e.target.value.toUpperCase())} placeholder="opcional" />
        </label>
        <div className="row">
          <button className="btn primary lg" disabled={!name.trim() && !pcode.trim()}>Empezar práctica</button>
          <button type="button" className="btn ghost" onClick={() => navigate('/')}>Volver</button>
        </div>
      </div>
    </form>
  );
}

function PracticeConn({ hello, onAgain, onForm }: { hello: Hello; onAgain: () => void; onForm: () => void }) {
  const net = useMemo(() => new Net(hello, (m) => {
    const opts: Opts = { topics: hello.topics ?? [], focus: !!hello.focus, size: hello.size ?? 15 };
    store.set(KEY, JSON.stringify({ room: m.room, token: m.token, opts } satisfies Saved));
    if (m.profile) store.set('bc:profile', m.profile);
    if (m.profileCode) store.set('bc:pcode', m.profileCode);
  }), [hello]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  if (st.fatal) {
    return (
      <div className="home" role="alert">
        <p className="err-msg">{st.error}</p>
        <div className="row">
          <button className="btn primary" onClick={onForm}>Volver al formulario</button>
        </div>
      </div>
    );
  }
  return (
    <ErrorBoundary onReset={onForm} resetLabel="Empezar otra práctica">
      {st.notice && <p className="panel practice-notice" role="status">{st.notice}</p>}
      {st.error && <p className="err-msg" role="alert">{st.error}</p>}
      <PlayScreen net={net} st={st} onNewPractice={onAgain} onChangeTopics={onForm} />
    </ErrorBoundary>
  );
}
