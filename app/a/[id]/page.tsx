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
import { invitationTextWaiting, recordGuardianLanded, resolveApprovalLink } from '@/lib/guardian-flow';
import { isLinkPreviewFetch, PITCH_METHOD_HEADER } from '@/lib/link-preview';
import { approve, confirmIt, endRequest } from './actions';
import { LegalBody } from '@/app/legal/legal-page';
import { AskHead, ChevronGlyph, ClockGlyph, ParentPage, TickGlyph } from '@/components/parent-sheet';
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

// D-PD-3 (BUZ, 1 Oct, on John's ruling): a real No, the equal of Approve. Its
// label lives here once, and every suite reads it from this line rather than
// typing it, so a change of words is a change of one string.
const PD3_END_LABEL = 'No, end this request';
// The No's own form: the code and nothing else, no tick, no adult declaration
// — ending creates nothing and discloses nothing (John). Always rendered AFTER
// the approve form, so a lookup by field still finds Approve first.
const END_FORM = 'pd-end';
function EndForm({ code }: { code: string }) {
  return (
    <form id={END_FORM} action={endRequest}>
      <input type="hidden" name="code" value={code} />
    </form>
  );
}
// Pressed from under the status card (state 3) or the second link's "Yes,
// it's me" (3b): the same secondary, full width, and its own form.
function EndButton({ code }: { code: string }) {
  return (
    <form action={endRequest}>
      <input type="hidden" name="code" value={code} />
      <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>{PD3_END_LABEL}</button>
    </form>
  );
}

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
  // D-PD-3: the No is offered from the first confirmed channel, on either
  // link — never by the invitation id, which the child holds, and never
  // before a press. The database checks all of this again (0167).
  const mayEnd = here !== null && (inv.sms_confirmed || inv.email_confirmed);
  // 3q (F6; BUZ, 1 Oct): the email is confirmed and the parent's text is still
  // waiting for SMS (D-168, 0120). "Open the link we texted to you" would be
  // untrue — there is no text yet — so the status line says it follows. The
  // database answers whether it waits (fn_invitation_sms_queued), as it does
  // for the child's waiting page.
  const textQueued = here === 'email' && confirmedHere && !inv.sms_confirmed && await invitationTextWaiting(inv.id);
  // The other channel, named only by kind — never its address (D-156).
  const other = here === 'sms' ? 'emailed' : 'texted';
  const teen = inv.existing_child;

  const name: string = inv.first_name;
  // pending_invitation.dob is NOT NULL (0002), so this always resolves.
  const age = ageOn(inv.dob) ?? 0;

  return (
    <ParentPage>
      {/* The ask head (spec D): the child's tile, who is asking, the question. */}
      <AskHead initial={name[0]} size={27}
        kicker={teen ? `${name} named you as their parent` : `${name} started this and asked you to look`}
        title={teen ? `Are you ${name}\u2019s parent?` : `Approve ${name}\u2019s page?`}
        sub={teen ? `${name} is ${age}. They run their own page, but they can\u2019t send it to clubs until you confirm.` : `${name} is ${age}. Nothing is live until you say so.`} />

      {/* What happens if yes: one panel of tick rows. The label is a section
          heading, not green — green is an action, and this is not one. */}
      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">{teen ? 'Once you confirm' : 'If you approve'}</h2>
        <div className="card pd-ticks">
          {(teen ? PROMISES_16 : PROMISES).map(([bold, rest], i) => (
            <div key={bold} className="pd-tk">
              <TickGlyph />
              <div><b>{!teen && i === 0 ? `${name} ${bold}` : bold}</b> {rest}</div>
            </div>
          ))}
        </div>
      </div>

      {/* doc 32 B3: the privacy policy written for the child is SHOWN here,
          in the flow, not merely linked. Open by default for an under-16's
          parent, whose approval accepts it on the child's behalf. LegalBody's
          own markup is untouched (leg-r1); .pol-well is a wrapper. */}
      <details open={!teen} className="card pd-pol">
        <summary>
          The privacy policy we wrote for {name}
          <ChevronGlyph />
        </summary>
        <div className="pol-well">
          <LegalBody file="21-Privacy-Policy-Child.md" />
        </div>
        <a href="/privacy/family" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12.5, fontWeight: 700, color: T.accent }}>Open it as a full page</a>
      </details>

      {here === null ? (
        <div role="note" className="card pd-body">
          <b>To {teen ? 'confirm' : 'approve'}, use the links we sent you.</b> We texted one and emailed one. Open each and press &ldquo;Yes, it&rsquo;s me&rdquo;. That&rsquo;s how we know the phone and the email are both yours.
        </div>
      ) : !confirmedHere ? (
        <>
          {/* A step that gives nothing away, so it keeps the screen's one glow. */}
          <form action={confirmIt} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="code" value={code} />
            <div className="pd-body">First, tell us this {here === 'sms' ? 'text' : 'email'} reached you.</div>
            <button type="submit" className="btn btn-primary fl-glow">Yes, it&rsquo;s me &mdash; continue</button>
          </form>
          {/* 3b: the other channel is confirmed already, so the No is here. */}
          {mayEnd && <EndButton code={code} />}
        </>
      ) : !bothConfirmed ? (
        <>
          <div role="status" className="card card-accent pd-body">
            {textQueued
              ? <><b>One more step.</b> Your text follows shortly &mdash; open the link in it to finish.</>
              : <><b>One more step.</b> Open the link we {other} to you, press &ldquo;Yes, it&rsquo;s me&rdquo;, and you can {teen ? 'confirm' : 'approve'} from there or here.</>}
          </div>
          <EndButton code={code} />
        </>
      ) : (
        // D-PD-0: the answer is the charter secondary, and nothing glows. The
        // no-answer sits beside it at the same width: the source's one
        // footnote, split at its line break, in the same order. Two-up from
        // 1024, stacked on a phone. D-PD-3: the No is the same button in the
        // second cell, above the do-nothing well (which stays true: silence
        // still ends it after 14 days). It belongs to its own form, rendered
        // after this one, so the adult tick is not asked of it.
        <>
        <form action={approve} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="code" value={code} />
          <label className={adult ? 'card card-amber pd-adult' : 'card pd-adult'}>
            <input type="checkbox" name="adult" required />
            <span>I&rsquo;m {name}&rsquo;s parent or guardian, and I&rsquo;m 18 or over.</span>
          </label>
          <div className="fl-answer">
            <div className="pd-cell">
              <button type="submit" className="btn btn-secondary">{teen ? 'Confirm I\u2019m their parent' : 'Approve this page'}</button>
              {!teen && <div className="pd-small" style={{ textAlign: 'center' }}>Approving accepts the Terms &amp; Privacy Policy on {name}&rsquo;s behalf, and you can undo it any time.</div>}
            </div>
            <div className="pd-cell">
              <button type="submit" form={END_FORM} className="btn btn-secondary">{PD3_END_LABEL}</button>
              <div className="card-sunken pd-info sec">
                <ClockGlyph />
                <div>{teen
                  ? <>Not {name}&rsquo;s parent? Do nothing. This request is deleted after 14 days.</>
                  : <>Not ready? Do nothing. If you don&rsquo;t approve, all of this is deleted after 14 days.</>}</div>
              </div>
            </div>
          </div>
        </form>
        <EndForm code={code} />
        </>
      )}
    </ParentPage>
  );
}
