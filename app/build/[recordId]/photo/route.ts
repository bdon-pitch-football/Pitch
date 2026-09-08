// Profile photo upload (D-94 §7): type verified by CONTENT, never by
// extension or declared MIME; re-encoded server-side (which strips
// EXIF/GPS and neutralises payloads); hard size cap; no SVG can survive
// because the input must decode as a raster image. Dev stores under
// public/dev-uploads; production swaps in Supabase Storage behind the
// same route.
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { putImage } from '@/lib/storage';
import { recordActor } from '@/lib/record-guard';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  // This was closed by a production 404 and nothing else — a deploy flag
  // where an authorisation check belongs. recordActor rather than
  // requireRecordActor because redirect() answers a POST with a 307, which
  // re-POSTs the upload at /signin; a form post needs 303 to become a GET.
  if (!(await recordActor(recordId))) {
    return NextResponse.redirect(new URL('/signin', request.url), 303);
  }
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
  let rel: string;
  try {
    rel = await putImage(`player/${recordId}.jpg`, out, 'image/jpeg');
  } catch {
    return NextResponse.redirect(new URL(`/build/${recordId}?photo=bad`, request.url), 303);
  }
  await db.query(
    `update person set photo_path = $2 where id = (select person_id from development_record where id = $1)`,
    [recordId, rel],
  );
  return NextResponse.redirect(new URL(`/build/${recordId}?saved=1`, request.url), 303);
}
