// Where a player's photo lives, and when an old one may go — the decisions,
// with no framework around them so the permission suite can run them.
//
// S-3 (safety review, 1 Oct). Every upload used to land on the one fixed key
// player/{recordId}.jpg, and an under-16's APPROVED snapshot names that same
// URL. So a new photo replaced the face every club and link-holder saw, with
// no pending version and no guardian (D-119) — and the object is served
// `immutable` for a year, so a CDN could equally keep the old face, and
// nobody could say which one a club was looking at.
//
// Now every upload is a new object with a name nobody can guess. A snapshot
// that names a photo keeps that photo for as long as the snapshot is served,
// and a new photo is only ever a new URL, which no cache has seen.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Under-18 photos are PRIVATE (John's ruling §1, BUZ 1 Oct: "put the public
// bucket fix in this release"; CLAUDE.md §7, signed URLs with short expiry).
// A public URL outlives the link it was found through: switch a CV link off
// and anyone who ever opened it, or copied the image address, could keep
// opening the child's face for good. So an under-18's photo lives in a
// private bucket, and the stored path is not a URL at all — it is
// `pitch-private:<key>`, which no browser can load. The only way to show it
// is an address minted for one read, after that read was allowed
// (lib/storage imageSrc), and it dies in PHOTO_URL_TTL_SECONDS. A switched-off
// link mints nothing, so the photo stops with the page.
// ---------------------------------------------------------------------------

export const PRIVATE_PREFIX = 'pitch-private:';

/**
 * Ten minutes. A page is read and its photo fetched within seconds; ten
 * minutes covers a slow phone at a ground, a print dialog left open, and a
 * browser that re-requests the image on scroll. A copied address, or one left
 * in a history or a log, is dead before it can travel far. Minutes, not
 * days: a day would let a switched-off link's photo outlive the switch by a
 * day.
 */
export const PHOTO_URL_TTL_SECONDS = 600;

export const isPrivatePhoto = (path: string | null | undefined): path is string =>
  typeof path === 'string' && path.startsWith(PRIVATE_PREFIX);

/** The bucket key behind a private path, or null if it is not a well-formed one. */
export function privateKeyOf(path: string): string | null {
  if (!isPrivatePhoto(path)) return null;
  const key = path.slice(PRIVATE_PREFIX.length);
  return /^(player|coach)\/[A-Za-z0-9._-]+\.jpg$/.test(key) && !key.includes('..') ? key : null;
}

// The local model of a signed URL (no bucket in development): an HMAC over
// the key and its expiry, checked by app/private-photo. The same two
// properties as Supabase's: whoever holds it may fetch it, and only until it
// expires. The permission is asked where it is minted, never where it is
// fetched — exactly as with the real thing.
// Hex, not base64url: a share token is base64url, and the suites' watch for a
// token in an address (scripts/token-in-url.mjs) knows it by that shape. A
// photo signature is a different credential — ten minutes, one image — and
// Supabase's own (a JWT, dotted) does not take that shape either.
const devSig = (key: string, exp: number, secret: string) =>
  createHmac('sha256', secret).update(`private-photo\n${key}\n${exp}`).digest('hex');

export function devPhotoUrl(key: string, nowSeconds: number, secret: string): string {
  const exp = nowSeconds + PHOTO_URL_TTL_SECONDS;
  return `/private-photo/${key}?e=${exp}&s=${devSig(key, exp, secret)}`;
}

/** True only for an unexpired, untampered address minted by devPhotoUrl. */
export function devPhotoValid(key: string, e: string | null, s: string | null, nowSeconds: number, secret: string): boolean {
  const exp = Number(e);
  if (!Number.isInteger(exp) || !s || exp <= nowSeconds || exp > nowSeconds + PHOTO_URL_TTL_SECONDS) return false;
  const want = Buffer.from(devSig(key, exp, secret));
  const got = Buffer.from(s);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * A fresh bucket key for one upload: player/{recordId}-{128 random bits}.jpg.
 * Never reused and never derivable from the record, so one photo's URL says
 * nothing about where the next one is.
 */
export function playerPhotoKey(recordId: string): string {
  return `player/${recordId}-${randomBytes(16).toString('hex')}.jpg`;
}

/**
 * An under-18 coach's photo (app/coach/edit/photo): private, and like the
 * player's, a new object every time rather than one key overwritten in place.
 */
export function coachPhotoKey(personId: string): string {
  return `coach/photo-${personId}-${randomBytes(16).toString('hex')}.jpg`;
}

/**
 * True when a stored photo path is one of THIS record's player photos — a
 * key playerPhotoKey made, or the fixed key every upload used before it —
 * in any form storage returns (the public bucket URL, /dev-uploads locally
 * where the slash becomes a dash, or a private path). Nothing else is ever deleted on a
 * record's behalf: not a coach photo (the coach route's own object), not
 * another record's, not a crest.
 */
export function isPlayerPhotoOf(recordId: string, path: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) return false;
  const name = new RegExp(`(?:^/dev-uploads/player-|^${PRIVATE_PREFIX}player/|/player/)${recordId}(?:-[0-9a-f]{32})?\\.jpg$`, 'i');
  return name.test(path) && !path.includes('..');
}

/**
 * Does anything that can still be shown name this photo? The live record
 * (anybody's person.photo_path), or a pending or approved version — the
 * approved one is what a club reads while a page is held (under 16, and from
 * 16 until the player's own first write: fn_cv_held, 0174), and the pending
 * one is what the guardian is about to approve. A superseded version is served to
 * nobody and keeps nothing alive. $1 is the stored path.
 */
export const PHOTO_STILL_SHOWN = `
  select exists (select 1 from person where photo_path = $1)
      or exists (select 1 from profile_version
                 where status in ('pending', 'approved') and content ->> 'photoPath' = $1) as shown`;

// ---------------------------------------------------------------------------
// Moving the public copies (scripts/private-photos.mts). Every distinct
// public photo path an under-18 is shown by today: the live record, and any
// version of their page that names it. The band is asked of the database at
// the moment of the run, never stored.
// ---------------------------------------------------------------------------
export const UNDER_18_PUBLIC_PHOTOS = `
  select distinct path from (
    select p.photo_path as path from person p
    where p.photo_path is not null and fn_age_band(p.dob) <> '18plus'
    union all
    select pv.content ->> 'photoPath' from profile_version pv
    join development_record dr on dr.id = pv.record_id
    join person p on p.id = dr.person_id
    where pv.content ->> 'photoPath' is not null and fn_age_band(p.dob) <> '18plus'
  ) named
  where path not like '${PRIVATE_PREFIX}%'`;

/** Repoint every row that names $1 to $2: the live record and every version. */
export const REPOINT_PHOTO = [
  `update person set photo_path = $2 where photo_path = $1`,
  `update profile_version set content = jsonb_set(content, '{photoPath}', to_jsonb($2::text)) where content ->> 'photoPath' = $1`,
] as const;
