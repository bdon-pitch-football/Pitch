// Operator access to the console (/ops/*).
//
// The console was production-disabled behind `notFound()` and "operator auth
// pending", because there is no operator identity anywhere in the schema —
// and inventing a roles table for a team of two would be building for a
// company we do not have.
//
// An email allowlist in the environment is the honest minimum: it is one
// variable, it is auditable, and it does not put a privilege escalation path
// in the database. OPS_EMAILS is a comma-separated list.
//
// The console still cannot read a child's development record (D-79) — that is
// enforced by what the console's own queries select, not by this gate. This
// only decides who may open the door.
import 'server-only';
import { redirect } from 'next/navigation';
import { db } from './db';
import { getSessionPersonId } from './session';
import { operatorAllowed } from './ops-policy';

export async function requireOperator(): Promise<{ personId: string; email: string }> {
  const personId = await getSessionPersonId();
  if (!personId) redirect('/signin');

  const { rows } = await db.query(`select lower(email) as email from person where id = $1`, [personId]);
  const email = rows[0]?.email as string | undefined;

  if (!operatorAllowed(email, process.env.OPS_EMAILS, process.env.NODE_ENV === 'production')) {
    redirect('/home');
  }
  return { personId, email: email as string };
}
