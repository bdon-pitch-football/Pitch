'use server';
// Register interest (D-108) — the u16 path: the child composes, the request
// routes to the guardian. The one line is capped at 140 and the guardian
// reads it before anything goes anywhere.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export async function composeInterest(recordId: string, formData: FormData) {
  const clubId = String(formData.get('clubId') ?? '');
  const squadId = String(formData.get('squadId') ?? '') || null;
  const positions = String(formData.get('positions') ?? '').split(',').filter(Boolean).slice(0, 3);
  const note = String(formData.get('note') ?? '').trim().slice(0, 140);
  if (!clubId) redirect(`/register-interest/${recordId}?error=1`);

  const { rows } = await db.query(
    `insert into registration_request (record_id, club_id, squad_target, positions, note)
     values ($1,$2,$3,$4,$5) returning id`,
    [recordId, clubId, squadId, positions, note || null],
  );
  await db.query(
    `insert into consent_event (event, subject_id, detail)
     select 'registration_created', dr.person_id, jsonb_build_object('request_id', $2::uuid, 'stage', 'requested')
     from development_record dr where dr.id = $1`,
    [recordId, rows[0].id],
  );
  redirect(`/register-interest/${recordId}?asked=1`);
}
