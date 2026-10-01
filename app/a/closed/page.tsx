// After "No, end this request" on /a (D-PD-3; BUZ, 1 Oct: "Yes to the line").
//
// A FIXED ADDRESS THAT IGNORES THE CODE. Nothing about the request reaches
// this page — not the code, not the child, not the parent — so nothing on it,
// and nothing in the address bar, can tell an ended link from an approved one
// or from one that never existed (D-77). A `?ended=1` on the original link
// would have done exactly that. The links themselves now open the finished
// page every other cause opens (D-PD-4).
//
// An on-screen confirmation and nothing else: nobody is a guardian yet, so no
// message goes to anyone (John). No name — the record is already gone — no
// button, and the dashed tile: nothing to act on here. The title is John's
// words from the child's page; its second half ("You can ask again whenever
// you like.") is the child's, and is not said here. The one line under it is
// BUZ's, approved 1 Oct, and it is true in the database (0167: the row, what
// its messages carried, and nothing that identifies the person who pressed).
import { ClosedGlyph, DashedTile, ParentPage } from '@/components/parent-sheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'This request has closed', robots: { index: false, follow: false } };

export default function RequestClosed() {
  return (
    <ParentPage page>
      <DashedTile><ClosedGlyph /></DashedTile>
      <div className="ask" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>This request has closed.</h1>
        <div className="pd-sub">Nothing was approved, and the details we held are deleted.</div>
      </div>
    </ParentPage>
  );
}
