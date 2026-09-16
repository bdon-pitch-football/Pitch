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

const reasonOf = (formData: FormData) => String(formData.get('reason') ?? '').trim().slice(0, 500);

export async function setLinksPaused(formData: FormData) {
  const op = await requireOperator();
  const paused = String(formData.get('paused') ?? '') === 'on';
  const reason = reasonOf(formData);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  await db.query('select fn_ops_set_links_paused($1, $2, $3, $4)', [paused, op.personId, op.email, reason]);
  redirect(`/ops/switches?done=${paused ? 'paused' : 'resumed'}`);
}

export async function revokeAllLinks(formData: FormData) {
  const op = await requireOperator();
  const reason = reasonOf(formData);
  if (reason.length < 3) redirect('/ops/switches?error=reason');
  if (String(formData.get('confirm') ?? '').trim() !== REVOKE_ALL_PHRASE) redirect('/ops/switches?error=confirm');
  const n = (await db.query('select fn_ops_revoke_all_links($1, $2, $3) as n', [op.personId, op.email, reason])).rows[0].n;
  redirect(`/ops/switches?done=revoked&n=${Number(n)}`);
}
