// Coach photo upload. The player photo route's twin, and it carries the same
// D-94 §7 controls: the type is verified by CONTENT (it must decode as a
// raster image), the file is re-encoded so EXIF/GPS and anything hidden in
// the container do not survive, there is a hard cap, and authorisation is
// checked server-side before a byte is written.
//
// Coaches had no photo at all — players have one and clubs have a crest and
// a banner, so a coach was the only profile in the product rendering
// initials. They are also adults publishing their own likeness on their own
// CV, which is the least fraught photo here.
//
// It writes person.photo_path, the same column the player CV reads. One
// photo per person, whichever hat they are wearing — so a 16–17 who coaches
// MiniRoos puts their face on their PLAYER page through this route too. Under
// 18 it goes to the private bucket at a key of its own, exactly as the player
// route does it (John's ruling §1, BUZ 1 Oct; lib/player-photo).
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { putImage, putPrivateImage } from '@/lib/storage';
import { coachPhotoKey } from '@/lib/player-photo';
import { getSessionPersonId } from '@/lib/session';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const me = await getSessionPersonId();
  // 303 rather than redirect(): a POST answered with a 307 is re-POSTed at
  // the destination, which would send the upload to /signin.
  if (!me) return NextResponse.redirect(new URL('/signin', request.url), 303);
  // It is their own coach profile or nothing. There is no path here that
  // takes a person id from the caller (D-94 §3).
  const { rows } = await db.query(`select id from coach_profile where person_id = $1`, [me]);
  if (rows.length === 0) return NextResponse.redirect(new URL('/home', request.url), 303);

  const form = await request.formData();
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL('/coach/edit?photo=bad', request.url), 303);
  }

  let out: Buffer;
  try {
    // decode-or-die is the content check; the re-encode strips the rest
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 86 })
      .toBuffer();
  } catch {
    return NextResponse.redirect(new URL('/coach/edit?photo=bad', request.url), 303);
  }

  const adult = (await db.query(`select fn_age_band(dob) = '18plus' as adult from person where id = $1`, [me])).rows[0]?.adult === true;
  let rel: string;
  try {
    rel = adult
      ? await putImage(`coach/photo-${me}.jpg`, out, 'image/jpeg')
      : await putPrivateImage(coachPhotoKey(me), out, 'image/jpeg');
  } catch {
    return NextResponse.redirect(new URL('/coach/edit?photo=bad', request.url), 303);
  }
  await db.query(`update person set photo_path = $2 where id = $1`, [me, rel]);
  return NextResponse.redirect(new URL('/coach/edit?saved=photo', request.url), 303);
}
