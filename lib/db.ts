// Privileged database access. Server-side only — importing this from client
// code is a build error (Next strips server-only), and the connection string
// is a secret (D-94 §1). In development this points at the local PGlite dev
// database (scripts/dev-db.mts); in production it is the Sydney project.
import 'server-only';
import { Pool } from 'pg';
import { isDemo, DEMO_DB_URL } from './demo';

const DEV_URL = 'postgres://postgres@127.0.0.1:54322/postgres';

// A demo reads its own local database and nothing else (lib/demo).
const url = isDemo() ? DEMO_DB_URL :
  process.env.SUPABASE_DB_URL ||
  (process.env.NODE_ENV !== 'production' ? DEV_URL : undefined);

if (!url) throw new Error('SUPABASE_DB_URL is not set');

// The dev socket serves ONE connection at a time, and Next dev re-evaluates
// modules on every recompile — a per-module Pool would strand dead clients
// on the single slot. One process-global pool.
//
// idleTimeoutMillis MUST be 0 here: with a short timeout the pool closes the
// connection between queries and reconnects for the next one, and because the
// dev socket accepts a single connection every other request queues behind
// that churn — pages took minutes. Keeping one warm connection makes queries
// serialize cheaply instead. Production (Supabase) raises max and this
// setting stops mattering.
const makePool = () => {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 0,
    allowExitOnIdle: false,
  });
  pool.on('error', () => {}); // a dropped client is replaced on next query
  return pool;
};

const g = globalThis as typeof globalThis & { __pitchDbPool?: Pool };
export const db = g.__pitchDbPool ?? (g.__pitchDbPool = makePool());
