import type { CSSProperties } from 'react';
import type { RoomView } from '../../shared/types.ts';
import { practiceMomentum } from './practice-feel.ts';

/** Small instrument above the question, not another card or invented XP system. */
export function PracticeProgress({ view }: { view: RoomView }) {
  const momentum = practiceMomentum(view);
  if (!momentum) return null;
  const { done, correct, total, percent } = momentum;
  return <div className="dt-practice-progress" data-practice-progress="" data-done={done}>
    <div className="dt-practice-progress-copy"><span lang="de">DEIN FORTSCHRITT</span><span>{done} completadas de {total} <i aria-hidden="true">/</i> {correct} aciertos</span></div>
    <div className="dt-practice-track" role="progressbar" aria-label="Progreso de esta práctica" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} de ${total} preguntas completadas; ${correct} aciertos`}>
      <span style={{ '--progress': percent / 100 } as CSSProperties} />
      <div className="dt-practice-ticks" aria-hidden="true">{Array.from({ length: total - 1 }, (_, index) => <i key={index} />)}</div>
    </div>
  </div>;
}
