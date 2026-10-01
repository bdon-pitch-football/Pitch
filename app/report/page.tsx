// Report a page (D-64). No account, no reason required, one tap from every
// public page. The confirmation is doc 15 §7's copy, and it is honest about
// what we are not: an emergency service.
import { QuietShell } from '@/components/quiet-shell';
import { FAILURE_COPY } from '@/components/FailureState';
import { fileReport } from './actions';
import { T } from '@/lib/palette';
import { documentTitle } from '@/lib/legal-doc';

// The confirmation is a different screen from the form, and it inherited the
// form's title: a person who had just reported a concern about a child was
// still looking at a tab reading "Report this page".
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  return { title: done ? FAILURE_COPY.reportDone.title : 'Report this page', robots: { index: false, follow: false } };
}

// Floodlit (spec H): a form is a door. The top bar — its logo links home
// (HD2, BUZ 1 Oct): a way off a page reached by accident or by duty — then
// the door panel (the phone column as drawn; from 640 the same column on the
// lifted panel). The four concerns are field wells as choices (.field-opt,
// 48px, the whole row the target); both explanations are wells (read this);
// one glowing primary; the policy link stays last. Every field name, value
// and the default are unchanged (doc 32 A5, write-tests).
export default async function Report({ searchParams }: { searchParams: Promise<{ page?: string; kind?: string; done?: string }> }) {
  const { page, kind, done } = await searchParams;

  if (done) {
    return (
      <QuietShell wide door>
          {/* Three faults on the one screen a person reaches after reporting a
              concern about a child, and no new words fix them. The thanks was
              a styled <div>, so h1 was 0 and a screen reader announced nothing
              on arrival. The one urgent line sat BELOW the thanks in the
              lowest-contrast style on the page. And the tab still read "Report
              this page" (generateMetadata, above). Doc 15 §7's sentences,
              unchanged — heading, order and contrast are not. Floodlit: the
              urgent line is the amber notice — a "needs you" state, never the
              green of an action. */}
          <h1 className="pg-title" style={{ fontSize: 24 }}>{FAILURE_COPY.reportDone.heading}</h1>
          <div className="card card-amber" style={{ fontSize: 13.5, color: T.ink, fontWeight: 700, lineHeight: 1.55 }}>
            {FAILURE_COPY.reportDone.urgent}
          </div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            {FAILURE_COPY.reportDone.thanks}
          </div>
          <a href="/home" className="btn btn-secondary">{FAILURE_COPY.reportDone.action}</a>
      </QuietShell>
    );
  }

  return (
    <QuietShell wide door>
        <div className="pg-titles">
          <h1 className="pg-title">Report this page</h1>
          <div className="pg-sub">
            A person reads every report. You don&rsquo;t need an account and you don&rsquo;t need to give a reason.
          </div>
        </div>
        <form action={fileReport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="subjectRef" value={page ?? ''} />
          <input type="hidden" name="subjectKind" value={kind ?? 'other'} />
          {/* doc 32 A5: a route for "this account belongs to a child" that
              needs neither an account nor certainty. Nothing is required. */}
          <fieldset className="opts">
            <legend className="field-label">What&rsquo;s it about — optional</legend>
            {([
              ['child_account', 'I think this account belongs to a child'],
              ['own_child', 'My child is in this and shouldn\u2019t be'],
              ['family_safety', 'A family safety matter — another parent\u2019s access'],
              ['other', 'Something else'],
            ] as const).map(([v, t]) => (
              <label key={v} className="field-opt">
                <input type="radio" name="concern" value={v} defaultChecked={v === 'other'} />
                {t}
              </label>
            ))}
          </fieldset>
          <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>If you or your child aren&rsquo;t safe at home,</b> you can talk to 1800RESPECT any time on <a href="tel:1800737732" style={{ color: T.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-11px 0', whiteSpace: 'nowrap' }}>1800 737 732</a>. We can stop another parent seeing your child&rsquo;s page while we look, without deleting anything. In an emergency, call 000.
          </div>
          <label className="field">
            <span className="field-label">What&rsquo;s wrong — optional</span>
            <textarea name="reason" rows={4} placeholder="Tell us as much or as little as you like." />
          </label>
          <label className="field">
            <span className="field-label">Your email — optional, if you&rsquo;d like a reply</span>
            <input name="reporterEmail" type="email" placeholder="you@example.com" />
          </label>
          <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            If this is about your own child appearing in someone else&rsquo;s content, say so and we will take it down while we look — you do not need to explain further.
          </div>
          <button type="submit" className="btn btn-primary fl-glow">Send the report</button>
        </form>
        {/* Doc 25, how a report is handled, one tap away and still no account
            (brief K). Its own title is the link, so the words are the
            document's and nothing new is written here. */}
        <a href="/report/policy" style={{ alignSelf: 'flex-start', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: T.accent, textDecoration: 'none', marginTop: -6 }}>{documentTitle('25-Complaints-and-Takedown.md')}</a>
    </QuietShell>
  );
}
