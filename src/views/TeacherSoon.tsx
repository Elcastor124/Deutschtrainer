import { followLearningLink } from '../components/LearningNav.tsx';
import { BrandSymbol } from '../brand/Logo.tsx';

/** Reservado para el modo profesor. Aquí no hay contraseñas ni lógica de acceso: solo un aviso. */
export function TeacherSoon() {
  return (
    <main className="dt-page dt-soon">
      <div className="dt-soon-card">
        <BrandSymbol size={72} tile />
        <p className="dt-eyebrow">Lehrerbereich</p>
        <h1>Próximamente: modo profesor protegido<b className="dt-punkt">.</b></h1>
        <p className="dt-lead">Aquí estará el panel del profesor con acceso protegido. Mientras tanto, las salas de clase se siguen creando desde cada juego.</p>
        <div className="dt-soon-actions">
          <a className="dt-btn dt-btn-primary" href="/" onClick={followLearningLink}><span className="dt-btn-label">Volver al inicio</span></a>
          <a className="dt-btn dt-btn-ghost" href="/curso" onClick={followLearningLink}><span className="dt-btn-label">Ver el curso</span></a>
        </div>
      </div>
    </main>
  );
}
