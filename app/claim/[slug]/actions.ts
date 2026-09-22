'use server';
// Claiming a club (ClaimClub.dc.html, D-126, doc 15 §34).
//
// Claiming gets the page and trial notices. Verified status is SEPARATE — a
// person rings the club and checks it against Football Victoria's register —
// and claiming can never set it.
//
// The flow is two steps and the first one is the point. A code goes to the
// address ALREADY PUBLISHED on the club's own listing, the address we
// compiled the page from. It never goes to an address the claimant types: a
// code sent wherever the reader asks proves only that the reader can read
// their own email, which is not a fact about the club. The previous dev flow
// claimed the page on a button press with no proof at all, which is why the
// route was 404'd in production rather than shipped.
import { redirect } from 'next/navigation';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { clubClaimCodeEmail } from '@/lib/messages';
import { sendAndLog } from '@/lib/messaging';
import { checkRate } from '@/lib/ratelimit-db';

const CODE_TTL_MINUTES = 30;   // doc 15 §34 says thirty minutes, so it is thirty
const MAX_ATTEMPTS = 5;

const hash = (code: string) => createHash('sha256').update(code).digest();

async function unclaimedClub(slug: string) {
  const { rows } = await db.query(
    `select id, name, club_state, contact_email from club where public_slug = $1`,
    [slug],
  );
  return rows[0] as { id: string; name: string; club_state: string; contact_email: string | null } | undefined;
}

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading, and it
// cannot be exercised by anything that is not a browser.
//
// Moving the id into the form costs nothing in safety: every one of these
// already re-checks its arguments server-side. bind() never made an argument
// trustworthy — the authorisation below did.
export async function requestClaimCode(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const club = await unclaimedClub(slug);
  if (!club || club.club_state !== 'unclaimed') redirect(`/claim/${slug}?taken=1`);
  if (!club.contact_email) redirect(`/claim/${slug}?noaddress=1`);

  // Two ceilings. The club one stops a stranger using our sender to pepper a
  // club's inbox; the person one stops one account walking the directory.
  const okClub = await checkRate(`claim-club:${club.id}`, 3, 3600);
  const okPerson = await checkRate(`claim-person:${me}`, 5, 3600);
  if (!okClub || !okPerson) redirect(`/claim/${slug}?sent=1`); // identical answer

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.query(
    `insert into verification_challenge (person_id, club_id, channel, token_hash, expires_at)
     values ($1,$2,'email',$3, now() + ($4 || ' minutes')::interval)
     on conflict (person_id, club_id) where club_id is not null and verified_at is null
     do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at,
                   sent_at = now(), attempts = 0`,
    [me, club.id, hash(code), String(CODE_TTL_MINUTES)],
  );
  await sendAndLog(clubClaimCodeEmail(club.name, code), { address: club.contact_email, personId: me }, 'email_sent');
  redirect(`/claim/${slug}?sent=1`);
}

export async function claimClub(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  // Whoever claims the page is the club's ADMINISTRATOR, and that is the
  // whole of it (BUZ's decision 9, 23 Sep; doc 14 H10, D-93). Technical
  // Director is granted by the club and confirmed on the verification call —
  // never self-declared on a form, which is what let a claimant give
  // themselves the one role that reads a child's development record.
  const mapped = 'club_admin';

  const club = await unclaimedClub(slug);
  if (!club || club.club_state !== 'unclaimed') redirect(`/claim/${slug}?taken=1`);

  // redirect() works by THROWING, so it must not be called inside a try that
  // has a catch-and-rollback around it: the redirect would be caught as a
  // failure, rolled back, and rethrown. The transaction decides an outcome;
  // the redirect happens afterwards, outside it.
  type Outcome = 'claimed' | 'bad' | 'taken';
  let outcome: Outcome;
  const client = await db.connect();
  try {
    await client.query('begin');
    // The challenge is locked and counted before it is compared, so a wrong
    // code costs an attempt whether or not it was close.
    const ch = await client.query(
      `select id, token_hash, attempts from verification_challenge
       where person_id = $1 and club_id = $2 and verified_at is null
         and expires_at > now() for update`,
      [me, club.id],
    );
    const row = ch.rows[0];
    if (!row || row.attempts >= MAX_ATTEMPTS) {
      await client.query('rollback');
      outcome = 'bad';
    } else {
      await client.query(`update verification_challenge set attempts = attempts + 1 where id = $1`, [row.id]);
      // timingSafeEqual, like every other secret comparison in the codebase
      // (session, auth, all three webhooks). The attempt ceiling above is the
      // control that actually matters for a six-digit code — but a lone
      // Buffer.equals among five timing-safe compares is the one somebody
      // copies into a place where it does matter.
      const given = hash(code);
      const stored = Buffer.from(row.token_hash);
      if (code.length !== 6 || stored.length !== given.length || !timingSafeEqual(stored, given)) {
        await client.query('commit');   // the attempt is kept
        outcome = 'bad';
      } else {
        // Re-read the club inside the transaction: two people holding codes
        // for the same club must not both become its administrator.
        const locked = await client.query(
          `select id from club where id = $1 and club_state = 'unclaimed' for update`,
          [club.id],
        );
        if (locked.rows.length === 0) {
          await client.query('rollback');
          outcome = 'taken';
        } else {
          await client.query(`update verification_challenge set verified_at = now() where id = $1`, [row.id]);
          await client.query(`update club set club_state = 'claimed' where id = $1`, [club.id]);
          await client.query(
            `insert into membership (person_id, club_id, role) values ($1,$2,$3)`,
            [me, club.id, mapped],
          );
          await client.query('commit');
          outcome = 'claimed';
        }
      }
    }
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  if (outcome === 'taken') redirect(`/claim/${slug}?taken=1`);
  if (outcome === 'bad') redirect(`/claim/${slug}?sent=1&bad=1`);
  redirect(`/claim/${slug}?claimed=1`);
}
