import { Home } from './views/Home.tsx';
import { Player } from './views/Player.tsx';
import { Practice } from './views/Practice.tsx';
import { Teacher } from './views/Teacher.tsx';
import { usePath } from './util.ts';

export function App() {
  const path = usePath();
  const m = /^\/(t|p|j)\/([A-Za-z0-9]{3,8})\/?$/.exec(path);
  if (m && m[1] === 't') return <Teacher key={m[2]} code={m[2] === 'new' ? 'new' : m[2].toUpperCase()} />;
  if (m) return <Player key={m[2]} code={m[2].toUpperCase()} />;
  if (/^\/practi[cz]a\/?$/.test(path)) return <Practice />;
  return <Home />;
}
