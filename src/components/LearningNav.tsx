import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { navigate, store } from '../util.ts';
import '../account.css';
import { Logo } from '../brand/Logo.tsx';
import { EffectsToggle } from '../brand/EffectsToggle.tsx';

const plainClick = (e: MouseEvent<HTMLAnchorElement>) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** Real links keep keyboard, new-tab and browser navigation available. */
export function followLearningLink(event: MouseEvent<HTMLAnchorElement>) {
  if (!plainClick(event)) return;
  const href = event.currentTarget.getAttribute('href')!;
  // Presentaciones (HTML estático) y pestañas nuevas: navegación normal del navegador.
  if (event.currentTarget.target === '_blank' || href.startsWith('/presentaciones/') || /^[a-z]+:/i.test(href)) return;
  event.preventDefault();
  const [to, hash] = href.split('#');
  navigate(to || '/');
  if (hash) requestAnimationFrame(() => setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40));
  else window.scrollTo({ top: 0 });
}

export type NavSection = 'home' | 'course' | 'practice' | 'games' | 'ranking' | 'road' | 'teacher' | 'account';
export function navSection(path: string): NavSection {
  if (/^\/(cuenta|mi|registro|entrar)(\/|$)/.test(path)) return 'account';
  if (path.startsWith('/ranking')) return 'ranking';
  if (path.startsWith('/road-to-b1') || path.startsWith('/examenes')) return 'road';
  if (path.startsWith('/curso') || path.startsWith('/biblioteca') || /^\/tema\/1\/?$/.test(path)) return 'course';
  if (path.startsWith('/practi') || path.startsWith('/tema/1/taller')) return 'practice';
  if (/^\/(jugar|jenga|boxeo|libre|t|p|j)(\/|$)/.test(path)) return 'games';
  if (path.startsWith('/profesor')) return 'teacher';
  return 'home';
}

const LINKS: { id: NavSection; href: string; label: string; de: string }[] = [
  { id: 'home', href: '/', label: 'Inicio', de: 'Start' },
  { id: 'course', href: '/curso', label: 'Curso', de: 'Kurs' },
  { id: 'practice', href: '/practica', label: 'Practicar', de: 'Üben' },
  { id: 'games', href: '/#juegos', label: 'Juegos', de: 'Spiele' },
  { id: 'ranking', href: '/ranking', label: 'Ranking', de: 'Rangliste' },
  { id: 'road', href: '/examenes', label: 'Exámenes', de: 'Prüfungen' },
];

/** Alias de la cuenta de alumno (si hay sesión). Se actualiza al entrar/salir sin recargar. */
function useAlias() {
  const [alias, setAlias] = useState<string | null>(() => store.get('dt:student-alias'));
  useEffect(() => {
    const on = () => setAlias(store.get('dt:student-alias'));
    addEventListener('dt:account', on); addEventListener('storage', on);
    return () => { removeEventListener('dt:account', on); removeEventListener('storage', on); };
  }, []);
  return alias;
}

export function LearningNav({ path }: { path: string }) {
  const active = navSection(path);
  const alias = useAlias();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty('--dt-nav-height', `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--dt-nav-height'); };
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 8);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); } };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [open]);
  const go = (e: MouseEvent<HTMLAnchorElement>) => { setOpen(false); followLearningLink(e); };
  return (
    <header ref={headerRef} className={`dt-nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="dt-skip" href="#contenido">Saltar al contenido</a>
      <nav className="dt-nav-inner" aria-label="Navegación principal">
        <a className="dt-nav-brand" href="/" onClick={go} aria-label="Deutschtrainer · Inicio"><Logo height={30} /></a>
        <button ref={toggleRef} type="button" className="dt-nav-toggle" aria-expanded={open} aria-controls="dt-nav-links" onClick={() => setOpen((v) => !v)}>
          <span className="sr">{open ? 'Cerrar menú' : 'Abrir menú'}</span><i aria-hidden="true" /><i aria-hidden="true" />
        </button>
        <div className="dt-nav-links" id="dt-nav-links">
          {LINKS.map((l) => (
            <a key={l.id} href={l.href} onClick={go} aria-current={active === l.id ? 'page' : undefined}>
              <span>{l.label}</span><small lang="de" aria-hidden="true">{l.de}</small>
            </a>
          ))}
          <EffectsToggle />
          {alias ? (
            <a className="acc-chip" href="/mi" onClick={go} aria-current={active === 'account' ? 'page' : undefined} aria-label={`Mi espacio: ${alias}`} data-account-chip="">
              <i aria-hidden="true">{alias.slice(0, 1).toUpperCase()}</i><span>{alias}</span>
            </a>
          ) : (
            <>
              <a className="dt-nav-join" href="/jugar" onClick={go} data-nav-join="">Unirse a una clase</a>
              <a className="dt-nav-login" href="/entrar" onClick={go} aria-current={active === 'account' ? 'page' : undefined} data-nav-login="">Iniciar sesión</a>
              <a className="dt-nav-cta" href="/registro" onClick={go} data-nav-register="">Crear cuenta</a>
            </>
          )}
          <a className="dt-nav-teacher" href="/profesor" onClick={go} aria-current={active === 'teacher' ? 'page' : undefined} aria-label="Área del profesor">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v6.5h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            <span>Profesor</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
