import type { Metadata } from 'next';
import { getByToken } from '@/lib/waitlist-db';
import { updateEntry } from './actions';
import { QuietShell } from '@/components/quiet-shell';
import { ROLES } from '@/lib/consent';

export const metadata: Metadata = {
  title: 'Manage your details',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; saved?: string; e?: string }>;
}) {
  const { t, saved, e } = await searchParams;
  const token = typeof t === 'string' && /^[a-f0-9]{16,64}$/.test(t) ? t : null;
  const row = token ? await getByToken(token) : null;

  // Spec A's Quiet shell (part 21) with the door (part 20): the logo in the
  // Top bar, top right on a phone. The words are the page's own; the title
  // takes the Page title (26px, -0.015em) and every weight is one we load.
  if (!token || !row) {
    return (
      <QuietShell door>
        <div className="pg-titles">
          <h1 className="pg-title">That link didn’t work.</h1>
          <p className="pg-sub" style={{ margin: 0 }}>
            The manage link may have been cut short by your mail app. Try copying the whole link
            from the email, or reply to any email from us and we’ll sort it by hand.
          </p>
        </div>
      </QuietShell>
    );
  }

  return (
    <QuietShell door>
      <div className="pg-titles">
        <h1 className="pg-title">Your waitlist details.</h1>
        <p className="pg-sub" style={{ margin: 0 }}>
          An email and who you are — that’s the whole record. Change either below.
          {row.unsubscribed_at ? ' You’re currently unsubscribed, so nothing will be sent either way.' : ''}
        </p>
      </div>
      {saved && <div role="status" className="card card-accent c-say">Saved.</div>}
      {e && (
        // A refusal is amber, as sign-in's is (it was a red literal).
        <div role="alert" className="card card-amber c-say">
          {e === 'invalid' ? 'Check the email address.' : e === 'taken' ? 'That address is already on the list.' : 'That didn’t save. Try again.'}
        </div>
      )}
      <form action={updateEntry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="hidden" name="t" value={token} />
        <label className="field" aria-invalid={e ? true : undefined}>
          <span className="field-label">Email</span>
          <input name="email" type="email" defaultValue={row.email} required />
        </label>
        <label className="field">
          <span className="field-label">I’m here as</span>
          <select name="role" defaultValue={row.role}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'parent' ? 'Parent' : r[0].toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary fl-glow">Save</button>
      </form>
      <p className="c-help" style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>
        Want off the list entirely? <a href={`/unsubscribe?t=${token}`}>Unsubscribe in one click.</a>
      </p>
    </QuietShell>
  );
}
