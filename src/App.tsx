import { Road } from './views/Road.tsx';
import { Boxing } from './views/Boxing.tsx';
import { Landing } from './views/Landing.tsx';
import { Course } from './views/Course.tsx';
import { TeacherSoon } from './views/TeacherSoon.tsx';
import { Intro } from './brand/Intro.tsx';
import { TopicOne } from './views/TopicOne.tsx';
import { Workshop } from './views/Workshop.tsx';
import { Player } from './views/Player.tsx';
import { Practice } from './views/Practice.tsx';
import { GameSetup } from './views/GameSetup.tsx';
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
  else if (/^\/road-to-b1(?:\/level-1)?\/?$/.test(path)) screen = <Road />;
  else if (/^\/curso\/?$/.test(path)) screen = <Course />;
  else if (/^\/profesor\/?$/.test(path)) screen = <TeacherSoon />;
  else if (/^\/tema\/1\/taller\/?$/.test(path)) screen = <Workshop />;
  else if (/^\/tema\/1\/?$/.test(path)) screen = <TopicOne />;
  else if (/^\/practi[cz]a\/?$/.test(path)) screen = <Practice />;
  else if (/^\/jenga\/?$/.test(path)) screen = <GameSetup mode="jenga" />;
  else if (/^\/jugar\/?$/.test(path) || invited) screen = <GameSetup mode="blackcard" />;
  else screen = <Landing />;
  return <><Intro path={path} search={location.search} /><LearningNav path={invited ? '/jugar' : path} /><div id="contenido" className="dt-content" tabIndex={-1}>{screen}</div></>;
}
