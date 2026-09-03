import 'server-only';

// ============================================================================
// THE ONLY FILE THAT MAY TOUCH THE WAITLIST TABLE (doc 29 §3, D-80 pattern).
// The service-role key exists here and nowhere else in the codebase — CI
// asserts it. RLS is on with no policies, so the anon key cannot read or
// write this table; every access goes through these functions.
// Never log an email address anywhere in this file.
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

const TABLE = `${SUPABASE_URL}/rest/v1/waitlist`;

export interface WaitlistInsert {
  email: string;
  role: string;
  consent_text: string;
  policy_version: string;
  source: string;
}

export type InsertResult = 'ok' | 'duplicate' | 'unconfigured' | 'error';

export async function insertWaitlist(row: WaitlistInsert): Promise<InsertResult> {
  if (!configured()) return 'unconfigured';
  const res = await fetch(TABLE, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...row, email: row.email.toLowerCase() }),
    cache: 'no-store',
  });
  if (res.ok) return 'ok';
  if (res.status === 409) return 'duplicate'; // unique on lower(email) — treat as success upstream
  return 'error';
}

/** One click sets unsubscribed_at. Idempotent; returns whether the token matched a row. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!configured()) return false;
  const res = await fetch(`${TABLE}?unsub_token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const rows: unknown[] = await res.json();
  return rows.length > 0;
}

export interface WaitlistRow {
  email: string;
  role: string;
  unsubscribed_at: string | null;
}

export async function getByToken(token: string): Promise<WaitlistRow | null> {
  if (!configured()) return null;
  const res = await fetch(
    `${TABLE}?unsub_token=eq.${encodeURIComponent(token)}&select=email,role,unsubscribed_at`,
    { headers: headers(), cache: 'no-store' },
  );
  if (!res.ok) return null;
  const rows: WaitlistRow[] = await res.json();
  return rows[0] ?? null;
}

export type UpdateResult = 'ok' | 'duplicate' | 'notfound' | 'error';

export async function updateByToken(
  token: string,
  patch: { email?: string; role?: string; unsubscribed_at?: null },
): Promise<UpdateResult> {
  if (!configured()) return 'error';
  const body: Record<string, unknown> = { ...patch };
  if (typeof body.email === 'string') body.email = body.email.toLowerCase();
  const res = await fetch(`${TABLE}?unsub_token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (res.status === 409) return 'duplicate';
  if (!res.ok) return 'error';
  const rows: unknown[] = await res.json();
  return rows.length > 0 ? 'ok' : 'notfound';
}

async function count(filter: string): Promise<number> {
  const res = await fetch(`${TABLE}?select=id${filter}`, {
    method: 'HEAD',
    headers: headers({ Prefer: 'count=exact' }),
    cache: 'no-store',
  });
  const range = res.headers.get('content-range'); // e.g. "0-24/25" or "*/0"
  const total = range?.split('/')[1];
  return total ? parseInt(total, 10) : 0;
}

export interface DigestCounts {
  newByRole: Record<string, number>;
  newTotal: number;
  total: number;
  unsubscribed: number;
}

/** Counts only — no email addresses ever leave this module for the digest (doc 29 §6). */
export async function digestCounts(sinceIso: string): Promise<DigestCounts | null> {
  if (!configured()) return null;
  const roles = ['player', 'coach', 'club', 'parent'];
  const newByRole: Record<string, number> = {};
  for (const role of roles) {
    newByRole[role] = await count(`&created_at=gt.${sinceIso}&role=eq.${role}`);
  }
  const newTotal = Object.values(newByRole).reduce((a, b) => a + b, 0);
  const total = await count('');
  const unsubscribed = await count('&unsubscribed_at=not.is.null');
  return { newByRole, newTotal, total, unsubscribed };
}
