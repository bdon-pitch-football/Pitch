// The strip across the top of every page in a demo (lib/demo). Server-rendered:
// the layout only includes it when isDemo() says so.
import { T } from '@/lib/palette';

export default function DemoBar() {
  return (
    <div role="note" style={{ background: T.accent, color: T.onAccent, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em', padding: '0 18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center' }}>
      <span>Demo · every person here is made up</span>
      {/* 44px, the charter's floor at every width (J spec, 1 Oct). It was 24px.
          The strip lost its 7px padding so it grows by 16px, not 30. */}
      <a href="/demo" style={{ color: T.onAccent, textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Switch seat</a>
    </div>
  );
}
