import type { Metadata } from 'next';
import { QuietShell } from '@/components/quiet-shell';
import { T } from '@/lib/palette';
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

const h1: React.CSSProperties = { fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', margin: 0 };
const body: React.CSSProperties = { fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6, margin: 0 };

export default async function StopCvsPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; t?: string; done?: string }>;
}) {
  const { r, t, done } = await searchParams;
  // Carried into the form as given, shape-checked only; lib/stop-cvs decides.
  const requestId = typeof r === 'string' ? r.slice(0, 64) : '';
  const sig = typeof t === 'string' ? t.slice(0, 64) : '';

  return (
    <QuietShell>
      {done ? (
        <>
          <h1 style={h1}>Done</h1>
          <p style={body}>Pitch won’t send CVs to this address again.</p>
        </>
      ) : (
        <>
          <h1 style={h1}>Stop CVs to this address?</h1>
          <p style={body}>Pitch won’t send CVs to this address again. Families can still contact the club in other ways.</p>
          <form action={stopCvs} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <input type="hidden" name="r" value={requestId} />
            <input type="hidden" name="t" value={sig} />
            <button type="submit" className="btn btn-primary">Stop them</button>
          </form>
        </>
      )}
    </QuietShell>
  );
}
