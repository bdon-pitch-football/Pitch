// Where an uploaded image actually goes.
//
// Every upload route re-encoded its image correctly and then wrote it with
// writeFileSync into public/dev-uploads, storing a local path in the
// database. That works on one laptop and nowhere else: a serverless instance
// has an ephemeral, per-invocation filesystem, so in production the write
// either vanishes at the end of the request or lands on an instance nobody
// else will ever be routed to. The club crest and banner routes were 404'd
// in production precisely because of this; the player and coach routes were
// not, and would have failed silently.
//
// So the destination becomes one function and the routes stop knowing about
// filesystems. Locally it still writes to public/dev-uploads, so the
// walkthrough is unchanged and needs no configuration. With Supabase
// configured it PUTs to Storage in the Sydney project (D-29 — images of
// children do not leave the country) and returns the public URL.
//
// D-80 NOTE, FOR BUZ AND JOHN. The service-role key was pinned by CI to
// lib/waitlist-db.ts and nowhere else, because it bypasses RLS and the point
// of the rule is that it lives in exactly one auditable place. A server-side
// Storage write genuinely needs elevated rights: the anon key is public, so
// a bucket writable by it is a bucket writable by anyone. This module is the
// second file, the CI rule now names both, and the property the rule exists
// to protect is unchanged — the key appears in a short, enumerated,
// server-only list rather than spreading. Widening D-80 from one file to two
// is a decision, not a detail, and it is flagged rather than assumed.
import 'server-only';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDemo } from './demo';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'public-images';

/**
 * True when uploads will persist. False means the local dev filesystem.
 *
 * A DEMO NEVER WRITES TO A REAL BUCKET (safety review N4a). `npm run demo`
 * blanks the keys before it starts anything, but that is the launcher's care,
 * not a property of this module: `PITCH_DEMO=1 npm run dev` with real keys in
 * .env.local would have put a crest a club typed across a table into the
 * Sydney bucket. Every other outbound module already asks isDemo() the same
 * way (lib/billing, lib/waitlist-db, lib/providers); this was the gap.
 */
export function storageConfigured(): boolean {
  return !isDemo() && Boolean(URL_BASE && KEY);
}

/**
 * Put an already re-encoded image and return the path to render it from.
 *
 * `key` is a stable path inside the bucket — 'club/crest-<id>.png'. It is
 * overwritten on re-upload, so a club replacing its crest does not leave the
 * old one behind, and the row keeps pointing at one address.
 *
 * Throws on failure rather than returning a broken path: a route that has
 * already told a club "saved" while the file went nowhere is worse than an
 * error the route can catch and answer honestly.
 */
export async function putImage(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!storageConfigured()) {
    // Local development. Same behaviour the routes had before, in one place.
    const rel = `/dev-uploads/${key.replace(/\//g, '-')}`;
    const pub = join(process.cwd(), 'public');
    mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
    writeFileSync(join(pub, rel.slice(1)), body);
    return rel;
  }

  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${KEY}`,
      'content-type': contentType,
      // Replacing a crest overwrites the same object; without this the
      // second upload 409s and the club is told to try again forever.
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`storage put failed: ${res.status}`);
  }
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${key}`;
}
