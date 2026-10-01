// After a press on the §36/§37 undo that switched a link off (G-P1). Reached
// ONLY by that redirect's answer — the press counted the links it switched
// off — and at a fixed address that carries no token, so it can say nothing
// about any link: the parent's own press is what makes these words true.
// "Done" is /stop-cvs's word; the line is the ask's own, now true; the
// un-send box stays (John, 1 Oct). No button: there is nothing left to do.
import { NotUnsent, UNDO_WHAT, UndoFrame } from '@/components/undo';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Undo', robots: { index: false, follow: false } };

export default function UndoDone() {
  return (
    <UndoFrame>
      <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Done</h1>
      <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{UNDO_WHAT}</div>
      <NotUnsent />
    </UndoFrame>
  );
}
