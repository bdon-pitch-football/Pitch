// Coach banner upload — the club banner route's twin, and the same D-94 §7
// controls: decoded to verify the type, re-encoded so EXIF/GPS and anything
// hidden in the container do not survive, hard cap, authorisation checked
// server-side against the caller's OWN profile.
//
// `cover` at 1600x500 like the club's: a banner is meant to be cropped to a
// wide strip, and a letterboxed one looks broken.
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { putImage } from '@/lib/storage';
import { getSessionPersonId } from '@/lib/session';

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const me = await getSessionPersonId();
  // 303, not redirect(): a POST answered with a 307 is re-POSTed at the
  // destination, which would send the upload to /signin.
  if (!me) return NextResponse.redirect(new URL('/signin', request.url), 303);
  const { rows } = await db.query(`select id from coach_profile where person_id = $1`, [me]);
  if (rows.length === 0) return NextResponse.redirect(new URL('/home', request.url), 303);
  const profileId = rows[0].id as string;

  const form = await request.formData();
  const file = form.get('banner');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL('/coach/edit?banner=bad', request.url), 303);
  }

  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1600, 500, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.redirect(new URL('/coach/edit?banner=bad', request.url), 303);
  }

  let rel: string;
  try {
    rel = await putImage(`coach/banner-${profileId}.jpg`, out, 'image/jpeg');
  } catch {
    return NextResponse.redirect(new URL('/coach/edit?banner=bad', request.url), 303);
  }
  await db.query(`update coach_profile set banner_path = $2 where id = $1`, [profileId, rel]);
  return NextResponse.redirect(new URL('/coach/edit?saved=banner', request.url), 303);
}
