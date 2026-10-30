import { lazy, Suspense, useEffect, useState } from 'react';
import { PageTransition } from './brand/PageTransition.tsx';
import { AmbientField } from './brand/AmbientField.tsx';
import './brand/gamefeel.css';
const KlausShowcase = lazy(() => import('./klaus/KlausShowcase.tsx'));
import { Road } from './views/Road.tsx';
import { Libre } from './views/Libre.tsx';
import { FreeGame } from './views/FreeGame.tsx';
import { Account } from './views/Account.tsx';
import { Ranking } from './views/Ranking.tsx';
import { LoginPage, RegisterPage } from './views/Auth.tsx';
import { StudentHome } from './views/StudentHome.tsx';
const TeacherOS = lazy(() => import('./teacher/TeacherOS.tsx').then((m) => ({ default: m.TeacherOS })));
import { ScrollReveal } from './brand/ScrollReveal.tsx';
import { AchievementWatcher } from './components/Badges.tsx';
import { Boxing } from './views/Boxing.tsx';
import { Landing } from './views/Landing.tsx';
import { Course } from './views/Course.tsx';
import { Intro } from './brand/Intro.tsx';
import { TopicOne } from './views/TopicOne.tsx';
import { Workshop } from './views/Workshop.tsx';
import { Player } from './views/Player.tsx';
import { Practice } from './views/Practice.tsx';
import { KlausSkins } from './views/KlausSkins.tsx';
import { GameSetup } from './views/GameSetup.tsx';
import { Teacher } from './views/Teacher.tsx';
import { LearningNav } from './components/LearningNav.tsx';
import { usePath } from './util.ts';

export function App() {
  const path = usePath();
  // usePath intentionally ignores queries; invitations still need to update without a reload.
  const [search, setSearch] = useState(location.search);
  useEffect(() => {
    const syncSearch = () => setSearch(location.search);
    addEventListener('popstate', syncSearch);
    return () => removeEventListener('popstate', syncSearch);
  }, []);
  const boxing = /^\/boxeo\/?$/.test(path);
  // Teacher OS es una aplicación con su propia barra lateral: sin la navegación pública encima.
  const teacherOs = /^\/(teacher|profesor)(\/|$)/.test(path);
  const m = /^\/(t|p|j)\/([A-Za-z0-9]{3,8})\/?$/.exec(path);
  const invited = path === '/' && !!new URLSearchParams(search).get('sala');
  let screen;
  if (boxing) screen = <Boxing />;
  else if (m && m[1] === 't') screen = <Teacher key={m[2]} code={m[2] === 'new' ? 'new' : m[2].toUpperCase()} />;
  else if (m) screen = <Player key={m[2]} code={m[2].toUpperCase()} />;
  else if (/^\/road-to-b1(?:\/level-1)?\/?$/.test(path)) screen = <Road />;
  else if (/^\/libre\/?$/.test(path)) screen = <Libre />;
  else if (/^\/cuenta\/?$/.test(path)) screen = <Account />;
  else if (/^\/registro\/?$/.test(path)) screen = <RegisterPage />;
  else if (/^\/entrar\/?$/.test(path)) screen = <LoginPage />;
  else if (/^\/mi\/?$/.test(path)) screen = <StudentHome />;
  else if (/^\/ranking\/?$/.test(path)) screen = <Ranking />;
  else if (/^\/klaus\/?$/.test(path)) screen = <KlausSkins />;
  else if (/^\/libre\/jugar\/?$/.test(path)) screen = <FreeGame key={search} />;
  else if (path === '/preview/klaus') screen = <Suspense fallback={<p className="home">Cargando a Klaus…</p>}><KlausShowcase /></Suspense>;
  else if (/^\/curso\/?$/.test(path)) screen = <Course />;
  else if (/^\/(teacher|profesor)(\/|$)/.test(path)) screen = <Suspense fallback={<div className="tos-skel full" aria-busy="true" />}><TeacherOS /></Suspense>;
  else if (/^\/tema\/1\/taller\/?$/.test(path)) screen = <Workshop />;
  else if (/^\/tema\/1\/?$/.test(path)) screen = <TopicOne />;
  else if (/^\/practi[cz]a\/?$/.test(path)) screen = <Practice />;
  else if (/^\/jenga\/?$/.test(path)) screen = <GameSetup mode="jenga" />;
  else if (/^\/jugar\/?$/.test(path) || invited) screen = <GameSetup mode="blackcard" />;
  else screen = <Landing />;
  return <><AmbientField path={path} search={search} /><Intro path={path} search={search} />{!teacherOs && <LearningNav path={invited ? '/jugar' : path} />}<PageTransition path={path}>{screen}</PageTransition><ScrollReveal path={path} /><AchievementWatcher path={path} /></>;
}
