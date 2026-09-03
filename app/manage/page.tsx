import type { Metadata } from 'next';
import { getByToken } from '@/lib/waitlist-db';
import { updateEntry } from './actions';
import { PitchWordmark, QuietShell } from '@/components/quiet-shell';
import { ROLES } from '@/lib/consent';

export const metadata: Metadata = {
  title: 'Manage your details — Pitch Football',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', height: 52, borderRadius: 14,
  background: '#0a110d', border: '1px solid #24322a', color: '#eef5f0',
  fontSize: 15, fontWeight: 600, padding: '0 16px', fontFamily: 'inherit',
};

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; saved?: string; e?: string }>;
}) {
  const { t, saved, e } = await searchParams;
  const token = typeof t === 'string' && /^[a-f0-9]{16,64}$/.test(t) ? t : null;
  const row = token ? await getByToken(token) : null;

  if (!token || !row) {
    return (
      <QuietShell>
        <PitchWordmark />
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', margin: 0 }}>
          That link didn’t work.
        </h1>
        <p style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
          The manage link may have been cut short by your mail app. Try copying the whole link
          from the email, or reply to any email from us and we’ll sort it by hand.
        </p>
      </QuietShell>
    );
  }

  return (
    <QuietShell>
      <PitchWordmark />
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', margin: 0 }}>
        Your waitlist details.
      </h1>
      <p style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
        An email and who you are — that’s the whole record. Change either below.
        {row.unsubscribed_at ? ' You’re currently unsubscribed, so nothing will be sent either way.' : ''}
      </p>
      {saved && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#3ddc84', background: 'rgba(61,220,132,.1)', border: '1px solid rgba(61,220,132,.3)', borderRadius: 12, padding: '10px 14px' }}>
          Saved.
        </div>
      )}
      {e && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e34948', background: 'rgba(227,73,72,.08)', border: '1px solid rgba(227,73,72,.35)', borderRadius: 12, padding: '10px 14px' }}>
          {e === 'invalid' ? 'Check the email address.' : e === 'taken' ? 'That address is already on the list.' : 'That didn’t save. Try again.'}
        </div>
      )}
      <form action={updateEntry} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input type="hidden" name="t" value={token} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7d8f85' }}>Email</span>
          <input name="email" type="email" defaultValue={row.email} required style={input} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7d8f85' }}>I’m here as</span>
          <select name="role" defaultValue={row.role} style={{ ...input, appearance: 'none' }}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'parent' ? 'Parent' : r[0].toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ height: 54, borderRadius: 14, background: '#3ddc84', color: '#06130c', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Save
        </button>
      </form>
      <p style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 600, margin: 0 }}>
        Want off the list entirely? <a href={`/unsubscribe?t=${token}`}>Unsubscribe in one click.</a>
      </p>
    </QuietShell>
  );
}
