// Post-approval landing — GuardianHome.dc.html, reduced to what exists
// after a first approval: the family header and the child card with its
// approved line. Grows into the full guardian dashboard.
import { getInvitationForParentPage } from '@/lib/guardian-flow';
import { ParentPage } from '@/components/parent-sheet';
import { FinishedLink } from '@/components/cv/LinkState';
import { T } from '@/lib/palette';
import { SUPPORT_EMAIL } from '@/lib/support';
import { db } from '@/lib/db';
import OpenInBrowser from '@/components/OpenInBrowser';
import { emailSetupLink } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your family', robots: { index: false, follow: false } };

export default async function Done({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params;
  const { sent } = await searchParams;
  const inv = await getInvitationForParentPage(id);
  // A hold (D-155) reads exactly as an approval: same page, same words.
  // Anything else is a link that opens nothing, said in LinkState's words at
  // 200 rather than the root 404's (D-PD-4).
  if (!inv || !(inv.approved_at || inv.held_at)) return <FinishedLink />;

  // What the parent can do next depends on whether their account can be
  // signed in to yet. Only yes/no leaves the database — never the address.
  const acct = (await db.query(
    `select p.email is not null as has_email,
       exists(select 1 from auth_credential ac where ac.person_id = p.id) as has_password
     from consent_event e join person p on p.id = e.actor_id
     where e.event = 'approved' and e.detail->>'invitation_id' = $1 limit 1`, [id])).rows[0]
    // Every parent now has an email (D-157), so a hold shows what a new
    // parent sees: "Email me the link", which then sends nothing.
    ?? { has_email: true, has_password: false };

  const approvedDate = new Date((inv.approved_at ?? inv.held_at) as string).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' });

  return (
    // A page, not a door: the children list sits on the page (spec D).
    <ParentPage page>
      <div className="ask" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</h1>
        <div className="pd-sub">{inv.existing_child ? `You confirmed you\u2019re ${inv.first_name}\u2019s parent. You\u2019ll hear from us each time they send their CV.` : `You approved ${inv.first_name}. Nothing is visible to anyone until there is a page and you have approved that too.`}</div>
      </div>

      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">Your children</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="ask-who">
            <div className="who-tile">{(inv.first_name as string)[0]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{inv.first_name}</div>
              {!inv.existing_child && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Page not built yet</div>}
            </div>
          </div>
          <div className="pd-tk" style={{ alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
            <div>{inv.existing_child ? 'Confirmed' : 'Approved'} by you on {approvedDate}</div>
          </div>
        </div>
      </div>

      {/* The next step. Approval makes the account; signing in to it needs
          a password, which comes by the doc 15 §10 email. A step gives
          nothing away, so its primary is the screen's one glow; "Send it
          again" stays secondary once the step is done. */}
      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">Next</h2>
        <OpenInBrowser path={`/a/${id}/done`} />
        {acct.has_password ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pd-body">Sign in to see {inv.first_name}&rsquo;s page and every control over it.</div>
            <a href="/signin" className="btn btn-primary fl-glow">Sign in</a>
          </div>
        ) : acct.has_email ? (
          <form action={emailSetupLink} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="invitationId" value={id} />
            <div className="pd-body">
              {sent
                ? 'If we have an email address for you, the link is on its way. It works once and lasts an hour.'
                : `Choose a password and you can sign in any time to see ${inv.first_name}\u2019s page and every control over it. We\u2019ll email you a link to set it.`}
            </div>
            <button type="submit" className={sent ? 'btn btn-secondary' : 'btn btn-primary fl-glow'}>{sent ? 'Send it again' : 'Email me the link'}</button>
          </form>
        ) : (
          <div className="card pd-body">
            To sign in and manage {inv.first_name}&rsquo;s page you&rsquo;ll need an email address on your account. Write to {SUPPORT_EMAIL} and we&rsquo;ll set it up.
          </div>
        )}
      </div>
    </ParentPage>
  );
}
