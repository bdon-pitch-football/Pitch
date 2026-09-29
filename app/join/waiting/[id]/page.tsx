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
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPendingInvitation, invitationTextWaiting } from '@/lib/guardian-flow';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Waiting for your parent', robots: { index: false, follow: false } };

// D-168 (0120): while SMS is not live, the parent's email goes at once and
// their text waits. BUZ approved this line on 29 Sep. It renders only while
// the text waits, in place of "Text and email sent", which would be false.
const TEXT_WAITING = 'We\u2019ve emailed your parent. Their text follows shortly.';

const maskPhone = (p: string) => {
  const d = p.replace(/\s/g, '');
  return d.length >= 7 ? `${d.slice(0, 4)} ··· ${d.slice(-3)}` : '····';
};

export default async function Waiting({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getPendingInvitation(id);
  if (!inv || inv.approved_at) notFound();

  const channels = 'Text and email sent'; // both are required now (D-157)
  // "Text and email sent" is false while the text waits for SMS, so it is not
  // said then (L25): the approved line says what did happen instead.
  const textWaiting = await invitationTextWaiting(inv.id);

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ borderRadius: 22, background: 'var(--hero)', padding: '26px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.10)', borderRadius: 999, padding: '6px 12px' }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: T.amber }} />
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>Not live yet</div>
            </div>
          </div>
          <h1 style={{ fontSize: 31, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.015em' }}>One person to go.</h1>
          <div style={{ fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>We&rsquo;ve asked your parent to approve your page. Until they say yes, nothing about you is on Pitch — not for clubs, not for coaches, not for us.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>We asked</div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20 c0-3.6 2.9-6 6.5-6 s6.5 2.4 6.5 6" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{inv.guardian_name}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{textWaiting ? TEXT_WAITING : `${channels} · ${maskPhone(inv.guardian_phone ?? '')}`}</div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 18, background: 'var(--hero)', border: `1px solid ${T.accent}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>Honestly? Just go and ask them.</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>A text is easy to miss and easy to put off. Show them the page on your phone.</div>
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

        <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>If nobody approves within <b style={{ color: T.secondary }}>14 days</b>, we delete what you told us. You can start again any time.</div>
        </div>
      </div>
    </div>
  );
}
