import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NetState } from '../net.ts';
import { KlausCompanion } from './KlausCompanion.tsx';

/** Use Player's existing empty practice column without changing its game tree.
 * The stable portal target is discovered only when the connected player mounts;
 * result snapshots update props, never remount Player or its answer controls.
 */
export function KlausPracticeStage({ state, children }: { state: Pick<NetState, 'view' | 'conn'>; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<Element | null>(null);
  const ready = !!state.view?.me;
  useLayoutEffect(() => {
    setSlot(root.current?.querySelector('.player') ?? null);
  }, [ready]);
  return <div className="klaus-practice-stage" data-klaus-stage="" ref={root}>
    {children}
    {slot && createPortal(<KlausCompanion state={state} />, slot)}
  </div>;
}
