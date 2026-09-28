// ClubPlan / ClubBilling — the disclosure is OURS and cannot be outsourced to
// Stripe (D-136): the price, the frequency, that it renews and how to cancel
// all appear here, before the customer reaches checkout. The authority tick
// (D-137) turns an anonymous assent into an identified representation.
//
// SET AS A CONSOLE SURFACE (D-147, 28 Sep). ClubBilling is on D-147's console
// list and was rendering as a 604px reading column: 80% of a 1280 viewport with
// nothing on it, on the one screen in the product attached to money. It is now
// the same console grid /club/register and the club's /home already use —
// content and a 320px rail at 1024 and up, one column below it. Nothing is
// added for the laptop and nothing is taken off the phone.
//
// THREE THINGS THIS SCREEN DOES NOT HOLD, and will not.
// The card brand, the last four digits and a receipt address. We do not collect
// any of them: D-25's rule is that a field we do not collect cannot leak, and
// D-112 keeps us at PCI SAQ-A precisely by never touching card data. Stripe's
// hosted portal shows the card to the person who entered it, and the button
// below is the route there.
//
// WHAT IT DOES HOLD THAT NOTHING ELSE DOES: who at this club can read the
// register, named, with the administrator shown as reading nothing (D-93,
// doc 14 N23). That answer comes from fn_club_register_readers and is never
// assembled here (LESSONS L23) — a page that works out who may see a child on
// its own is a second answer and a second place to be wrong.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import RegisterPaused from '@/components/RegisterPaused';
import { billingConfigured, billingEnabled, PRICES } from '@/lib/billing';
import { openPortal, startCheckout } from './actions';
import { T } from '@/lib/palette';
import { card, fieldLabel, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Interest Register', robots: { index: false, follow: false } };

const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };
// A sunken definition row: read this, do not act on it.
const dl: React.CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '11px 0' };
const dt: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: T.muted };
const dd: React.CSSProperties = { fontSize: 13.5, fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums' };

// What the subscription state is called on screen. fn_register_payment_state
// is the only thing that decides which one this is.
const STATE_WORD: Record<string, string> = {
  active: 'Active',
  grace: 'Payment outstanding',
  suspended: 'Paused',
  cancelled: 'Cancelled',
};

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; unconfigured?: string; error?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  // D-163: free at launch. While billing is off this is not a place a club
  // must visit, and every word on it is about money, so nobody reaches it —
  // the same answer a signed-in person with no club seat gets. The screen is
  // kept whole behind the switch (0075), not deleted.
  if (!(await billingEnabled())) redirect('/home');
  // `error` was declared in this type and never taken out of it, so pressing
  // Subscribe without the D-137 authority tick — or with a name that is only
  // spaces — came back to ?error=1 with the fields emptied and NOT ONE WORD
  // about what happened.
  const { paid, unconfigured, error } = await searchParams;

  const { rows } = await db.query(
    `select c.id, c.name, c.plan, c.stripe_customer_id,
       fn_register_payment_state($1, c.id) as pay_state,
       to_char(c.current_period_end at time zone 'Australia/Melbourne', 'FMDD Mon') as renews_short
     from club c join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];
  // One answer about money, shared with /club/register so the two screens
  // cannot disagree about a club whose payment failed (0063).
  const state = c.pay_state as 'unsubscribed' | 'active' | 'grace' | 'suspended' | 'cancelled';
  // A club with a subscription is sent to the hosted portal — that is where a
  // failed card is replaced (D-112). A cancelled club needs a new subscription,
  // so it gets checkout. Before this, a club in dunning was shown "Choose how
  // you pay" and never offered the one control that fixes a declined card.
  const hasPlan = state === 'active' || state === 'grace' || state === 'suspended';
  const price = c.plan === 'register_annual' ? PRICES.register_annual : PRICES.register_monthly;

  const readers = (await db.query(
    `select reader_name, role_label, scope, squad_names from fn_club_register_readers($1, $2)`,
    [me, c.id],
  )).rows as { reader_name: string | null; role_label: string; scope: 'whole' | 'squads' | 'none'; squad_names: string[] }[];

  return (
    <ClubConsole active="billing" floodlight>
      <div className="console" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div className="player-grid">

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>The Interest Register</h1>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{c.name}. Your club page, your trial notices and CVs arriving by email are free and stay free.</div>
          </div>

          {paid && <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13.5, fontWeight: 700, color: T.secondary }}>Payment received. Your receipt is on its way to the club.</div>}
          {unconfigured && <div role="status" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 500, color: T.secondary, lineHeight: 1.55 }}>Payments aren&rsquo;t switched on yet — the Stripe account isn&rsquo;t connected. Everything else on this page is real.</div>}
          {error && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>Nothing has been charged. We need your name, your role at the club, and the tick that says you&rsquo;re authorised.</div>}

          {(state === 'grace' || state === 'suspended') && <RegisterPaused state={state} />}

          {hasPlan ? (
            <>
              <div style={{ ...card, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={sectionLabel}>Your plan</div>
                    <div className="numeral numeral-l" style={{ marginTop: 10 }}>{price.numeral}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.secondary, marginTop: 8 }}>{price.per}</div>
                  </div>
                  {/* The next charge date renders only while the subscription is
                      actually running. On a club whose payment failed there is
                      no honest date to print, and the card above says why. */}
                  {state === 'active' && c.renews_short && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={sectionLabel}>Next charge</div>
                      <div className="numeral numeral-m" style={{ marginTop: 10 }}>{c.renews_short.trim()}</div>
                      <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 8 }}>unless you cancel before then</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The same price for a club of four hundred and a club of forty.</div>
                <form action={openPortal}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', cursor: 'pointer' }}>Manage or cancel this subscription</button>
                </form>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>Cancelling lives here in your club settings and takes about as long as signing up did. Cancelling stops the next charge. Nothing is deleted, and the families who registered stay registered.</div>
              </div>

              <div className="card-sunken" style={{ padding: '4px 16px' }}>
                <div style={dl}><span style={dt}>On your statement</span><span style={dd}>PITCH FOOTBALL</span></div>
                <div style={{ ...dl, borderTop: `1px solid ${T.line}` }}><span style={dt}>Your subscription</span><span style={dd}>{STATE_WORD[state]}</span></div>
              </div>

              <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
                Paying does not verify your club and cannot. Nothing about a player under 18 reaches you until we have spoken to someone at the club by phone.
              </div>
            </>
          ) : (
            <form action={startCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* These captions used className="field-label", and the only
                    rule for that class is `.field > .field-label` — a
                    direct-child selector, and these are children of a card. The
                    rule never matched, so every caption on this screen rendered
                    as 16px body text three pixels off the price it captioned.
                    lib/ui carries both label styles as objects; the selector
                    itself is still wrong for 14 more captions on three other
                    screens, which is in the handoff. */}
                <div style={sectionLabel}>Choose how you pay</div>
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
                <div style={sectionLabel}>Who is agreeing to this</div>
                <label style={card}><div style={fieldLabel}>Your name</div><input style={input} name="personName" required /></label>
                <label style={card}><div style={fieldLabel}>Your role at the club</div><input style={input} name="roleAtClub" placeholder="e.g. Treasurer" required /></label>
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

        <div>
          {/* The safety story on the screen attached to the money, as data
              rather than as a lecture: the people this club has named, what
              each of them reads, and the administrator reading nothing. An
              administrator asking is shown their own row and nobody else's
              (0063) — N23 gives this list to the technical director. */}
          {readers.length > 0 && (
            <div className="card-sunken" style={{ padding: '16px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <h2 style={sectionLabel}>Who reads it</h2>
              {readers.map((r, i) => (
                <div key={i} style={{ borderTop: i === 0 ? undefined : `1px solid ${T.line}`, paddingTop: i === 0 ? 0 : 11 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: r.scope === 'none' ? T.secondary : T.ink }}>{r.reader_name ?? 'A club member'}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 2 }}>
                    {r.scope === 'whole' && `${r.role_label} · the whole register`}
                    {r.scope === 'squads' && `${r.role_label} · ${r.squad_names.join(' · ')}`}
                    {r.scope === 'none' && `${r.role_label} — reads no registration`}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>
                Only people a club has named can read its register, and every time they do, it&rsquo;s recorded.
              </div>
            </div>
          )}

          {/* The dunning words as a standing answer rather than a banner
              nobody meets until it is too late. Only while a payment is
              actually being taken — once one has failed, the card at the top
              of the column says it in the present tense. */}
          {state === 'active' && (
            <div className="card-sunken" style={{ padding: '16px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={sectionLabel}>If a payment fails</h2>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }}>
                We&rsquo;ll keep trying for the next fortnight. If it&rsquo;s still not sorted, the register is paused — your coaches stop seeing the list.
                <b style={{ color: T.ink }}> Nothing is deleted.</b> The families who registered stay registered, and everything comes back the moment a payment goes through.
              </div>
            </div>
          )}
        </div>

        </div>
      </div>
    </ClubConsole>
  );
}
