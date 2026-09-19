// The strip across the top of every page in a demo (lib/demo). Server-rendered:
// the layout only includes it when isDemo() says so.
import { T } from '@/lib/palette';

export default function DemoBar() {
  return (
    <div role="note" style={{ background: T.accent, color: T.onAccent, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em', padding: '7px 18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center' }}>
      <span>Demo · every person here is made up</span>
      <a href="/demo" style={{ color: T.onAccent, textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 24, display: 'inline-flex', alignItems: 'center' }}>Switch seat</a>
    </div>
  );
}
