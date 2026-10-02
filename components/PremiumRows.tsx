// The locked Premium rows (D-164 (4)), Highlights18.dc.html's two rows with
// "Coming soon" where the design had a month, and no price anywhere (D-163:
// there is nothing to buy). Seeded, not sold: a tap is counted, anonymously,
// and that is all it does (0081).
//
// NEVER UNDER 18 (D-82, D-88). A caller renders this only for an adult's own
// page, decided from the band the database derived — and the database refuses
// a minor's tap anyway, so a form posted from anywhere cannot record a child's
// interest in a paid feature. Two rows, the most any screen carries.
//
// OFF WHILE D-163 STANDS (John, 2 Oct): lib/premium's one switch. Off, this
// renders nothing at all, wherever a page places it. "See who viewed your CV"
// is gone from the rows, switch or no switch, until it has its own ruling.
import { tapPremium } from './premium-actions';
import { T } from '@/lib/palette';
import { PREMIUM_ROWS_ON } from '@/lib/premium';

const ROWS = [
  ['unlimited_clips', 'Unlimited clips'],
] as const;

export default function PremiumRows({ on, tapped }: { on: 'clips' | 'coach'; tapped: boolean }) {
  if (!PREMIUM_ROWS_ON) return null;
  return (
    // id="premium": where a tap lands (premium-actions), so the answer to it
    // is on screen rather than above the fold. scroll-margin keeps it clear of
    // the top edge.
    <form id="premium" action={tapPremium} style={{ display: 'flex', flexDirection: 'column', gap: 8, scrollMarginTop: 24 }}>
      <input type="hidden" name="on" value={on} />
      {/* Spec C (1 Oct): each row is a panel with a neutral Pill and a muted
          "Coming soon" — green is an action, and neither is one (D-173 (4)).
          Both words stay bare inside their own element (prem-r1 counts them). */}
      {ROWS.map(([feature, title]) => (
        <button key={feature} type="submit" name="feature" value={feature} className="card prem">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5 V7.5 A4 4 0 0 1 16 7.5 V10.5" />
          </svg>
          <span className="prem-t">{title}</span>
          <span className="pill nodot">Premium</span>
          <span className="prem-end">Coming soon</span>
        </button>
      ))}
      <div role={tapped ? 'status' : undefined} className="foot-s">
        {tapped ? 'Premium is coming. You’re first in line.' : 'Tap a locked feature to be first in line.'}
      </div>
    </form>
  );
}
