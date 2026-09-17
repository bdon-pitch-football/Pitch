// Post-approval landing — GuardianHome.dc.html, reduced to what exists
// after a first approval: the family header and the child card with its
// approved line. Grows into the full guardian dashboard.
import { notFound } from 'next/navigation';
import { getInvitationForParentPage } from '@/lib/guardian-flow';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';
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
  if (!inv || !(inv.approved_at || inv.held_at)) notFound();

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
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>You approved {inv.first_name}. Nothing is visible to anyone until there is a page and you have approved that too.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Your children</div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{(inv.first_name as string)[0]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{inv.first_name}</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Page not built yet</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Approved by you on {approvedDate}</div>
            </div>
          </div>
        </div>

        {/* The next step. Approval makes the account; signing in to it needs
            a password, which comes by the doc 15 §10 email. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Next</div>
          <OpenInBrowser path={`/a/${id}/done`} />
          {acct.has_password ? (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Sign in to see {inv.first_name}&rsquo;s page and every control over it.</div>
              <a href="/signin" className="btn btn-primary">Sign in</a>
            </div>
          ) : acct.has_email ? (
            <form action={emailSetupLink} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="invitationId" value={id} />
              <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                {sent
                  ? 'If we have an email address for you, the link is on its way. It works once and lasts an hour.'
                  : `Choose a password and you can sign in any time to see ${inv.first_name}\u2019s page and every control over it. We\u2019ll email you a link to set it.`}
              </div>
              <button type="submit" className={sent ? 'btn btn-secondary' : 'btn btn-primary'}>{sent ? 'Send it again' : 'Email me the link'}</button>
            </form>
          ) : (
            <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              To sign in and manage {inv.first_name}&rsquo;s page you&rsquo;ll need an email address on your account. Write to help@pitchfootball.com.au and we&rsquo;ll set it up.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
