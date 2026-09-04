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

// Right-aligned header row used by every app screen.
export function HeaderMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Wordmark size={20} />
    </div>
  );
}
