// DEV ONLY — mints §36/§37 undo tokens in a chosen state, for the render and
// timing suites (G-P1; John, 1 Oct).
//
// /undo/[token] must answer a used, a lapsed, an already-switched-off and a
// never-existed token with one panel, byte for byte and in the same time, and
// a live press must cost what a dead one costs. Measuring that takes hundreds
// of live tokens, one per press, and the only product path to one is a real
// send to a family with two guardians (§36) or a child-safety suspension
// (§37). The suites cannot write to the database themselves — PGlite serves
// one connection and the app holds it — so they ask the app, as they do for
// /dev/ratelimit and /dev/read-level.
//
// Each token points at a share token minted here for the record named, whose
// own raw value is thrown away: it opens nothing, so revoking it switches off
// nothing anybody holds. Nothing is sent and no consent event is written here
// (a live press writes the switch-off row, against the record named).
//
// Gated exactly as /dev/billing is: not found in production, and not found in
// a club demo. POST only, so no crawl and no link preview can reach it.
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';
import { isUuid } from '@/lib/ids';

export const dynamic = 'force-dynamic';

const KINDS = ['live', 'used', 'lapsed', 'off'] as const;
const hash = (t: string) => createHash('sha256').update(t).digest();

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || isDemo()) return new NextResponse(null, { status: 404 });
  const q = new URL(request.url).searchParams;
  const record = q.get('record') ?? '';
  const kind = q.get('kind') as (typeof KINDS)[number];
  const n = Math.min(Math.max(Number(q.get('n')) || 1, 1), 500);
  if (!isUuid(record) || !KINDS.includes(kind)) return new NextResponse(null, { status: 400 });
  const owner = (await db.query('select person_id from development_record where id = $1', [record])).rows[0]?.person_id;
  if (!owner) return new NextResponse(null, { status: 400 });
  const tokens: string[] = [];
  for (let i = 0; i < n; i++) {
    // Lapsed is the LINK's lapse: the undo follows its link's expiry (John,
    // 1 Oct, §6), so an undo whose own date has passed while its link is
    // still in date — a renewed link — is live, not lapsed.
    const link = (await db.query(
      `insert into share_token (record_id, token_hash, issued_by, expires_at, revoked_at)
       values ($1, $2, $3, case when $5 then now() - interval '1 day' else now() + interval '90 days' end,
         case when $4 then now() end) returning id`,
      [record, hash(randomBytes(32).toString('base64url')), owner, kind === 'off', kind === 'lapsed'],
    )).rows[0].id;
    const raw = randomBytes(24).toString('base64url');
    await db.query(
      `insert into undo_token (token_hash, share_token_id, issued_to, expires_at, used_at)
       values ($1, $2, $3,
         case when $4 then now() - interval '1 day' else now() + interval '90 days' end,
         case when $5 then now() end)`,
      [hash(raw), link, owner, kind === 'lapsed', kind === 'used'],
    );
    tokens.push(raw);
  }
  return NextResponse.json({ tokens });
}
