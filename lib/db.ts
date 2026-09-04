// Privileged database access. Server-side only — importing this from client
// code is a build error (Next strips server-only), and the connection string
// is a secret (D-94 §1). In development this points at the local PGlite dev
// database (scripts/dev-db.mts); in production it is the Sydney project.
import 'server-only';
import { Pool } from 'pg';

const DEV_URL = 'postgres://postgres@127.0.0.1:54322/postgres';

const url =
  process.env.SUPABASE_DB_URL ||
  (process.env.NODE_ENV !== 'production' ? DEV_URL : undefined);

if (!url) throw new Error('SUPABASE_DB_URL is not set');

// The dev socket serves one connection at a time; a single pooled connection
// keeps behaviour identical in both environments for our query volume.
export const db = new Pool({ connectionString: url, max: 1 });
