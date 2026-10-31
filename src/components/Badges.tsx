// Insignias: medallón SVG por logro (bronce/plata/oro), grid agrupado y aviso animado al desbloquear.
import { useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS, type AchievementDef, type AchievementState } from '../../shared/play.ts';
import { getAchievements } from '../play-client.ts';
import { store, studentSession } from '../util.ts';
import '../badges.css';

const ICONS: Record<string, string> = {
  spark: 'M16 4 L18.5 13.5 L28 16 L18.5 18.5 L16 28 L13.5 18.5 L4 16 L13.5 13.5 Z',
  check: 'M8 16.5 L13.5 22 L24.5 10',
  star: 'M16 5 L19.3 12.2 L27 13 L21.2 18.2 L22.9 26 L16 22 L9.1 26 L10.8 18.2 L5 13 L12.7 12.2 Z',
  compass: 'M16 5 A11 11 0 1 0 16.01 5 M20 12 L17.5 17.5 L12 20 L14.5 14.5 Z',
  mountain: 'M4 25 L12.5 11 L17 18 L20 14 L28 25 Z M12.5 11 L14.5 14.5',
  flame: 'M16 4 C17 9 23 11 23 18.5 A7 7 0 0 1 9 18.5 C9 14.5 11.5 12.5 12.5 10 C13 12 14 13 15.2 13.5 C14.6 10.5 15 7.5 16 4 Z',
  flag: 'M9 27 L9 5 M9 6 L24 6 L20 11 L24 16 L9 16',
  diamond: 'M10 6 L22 6 L28 13 L16 27 L4 13 Z M4 13 L28 13 M12 6 L16 13 L20 6',
  glove: 'M10 14 C10 8 14 6 18 6 C23 6 25 9 25 14 L25 18 C25 22 22 25 18 25 L13 25 C10 25 8 23 8 20 L8 16 C8 14 10 13 12 14 L12 18',
  tower: 'M9 26 L23 26 M10 26 L10 21 L22 21 L22 26 M11 21 L11 16 L21 16 L21 21 M12 16 L12 11 L20 11 L20 16 M13 11 L13 6 L19 6 L19 11',
  grid: 'M7 7 H14 V14 H7 Z M18 7 H25 V14 H18 Z M7 18 H14 V25 H7 Z M18 18 H25 V25 H18 Z',
  podium: 'M4 26 L4 18 L11 18 L11 26 M11 26 L11 11 L21 11 L21 26 M21 26 L21 15 L28 15 L28 26 M3 26 L29 26',
  crown: 'M5 24 L7 10 L12.5 16 L16 7 L19.5 16 L25 10 L27 24 Z',
  medal: 'M10 4 L14 13 M22 4 L18 13 M10 19 A6 6 0 1 0 22 19 A6 6 0 1 0 10 19',
  shield: 'M16 4 L26 8 V15 C26 21 21.5 26 16 28 C10.5 26 6 21 6 15 V8 Z',
  bolt: 'M18 3 L8 18 H15 L13 29 L24 13 H17 Z',
  target: 'M16 4 A12 12 0 1 0 16.01 4 M16 9 A7 7 0 1 0 16.01 9 M16 14 A2 2 0 1 0 16.01 14',
  rocket: 'M16 3 C21 7 22 13 20 19 L16 23 L12 19 C10 13 11 7 16 3 Z M12 19 L8 22 L9 26 L13 23 M20 19 L24 22 L23 26 L19 23 M16 23 V29',
  book: 'M5 6 C9 4 13 5 16 8 C19 5 23 4 27 6 V26 C23 24 19 25 16 28 C13 25 9 24 5 26 Z M16 8 V28',
  sun: 'M16 11 A5 5 0 1 0 16.01 11 M16 3 V6 M16 26 V29 M3 16 H6 M26 16 H29 M7 7 L9 9 M23 23 L25 25 M25 7 L23 9 M9 23 L7 25',
  moon: 'M20 4 A12 12 0 1 0 28 22 A10 10 0 0 1 20 4 Z',
  calendar: 'M5 8 H27 V27 H5 Z M5 13 H27 M11 5 V10 M21 5 V10',
  leaf: 'M6 26 C6 14 12 7 26 6 C26 19 20 26 6 26 Z M6 26 L16 16',
  globe: 'M16 4 A12 12 0 1 0 16.01 4 M4 16 H28 M16 4 C12 8 12 24 16 28 M16 4 C20 8 20 24 16 28',
};
export const defOf = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

export function Medal({ def, unlocked, size = 64 }: { def: AchievementDef; unlocked: boolean; size?: number }) {
  return (
    <svg className={`bdg-medal tier-${def.tier}${unlocked ? '' : ' locked'}`} viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="18.5" className="bdg-rim" />
      <circle cx="20" cy="20" r="14.5" className="bdg-face" />
      <g transform="translate(4 4)"><path d={ICONS[def.icon] ?? ICONS.spark} className="bdg-icon" /></g>
      {!unlocked && <path d="M16 19 V17 a4 4 0 0 1 8 0 V19 M15 19 H25 V25 H15 Z" className="bdg-lock" />}
    </svg>
  );
}

const GROUPS: { id: AchievementDef['group']; title: string }[] = [
  { id: 'aprendizaje', title: 'Aprendizaje' }, { id: 'dominio', title: 'Dominio' }, { id: 'temas', title: 'Temas' },
  { id: 'constancia', title: 'Constancia' }, { id: 'habitos', title: 'Hábitos' }, { id: 'juegos', title: 'Juegos' }, { id: 'ranking', title: 'Ranking' },
];

export function BadgeGrid({ list }: { list: AchievementState[] }) {
  const done = list.filter((a) => a.unlocked).length;
  return (
    <section className="libre-card bdg-wrap" aria-label="Logros">
      <header className="bdg-head">
        <h2>Logros</h2>
        <span className="bdg-count"><b className="dotnum">{done}</b>/{list.length}</span>
        <span className="bdg-total" aria-hidden="true"><i style={{ width: `${Math.round((done / Math.max(1, list.length)) * 100)}%` }} /></span>
      </header>
      {GROUPS.map((g) => {
        const items = list.filter((a) => defOf(a.id)?.group === g.id);
        const got = items.filter((a) => a.unlocked).length;
        // Con 121 logros, un grupo sin nada conseguido se pliega: se ve su progreso y se abre al pulsar.
        return (
        <details key={g.id} className="bdg-group" open={got > 0 || g.id === 'aprendizaje'}>
          <summary><h3>{g.title}</h3><span className="bdg-gcount">{got}/{items.length}</span></summary>
          <ul className="bdg-grid">
            {items.map((a) => {
              const d = defOf(a.id);
              return (
                <li key={a.id} className={`bdg${a.unlocked ? ' is-on' : ''}`} data-badge={a.id} title={d.desc}>
                  <Medal def={d} unlocked={a.unlocked} size={52} />
                  <b>{d.name}</b>
                  <span>{d.desc}</span>
                  {a.unlocked
                    ? <small>Conseguido el {new Date(a.at!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                    : <span className="bdg-prog" role="progressbar" aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.value} aria-label={`${a.value} de ${a.goal}`}><i style={{ width: `${Math.round((a.value / a.goal) * 100)}%` }} /><em>{a.value}/{a.goal}</em></span>}
                </li>
              );
            })}
          </ul>
        </details>
        );
      })}
    </section>
  );
}

/**
 * Aviso global: cuando el servidor dice que hay un logro nuevo (que este navegador aún no había celebrado), lo celebra.
 * La primera vez que ve una cuenta solo apunta los que ya tenía (no avisa de golpe de todo lo antiguo).
 */
export function AchievementWatcher({ path }: { path: string }) {
  const [queue, setQueue] = useState<string[]>([]);
  const busy = useRef(false);
  const check = async () => {
    const alias = store.get('dt:student-alias');
    if (!studentSession() || !alias || busy.current) return;
    busy.current = true;
    try {
      const { achievements } = await getAchievements();
      const key = `dt:ach-seen:${alias}`;
      const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
      const raw = store.get(key);
      if (raw === null) { store.set(key, JSON.stringify(unlocked)); return; }
      let seen: string[] = []; try { seen = JSON.parse(raw); } catch { /* se rehace */ }
      const fresh = unlocked.filter((id) => !seen.includes(id));
      if (fresh.length) { store.set(key, JSON.stringify(unlocked)); setQueue((q) => [...q, ...fresh]); }
    } catch { /* sin conexión: ya avisará la próxima vez */ } finally { busy.current = false; }
  };
  useEffect(() => { void check(); }, [path]);
  useEffect(() => {
    const on = () => void check();
    addEventListener('dt:activity', on); addEventListener('dt:account', on);
    const vis = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('dt:activity', on); removeEventListener('dt:account', on); document.removeEventListener('visibilitychange', vis); };
  }, []);
  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 6500);
    return () => clearTimeout(t);
  }, [queue]);
  const id = queue[0];
  if (!id) return null;
  const d = defOf(id);
  return (
    <div className={`bdg-toast tier-${d.tier}`} role="status" aria-live="polite" key={id} data-achievement-toast={id}>
      <div className="bdg-toast-medal"><Medal def={d} unlocked size={72} /><span className="bdg-shine" aria-hidden="true" /></div>
      <div className="bdg-toast-text">
        <small>¡Logro desbloqueado!</small>
        <b>{d.name}</b>
        <span>{d.desc}</span>
      </div>
      <a className="btn sm" href="/cuenta#logros">Ver logros</a>
      <button type="button" className="bdg-close" aria-label="Cerrar" onClick={() => setQueue((q) => q.slice(1))}>×</button>
      {queue.length > 1 && <span className="bdg-more">+{queue.length - 1}</span>}
    </div>
  );
}
