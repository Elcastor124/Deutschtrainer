import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { TOPICS } from '../../shared/rules.ts';
import type { Topic } from '../../shared/types.ts';
import { Net, useNet } from '../net.ts';
import { navigate, profileId, store } from '../util.ts';
import { PlayScreen } from './Player.tsx';
import { followLearningLink } from '../components/LearningNav.tsx';

type Hello = ConstructorParameters<typeof Net>[0];

export function Practice() {
  const saved = (() => { try { return JSON.parse(store.get('bc:practice') ?? 'null') as { room: string; token: string } | null; } catch { return null; } })();
  const [hello, setHello] = useState<Hello | null>(null);
  const [name, setName] = useState(store.get('bc:name') ?? '');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [focus, setFocus] = useState(false);
  const [pcode, setPcode] = useState('');
  const myCode = store.get('bc:pcode');

  if (hello) return <PracticeConn hello={hello} onNew={() => { store.del('bc:practice'); setHello(null); }} />;

  const start = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !pcode.trim()) return;
    store.set('bc:name', name.trim());
    setHello({ t: 'hello', role: 'practice', name: name.trim(), topics, focus, profile: profileId(), ...(pcode.trim() ? { profileCode: pcode.trim().toUpperCase() } : {}) });
  };
  const toggle = (t: Topic) => setTopics((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  return (
    <form className="home" onSubmit={start} style={{ alignContent: 'start', paddingTop: '8vh' }}>
      <h1 className="home-title" style={{ fontSize: 'clamp(2.2rem, 1.4rem + 4vw, 4.6rem)' }}>Tema 1<b>// práctica</b></h1>
      <p className="home-sub">Todo el banco de preguntas preparado, en sesiones de 15 preguntas sin tiempo. Si fallas una, vuelve a salir unas preguntas después. Puedes activar el repaso de errores o elegir contenidos.</p>
      <p className="home-sub small">Necesitas conexión con el servidor. Los talleres de escritura y ensayo de escenas tienen su propio espacio de práctica.</p>
      <div className="row"><a className="btn" href="/tema/1" onClick={followLearningLink}>Ver materiales de Tema 1</a><a className="btn" href="/tema/1/taller" onClick={followLearningLink}>Practicar escritura y escenas</a></div>
      {saved && (
        <div className="panel row" style={{ width: '100%' }}>
          <span>Tienes una práctica a medias.</span><span className="spacer" />
          <button type="button" className="btn primary" onClick={() => setHello({ t: 'hello', role: 'practice', room: saved.room, token: saved.token })}>Continuar</button>
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
        <label className="row"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /> Solo lo que he fallado (si no hay errores guardados, preguntas variadas)</label>
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

function PracticeConn({ hello, onNew }: { hello: Hello; onNew: () => void }) {
  const net = useMemo(() => new Net(hello, (m) => {
    store.set('bc:practice', JSON.stringify({ room: m.room, token: m.token }));
    if (m.profile) store.set('bc:profile', m.profile);
    if (m.profileCode) store.set('bc:pcode', m.profileCode);
  }), [hello]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  if (st.fatal) {
    return (
      <div className="home">
        <p className="err-msg">{st.error}</p>
        <button className="btn primary" onClick={onNew}>Volver a empezar</button>
      </div>
    );
  }
  return <PlayScreen net={net} st={st} onNewPractice={onNew} />;
}
