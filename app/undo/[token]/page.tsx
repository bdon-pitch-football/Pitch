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
//
// IT SAYS WHETHER IT WORKED (G-P1; John, 1 Oct: "treat it as a defect"). It
// used to ask the same question before and after the press, and a press on a
// spent link did nothing while the screen looked identical — the false
// assurance §36 itself warns about, built into the control §36 describes.
// Now:
//   · on load, a link that would switch something off asks; any other — used,
//     lapsed, its link already off, or never a link — shows ONE not-live
//     panel, identical in every byte for all of them (D-77);
//   · after the press, "Done" (/undo/done) only when the press actually
//     switched a link off, and the not-live panel otherwise.
// D-77 protects a stranger probing whether a link exists. A guessed token
// never reaches Done, because there is nothing for it to switch off, and the
// not-live causes cannot be told apart — by the words or by the clock. Every
// token, on load and on the press, costs the same one statement of the same
// shape, starting from its hash (John: "the not-live path must do the same
// work"; the timing suite's jr-undo rows measure it rather than trust this).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { DashedTile } from '@/components/parent-sheet';
import { NotUnsent, UNDO_WHAT, UndoFrame } from '@/components/undo';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Undo', robots: { index: false, follow: false } };

const hashOf = (token: string) => createHash('sha256').update(token).digest();

// Live means the press would switch a link off: the undo is unused and in
// date, and the link it points at is still on. The same predicate the press
// uses below, so the page never asks a question whose answer is "nothing".
async function undoIsLive(token: string): Promise<boolean> {
  const { rows } = await db.query(
    `select (u.id is not null and u.used_at is null and u.expires_at > now()
             and st.id is not null and st.revoked_at is null) as live
     from (select $1::bytea as token_hash) asked
     left join undo_token u on u.token_hash = asked.token_hash
     left join share_token st on st.id = u.share_token_id`,
    [hashOf(token)],
  );
  return rows[0]?.live === true;
}

async function revoke(formData: FormData) {
  'use server';
  // Same reason as /a/[id]: this arrives in a message. The token is the
  // credential and it is checked below either way — bind() never made it
  // safer, it only made it need JavaScript.
  const token = String(formData.get('token') ?? '');
  // One statement for every token, live or not: spend the undo if it is live,
  // and switch off the link it points at if that is still on. "Done" is the
  // count of links this press switched off, and nothing else — a press on a
  // spent, lapsed or unknown link switches off nothing and says so.
  const { rows } = await db.query(
    `with asked as (select $1::bytea as token_hash),
     spent as (
       update undo_token u set used_at = now()
       from asked
       where u.token_hash = asked.token_hash and u.used_at is null and u.expires_at > now()
       returning u.share_token_id
     ),
     off as (
       update share_token st set revoked_at = now()
       from spent
       where st.id = spent.share_token_id and st.revoked_at is null
       returning st.id
     )
     select count(*)::int as revoked from off`,
    [hashOf(token)],
  );
  redirect(rows[0]?.revoked === 1 ? '/undo/done' : `/undo/${encodeURIComponent(token)}`);
}

export default async function Undo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const act = revoke;

  if (!(await undoIsLive(token))) {
    // One panel for used, lapsed, already-off and never-a-link (D-77). It is
    // handed nothing about the token, so it can say nothing different. The
    // first sentence is /confirm's; the second is N-G1 (BUZ, 1 Oct): a link
    // that may still be on, and where its switch is.
    return (
      <UndoFrame>
        <DashedTile>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14 a4 4 0 0 0 5.66 0 l3-3 a4 4 0 0 0 -5.66 -5.66 l-1 1" /><path d="M14 10 a4 4 0 0 0 -5.66 0 l-3 3 a4 4 0 0 0 5.66 5.66 l1 -1" /></svg>
        </DashedTile>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>This link isn&rsquo;t live</h1>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
          It may have been used already, or it may have lapsed. Sign in, and you can switch off any club&rsquo;s link from your child&rsquo;s controls.
        </div>
        <Link href="/signin" className="btn btn-secondary">Go to sign in</Link>
      </UndoFrame>
    );
  }

  return (
    <UndoFrame>
      <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Switch this link off?</h1>
      <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{UNDO_WHAT}</div>
      <form action={act}><input type="hidden" name="token" value={token} />
        <button type="submit" style={{ width: '100%', background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Switch it off</button>
      </form>
      <NotUnsent />
      <Link href="/home" className="btn btn-ghost">Not now</Link>
    </UndoFrame>
  );
}
