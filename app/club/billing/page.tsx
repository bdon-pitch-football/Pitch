// ClubPlan / ClubBilling — the disclosure is OURS and cannot be outsourced to
// Stripe (D-136): the price, the frequency, that it renews and how to cancel
// all appear here, before the customer reaches checkout. The authority tick
// (D-137) turns an anonymous assent into an identified representation.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { billingConfigured, PRICES } from '@/lib/billing';
import { openPortal, startCheckout } from './actions';
import { T } from '@/lib/palette';
import { card, fieldLabel as label } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Interest Register', robots: { index: false, follow: false } };

const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; unconfigured?: string; error?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { paid, unconfigured } = await searchParams;

  const { rows } = await db.query(
    `select c.id, c.name, c.subscription_status, c.plan, c.stripe_customer_id, c.grace_until,
       to_char(c.current_period_end at time zone 'Australia/Melbourne', 'DD Month YYYY') as renews
     from club c join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];
  const active = ['active', 'trialing'].includes(c.subscription_status ?? '');
  const pastDue = c.subscription_status === 'past_due';

  return (
    <ClubConsole active="billing" floodlight>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>The Interest Register</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{c.name}. Your club page, your trial notices and CVs arriving by email are free and stay free.</div>
        </div>

        {paid && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13.5, fontWeight: 700, color: T.secondary }}>Payment received. Your receipt is on its way to the club.</div>}
        {unconfigured && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 500, color: T.secondary, lineHeight: 1.55 }}>Payments aren&rsquo;t switched on yet — the Stripe account isn&rsquo;t connected. Everything else on this page is real.</div>}

        {pastDue && (
          <div style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: T.amber }}>We couldn&rsquo;t take your payment</div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Nothing has changed yet. We&rsquo;ll keep trying for the next fortnight. If it&rsquo;s still not sorted, the register is paused — your coaches stop seeing the list.
              <b style={{ color: T.ink }}> Nothing is deleted.</b> The families who registered stay registered, and everything comes back the moment a payment goes through.
            </div>
          </div>
        )}

        {active ? (
          <>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="field-label">Your plan</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{c.plan === 'register_annual' ? PRICES.register_annual.label : PRICES.register_monthly.label}</div>
              {c.renews && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Renews {c.renews.trim()} unless you cancel before then.</div>}
            </div>
            <form action={openPortal}>
              <button type="submit" style={{ width: '100%', border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 14, height: 46, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Manage or cancel this subscription</button>
            </form>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Cancelling lives here in your club settings and takes about as long as signing up did. This charge shows on your statement as <b style={{ color: T.secondary }}>PITCH FOOTBALL</b>.</div>
          </>
        ) : (
          <form action={startCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="field-label">Choose how you pay</div>
              {(['register_monthly', 'register_annual'] as const).map((k, i) => (
                <label key={k} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input type="radio" name="plan" aria-label="Plan" value={k} defaultChecked={i === 0} style={{ width: 20, height: 20, accentColor: T.accent }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{PRICES[k].label}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
                      Renews every {PRICES[k].cadence} until you cancel. {k === 'register_annual' ? 'Cancel within 14 days for a full refund, no questions.' : 'Cancel any time.'}
                    </div>
                  </div>
                </label>
              ))}
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Both prices include GST. The same price for a club of four hundred and a club of forty.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="field-label">Who is agreeing to this</div>
              <label style={card}><div className="field-label">Your name</div><input style={input} name="personName" required /></label>
              <label style={card}><div className="field-label">Your role at the club</div><input style={input} name="roleAtClub" placeholder="e.g. Treasurer" required /></label>
              <label style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer' }}>
                <input type="checkbox" name="authorised" required style={{ width: 20, height: 20, accentColor: T.accent, marginTop: 1 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.5 }}>I am authorised by {c.name} to enter this agreement on its behalf.</div>
              </label>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The receipt is addressed to the club, not to you, so it can be reimbursed without an argument.</div>
            </div>

            <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              Paying does not verify your club and cannot. Nothing about a player under 18 reaches you until we have spoken to someone at the club by phone.
            </div>

            <button type="submit" className="btn btn-primary">
              {billingConfigured() ? 'Continue to payment' : 'Payments not switched on yet'}
            </button>
          </form>
        )}
      </div>
    </ClubConsole>
  );
}
