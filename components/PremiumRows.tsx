// The locked Premium rows (D-164 (4)), Highlights18.dc.html's two rows with
// "Coming soon" where the design had a month, and no price anywhere (D-163:
// there is nothing to buy). Seeded, not sold: a tap is counted, anonymously,
// and that is all it does (0081).
//
// NEVER UNDER 18 (D-82, D-88). A caller renders this only for an adult's own
// page, decided from the band the database derived — and the database refuses
// a minor's tap anyway, so a form posted from anywhere cannot record a child's
// interest in a paid feature. Two rows, the most any screen carries.
import { tapPremium } from './premium-actions';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';

const ROWS = [
  ['unlimited_clips', 'Unlimited clips'],
  ['who_viewed', 'See who viewed your CV'],
] as const;

export default function PremiumRows({ on, tapped }: { on: 'clips' | 'coach'; tapped: boolean }) {
  return (
    // id="premium": where a tap lands (premium-actions), so the answer to it
    // is on screen rather than above the fold. scroll-margin keeps it clear of
    // the top edge.
    <form id="premium" action={tapPremium} style={{ display: 'flex', flexDirection: 'column', gap: 8, scrollMarginTop: 24 }}>
      <input type="hidden" name="on" value={on} />
      {ROWS.map(([feature, title]) => (
        <button key={feature} type="submit" name="feature" value={feature} style={{
          ...card, display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44,
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: T.secondary,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5 V7.5 A4 4 0 0 1 16 7.5 V10.5" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.secondary, minWidth: 0 }}>{title}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent, background: 'rgba(61,220,132,.12)', borderRadius: 999, padding: '3px 8px', flexShrink: 0 }}>Premium</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', color: T.accent, flexShrink: 0 }}>Coming soon</span>
        </button>
      ))}
      <div role={tapped ? 'status' : undefined} style={{ fontSize: 11.5, color: tapped ? T.secondary : T.muted, textAlign: 'center', fontWeight: tapped ? 700 : 500 }}>
        {tapped ? 'Premium is coming. You’re first in line.' : 'Tap a locked feature to be first in line.'}
      </div>
    </form>
  );
}
