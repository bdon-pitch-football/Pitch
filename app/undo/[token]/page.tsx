// The one-tap revoke that §36 and §37 point at (John, U-2 and M11).
//
// It must work from an email, on a phone, without a sign-in hunt — a parent
// who has just been told something alarming should not meet a login wall. So
// the link itself carries the authority, exactly as a share token does: a
// long random value, stored hashed, single-purpose, and it revokes ONE link.
//
// What it can do is bounded to the point of being dull: it switches off a
// share token that already exists. It cannot read the record, cannot see the
// child, cannot send anything, and cannot be replayed into anything else.
// That is what makes it safe to put in an email.
import Link from 'next/link';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

async function revoke(formData: FormData) {
  'use server';
  // Same reason as /a/[id]: this arrives in a message. The token is the
  // credential and it is checked below either way — bind() never made it
  // safer, it only made it need JavaScript.
  const token = String(formData.get('token') ?? '');
  // Revoking is idempotent and its answer never varies — a spent link, a
  // wrong one and a live one all end on the same page, for the same reason
  // the link-state page does not say which (D-77).
  await db.query(
    `update share_token set revoked_at = now()
     where id = (select share_token_id from undo_token where token_hash = $1
                 and used_at is null and expires_at > now())
       and revoked_at is null`,
    [createHash('sha256').update(token).digest()],
  );
  await db.query(`update undo_token set used_at = now() where token_hash = $1 and used_at is null`,
    [createHash('sha256').update(token).digest()]);
}

export default async function Undo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const act = revoke;
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Switch this link off?</h1>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
          The club will not be able to open the page any more. Nothing is deleted, and you can make a new link whenever you want to.
        </div>
        <form action={act}><input type="hidden" name="token" value={token} />
          <button type="submit" style={{ width: '100%', background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Switch it off</button>
        </form>
        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
          <b style={{ color: T.secondary }}>This does not un-send the email.</b> It has already arrived and nobody can recall it — not us, not you. What this stops is what it opens.
        </div>
        <Link href="/home" className="btn btn-ghost">Not now</Link>
      </div>
    </div>
  );
}
