'use server';
// Request access from the link-state page (D-77, doc 14 C6/C7/C8).
//
// The whole design is in what this action does NOT tell the caller. A dead
// token, a token that never existed, a second request inside 24 hours, and a
// request that was genuinely sent all produce the SAME redirect. Anything
// else is an oracle: "you have already asked" reveals that the first request
// found something, which is precisely what the link-state page exists to
// hide.
//
// C8: the guardian's silence is a complete answer. Nothing here creates a
// state the requester can observe, and nothing schedules a follow-up.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { accessRequestEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { resolveTokenForNotice } from '@/lib/record-read';
import { answerNoSoonerThan } from '@/lib/send-dispatch';

//
// The token comes from the FORM. This one sits on the dead-link page — a
// stranger, no session, often an in-app webview — which is the least
// reliable place in the product for JavaScript, and a bound action answers
// a 500 there instead of working. The token is the credential and it is
// hashed and checked in lib/record-read either way; bind() never made it safer.
//
// ONE ANSWER, IN ONE TIME (D-77, doc 14 C7; brief D, 29 Sep). A token that
// never existed used to be answered straight away and a real one after three
// more queries and a send, so the time alone said whether the link had ever
// been a child's. The clock starts first; whatever happens in between —
// never existed, dead, already asked today, or sent — the answer is the one
// redirect, no sooner than the send floor (lib/send-dispatch), with nothing
// awaited between the floor and the redirect.
export async function requestAccess(formData: FormData) {
  const startedAt = performance.now();
  const token = String(formData.get('token') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const role = String(formData.get('role') ?? '').trim().slice(0, 120);
  if (name && role) await askOnce(token, name, role);
  await answerNoSoonerThan(startedAt);
  redirect(`/p/${token}?asked=${name && role ? 1 : 0}`);
}

// The request itself. It returns nothing, so there is nothing for the answer
// to branch on.
async function askOnce(token: string, name: string, role: string): Promise<void> {
  // Through the one read path (D-80): the token id, a first name and one
  // guardian address, for a live token or a dead one. Nothing off the record.
  const notice = await resolveTokenForNotice(token);
  if (!notice) return; // never existed — same answer

  const allowed = (await db.query(`select fn_access_request_allowed($1) as ok`, [notice.tokenId])).rows[0].ok;
  if (!allowed) return; // C7: silently accepted, not sent

  await db.query(
    `insert into access_request (share_token_id, requester_name, requester_role) values ($1,$2,$3)`,
    [notice.tokenId, name, role],
  );
  if (notice.guardianEmail) {
    await send(accessRequestEmail(notice.firstName, name, role), { address: notice.guardianEmail });
  }
}
