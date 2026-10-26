// Isolated browser fixture: real production components, no app/game data or fake scores.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AmbientField } from '../src/brand/AmbientField.tsx';
import { EffectsToggle } from '../src/brand/EffectsToggle.tsx';
import '../src/styles.css';
import '../src/brand/brand.css';

declare global {
  interface Window { __ambientRoute: (path: string, search?: string) => void; __ambientUnmount: () => void; }
}
function Fixture() {
  const [route, setRoute] = useState({ path: '/', search: '' });
  window.__ambientRoute = (path, search = '') => setRoute({ path, search });
  return <>
    <AmbientField {...route} />
    <nav className="dt-nav"><div className="dt-nav-inner"><span>Deutschtrainer · prueba aislada</span><EffectsToggle /></div></nav>
    <div className="dt-page-surface">
      <main className="dt-landing">
        <section className="dt-hero" style={{ minHeight: 720, display: 'grid', gridTemplateColumns: '1fr', alignContent: 'center' }}>
          <div className="dt-hero-copy"><p className="dt-eyebrow">Ambient · prueba aislada</p><h1 className="dt-hero-title">Rojo. Oro.<br />Tinta.</h1><p className="dt-hero-sub">La atmósfera acompaña. El contenido permanece en primer plano.</p><a className="dt-btn dt-btn-primary" href="#fin">Seguir leyendo</a></div>
        </section>
        <section id="fin" style={{ minHeight: 1600, paddingTop: 400 }}><h2>Fuera del hero, el render se detiene.</h2></section>
      </main>
    </div>
  </>;
}
const root = createRoot(document.getElementById('ambient-fixture')!);
window.__ambientUnmount = () => root.unmount();
root.render(<Fixture />);
