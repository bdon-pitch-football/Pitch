// Billing (D-112). Stripe HOSTED Checkout and the HOSTED Customer Portal
// only — never embedded card fields, which is what keeps us at PCI SAQ-A.
//
// Three walls this file must never breach:
//  · Subscription state is written ONLY by the webhook (fn_apply_subscription).
//  · Payment can never set club_state — a card is not a safety control (D-126).
//  · Stripe never receives child data (doc 14 §O10): we send a club id and a
//    price, and nothing else.
//
// Until the account exists these functions report themselves unconfigured and
// the UI says so plainly rather than pretending to take money.
import 'server-only';

export const PRICES = {
  register_monthly: { label: '$54 a month', amount: 5400, cadence: 'month' as const },
  register_annual: { label: '$329 for twelve months', amount: 32900, cadence: 'year' as const },
};
export type PlanKey = keyof typeof PRICES;

export const billingConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_ANNUAL);

// Creates a hosted Checkout session. The disclosure — price, frequency, that
// it renews, and how to cancel — has already been shown on OUR page before
// the customer reaches Stripe (D-136); it is our obligation, not Stripe's.
export async function createCheckoutSession(input: {
  clubId: string;
  plan: PlanKey;
  origin: string;
}): Promise<{ url: string } | { unconfigured: true }> {
  if (!billingConfigured()) return { unconfigured: true };

  const price = input.plan === 'register_annual' ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': price!,
    'line_items[0][quantity]': '1',
    success_url: `${input.origin}/club/billing?paid=1`,
    cancel_url: `${input.origin}/club/billing`,
    // The club id is the ONLY thing we hand Stripe. No player, no
    // registration, no count — nothing about any child (doc 14 §O10).
    'metadata[club_id]': input.clubId,
    'subscription_data[metadata][club_id]': input.clubId,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error('checkout_failed');
  const json = (await res.json()) as { url: string };
  return { url: json.url };
}

// The hosted Customer Portal — where cancelling lives, reachable from the
// club's own settings inside Pitch and not only from an emailed receipt
// somebody deleted in March (D-136).
export async function createPortalSession(customerId: string, origin: string): Promise<{ url: string } | { unconfigured: true }> {
  if (!billingConfigured()) return { unconfigured: true };
  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ customer: customerId, return_url: `${origin}/club/billing` }),
  });
  if (!res.ok) throw new Error('portal_failed');
  const json = (await res.json()) as { url: string };
  return { url: json.url };
}
