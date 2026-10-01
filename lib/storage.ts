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
//
// PRIVATE IMAGES (John's ruling §1, BUZ 1 Oct). An under-18's photo goes to a
// second, PRIVATE bucket and is never given a public address: the row holds
// `pitch-private:<key>` (lib/player-photo), and a page shows it only through
// imageSrc, which mints a signed address that dies in ten minutes. Signing
// needs the same service-role key, so it lives here with the rest; nothing
// outside this file ever sees the key. Locally the private bucket is a folder
// outside public/ (.dev-private-uploads), served only by app/private-photo
// against an expiring HMAC — the same rule, so the suites prove behaviour.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDemo } from './demo.ts';
import { devPhotoUrl, devPhotoValid, isPrivatePhoto, PHOTO_URL_TTL_SECONDS, PRIVATE_PREFIX, privateKeyOf } from './player-photo.ts';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'public-images';
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? 'private-images';
const DEV_PRIVATE_DIR = () => join(process.cwd(), '.dev-private-uploads');
// One flat folder, as public/dev-uploads is: the key's slash becomes a dash.
const devPrivateFile = (key: string) => join(DEV_PRIVATE_DIR(), key.replace(/\//g, '-'));
// The dev signer's secret: the session secret, as everything signed here is.
// With none in a production build there is no dev address at all.
const devSecret = () => process.env.SESSION_SECRET
  || (process.env.NODE_ENV === 'production' ? null : 'dev-only-secret-not-for-production');

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
 * old one behind, and the row keeps pointing at one address. A PLAYER photo
 * is the exception (S-3, 1 Oct): an under-16's approved page names its photo
 * by URL, so every upload gets a key of its own (lib/player-photo) and the
 * old one goes through removeImage once nothing shows it.
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

/**
 * Put an under-18's already re-encoded image in the PRIVATE bucket, and return
 * the path to store: `pitch-private:<key>`, which is not an address and can
 * only be shown through imageSrc. Cached privately and briefly — never the
 * public bucket's year-long immutable header.
 */
export async function putPrivateImage(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!privateKeyOf(`${PRIVATE_PREFIX}${key}`)) throw new Error('storage put refused: not a private image key');
  if (!storageConfigured()) {
    mkdirSync(DEV_PRIVATE_DIR(), { recursive: true });
    writeFileSync(devPrivateFile(key), body);
    return `${PRIVATE_PREFIX}${key}`;
  }

  const res = await fetch(`${URL_BASE}/storage/v1/object/${PRIVATE_BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${KEY}`,
      'content-type': contentType,
      'x-upsert': 'true',
      'cache-control': `private, max-age=${PHOTO_URL_TTL_SECONDS}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`storage put failed: ${res.status}`);
  }
  return `${PRIVATE_PREFIX}${key}`;
}

/**
 * The address to draw a stored image from — for ONE read that has already
 * been allowed. A public path comes back as it is. A private one gets an
 * address minted now that stops working in PHOTO_URL_TTL_SECONDS. The
 * authorisation is the caller's and comes first, always: the tokenised read
 * (lib/record-read), or a session-checked read of the person's own record or
 * their child's. A read that was refused must never reach this, and a
 * switched-off link never does, so it mints nothing.
 *
 * Null when it cannot mint: the page then shows the initials, never a public
 * copy and never a broken image.
 */
export async function imageSrc(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (!isPrivatePhoto(path)) return path;
  const key = privateKeyOf(path);
  if (!key) return null;
  if (!storageConfigured()) {
    const secret = devSecret();
    return secret ? devPhotoUrl(key, Math.floor(Date.now() / 1000), secret) : null;
  }
  try {
    const res = await fetch(`${URL_BASE}/storage/v1/object/sign/${PRIVATE_BUCKET}/${key}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expiresIn: PHOTO_URL_TTL_SECONDS }),
    });
    if (!res.ok) return null;
    const { signedURL } = (await res.json()) as { signedURL?: string };
    return signedURL ? `${URL_BASE}/storage/v1${signedURL}` : null;
  } catch {
    return null;
  }
}

/**
 * The local private bucket, for app/private-photo only: the bytes behind a
 * dev address that is unexpired and untampered, else null. Nothing at all
 * once a real bucket is configured — the route is then a 404.
 */
export function devPrivateImage(key: string, e: string | null, s: string | null): Buffer | null {
  if (storageConfigured()) return null;
  const secret = devSecret();
  if (!secret || !privateKeyOf(`${PRIVATE_PREFIX}${key}`)) return null;
  if (!devPhotoValid(key, e, s, Math.floor(Date.now() / 1000), secret)) return null;
  try {
    return readFileSync(devPrivateFile(key));
  } catch {
    return null;
  }
}

/**
 * For scripts/private-photos.mts: copy one PUBLIC image into the private
 * bucket under the same key, and return its private path — or null when the
 * path is not one of ours. The public copy is left for the caller to delete
 * (removeImage) once every row points at the private one.
 */
export async function copyToPrivate(path: string): Promise<string | null> {
  if (!storageConfigured()) {
    const name = /^\/dev-uploads\/((?:player|coach)-[A-Za-z0-9._-]+\.jpg)$/.exec(path)?.[1];
    if (!name || name.includes('..')) return null;
    const key = name.replace('-', '/');
    const body = readFileSync(join(process.cwd(), 'public', 'dev-uploads', name));
    return putPrivateImage(key, body, 'image/jpeg');
  }
  const prefix = `${URL_BASE}/storage/v1/object/public/${BUCKET}/`;
  if (!path.startsWith(prefix)) return null;
  const key = path.slice(prefix.length);
  if (!privateKeyOf(`${PRIVATE_PREFIX}${key}`)) return null;
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${key}`, { headers: { authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`storage read failed: ${res.status}`);
  return putPrivateImage(key, Buffer.from(await res.arrayBuffer()), 'image/jpeg');
}

/**
 * Delete an image, given the path putImage returned for it.
 *
 * Takes the PATH, not a key, so the shape of a stored URL stays known in this
 * one file — public or `pitch-private:`, each in its own bucket. A path that is not one of ours — another host, an asset, a
 * traversal — is left alone rather than guessed at. Whether the image may go
 * at all (nothing still shows it) is the caller's question and is asked
 * before this is called: lib/cv-build forgetPlayerPhoto.
 *
 * Throws on failure, as putImage does; a caller that has already done its
 * real work catches it.
 */
export async function removeImage(path: string): Promise<void> {
  const privateKey = privateKeyOf(path);
  if (isPrivatePhoto(path) && !privateKey) return;
  if (!storageConfigured()) {
    if (privateKey) {
      rmSync(devPrivateFile(privateKey), { force: true });
      return;
    }
    const name = /^\/dev-uploads\/([A-Za-z0-9._-]+)$/.exec(path)?.[1];
    if (!name || name.includes('..')) return;
    rmSync(join(process.cwd(), 'public', 'dev-uploads', name), { force: true });
    return;
  }

  const prefix = `${URL_BASE}/storage/v1/object/public/${BUCKET}/`;
  if (!privateKey && !path.startsWith(prefix)) return;
  const [bucket, key] = privateKey ? [PRIVATE_BUCKET, privateKey] : [BUCKET, path.slice(prefix.length)];
  if (!key || key.includes('..')) return;
  const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${key}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    throw new Error(`storage remove failed: ${res.status}`);
  }
}
