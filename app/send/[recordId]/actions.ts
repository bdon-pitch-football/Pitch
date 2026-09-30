'use server';
// "Send my CV" (D-99): never automated, never batched, never an attachment.
// Who presses send depends on the band AT THE MOMENT OF SENDING (G1):
//
//   under 16  the child composes; the request routes to the guardian (D-91)
//   16–17     the player sends; every guardian is told, every time (§22)
//   18+       the player sends alone
//
// It used to know only the first. Every player at every age was told to ask a
// parent, and an adult — who has no guardian — composed a request that went to
// nobody, and was then told it had been asked. Postgres had permitted the
// other two bands all along (fn_can_dispatch, doc 14 L5 and L8 green); nothing
// in the product ever called it for anyone but a guardian.
//
// The club address is typed from the club's own notice — hostile free text,
// validated as an email shape only.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { SEND_DAILY_CAP } from '@/lib/football';
import { sendWaitingEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { checkRate } from '@/lib/ratelimit-db';
import { requireRecordActor } from '@/lib/record-guard';
import { answerNoSoonerThan, dispatchShareRequest } from '@/lib/send-dispatch';
import { sendState } from '@/lib/send-state';
import { replaceOwnLinks, switchOffOneLink } from '@/lib/link-switch';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function composeSend(formData: FormData) {
  // L40: the floor is measured from here, before anything either path does.
  const startedAt = performance.now();
  const recordId = String(formData.get('recordId') ?? '');
  // Never trust the record id in the URL (D-94 §3).
  const { personId } = await requireRecordActor(recordId);
  const clubName = String(formData.get('clubName') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();

  const state = await sendState(recordId, personId);
  // L10/L11: paused, unapproved, or not this person's to send — no send row.
  if (!state || state.mode === 'none') redirect('/home');
  // L6: sending is switched off. Nothing is created and nothing is logged,
  // because the log records what happened, never what was stopped (L56).
  if (state.mode === 'off') redirect(`/send/${recordId}`);
  if (!clubName || !EMAIL_RE.test(address)) redirect(`/send/${recordId}?error=1`);
  // 0160 (John, 30 Sep §2): a club that asked Pitch to stop is not sent to —
  // including an address typed by hand at that club's domain. Asked before
  // anything is written, on both paths: nothing is created and nothing is
  // logged, and the page says so plainly, with no reason.
  const stopped = (await db.query('select fn_send_blocked($1) as b', [address])).rows[0]?.b === true;
  if (stopped) redirect(`/send/${recordId}?blocked=1`);

  if (state.mode === 'self') {
    // L38-L41, on the same terms as the guardian's door: counted per sending
    // actor, and a limited send lands on exactly the page a real one does.
    const withinLimit = await checkRate(`send:actor:${personId}`, SEND_DAILY_CAP, 24 * 60 * 60);
    if (!withinLimit) {
      await db.query(`insert into abuse_signal (actor_id, reason, surface) values ($1,'rate_limited','send')`, [personId]);
      // The player's own list must not show this as sent (John, 17 Sep; 0046).
      // The page they land on stays identical to a real send (U-3, J40).
      await db.query(`insert into send_held (person_id, club_name) values ($1,$2)`, [personId, clubName.slice(0, 60)]);
      await answerNoSoonerThan(startedAt);
      redirect(`/send/${recordId}?sent=1`);
    }
    const { rows } = await db.query(
      `insert into share_request (record_id, requested_by, destination) values ($1,$2,$3) returning id`,
      [recordId, personId, `${clubName} <${address}>`],
    );
    const done = await dispatchShareRequest(rows[0].id, personId);
    await answerNoSoonerThan(startedAt);
    // The switch can be turned off between the page and the press. Fail
    // closed, onto the screen that says so, rather than claiming a send.
    if (!done) redirect(`/send/${recordId}`);
    redirect(`/send/${recordId}?sent=1`);
  }

  // Under 16: the request is composed here and waits for a guardian.
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into share_request (record_id, requested_by, destination)
       select dr.id, dr.person_id, $2 from development_record dr where dr.id = $1
       returning id`,
      [recordId, `${clubName} <${address}>`],
    );
    await client.query(
      `insert into consent_event (event, subject_id, detail)
       select 'share_request_created', dr.person_id, jsonb_build_object('request_id', $2::uuid)
       from development_record dr where dr.id = $1`,
      [recordId, rows[0].id],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §20: email only — an SMS manufactures pressure around a decision
  // deliberately designed to be pressure-free. The address is printed in full.
  const g = await db.query(
    `select p2.email, c.first_name from development_record dr
     join person c on c.id = dr.person_id
     join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
     join person p2 on p2.id = gl.guardian_id
     where dr.id = $1 and p2.email is not null limit 1`,
    [recordId],
  );
  if (g.rows[0]) {
    const rid = (await db.query(
      `select id from share_request where record_id = $1 and dispatched_at is null order by created_at desc limit 1`,
      [recordId],
    )).rows[0]?.id;
    if (rid) await send(sendWaitingEmail(g.rows[0].first_name, clubName, address, rid), { address: g.rows[0].email });
  }
  redirect(`/send/${recordId}?asked=1`);
}


// ---------------------------------------------------------------------------
// The player's own link controls (John's rulings, 17 Sep §3). A player 16 or
// over, sending for themselves, can switch off the link one club has, or make
// a fresh link, which switches off every link they have. The link itself is
// never shown again after it is made: tokens are stored hashed (D-80).
// Both need the same standing as sending does — 'self' — so a 16-17 whose
// parent switched sending off gets neither, and an under-16 never does.
// ---------------------------------------------------------------------------
async function requireSelfSender(recordId: string): Promise<string> {
  const { personId } = await requireRecordActor(recordId, ['self']);
  const state = await sendState(recordId, personId);
  if (!state || state.mode !== 'self') redirect('/home');
  return personId;
}

export async function switchOffMine(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const personId = await requireSelfSender(recordId);
  const ok = await switchOffOneLink(personId, personId, String(formData.get('tokenId') ?? ''));
  redirect(`/send/${recordId}${ok ? '?off=1' : ''}#links`);
}

export async function freshLink(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const personId = await requireSelfSender(recordId);
  const raw = await replaceOwnLinks(personId, recordId);
  // Shown once, the same way a parent's Replace shows it.
  redirect(`/send/${recordId}?link=${raw}#links`);
}
