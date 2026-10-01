import type { Metadata } from 'next';
import { QuietShell } from '@/components/quiet-shell';
import { GlyphTile } from '@/components/FailureState';
import { CV_OFF_GLYPH } from '@/components/door-glyphs';
import { stopCvs } from './actions';

// Where the CV email's opt-out lands (doc 15 §19; John, 30 Sep §2). Opening
// the link changes NOTHING: mail scanners fetch every link in a message, and
// a GET that stopped sends would let a spam filter opt a club out. The press
// does it, and works with no JavaScript. The page looks the same whatever the
// link says — a good signature, a bad one or none — so it tells nobody which
// sends exist. No address is shown or carried: the link names the send.

export const metadata: Metadata = {
  title: 'Stop CVs to this address?',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';


export default async function StopCvsPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; t?: string; done?: string }>;
}) {
  const { r, t, done } = await searchParams;
  // Carried into the form as given, shape-checked only; lib/stop-cvs decides.
  const requestId = typeof r === 'string' ? r.slice(0, 64) : '';
  const sig = typeof t === 'string' ? t.slice(0, 64) : '';

  // Floodlit (spec G): the quiet shell as a door, `wide` so it is the same
  // width as /signin; the title and its line are the page title (it was 28px
  // at -.02em; Head of Product Design ruling 5).
  // The tick tile on done, which every outcome lands on. The ask and the
  // done screen are each one constant body, whatever the link said.
  return (
    <QuietShell wide door>
      {done ? (
        <>
          <GlyphTile state="done">{CV_OFF_GLYPH}</GlyphTile>
          <div className="pg-titles">
            <h1 className="pg-title">Done</h1>
            <p className="pg-sub" style={{ margin: 0 }}>Pitch won’t send CVs to this address again.</p>
          </div>
        </>
      ) : (
        <>
          <GlyphTile>{CV_OFF_GLYPH}</GlyphTile>
          <div className="pg-titles">
            <h1 className="pg-title">Stop CVs to this address?</h1>
            <p className="pg-sub" style={{ margin: 0 }}>Pitch won’t send CVs to this address again. Families can still contact the club in other ways.</p>
          </div>
          <form action={stopCvs} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="r" value={requestId} />
            <input type="hidden" name="t" value={sig} />
            <button type="submit" className="btn btn-primary fl-glow">Stop them</button>
          </form>
        </>
      )}
    </QuietShell>
  );
}
