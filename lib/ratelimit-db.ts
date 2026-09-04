// Rate limiting that survives instance recycling (D-94 §2). Keys are hashed
// before they reach the database, so no raw address or identifier is stored.
// Callers must respond IDENTICALLY whether or not the limit bit — a
// rate-limit message is an existence oracle (doc 14 §C7).
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';

export async function checkRate(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const hash = createHash('sha256').update(key).digest();
  try {
    const { rows } = await db.query('select fn_rate_ok($1,$2,$3) as ok', [hash, max, windowSeconds]);
    return rows[0].ok === true;
  } catch {
    // Fail closed on a limiter error: better to drop a request than to open
    // an unmetered endpoint.
    return false;
  }
}
