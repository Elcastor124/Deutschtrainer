import type { MouseEvent } from 'react';
import { navigate } from '../util.ts';

/** Real links keep keyboard, new-tab and browser navigation available. */
export function followLearningLink(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute('href')!);
  window.scrollTo({ top: 0 });
}

export function LearningNav({ path }: { path: string }) {
  const active = path.startsWith('/road-to-b1') ? 'road' : path.startsWith('/practi') || path.startsWith('/tema/1/taller') ? 'practice' : /^\/(jugar|t|p|j)(\/|$)/.test(path) ? 'game' : 'explore';
  return (
    <nav className="learning-nav" aria-label="Navegación de aprendizaje">
      <a className="learning-brand" href="/" onClick={followLearningLink}>DEUTSCH <b>// BLACKCARD</b></a>
      <div className="row">
        <a href="/" onClick={followLearningLink} aria-current={active === 'explore' ? 'page' : undefined}>Explorar</a>
        <a href="/road-to-b1" onClick={followLearningLink} aria-current={active === 'road' ? 'page' : undefined}>Road to B1</a>
        <a href="/jugar" onClick={followLearningLink} aria-current={active === 'game' ? 'page' : undefined}>Jugar en clase</a>
        <a href="/practica?tema=1" onClick={followLearningLink} aria-current={active === 'practice' ? 'page' : undefined}>Practicar</a>
      </div>
    </nav>
  );
}
