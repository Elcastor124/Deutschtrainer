// Página 404: el servidor ya responde con código 404 a rutas desconocidas; aquí se dice claro y se ofrecen salidas.
import type { MouseEvent } from 'react';
import { navigate } from '../util.ts';

const go = (path: string) => (e: MouseEvent) => { e.preventDefault(); navigate(path); };

export function NotFound() {
  return (
    <main className="dt-page" data-not-found style={{ display: 'grid', gap: 18, alignContent: 'start', paddingBlock: '72px 120px', maxWidth: 640 }}>
      <p className="dt-eyebrow">Error 404</p>
      <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', lineHeight: 1 }}>Diese Seite gibt es nicht<b className="dt-punkt">.</b></h1>
      <p style={{ margin: 0, fontSize: '1.05rem', opacity: 0.85 }}>Esta página no existe. Puede que el enlace esté mal copiado o que la página ya no esté.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <a className="btn primary" href="/" onClick={go('/')}>Ir al inicio</a>
        <a className="btn" href="/curso" onClick={go('/curso')}>Tu curso</a>
        <a className="btn ghost" href="/practica" onClick={go('/practica')}>Practicar</a>
      </div>
    </main>
  );
}
