// Report a page (D-64). No account, no reason required, one tap from every
// public page. The confirmation is doc 15 §7's copy, and it is honest about
// what we are not: an emergency service.
import { HeaderMark } from '@/components/Wordmark';
import { fileReport } from './actions';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const metadata = { robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function Report({ searchParams }: { searchParams: Promise<{ page?: string; kind?: string; done?: string }> }) {
  const { page, kind, done } = await searchParams;

  if (done) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>We&rsquo;ve received your report</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            Thanks — we have your report and a person will look at it. We aim to respond within one business day.
          </div>
          <div style={{ ...card, background: T.surface2, fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            If it concerns a child&rsquo;s immediate safety, contact your local police first; we are not an emergency service.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Report this page</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            A person reads every report. You don&rsquo;t need an account and you don&rsquo;t need to give a reason.
          </div>
        </div>
        <form action={fileReport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="subjectRef" value={page ?? ''} />
          <input type="hidden" name="subjectKind" value={kind ?? 'other'} />
          <label style={card}>
            <div style={label}>What&rsquo;s wrong — optional</div>
            <textarea name="reason" rows={4} placeholder="Tell us as much or as little as you like." style={{ ...input, lineHeight: 1.5, resize: 'vertical' }} />
          </label>
          <label style={card}>
            <div style={label}>Your email — optional, if you&rsquo;d like a reply</div>
            <input style={input} name="reporterEmail" type="email" placeholder="you@example.com" />
          </label>
          <div style={{ ...card, background: T.surface2, fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            If this is about your own child appearing in someone else&rsquo;s content, say so and we will take it down while we look — you do not need to explain further.
          </div>
          <button type="submit" className="btn btn-primary">Send the report</button>
        </form>
      </div>
    </div>
  );
}
