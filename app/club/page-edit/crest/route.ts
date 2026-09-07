// Club crest upload. Same shape and the same D-94 §7 controls as the player
// photo route — type verified by DECODING the file (never by extension or
// the client's declared MIME), re-encoded through sharp so EXIF/GPS is gone
// and an SVG or a payload hidden in a container cannot survive, hard size
// cap. Dev writes under public/dev-uploads; production swaps in Supabase
// Storage behind this same route.
//
// A crest is club branding, not a person, so none of the D-25 minimisation
// tension around photos applies. The authorisation still does: only the
// people who administer the club may change how it looks in public.
import { NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ ok: false }, { status: 404 });

  const me = await getSessionPersonId();
  if (!me) return NextResponse.redirect(new URL('/signin', request.url), 303);
  const { rows } = await db.query(
    `select c.id from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (rows.length === 0) return NextResponse.redirect(new URL('/home', request.url), 303);
  const clubId = rows[0].id as string;

  const form = await request.formData();
  const file = form.get('crest');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL('/club/page-edit?crest=bad', request.url), 303);
  }

  let out: Buffer;
  try {
    // decode-or-die is the content check; the re-encode strips the rest.
    // `contain` on a transparent background, not `cover`: a crest cropped
    // square loses the badge, and a club will notice that immediately.
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return NextResponse.redirect(new URL('/club/page-edit?crest=bad', request.url), 303);
  }

  const rel = `/dev-uploads/crest-${clubId}.png`;
  mkdirSync(join(process.cwd(), 'public', 'dev-uploads'), { recursive: true });
  writeFileSync(join(process.cwd(), 'public', rel), out);
  await db.query(`update club set crest_path = $2 where id = $1`, [clubId, rel]);
  return NextResponse.redirect(new URL('/club/page-edit?saved=1', request.url), 303);
}
