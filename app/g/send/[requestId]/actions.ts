'use server';
// Guardian dispatch (D-99). The send itself — token, stamp, consent row, the
// club's email and the other guardian's undo — lives in lib/send-dispatch.ts,
// the one path every sender uses. This action is the guardian's door onto it:
// the session, the rate limit, and the answer.
//
// Doing nothing remains a complete answer: an unsent request just sits, and
// nothing chases anyone (D-138).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { checkRate } from '@/lib/ratelimit-db';
import { SEND_DAILY_CAP } from '@/lib/football';
import { answerNoSoonerThan, dispatchShareRequest } from '@/lib/send-dispatch';

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading, and it
// cannot be exercised by anything that is not a browser.
export async function dispatchSend(formData: FormData) {
  // L40: the floor is measured from here, before anything either path does.
  const startedAt = performance.now();
  const requestId = String(formData.get('requestId') ?? '');
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  // L41: counted per SENDING ACTOR per day, never per recipient — a
  // per-recipient counter would let one sender learn that somebody else had
  // written to that club.
  //
  // L38/L42: when the limit bites, NOTHING is transmitted and the answer is
  // the same one a real send gives. No counter, no "sends remaining", no
  // greyed button, no error — any surface that reveals limit state is the
  // oracle the identical response exists to close. Both paths redirect to the
  // same address, byte for byte. A real send used to add `&link=<the raw
  // token>` for a development-only panel, so the address bar said whether the
  // limit bit, and a live share token sat in the browser's history (brief D,
  // 29 Sep). The link a send made is in the club's email, which development
  // reads at /dev/outbox.
  const withinLimit = await checkRate(`send:actor:${guardianId}`, SEND_DAILY_CAP, 24 * 60 * 60);
  if (!withinLimit) {
    // U-4 (John): the consent log records what happened, never what was
    // attempted and stopped. The signal goes to a separate operational store
    // carrying the sender, the time and a reason — no recipient, no child and
    // no content.
    await db.query(`insert into abuse_signal (actor_id, reason, surface) values ($1,'rate_limited','send')`, [guardianId]);
    await answerNoSoonerThan(startedAt);
    redirect(`/g/send/${requestId}?sent=1`);
  }

  // Not yours, already sent, never existed or malformed — one answer.
  const done = isUuid(requestId) ? await dispatchShareRequest(requestId, guardianId) : null;
  // 0160: the club asked Pitch to stop between the page and the press. Only a
  // request this guardian may see is asked about, so the answer says nothing
  // about anybody else's; theirs lands on its page, which says so. Asked
  // before the floor, so nothing is awaited between the floor and the answer.
  const stopped = !done && isUuid(requestId) && (await db.query(
    `select fn_send_blocked(sr.destination) as b from share_request sr
     join development_record dr on dr.id = sr.record_id
     join guardianship_link g on g.child_id = dr.person_id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where sr.id = $1 and sr.dispatched_at is null`,
    [requestId, guardianId],
  )).rows[0]?.b === true;
  await answerNoSoonerThan(startedAt);
  if (!done) redirect(stopped ? `/g/send/${requestId}` : '/home');
  redirect(`/g/send/${requestId}?sent=1`);
}
