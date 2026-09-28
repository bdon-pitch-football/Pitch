// Report a page (D-64). No account, no reason required, one tap from every
// public page. The confirmation is doc 15 §7's copy, and it is honest about
// what we are not: an emergency service.
import { HeaderMark } from '@/components/Wordmark';
import { FAILURE_COPY } from '@/components/FailureState';
import { fileReport } from './actions';
import { T } from '@/lib/palette';
import { card, fieldLabel as label } from '@/lib/ui';

// The confirmation is a different screen from the form, and it inherited the
// form's title: a person who had just reported a concern about a child was
// still looking at a tab reading "Report this page".
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  return { title: done ? FAILURE_COPY.reportDone.title : 'Report this page', robots: { index: false, follow: false } };
}

const input: React.CSSProperties = { background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function Report({ searchParams }: { searchParams: Promise<{ page?: string; kind?: string; done?: string }> }) {
  const { page, kind, done } = await searchParams;

  if (done) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          {/* Three faults on the one screen a person reaches after reporting a
              concern about a child, and no new words fix them. The thanks was
              a styled <div>, so h1 was 0 and a screen reader announced nothing
              on arrival. The one urgent line sat BELOW the thanks in the
              lowest-contrast style on the page. And the tab still read "Report
              this page" (generateMetadata, above). Doc 15 §7's sentences,
              unchanged — heading, order and contrast are not. */}
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em', margin: 0 }}>{FAILURE_COPY.reportDone.heading}</h1>
          <div className="card-accent" style={{ ...card, fontSize: 13.5, color: T.ink, fontWeight: 700, lineHeight: 1.55 }}>
            {FAILURE_COPY.reportDone.urgent}
          </div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            {FAILURE_COPY.reportDone.thanks}
          </div>
          <a href="/home" className="btn btn-secondary">{FAILURE_COPY.reportDone.action}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
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
          {/* doc 32 A5: a route for "this account belongs to a child" that
              needs neither an account nor certainty. Nothing is required. */}
          <fieldset style={{ ...card, border: `1px solid ${T.line}`, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <legend style={{ ...label, padding: 0, float: 'left', marginBottom: 4 }}>What&rsquo;s it about — optional</legend>
            {([
              ['child_account', 'I think this account belongs to a child'],
              ['own_child', 'My child is in this and shouldn\u2019t be'],
              ['family_safety', 'A family safety matter — another parent\u2019s access'],
              ['other', 'Something else'],
            ] as const).map(([v, t]) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 13.5, fontWeight: 700, color: T.secondary, cursor: 'pointer', clear: 'both' }}>
                <input type="radio" name="concern" value={v} defaultChecked={v === 'other'} style={{ width: 18, height: 18, accentColor: T.accent }} />
                {t}
              </label>
            ))}
          </fieldset>
          <div style={{ ...card, background: T.surface2, fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>If you or your child aren&rsquo;t safe at home,</b> you can talk to 1800RESPECT any time on <a href="tel:1800737732" style={{ color: T.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-11px 0', whiteSpace: 'nowrap' }}>1800 737 732</a>. We can stop another parent seeing your child&rsquo;s page while we look, without deleting anything. In an emergency, call 000.
          </div>
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
