// The guardian approval page — ParentApprovalV2.dc.html. The doc-04 consent
// benchmark: promises stated outright, in the same order and words as the
// doc-15 approval email (the repetition is deliberate).
// The page-preview card renders once the CV builder exists; until a child
// has built content there is nothing to preview and the promises + decision
// stand alone.
//
// D-156 (17 Sep): approval needs both channels. The texted link and the
// emailed link each open this page with their own code; pressing "Yes, it's
// me — continue" confirms that channel. Opening the page confirms nothing.
// Reached by the invitation id (the child's "Show them my page"), it carries
// no channel and says where the two links are.
import { headers } from 'next/headers';
import { ageOn } from '@/lib/age';
import { recordGuardianLanded, resolveApprovalLink } from '@/lib/guardian-flow';
import { isLinkPreviewFetch, PITCH_METHOD_HEADER } from '@/lib/link-preview';
import { approve, confirmIt } from './actions';
import { card } from '@/lib/ui';
import { LegalBody } from '@/app/legal/legal-page';
import { HeaderMark } from '@/components/Wordmark';
import { FinishedLink } from '@/components/cv/LinkState';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Approve a profile', robots: { index: false, follow: false } };

// A 16–17's parent confirms they are the parent; the three are the controls
// that parent really has (doc 15 §2b).
const PROMISES_16: [string, string][] = [
  ["You're told every time they send their CV to a club.", 'And you can switch their sending off.'],
  ['No one can contact them directly.', 'Any approach from outside their club comes to you both together.'],
  ['You can pause their page at any time.', 'Every link stops working until you switch it back on.'],
];

const PROMISES: [string, string][] = [
  ['will not appear in any search.', 'Under-16 profiles are not searchable on Pitch at all.'],
  ['No one can contact them directly.', 'Every approach comes to you together.'],
  ['You hold the share link.', 'It works only where you send it, expires every 90 days, and you can pause or regenerate it any time.'],
  ['You see everything they see.', 'Linked account, full visibility — and you can withdraw all of it at any time.'],
];

export default async function Approval({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adult?: string }> }) {
  const { id } = await params;
  const { adult } = await searchParams;
  const code = decodeURIComponent(id);
  const inv = await resolveApprovalLink(code);
  // Approved and held (D-155) read the same: the link is finished. So do
  // purged and never-existed, and all four say it at 200 in LinkState's
  // words, not the root 404's "taken down" (D-PD-4).
  if (!inv || inv.approved_at || inv.held_at) return <FinishedLink />;
  // The consent funnel's middle state (D-78): the parent reached the page.
  // Once per invitation, and it confirms nothing — confirming is still a
  // press (D-156). Read the function for what this can and cannot claim.
  // A messaging app building a preview of a forwarded link is not the
  // parent, and neither is a HEAD (lib/link-preview — a heuristic).
  const h = await headers();
  if (!isLinkPreviewFetch(h.get(PITCH_METHOD_HEADER), h.get('user-agent'))) {
    await recordGuardianLanded(inv.id, inv.channel);
  }
  const here = inv.channel;
  const confirmedHere = here === 'sms' ? inv.sms_confirmed : here === 'email' ? inv.email_confirmed : false;
  const bothConfirmed = inv.sms_confirmed && inv.email_confirmed;
  // The other channel, named only by kind — never its address (D-156).
  const other = here === 'sms' ? 'emailed' : 'texted';
  const teen = inv.existing_child;

  const name: string = inv.first_name;
  // pending_invitation.dob is NOT NULL (0002), so this always resolves.
  const age = ageOn(inv.dob) ?? 0;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{teen ? `${name} named you as their parent` : `${name} started this and asked you to look`}</div>
          <div style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.015em' }}>{teen ? `Are you ${name}\u2019s parent?` : `Approve ${name}\u2019s page?`}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            {teen ? `${name} is ${age}. They run their own page, but they can\u2019t send it to clubs until you confirm.` : `${name} is ${age}. Nothing is live until you say so.`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>{teen ? 'Once you confirm' : 'If you approve'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(teen ? PROMISES_16 : PROMISES).map(([bold, rest], i) => (
              <div key={bold} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                  <b style={{ color: T.ink }}>{!teen && i === 0 ? `${name} ${bold}` : bold}</b> {rest}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* doc 32 B3: the privacy policy written for the child is SHOWN here,
            in the flow, not merely linked. Open by default for an under-16's
            parent, whose approval accepts it on the child's behalf. */}
        <details open={!teen} style={{ ...card, display: 'block' }}>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13.5, fontWeight: 800 }}>
            The privacy policy we wrote for {name}
          </summary>
          <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 8, paddingRight: 4 }}>
            <LegalBody file="21-Privacy-Policy-Child.md" />
          </div>
          <a href="/privacy/family" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12.5, fontWeight: 700, color: T.accent }}>Open it as a full page</a>
        </details>

        {here === null ? (
          <div role="note" style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55, marginTop: 'auto' }}>
            <b style={{ color: T.ink }}>To {teen ? 'confirm' : 'approve'}, use the links we sent you.</b> We texted one and emailed one. Open each and press &ldquo;Yes, it&rsquo;s me&rdquo;. That&rsquo;s how we know the phone and the email are both yours.
          </div>
        ) : !confirmedHere ? (
          <form action={confirmIt} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <input type="hidden" name="code" value={code} />
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>First, tell us this {here === 'sms' ? 'text' : 'email'} reached you.</div>
            <button type="submit" className="btn btn-primary">Yes, it&rsquo;s me &mdash; continue</button>
          </form>
        ) : !bothConfirmed ? (
          <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55, marginTop: 'auto' }}>
            <b style={{ color: T.ink }}>One more step.</b> Open the link we {other} to you, press &ldquo;Yes, it&rsquo;s me&rdquo;, and you can {teen ? 'confirm' : 'approve'} from there or here.
          </div>
        ) : (
          <form action={approve} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <input type="hidden" name="code" value={code} />
            <label style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, cursor: 'pointer', border: `1px solid ${adult ? T.amber : T.line}` }}>
              <input type="checkbox" name="adult" required style={{ marginTop: 2, width: 18, height: 18, accentColor: T.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: T.secondary, fontWeight: 700, lineHeight: 1.5 }}>I&rsquo;m {name}&rsquo;s parent or guardian, and I&rsquo;m 18 or over.</span>
            </label>
            <button type="submit" className="btn btn-primary">{teen ? 'Confirm I\u2019m their parent' : 'Approve this page'}</button>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, textAlign: 'center', lineHeight: 1.5 }}>
              {teen
                ? <>Not {name}&rsquo;s parent? Do nothing. This request is deleted after 14 days.</>
                : <>Approving accepts the Terms &amp; Privacy Policy on {name}&rsquo;s behalf, and you can undo it any time.<br />Not ready? Do nothing. If you don&rsquo;t approve, all of this is deleted after 14 days.</>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
