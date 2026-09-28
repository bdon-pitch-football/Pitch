// What goes on the receipt for a charge (D-136, D-137, D-148, doc 15 §31).
//
// D-136 requires a receipt on every charge and a named statement descriptor,
// so a confused treasurer emails us before ringing their bank — a chargeback
// costs more than the subscription and takes the account with it. The webhook
// handled four event types, called no message builder in any branch, and never
// handled invoice.payment_succeeded at all: the day payments were switched on,
// no receipt would have sent.
//
// Two rules this file exists to hold:
//
//  · The receipt is addressed to the CLUB, never to the person who typed the
//    card (D-137), so a volunteer treasurer can be reimbursed without an
//    argument — and doc 14 O2 says a billing email that can resolve a guardian
//    or a player address cannot exist. The address comes from
//    club.contact_email and there is no other way to reach it from here.
//  · It carries nothing about any child (doc 14 O10). The whole input is a
//    club name, a plan and an amount.
//
// Pure: no database, no environment, no message text, no Stripe SDK. The
// permission suite drives it directly, which is the only way to prove what a
// receipt says before an account exists to send one.

/**
 * The fields doc 15 §31 prints. The message builder takes exactly this, so the
 * two cannot drift and a nine-argument positional call cannot be got wrong.
 */
export type ReceiptFields = {
  clubLegalName: string;
  planLabel: string;
  /** Formatted, GST-inclusive, e.g. "$329.00". */
  amount: string;
  /** The GST inside that amount, e.g. "$29.91" (D-148). */
  gst: string;
  paidOn: string;
  /**
   * The card's last four digits, or null.
   *
   * NOT on a Stripe invoice. Resolving them needs a second API read against a
   * live account, which cannot be verified before that account exists — so the
   * webhook passes null today and the card fragment is omitted rather than
   * guessed. doc 15 §31 approved "Card ending 4242 · receipt PF-00184";
   * whether the card stays in that line is BUZ's (28 Sep report).
   */
  cardLast4: string | null;
  receiptNo: string;
  renewsOn: string;
  /** The 14-day cooling-off sentence — annual plan only (D-136). */
  refundable: boolean;
};

/** Only the fields we are prepared to trust in an invoice payload. */
export type InvoiceFacts = {
  /** amount_paid, in cents. */
  amountCents: number;
  currency: string;
  /** invoice.number where Stripe gave one, else its id — never invented. */
  receiptNo: string;
  /** The subscription period this invoice paid for, where the payload says. */
  periodEnd: Date | null;
  cardLast4: string | null;
};

export type ReceiptClub = {
  name: string;
  /** club.plan — decides the plan line and the cooling-off sentence. */
  plan: string | null;
  /** club.contact_email. The club's own mailbox, never a person's (D-137). */
  contactEmail: string | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// GST is not read off the payload: our prices are GST-inclusive by decision
// (D-148), so the GST inside a $329.00 charge is one eleventh of it — $29.91,
// which is the figure doc 15 §31 prints. Computing it from the total we
// actually charged cannot disagree with the bank statement; a tax field from
// an account configured differently can.
const gstOf = (cents: number) => money(Math.round(cents / 11));

/** Every date on a money surface is a Melbourne date (env TZ, doc 14 G9). */
export const melbourneDay = (d: Date) =>
  d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' });

const PLAN_LINES: Record<string, string> = {
  register_annual: 'Interest Register — 12 months',
  register_monthly: 'Interest Register — monthly',
};

/** Twelve months on, or one month on, from the day we took the money. */
function renewalFrom(paidAt: Date, plan: string | null): Date {
  const d = new Date(paidAt.getTime());
  if (plan === 'register_monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * The receipt's address and its fields, or null when there is nowhere to send
 * one.
 *
 * A club with no contact address gets no receipt — we do NOT fall back to the
 * person who paid (D-137, doc 14 O2). That is a gap in the claim flow, not
 * something to paper over here: it is in the 28 Sep report.
 */
export function receiptFields(
  club: ReceiptClub, facts: InvoiceFacts, paidAt: Date,
): { to: string; receipt: ReceiptFields } | null {
  if (!club.contactEmail) return null;
  return {
    to: club.contactEmail,
    receipt: {
      clubLegalName: club.name,
      planLabel: PLAN_LINES[club.plan ?? ''] ?? 'Interest Register',
      amount: money(facts.amountCents),
      gst: gstOf(facts.amountCents),
      paidOn: melbourneDay(paidAt),
      cardLast4: facts.cardLast4,
      receiptNo: facts.receiptNo,
      renewsOn: melbourneDay(facts.periodEnd ?? renewalFrom(paidAt, club.plan)),
      // D-136's fourteen-day cooling-off is on the ANNUAL plan: a $329 prepay
      // cancelled in month two otherwise leaves a ten-month dead zone. A
      // monthly plan cancels at the end of its month, and printing a refund
      // sentence there would promise a refund we have not agreed to give.
      refundable: club.plan === 'register_annual',
    },
  };
}

/**
 * Read an invoice event's object into the few facts a receipt needs.
 *
 * Deliberately narrow: every field taken here is one whose shape is checked at
 * runtime, and everything else in the payload is ignored. A handler written
 * against an imagined body looks finished and is not.
 */
export function invoiceFacts(obj: Record<string, unknown>): InvoiceFacts | null {
  const amountCents = typeof obj.amount_paid === 'number' ? obj.amount_paid : null;
  // A $0 invoice is not a charge and gets no tax invoice — a trial, a credit,
  // or a proration to nothing. A receipt for nothing is exactly the line a
  // treasurer cannot reconcile, which is what D-136 is trying to prevent.
  if (amountCents === null || amountCents <= 0) return null;

  const id = typeof obj.id === 'string' ? obj.id : '';
  const number = typeof obj.number === 'string' && obj.number.length > 0 ? obj.number : null;
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : 'AUD';

  // The line's own period is the subscription period this invoice paid for.
  // Absent or misshapen, the renewal date is derived from the plan instead —
  // our own fact rather than a guess about somebody else's payload.
  const lines = obj.lines as { data?: Array<{ period?: { end?: unknown } }> } | undefined;
  const end = lines?.data?.[0]?.period?.end;
  const periodEnd = typeof end === 'number' && end > 0 ? new Date(end * 1000) : null;

  return { amountCents, currency, receiptNo: number ?? id, periodEnd, cardLast4: null };
}

/**
 * The club this event belongs to, as far as the payload can say.
 *
 * An invoice does NOT carry the metadata we set at checkout: Stripe puts a
 * subscription's metadata on the invoice under `subscription_details`, not
 * under `metadata`. The webhook read `metadata.club_id` alone, so an
 * invoice.payment_failed could never resolve a club and D-135's dunning path
 * was unreachable. The customer id is the fallback, and the caller resolves it
 * against our own club row.
 */
export function clubIdFromEvent(obj: Record<string, unknown>): string | null {
  const own = (obj.metadata ?? {}) as Record<string, string>;
  if (own.club_id) return own.club_id;
  const sub = obj.subscription_details as { metadata?: Record<string, string> } | undefined;
  return sub?.metadata?.club_id ?? null;
}
