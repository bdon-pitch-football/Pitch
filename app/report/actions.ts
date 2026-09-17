'use server';
// Filing a report (D-64). Rate-limited by IP so the queue cannot be flooded;
// the response is identical either way, so a flooder learns nothing.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { checkRate } from '@/lib/ratelimit-db';

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

  if (allowed) {
    await db.query(
      `insert into report (subject_kind, subject_ref, reason, reporter_email, concern)
       values ($1,$2,$3,$4,$5)`,
      [subjectKind, subjectRef || 'unknown', reason || null, reporterEmail || null, concern],
    );
    await db.query(`insert into consent_event (event, detail) values ('report_filed', jsonb_build_object('kind', $1::text))`, [subjectKind]);
  }
  // Identical outcome whether or not the rate limit bit: a limit message is
  // an oracle, and a flooder must not be able to tell.
  redirect('/report?done=1');
}
