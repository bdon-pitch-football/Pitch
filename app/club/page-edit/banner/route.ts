// Club banner upload. Same D-94 §7 controls as the crest and the player
// photo — decoded to verify the type, re-encoded so EXIF/GPS is stripped and
// nothing hidden in the container survives, hard cap, authorisation checked
// server-side.
//
// `cover` here where the crest uses `contain`: a banner is meant to be
// cropped to a wide strip, and a letterboxed one looks broken.
import { NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

const MAX_BYTES = 12 * 1024 * 1024;

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
  const file = form.get('banner');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL('/club/page-edit?banner=bad', request.url), 303);
  }

  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1600, 500, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.redirect(new URL('/club/page-edit?banner=bad', request.url), 303);
  }

  const rel = `/dev-uploads/banner-${clubId}.jpg`;
  mkdirSync(join(process.cwd(), 'public', 'dev-uploads'), { recursive: true });
  writeFileSync(join(process.cwd(), 'public', rel), out);
  await db.query(`update club set banner_path = $2 where id = $1`, [clubId, rel]);
  return NextResponse.redirect(new URL('/club/page-edit?saved=banner', request.url), 303);
}
