'use server';
// The kill switches (D-94 §10; migration 0044). Operator-only, checked here on
// every action — the page being operator-only has never been enough on its
// own (see ops/support/actions.ts). Every switch needs a reason, and the
// database writes the operator's name and reason in the same transaction as
// the switch itself.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/ops-guard';
import { REVOKE_ALL_PHRASE } from '@/lib/ops-policy';
import { linksSwitchedOffEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { operatorCapCents, smsCapCents } from '@/lib/sms-policy';

const reasonOf = (formData: FormData) => String(formData.get('reason') ?? '').trim().slice(0, 500);

export async function setLinksPaused(formData: FormData) {
  const op = await requireOperator();
  const paused = String(formData.get('paused') ?? '') === 'on';
  const reason = reasonOf(formData);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  await db.query('select fn_ops_set_links_paused($1, $2, $3, $4)', [paused, op.personId, op.email, reason]);
  redirect(`/ops/switches?done=${paused ? 'paused' : 'resumed'}`);
}

// Families are told (doc 15 §38). The sentence they read is written now, by
// the operator, and the switch does not run without it: the reason cannot be
// known in advance, and a breach starts the NDB clock whether or not anyone
// has been told.
export async function revokeAllLinks(formData: FormData) {
  const op = await requireOperator();
  const reason = reasonOf(formData);
  const familyReason = String(formData.get('familyReason') ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  if (familyReason.length < 10) redirect('/ops/switches?error=family');
  if (String(formData.get('confirm') ?? '').trim() !== REVOKE_ALL_PHRASE) redirect('/ops/switches?error=confirm');

  // Who is told, read before the links go: every approved guardian of an
  // affected person, and every affected person aged 16 or over. Never an
  // under-16 directly (D-19). One message per address.
  const recipients = (await db.query(
    `with affected as (
       select distinct dr.person_id from share_token st
       join development_record dr on dr.id = st.record_id
       where st.revoked_at is null)
     select distinct on (lower(email)) id, email from (
       select g.id, g.email from affected a
         join guardianship_link gl on gl.child_id = a.person_id and gl.approved_at is not null and gl.revoked_at is null
         join person g on g.id = gl.guardian_id
       union all
       select p.id, p.email from affected a join person p on p.id = a.person_id
        where p.dob is not null and fn_age_band(p.dob) <> 'u16'
     ) r where email is not null`,
  )).rows as { id: string; email: string }[];

  const n = (await db.query('select fn_ops_revoke_all_links($1, $2, $3) as n', [op.personId, op.email, reason])).rows[0].n;
  const message = linksSwitchedOffEmail(familyReason);
  for (const r of recipients) await send(message, { address: r.email, personId: r.id });
  redirect(`/ops/switches?done=revoked&n=${Number(n)}&told=${recipients.length}`);
}

// The SMS switch (0070, D-81, D-94 §10). Off or on, logged with a name and a
// reason like the other two. The environment stays the ceiling: switching on
// here cannot undo SMS_KILL_SWITCH, and lib/messaging obeys whichever is off.
export async function setSmsOff(formData: FormData) {
  const op = await requireOperator();
  const off = String(formData.get('off') ?? '') === 'on';
  const reason = reasonOf(formData);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  await db.query('select fn_ops_set_sms_off($1, $2, $3, $4)', [off, op.personId, op.email, reason]);
  redirect(`/ops/switches?done=${off ? 'sms-off' : 'sms-on'}`);
}

// A lower monthly cap, or back to the environment's. Dollars as typed, stored
// in cents. A cap above SMS_MONTHLY_CAP_CENTS is refused here, before the
// database sees it: the database may lower the ceiling and never raise it,
// and a log row recording a raise that could never take effect would be a
// record of something that did not happen.
export async function setSmsCap(formData: FormData) {
  const op = await requireOperator();
  const reason = reasonOf(formData);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  const clear = String(formData.get('clear') ?? '') === 'on';
  const envCap = smsCapCents(process.env.SMS_MONTHLY_CAP_CENTS);
  const typed = String(formData.get('dollars') ?? '');
  const cents = clear ? null : operatorCapCents(typed, null);
  if (!clear && cents === null) redirect('/ops/switches?error=cap');
  if (!clear && envCap !== null && cents !== null && cents > envCap) redirect('/ops/switches?error=cap-ceiling');
  await db.query('select fn_ops_set_sms_cap($1, $2, $3, $4)', [cents, op.personId, op.email, reason]);
  redirect(`/ops/switches?done=${clear ? 'cap-cleared' : 'cap-set'}`);
}
