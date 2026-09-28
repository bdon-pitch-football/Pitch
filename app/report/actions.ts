'use server';
// Filing a report (D-64). Every report is SAVED, whatever the rate limit says,
// and the response is identical either way, so a flooder learns nothing.
//
// Until 28 Sep the limit gated the insert itself: the eleventh report from one
// address in an hour was never written, and the person was still told "We've
// received your report". For sign-in that silence is right. For a report about
// a child it meant a real concern could vanish with the reporter believing it
// had arrived. John ruled it, BUZ chose it: no report is ever lost (doc 35 5a).
//
// The limit now gates only the one side effect worth limiting — the
// confirmation email. That goes to an address the REPORTER typed, so an
// unlimited send would make this form a way to mail anybody from our domain.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { checkRate } from '@/lib/ratelimit-db';
import { reportReceivedEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function fileReport(formData: FormData) {
  const subjectRef = String(formData.get('subjectRef') ?? '').slice(0, 200);
  const subjectKindRaw = String(formData.get('subjectKind') ?? 'other');
  const kinds = ['player_cv', 'coach_cv', 'club_page', 'trial_notice', 'other'];
  const subjectKind = kinds.includes(subjectKindRaw) ? subjectKindRaw : 'other';
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 2000);
  const reporterEmail = String(formData.get('reporterEmail') ?? '').trim().slice(0, 200);
  const concernRaw = String(formData.get('concern') ?? 'other');
  const concern = ['child_account', 'own_child', 'family_safety', 'other'].includes(concernRaw) ? concernRaw : 'other';

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const allowed = await checkRate(`report:${ip}`, 10, 60 * 60);

  await db.query(
    `insert into report (subject_kind, subject_ref, reason, reporter_email, concern)
     values ($1,$2,$3,$4,$5)`,
    [subjectKind, subjectRef || 'unknown', reason || null, reporterEmail || null, concern],
  );
  await db.query(`insert into consent_event (event, detail) values ('report_filed', jsonb_build_object('kind', $1::text))`, [subjectKind]);
  if (allowed) {
    // doc 15 §7, only when they left an address. The page is described by
    // kind, never by anything the report carried.
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reporterEmail)) {
      const what: Record<string, string> = {
        player_cv: "a player's page", coach_cv: 'a coach page', club_page: 'a club page', trial_notice: 'a trial notice', other: 'a page on Pitch',
      };
      await send(reportReceivedEmail(what[subjectKind]), { address: reporterEmail });
    }
  }
  // Identical outcome whether or not the rate limit bit: a limit message is
  // an oracle, and a flooder must not be able to tell.
  redirect('/report?done=1');
}
