// Profile photo upload (D-94 §7): type verified by CONTENT, never by
// extension or declared MIME; re-encoded server-side (which strips
// EXIF/GPS and neutralises payloads); hard size cap; no SVG can survive
// because the input must decode as a raster image. Dev stores under
// public/dev-uploads; production swaps in Supabase Storage behind the
// same route.
//
// S-3 (safety review, 1 Oct; D-119). Every upload used to overwrite
// player/{recordId}.jpg — the very URL an under-16's approved snapshot names
// — so a child's new photo reached every club and link-holder with no
// guardian, and a year-long immutable cache made it anybody's guess which
// face a club saw. Now each upload is a new object at a key nobody can guess
// (lib/player-photo), for every band:
//   - 16-17 and 18+: the live record IS the page, so the new photo shows at
//     once, at a URL no cache has seen.
//   - under 16, uploaded by the child: the live record, and the waiting
//     version at once (BUZ, 2 Oct), which the guardian sees on /g/pending,
//     old photo beside new. The approved snapshot keeps the photo it was
//     approved with, and that file stays, until the guardian approves.
//   - under 16, uploaded by a guardian: their own upload is its own approval
//     (John F14, 1 Oct) — lib/cv-build publishGuardianChange, which sets the
//     page's photo and nothing else (parent's change only, 2 Oct).
// The photo it replaces is deleted only once nothing still shows it.
//
// Under 18 the photo goes to the PRIVATE bucket (John's ruling §1, BUZ 1 Oct):
// the row holds a path that is not an address, and pages show it only through
// a signed one minted for an allowed read (lib/storage imageSrc). An adult's
// stays public, as their page is. The band is asked here, at the upload, and
// an answer that does not come back is treated as under 18.
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { putImage, putPrivateImage } from '@/lib/storage';
import { recordAuthor } from '@/lib/record-guard';
import { playerPhotoKey } from '@/lib/player-photo';
import { forgetPlayerPhoto, writeRecord } from '@/lib/cv-build';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  // Authorship, not visibility (N-10, doc 14 R12; John, 1 Oct): the owner,
  // or an approved guardian of an UNDER-16 — a 16–17's guardian may not set
  // their photo. recordAuthor rather than requireRecordAuthor because
  // redirect() answers a POST with a 307, which re-POSTs the upload; a form
  // post needs 303 to become a GET. Same two answers as the page guard.
  const who = await recordAuthor(recordId);
  if (who === 'no-session') return NextResponse.redirect(new URL('/signin', request.url), 303);
  if (!who) return NextResponse.redirect(new URL('/home', request.url), 303);
  const form = await request.formData();
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL(`/build/${recordId}?photo=bad`, request.url), 303);
  }
  const input = Buffer.from(await file.arrayBuffer());

  let out: Buffer;
  try {
    // decode-or-die is the content check; re-encode strips everything else
    out = await sharp(input).rotate().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer();
  } catch {
    return NextResponse.redirect(new URL(`/build/${recordId}?photo=bad`, request.url), 303);
  }

  // Storage decides where this lives; the route only knows the key. A put
  // that fails must not leave a row pointing at nothing, so the write to the
  // database happens after it and the failure is answered honestly.
  const band = (await db.query(
    `select fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  )).rows[0]?.band;
  let rel: string;
  try {
    rel = band === '18plus'
      ? await putImage(playerPhotoKey(recordId), out, 'image/jpeg')
      : await putPrivateImage(playerPhotoKey(recordId), out, 'image/jpeg');
  } catch {
    return NextResponse.redirect(new URL(`/build/${recordId}?photo=bad`, request.url), 303);
  }
  // The photo this one replaces comes back from the same statement, read
  // under the row lock, so two uploads at once each hand on the one they
  // actually replaced. The write goes through writeRecord (lib/cv-build), the
  // door every page write takes: for an under-16's guardian it publishes the
  // photo and nothing else (F14, parent's change only); for the under-16
  // themselves it opens the waiting version, which the guardian sees on
  // /g/pending before it reaches anyone (BUZ, 2 Oct) — the photo no longer
  // waits unseen on the live record to ride the next save; and for a 16–17 or
  // an adult the live record is the page.
  let replaced: string | null = null;
  await writeRecord(recordId, who, async (client) => {
    const { rows } = await client.query(
      `with before as (
         select p.id, p.photo_path from person p
         where p.id = (select person_id from development_record where id = $1)
         for update)
       update person set photo_path = $2 from before where person.id = before.id
       returning before.photo_path as replaced`,
      [recordId, rel],
    );
    replaced = (rows[0]?.replaced as string | null | undefined) ?? null;
    return { set: { photoPath: rel } };
  });
  await forgetPlayerPhoto(recordId, replaced);
  return NextResponse.redirect(new URL(`/build/${recordId}?saved=1`, request.url), 303);
}
