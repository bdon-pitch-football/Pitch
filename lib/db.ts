// Privileged database access. Server-side only — importing this from client
// code is a build error (Next strips server-only), and the connection string
// is a secret (D-94 §1). In development this points at the local PGlite dev
// database (scripts/dev-db.mts); in production it is the Sydney project.
import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { poolConfig } from './db-policy';
import { isDemo, DEMO_DB_URL } from './demo';

// DEV_DB_PORT lets a seat run its own dev database and app without fighting
// another seat's (LESSONS L30). Unset is the shared default, 54322, so
// nothing changes for anyone who does not set it. The demo has its own port
// and ignores this.
const DEV_URL = `postgres://postgres@127.0.0.1:${process.env.DEV_DB_PORT || '54322'}/postgres`;

// A demo reads its own local database and nothing else (lib/demo).
const url = isDemo() ? DEMO_DB_URL :
  process.env.SUPABASE_DB_URL ||
  (process.env.NODE_ENV !== 'production' ? DEV_URL : undefined);

if (!url) throw new Error('SUPABASE_DB_URL is not set');

// The certificate authority to pin for a real database (lib/db-policy). It is
// Supabase's own PUBLIC certificate, not a secret: in the environment as a
// PEM (what Vercel gets, where no repository file is guaranteed to be there
// at runtime), or the file the keys-day runbook saves locally. Absent, we
// verify against Node's trust store — still verified, just not Supabase's CA.
const ca = process.env.SUPABASE_CA_CERT || (() => {
  try { return readFileSync(join(process.cwd(), 'supabase', 'prod-ca.crt'), 'utf8'); } catch { return undefined; }
})();

// The dev socket serves ONE connection at a time, and Next dev re-evaluates
// modules on every recompile — a per-module Pool would strand dead clients
// on the single slot. One process-global pool.
//
// idleTimeoutMillis MUST be 0 on that socket: with a short timeout the pool
// closes the connection between queries and reconnects for the next one, and
// because the dev socket accepts a single connection every other request
// queues behind that churn — pages took minutes. Keeping one warm connection
// makes queries serialize cheaply instead. A real database gets the other
// shape (more than one connection, TLS verified); which one is which is
// lib/db-policy's decision, off the host.
const makePool = () => {
  const pool = new Pool(poolConfig(url, { ca }));
  pool.on('error', () => {}); // a dropped client is replaced on next query
  return pool;
};

const g = globalThis as typeof globalThis & { __pitchDbPool?: Pool };
export const db = g.__pitchDbPool ?? (g.__pitchDbPool = makePool());
