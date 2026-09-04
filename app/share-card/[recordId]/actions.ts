'use server';
// Asking for a share card (D-101 as amended). NOTHING is generated here —
// no image, no URL. A request row is all that exists until a guardian has
// seen the exact artefact and said yes.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { shareCardWaitingEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function requestCard(recordId: string, formData: FormData) {
  const shape = String(formData.get('shape') ?? 'story');
  const kinds = ['story', 'square', 'landscape'];
  const cardKind = kinds.includes(shape) ? shape : 'story';

  await db.query(
    `insert into share_card_approval (record_id, requested_by, card_kind)
     select $1, dr.person_id, $2 from development_record dr where dr.id = $1`,
    [recordId, cardKind],
  );
  await db.query(
    `insert into consent_event (event, subject_id, detail)
     select 'card_requested', dr.person_id, jsonb_build_object('kind', $2::text)
     from development_record dr where dr.id = $1`,
    [recordId, cardKind],
  );

  // doc 15 §29 — and the email carries NO preview: generating the preview
  // is generating the image, before anyone approved it.
  const g = await db.query(
    `select p2.email, c.first_name from development_record dr
     join person c on c.id = dr.person_id
     join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
     join person p2 on p2.id = gl.guardian_id
     where dr.id = $1 and p2.email is not null limit 1`,
    [recordId],
  );
  if (g.rows[0]) await send(shareCardWaitingEmail(g.rows[0].first_name), { address: g.rows[0].email });

  redirect(`/share-card/${recordId}?asked=1`);
}
