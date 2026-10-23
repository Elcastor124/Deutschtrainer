import { Home } from './views/Home.tsx';
import { Boxing } from './views/Boxing.tsx';
import { Explore } from './views/Explore.tsx';
import { TopicOne } from './views/TopicOne.tsx';
import { Workshop } from './views/Workshop.tsx';
import { Player } from './views/Player.tsx';
import { Practice } from './views/Practice.tsx';
import { Teacher } from './views/Teacher.tsx';
import { LearningNav } from './components/LearningNav.tsx';
import { usePath } from './util.ts';

export function App() {
  const path = usePath();
  if (/^\/boxeo\/?$/.test(path)) return <Boxing />;
  const m = /^\/(t|p|j)\/([A-Za-z0-9]{3,8})\/?$/.exec(path);
  const invited = path === '/' && !!new URLSearchParams(location.search).get('sala');
  let screen;
  if (m && m[1] === 't') screen = <Teacher key={m[2]} code={m[2] === 'new' ? 'new' : m[2].toUpperCase()} />;
  else if (m) screen = <Player key={m[2]} code={m[2].toUpperCase()} />;
  else if (/^\/tema\/1\/taller\/?$/.test(path)) screen = <Workshop />;
  else if (/^\/tema\/1\/?$/.test(path)) screen = <TopicOne />;
  else if (/^\/practi[cz]a\/?$/.test(path)) screen = <Practice />;
  else if (/^\/jugar\/?$/.test(path) || invited) screen = <Home />;
  else screen = <Explore />;
  return <><LearningNav path={invited ? '/jugar' : path} />{screen}</>;
}
