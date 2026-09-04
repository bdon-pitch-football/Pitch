// Profile photo upload (D-94 §7): type verified by CONTENT, never by
// extension or declared MIME; re-encoded server-side (which strips
// EXIF/GPS and neutralises payloads); hard size cap; no SVG can survive
// because the input must decode as a raster image. Dev stores under
// public/dev-uploads; production swaps in Supabase Storage behind the
// same route.
import { NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { db } from '@/lib/db';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ ok: false }, { status: 404 });
  const { recordId } = await params;
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

  const rel = `/dev-uploads/${recordId}.jpg`;
  mkdirSync(join(process.cwd(), 'public', 'dev-uploads'), { recursive: true });
  writeFileSync(join(process.cwd(), 'public', rel), out);
  await db.query(
    `update person set photo_path = $2 where id = (select person_id from development_record where id = $1)`,
    [recordId, rel],
  );
  return NextResponse.redirect(new URL(`/build/${recordId}?saved=1`, request.url), 303);
}
