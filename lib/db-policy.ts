// How the pool connects — the decision, with no framework around it so the
// suite can run it. Same shape as ops-policy, cron-policy and reply-policy.
//
// Release seat R3 (22 Sep), both halves:
//
//   1. THE CONNECTION TO SUPABASE WAS NOT TLS-VERIFIED. `new Pool({
//      connectionString })` with nothing else connects in plaintext unless
//      the URL happens to carry an sslmode, and the URL is the worst place to
//      decide it: pg-connection-string reads `?sslmode=require` as
//      `rejectUnauthorized: false` — TLS with the certificate unchecked,
//      which is encryption against nobody. Anyone between the function and
//      Sydney can present their own certificate and read every child's
//      record in the clear. So verification is decided HERE, in code, and the
//      URL is not allowed a vote: the ssl parameters are stripped out of the
//      string before pg ever parses it (pg merges the parsed string OVER the
//      config object, so leaving them in would let the URL win).
//
//   2. THE PRODUCTION POOL WAS ONE CONNECTION. `max: 1` is the shape the
//      LOCAL dev socket needs — PGlite serves exactly one connection, and
//      lib/db explains why that one is kept warm — and it was applied
//      unconditionally, so on Vercel every concurrent request in an instance
//      queued behind a single client. That is also where LESSONS L1 stops
//      being a development annoyance and becomes a production deadlock.
//
// The two are one decision because they are both "is this the local socket
// or a real database", so they are made in one place off one answer.

/** Loopback: the PGlite dev socket (scripts/dev-db.mts) or the demo's. */
export function isLocalSocket(url: string): boolean {
  let host = '';
  try { host = new URL(url).hostname; } catch { return false; }
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}

/**
 * Anything in the connection string that could weaken or re-decide TLS.
 * Removed rather than honoured: `sslmode=require` and `sslmode=no-verify`
 * both mean "do not check the certificate" to pg, and a connection string is
 * pasted from a dashboard by a tired person at 11pm.
 */
const SSL_PARAMS = ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslnegotiation'];

export function stripSslParams(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  // Untouched when there is nothing to take out. Re-serialising a URL
  // normalises its percent-encoding, and the password is in this string —
  // a connection string we did not have to rewrite is one we cannot break.
  if (!SSL_PARAMS.some((p) => u.searchParams.has(p))) return url;
  for (const p of SSL_PARAMS) u.searchParams.delete(p);
  return u.toString();
}

export interface PoolShape {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  allowExitOnIdle: boolean;
  /** false = the local socket, which speaks no TLS. Never `{ rejectUnauthorized: false }`. */
  ssl: false | { ca?: string; rejectUnauthorized: true };
}

/**
 * The pool configuration for one connection string.
 *
 * `ca` is the certificate authority to pin — Supabase's own CA, which BUZ
 * downloads on keys day (the runbook, step 5) and which is a PUBLIC
 * certificate, not a secret. Without it we verify against Node's trust store
 * instead; that is still verify-full, it simply will not trust Supabase's own
 * CA, so a missing CA shows up as a connection that fails, never as a
 * connection that silently stops checking.
 */
export function poolConfig(url: string, opts: { ca?: string } = {}): PoolShape {
  if (isLocalSocket(url)) {
    // DEV ONLY, and unchanged: one warm connection, never closed between
    // queries. See lib/db for why idleTimeoutMillis must be 0 here.
    return { connectionString: url, max: 1, idleTimeoutMillis: 0, allowExitOnIdle: false, ssl: false };
  }
  return {
    connectionString: stripSslParams(url),
    // Small on purpose. This is per serverless instance and the ceiling that
    // matters is Supabase's pooler, not ours: a handful of connections per
    // instance times however many instances Vercel runs. Five lets an
    // instance serve concurrent requests — and lets a request that needs a
    // second query while holding a client (L1) find one instead of waiting
    // on itself forever — without any one instance hoarding the pooler.
    max: 5,
    // Not 0 here: a real database charges for an idle connection and a
    // serverless instance is idle most of its life. Ten seconds is long
    // enough that a burst of requests reuses one connection.
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: false,
    ssl: { ...(opts.ca ? { ca: opts.ca } : {}), rejectUnauthorized: true },
  };
}
