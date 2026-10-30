// Partida en solitario (BlackCard o Wort-Jenga) del modo libre: sin profesor. Reutiliza la pantalla de juego del alumno (PlayScreen)
// y el transporte existente; el servidor decide corrección, puntos y progreso.
import { useEffect, useMemo, useState } from 'react';
import type { Topic } from '../../shared/types.ts';
import { isLevel } from '../../shared/play.ts';
import { Net, useNet } from '../net.ts';
import { navigate, store, studentSession } from '../util.ts';
import { PlayScreen } from './Player.tsx';
import { topicsFromQuery } from './Practice.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';

type Hello = Extract<ConstructorParameters<typeof Net>[0], { role: 'practice' }>;
const KEY = 'dt:free:resume';
interface Saved { room: string; token: string; q: string }

function params(search: string) {
  const q = new URLSearchParams(search);
  const level = q.get('nivel');
  const size = Number(q.get('n'));
  return {
    game: q.get('juego') === 'jenga' ? 'jenga' as const : 'blackcard' as const,
    level: isLevel(level) ? level : undefined,
    topics: topicsFromQuery(search) as Topic[],
    size: [10, 15, 25].includes(size) ? size : 10,
    q: q.toString(),
  };
}

function helloFor(search: string, saved: Saved | null): Hello {
  const p = params(search);
  const session = studentSession();
  const base = { t: 'hello' as const, role: 'practice' as const, free: true, game: p.game, topics: p.topics, size: p.size, ...(p.level ? { level: p.level } : {}), ...(session ? { session } : {}) };
  if (saved && saved.q === p.q) return { ...base, room: saved.room, token: saved.token };
  return { ...base, name: store.get('dt:free:name') ?? 'Invitado' };
}

export function FreeGame() {
  const search = typeof location !== 'undefined' ? location.search : '';
  const read = (): Saved | null => { try { const v = JSON.parse(store.get(KEY) ?? 'null'); return v && typeof v.room === 'string' && typeof v.token === 'string' ? v : null; } catch { return null; } };
  const [run, setRun] = useState(0);
  const [hello, setHello] = useState<Hello>(() => helloFor(search, read()));
  const again = () => { store.del(KEY); setHello(helloFor(search, null)); setRun((x) => x + 1); };
  const leave = () => { store.del(KEY); navigate('/libre'); };
  return <FreeConn key={run} hello={hello} q={params(search).q} onAgain={again} onLeave={leave} />;
}

function FreeConn({ hello, q, onAgain, onLeave }: { hello: Hello; q: string; onAgain: () => void; onLeave: () => void }) {
  const net = useMemo(() => new Net(hello, (m) => { store.set(KEY, JSON.stringify({ room: m.room, token: m.token, q } satisfies Saved)); }), [hello, q]);
  useEffect(() => () => net.close(), [net]);
  const st = useNet(net);
  if (st.fatal) {
    return (
      <div className="home" role="alert">
        <p className="err-msg">{st.error}</p>
        <div className="row"><button className="btn primary" onClick={onLeave}>Volver al modo libre</button></div>
      </div>
    );
  }
  return (
    <ErrorBoundary onReset={onLeave} resetLabel="Volver al modo libre">
      {st.notice && <p className="panel practice-notice" role="status">{st.notice}</p>}
      {st.error && <p className="err-msg" role="alert">{st.error}</p>}
      <PlayScreen net={net} st={st} onNewPractice={onAgain} onChangeTopics={onLeave} />
    </ErrorBoundary>
  );
}
