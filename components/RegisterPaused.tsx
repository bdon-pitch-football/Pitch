// The failed-payment words, in ONE place (0063; D-135, doc 14 O4/O5).
//
// They were the best failure-state writing in the product and they were on the
// wrong screen. app/club/billing/page.tsx said them; app/club/register — the
// screen where losing the list actually costs something — said nothing at all,
// and a suspended club dropped silently to the free tier's "Interest in your
// trials" heading. Both screens now render this, so the sentence cannot go
// stale on one of them (LESSONS L25).
//
// Two states, one change of tense between them, because they are two different
// truths: during the fourteen days nothing has changed yet, and after them the
// register is paused. D-135's promise is the last two sentences and it is the
// same in both: nothing is deleted, and a family's child is never deleted
// because a club's card expired.
import Link from 'next/link';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';

export default function RegisterPaused({ state, billingLink }: {
  state: 'grace' | 'suspended'; billingLink?: boolean;
}) {
  return (
    <div role="status" style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: T.amber }}>We couldn&rsquo;t take your payment</div>
      <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
        {state === 'grace'
          ? <>Nothing has changed yet. We&rsquo;ll keep trying for the next fortnight. If it&rsquo;s still not sorted, the register is paused — your coaches stop seeing the list.</>
          : <>The register is paused — your coaches stop seeing the list.</>}
        <b style={{ color: T.ink }}> Nothing is deleted.</b> The families who registered stay registered, and everything comes back the moment a payment goes through.
      </div>
      {billingLink && (
        <Link href="/club/billing" style={{ fontSize: 13, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start' }}>
          Plan &amp; billing
        </Link>
      )}
    </div>
  );
}
