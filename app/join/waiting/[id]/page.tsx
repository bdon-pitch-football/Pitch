// WaitingForParent.dc.html — the pending state (D-17). Nothing exists
// publicly; if nobody approves within 14 days everything purges.
//
// Rewritten 29 Sep (BUZ: "approve 1 and 2", docs/team/APPROVALS-28-SEP.md).
// The design's words promised things that do not exist before a parent says
// yes: "Your page is built", "the page, the photo, the clips", a "What you
// made" card and "Keep editing it while you wait" — but under D-17 an
// under-16 has a first name, a date of birth and a parent's contact, and the
// CV is built after approval, never before. Every sentence here is now one
// BUZ approved, and the render suite fails if the page promises a page, a
// photo or clips again (wait-r1).
// No SMS/email actually sends yet (doc 15 wiring comes with Twilio/Resend);
// in development the approval link is surfaced on-screen instead.
import Link from 'next/link';
import { getPendingInvitation, invitationTextWaiting } from '@/lib/guardian-flow';
import { ClockGlyph, ClosedGlyph, DashedTile, ParentPage } from '@/components/parent-sheet';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
// Absolute: /join's layout sets a plain title, which stops the root template
// reaching this page, and the approved tab title carries the brand itself.
export const metadata = { title: { absolute: 'Waiting for your parent · Pitch Football' }, robots: { index: false, follow: false } };

// D-168 (0120): while SMS is not live, the parent's email goes at once and
// their text waits. BUZ approved this line on 29 Sep. It renders only while
// the text waits, in place of "Text and email sent", which would be false.
const TEXT_WAITING = 'We\u2019ve emailed your parent. Their text follows shortly.';

const maskPhone = (p: string) => {
  // Stored as E.164 (+614…, John 3 Oct §4); shown as the family typed it, 04…
  // — how a number looks is presentation (§4.6), and this keeps it as it was.
  const d = p.replace(/\s/g, '').replace(/^\+61(?=4)/, '0');
  return d.length >= 7 ? `${d.slice(0, 4)} ··· ${d.slice(-3)}` : '····';
};

// John's ruling, BUZ approved for building (1 Oct): one screen for both
// endings — the 14 days ran out, or (with D-PD-3) a parent ended it. Never
// "expired": that is untrue when someone ended it, and an immediate
// "expired" would let the child infer that a parent said no (D-17, U-1).
// A purged row is gone, so this page cannot tell the endings apart — or
// either of them from an id that never existed — which is the point.
const CLOSED = { heading: 'This request has closed.', line: 'You can ask again whenever you like.' };

// B1 / F3 (Head of Product Design, 1 Oct; BUZ: "Yes to all, hand to Leo"):
// after a parent approves, this page said "taken down" (the root 404) to the
// child who had just been told yes. A third state, separate from the closed
// one, saying only what approval itself means — a parent said yes and builds
// the page — and nothing about when or how. The closed state is untouched, so
// an ending and an id that never existed stay byte-identical (John's PD-3
// condition 3). BUZ confirmed the words, 1 Oct.
const APPROVED = { heading: 'Your parent said yes.', line: 'They build your page from their account, so ask them to start it with you.' };

export default async function Waiting({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getPendingInvitation(id);
  if (!inv) {
    return (
      <ParentPage page>
        <DashedTile><ClosedGlyph /></DashedTile>
        <div className="ask" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{CLOSED.heading}</h1>
          <div className="pd-sub">{CLOSED.line}</div>
        </div>
      </ParentPage>
    );
  }
  if (inv.approved_at) {
    return (
      <ParentPage page>
        <div className="ask" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{APPROVED.heading}</h1>
          <div className="pd-sub">{APPROVED.line}</div>
        </div>
      </ParentPage>
    );
  }

  const channels = 'Text and email sent'; // both are required now (D-157)
  // "Text and email sent" is false while the text waits for SMS, so it is not
  // said then (L25): the approved line says what did happen instead.
  const textWaiting = await invitationTextWaiting(inv.id);

  return (
    <ParentPage page>
      {/* The hero panel (spec A part 14), with the float shadow, and the
          waiting pill (part 12). */}
      <div className="hero-panel" style={{ padding: '26px 20px 24px 20px', gap: 12 }}>
        <div style={{ display: 'flex' }}><span className="pill pill-wait">Not live yet</span></div>
        <h1 style={{ fontSize: 31, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.015em' }}>One person to go.</h1>
        <div className="pd-sub" style={{ fontSize: 14.5 }}>We&rsquo;ve asked your parent to approve your page. Until they say yes, nothing about you is on Pitch — not for clubs, not for coaches, not for us.</div>
      </div>

      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">We asked</h2>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20 c0-3.6 2.9-6 6.5-6 s6.5 2.4 6.5 6" /></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{inv.guardian_name}</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{textWaiting ? TEXT_WAITING : `${channels} · ${maskPhone(inv.guardian_phone ?? '')}`}</div>
          </div>
        </div>
      </div>

      {/* In production this panel holds no button, so it carries no green
          edge: green would point at nothing. */}
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 900 }}>Honestly? Just go and ask them.</div>
        <div className="pd-sub" style={{ fontSize: 13.5 }}>A text is easy to miss and easy to put off. Show them the page on your phone.</div>
        {/* DEV ONLY: no SMS sends yet — this is where the guardian's doc-15
            link goes. In dev it opens the approval page directly. */}
        {process.env.NODE_ENV !== 'production' && (
          <Link href={`/a/${inv.id}`} className="btn btn-primary">Show them my page</Link>
        )}
      </div>

      {/* "Send the text again" and "Wrong number? Change who we ask" were
          drawn here as buttons and did nothing. They are out until they are
          built: a resend mints a new link (D-156), and changing who is
          asked is a consent-spine question for John first. */}

      <div className="card-sunken pd-info">
        <ClockGlyph />
        <div>If nobody approves within <b style={{ color: T.secondary }}>14 days</b>, we delete what you told us. You can start again any time.</div>
      </div>
    </ParentPage>
  );
}
