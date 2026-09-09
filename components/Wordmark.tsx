// The Pitch emblem — identical to the coming-soon site's wordmark (BUZ,
// 4 Sep: the new emblem is THE emblem). "P" + the pitch glyph as the I +
// "TCH". Placement rule unchanged: top right corner on every screen.
export default function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: size, letterSpacing: '-.035em', color: '#eef5f0', lineHeight: 1 }}>
      P
      <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none">
        <line x1="37" y1="6.5" x2="37" y2="90.5" stroke="#3ddc84" strokeWidth="13" strokeLinecap="round" />
        <circle cx="37" cy="48.5" r="32" fill="none" stroke="#3ddc84" strokeWidth="10" />
      </svg>
      TCH
    </div>
  );
}

// The header row every app screen renders. The wordmark stays hard right —
// that rule has no exceptions (BUZ, 24 Aug) — and the left of the same row is
// where a way out belongs.
//
// WHY IT IS HERE AND NOT AT THE BOTTOM OF EACH PAGE. Twenty signed-in screens
// had no link out at all: the whole build flow, all six guardian screens, the
// club's billing and trial screens, the coach editor and the operator
// console. On the web the browser's back button hides that. This is an
// INSTALLABLE app — manifest, icons, iOS meta — and in standalone mode there
// is no browser chrome, so a parent who opened Manage was simply stuck.
//
// Top-left, because someone looking for the exit does not scroll to the foot
// of a long form to find it.
export function HeaderMark({ back }: { back?: { href: string; label?: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
      {back ? (
        <a href={back.href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
          color: 'var(--muted, #7d8f85)', fontSize: 13, fontWeight: 700,
          // 44px of tappable height without 44px of visual weight (D-147).
          margin: '-10px 0', padding: '10px 0',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
          {back.label ?? 'Back'}
        </a>
      ) : <span />}
      <Wordmark size={20} />
    </div>
  );
}
