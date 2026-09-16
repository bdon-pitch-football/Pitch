// The guardian approval page — ParentApprovalV2.dc.html. The doc-04 consent
// benchmark: promises stated outright, in the same order and words as the
// doc-15 approval email (the repetition is deliberate).
// The page-preview card renders once the CV builder exists; until a child
// has built content there is nothing to preview and the promises + decision
// stand alone.
import { notFound } from 'next/navigation';
import { getInvitationForParentPage } from '@/lib/guardian-flow';
import { approve } from './actions';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Approve a profile', robots: { index: false, follow: false } };

const PROMISES: [string, string][] = [
  ['will not appear in any search.', 'Under-16 profiles are not searchable on Pitch at all.'],
  ['No one can contact them directly.', 'Every approach comes to you together.'],
  ['You hold the share link.', 'It works only where you send it, expires every 90 days, and you can pause or regenerate it any time.'],
  ['You see everything they see.', 'Linked account, full visibility — and you can withdraw all of it at any time.'],
];

export default async function Approval({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvitationForParentPage(id);
  if (!inv || inv.approved_at) notFound();

  const name: string = inv.first_name;
  const age = Math.floor((Date.now() - new Date(inv.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  const approveWithId = approve;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name} started this and asked you to look</div>
          <div style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.015em' }}>Approve {name}&rsquo;s page?</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{name} is {age}. Nothing is live until you say so.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>If you approve</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {PROMISES.map(([bold, rest], i) => (
              <div key={bold} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                  <b style={{ color: T.ink }}>{i === 0 ? `${name} ${bold}` : bold}</b> {rest}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form action={approveWithId} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}><input type="hidden" name="invitationId" value={id} />
          <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accent, color: T.onAccent, fontWeight: 800, fontSize: 15, borderRadius: 14, height: 50, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Approve this page</button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, color: T.secondary, fontWeight: 700, fontSize: 14, borderRadius: 13, height: 48 }}>Not yet — I want to talk to {name} first</div>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, textAlign: 'center', lineHeight: 1.5 }}>
            Approving accepts the Terms &amp; Privacy Policy on {name}&rsquo;s behalf, and you can undo it any time.<br />If you do nothing, all of this is deleted after 14 days.
          </div>
        </form>
      </div>
    </div>
  );
}
