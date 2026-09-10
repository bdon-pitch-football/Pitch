'use server';
// Approving a share card. The image is rendered behind sign-in for the
// guardian to see, hashed, and only then given a path. Once approved it
// cannot be recalled — the product says so rather than implying a control
// we do not have (doc 14 §Q8).
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

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
export async function approveCard(formData: FormData) {
  const cardId = String(formData.get('cardId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select sca.id, sca.card_kind, dr.id as record_id
     from share_card_approval sca
     join development_record dr on dr.id = sca.record_id
     join person c on c.id = dr.person_id
     join guardianship_link g on g.child_id = c.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where sca.id = $1 and sca.approved_at is null`,
    [cardId, me],
  );
  if (rows.length === 0) redirect('/home');

  // Hash what was shown, so the artefact that leaves is byte-identical to
  // the artefact that was approved (doc 14 §Q2).
  const shown = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/g/card/${cardId}/image`,
  ).then((r) => r.arrayBuffer()).catch(() => null);
  const hash = shown ? createHash('sha256').update(Buffer.from(shown)).digest() : null;

  await db.query(
    `update share_card_approval set approved_by = $2, approved_at = now(), image_hash = $3,
       storage_path = $4 where id = $1`,
    [cardId, me, hash, `/g/card/${cardId}/image`],
  );
  await db.query(
    `insert into consent_event (event, actor_id, detail) values ('card_approved', $1, jsonb_build_object('card_id', $2::uuid))`,
    [me, cardId],
  );
  redirect(`/g/card/${cardId}?approved=1`);
}
