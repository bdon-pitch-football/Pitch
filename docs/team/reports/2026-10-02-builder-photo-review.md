# builder: the photo gap (S-3), F14 for photos, and under-18 photos made private (2 Oct)

Asked: close S-3 so a child's new photo never reaches a club without a guardian. Every upload gets a new key, and old files are deleted only when nothing names them. Then two later additions: F14 (a guardian's upload is its own approval) and John's §1 (under-18 photos go to a private bucket with short-lived signed URLs). Last instruction: merge `build/full-release` and switch to `requireRecordAuthor` and `publishGuardianChange`. That last step is **not done**: the merge was refused by the permission system (see Stopped).

Branch `build/photo-review`, worktree `.claude/worktrees/photo-review`, commit **52eb643** on top of c95082e. Not pushed, not merged. Ports: DB 54551, app 3351, CDP 9551.

## Did

**Part 1: a new key for every upload, and the approved photo stays put**
- `lib/player-photo.ts` (new, pure, no framework, so the permission suite can run it):
  - `playerPhotoKey` makes `player/{recordId}-{128 random bits hex}.jpg`.
  - `isPlayerPhotoOf` is the only shape a record may delete. Never another record's photo, a coach photo, a crest or a traversal.
  - `PHOTO_STILL_SHOWN` is the delete rule. A photo goes only when no `person.photo_path` and no pending or approved version names it. A superseded version keeps nothing alive.
- `app/build/[recordId]/photo/route.ts`:
  - Every band gets the new key.
  - The replaced photo comes back from the same row-locked `update … returning` and is handed to `forgetPlayerPhoto`.
- `lib/cv-build.ts`:
  - `forgetPlayerPhoto` runs after commit and outside `db.connect()` (L1), and never throws.
  - It is called on upload, on a save that rewrites the pending version, and on approval. When a guardian approves, the previously approved photo is deleted.
- `lib/storage.ts`:
  - `removeImage(path)` sits next to `putImage`. It takes the stored path (public, `/dev-uploads` or private) and leaves alone any path that is not ours.
  - The key stays in this file.
- **Under 16, uploaded by the child:**
  - The upload writes the live record only, and nothing a club or link-holder reads changes.
  - The new photo reaches a club the way a clip or a stat does: the next save builds the pending version (`buildSnapshot` reads `person.photo_path`), and the guardian approves it.
  - The upload does **not** open a pending version of its own. See Stopped.
- **16–17 and adults:** the live record, unchanged, apart from the new key.
- **No migration.** The snapshot's content JSON already carries `photoPath`.

**F14 (a guardian's upload is its own approval)**
- `publishGuardianPhoto(recordId, guardianId, path)` in `lib/cv-build.ts`. **This is the function to reconcile with `publishGuardianChange` at merge.**
  - It runs one transaction and checks `fn_age_band = 'u16'` and `fn_record_actor = 'guardian'` again.
  - It moves **only** `photoPath` onto the approved version, and onto the pending one if there is one, so that approving the child's change later does not bring the old photo back.
  - It logs `edit_approved` with the guardian as actor and the child as subject. The history shows the existing line "You approved a change".
  - It sends nothing.
- Its rule differs from `publishGuardianChange` on full-release. That function snapshots the whole live record, and when a child's change is waiting it publishes nothing and joins the pending version.

**John §1 (under-18 photos private), now in scope**
- **The upload routes.** The player route and the coach route (a 16–17 MiniRoos coach writes the same `person.photo_path`) put an under-18's photo into `SUPABASE_PRIVATE_BUCKET` (default `private-images`) with `cache-control: private, max-age=600`.
  - The row stores `pitch-private:<key>`. That is not an address: a page that forgets to mint shows a broken image, never a public copy.
  - The band is asked at upload. An unknown band counts as under 18.
  - Adults and crests stay public.
- **`imageSrc(path)` in `lib/storage.ts`** returns a public path unchanged. For a private path it mints:
  - Supabase: `POST /storage/v1/object/sign/{bucket}/{key}` with `expiresIn: 600`.
  - Dev: an expiring HMAC address served by `app/private-photo/[...key]`, which reads `.dev-private-uploads/` outside `public/` and returns 404 once a bucket is configured.
  - If minting fails it returns null, so the page shows initials.
- **TTL is 600 seconds (`PHOTO_URL_TTL_SECONDS`).**
  - A page and its image load within seconds; ten minutes covers a slow phone at a ground, a print dialog left open, and a re-request on scroll.
  - A copied or logged address is dead before it travels. A day would let a switched-off link's photo outlive the switch by a day.
- **Where it mints.** Only after the read was allowed:
  - `readCvByToken` and `assembleCv`, through `withSignedPhoto`/`photoFor` in `lib/record-read.ts`;
  - the three pages that serve an approved snapshot after their own check;
  - the family's own pages.
  - A paused, revoked, expired or switched-off link returns null before any minting, so the photo stops with the page.
- **`scripts/private-photos.mts`** moves the existing public copies.
  - Order: copy into the private bucket, repoint every row (person and every version) in one transaction, then delete the public object.
  - Plan by default; `--apply` to act. It prints counts only.
  - Refuses: the shared and demo databases, a remote database without `--ca`, and a remote database with no bucket configured.
  - All bucket calls go through `lib/storage.ts` (`--conditions=react-server`), so the key name appears in no new file. D-80 is not widened.
  - Tested against dev: plan 2 → apply moved 2, 4 rows repointed, adult left alone → plan 0. The moved photo then rendered signed (200).
- **`.env.example`** documents `SUPABASE_PRIVATE_BUCKET`. **`.gitignore`** adds `/.dev-private-uploads/`.

**Every render site and its decision**

| Site | Decision |
|---|---|
| `/p/[token]` CV page and `/p/[token]/print` | Minted inside `readCvByToken` (D-80). A dead link mints nothing. |
| `/p/[token]/opengraph-image` (the CV card) | `readCvByToken(token, { photo: false })`: no photo, public or signed, ever reaches it (D-89). |
| `/c/[slug]/opengraph-image`, `/share-card/[recordId]`, `/g/card/[cardId]`, `/g/card/[cardId]/image` | No photo at all, pinned (photo14). |
| `/club/register/cv/[registrationId]`, `/club/squads/[squadId]/cv/[playerId]` | Mint after the club's own check. u16 goes through `fn_approved_cv` + `withSignedPhoto`; 16+ through `assembleCv`. |
| `/build/[recordId]/preview` | Mints after `requireRecordActor`. |
| `/build/[recordId]` (BuildForm), `/home` (own photo and each child's), the player shell, `/coach/edit` | Mint after the session check. The children list on `/home` is approved and unrevoked guardianships only. |
| `/c/[slug]` public coach page | Never mints. A private photo shows as initials. The database already refuses this page to under-18s; the only effect is that an adult who uploaded at 17 shows initials until they upload again. |
| Emails | None carry a photo (doc 14 L22). |

## Ran

Run on 52eb643's tree, with the order as briefed: reseed → `next dev -p 3351` → perms → render → write → reseed → restart → layout → the rest.
- perms **2121/2122**. The 1 failure is `jr-doc27-sync`: the root copy of doc 27 went to v1.1 at 23:38 (d7d1e78 on full-release) and this branch has v1.0. It passed on this tree before the root copy changed, it is not mine, and the merge fixes it.
- render **821/821**.
- write **628/628**.
- layout **274 views at 375 and 1280, ALL GREEN**. The seed has no photos, so layout and CSP did not draw a private photo.
- palette ALL GREEN (247 files) · `tsc --noEmit` clean · `NEXT_DIST_DIR=.next-check next build` OK · test:csp-prod **5/5** (port 3351, dev stopped) · corpus-check 0 failures · secret-scan none · gate-coverage **263/263**.

**New checks**
- perms: photo1–photo17 (photo3b, photo13b/c, photo14b included).
- write: photo-w0–w10 (w2b and w5b included).
- No label carries a doc 14 row id.

**Red on the old code** (product files put back to c95082e, new tests kept):
- perms: photo1–14b and photo16 all FAIL (21 red, including env2).
- write: w1–w10 FAIL.
  - photo-w1 shows the bug itself: after the child's upload, the club's address served the new bytes ("true,false").
  - w6 public not signed · w7 the key alone 200 · w9 a stranger and another club 200 · w10 public under-18 URLs on 30+ pages.
- These held on the old code too:
  - w0, a precondition labelled "before";
  - photo15 (a revoked guardian is no actor — a guard that already held);
  - photo17, which tests the new script, so there was no old version to fail.
- The card pin (photo14) goes red when a photo is put back into the CV card route. I tested that, then restored it.
- w2b and w5b compare the Open Graph bytes before and after a photo change.

**Two harness changes, said out loud (L32, L33)**
1. `reach()` in the write suite now skips `/private-photo/` and judges asset suffixes before the query string. React preloads each signed image with a `<link href>`, so the crawl followed two of the parent's 60 pages into images. That moved who met Jordan's register-interest form first, and the A4 hold turned ks-w0, sq2 and sq3 red. I found it by diffing the reach lists with the block on and off.
2. The dev signature is **hex**, not base64url. `token-in-url.mjs` knows a share token by base64url shape and flagged the dev signature as a token in a link. Supabase's real signature is a dotted JWT that does not match either. I did not loosen the watcher. Leo, it is your call whether signed photo addresses belong in its scope.

## Stopped

1. **The guardian's review screen cannot show a pending photo without new words** (brief part 2).
   - `/g/pending` shows only the About diff, and `if (!done && !r.pending_about)` treats a blank About as "Nothing is waiting on you". A pending version with an empty About can never be approved from that screen.
   - So a child's upload does not open a pending version yet. It rides the next save, as clips and stats do today, and is approved without being seen on that screen. Clips and stats are already approved the same way.
   - Options for BUZ:
     - (a) A photo section on `/g/pending` (proposed words: "The photo", with "No photo yet" as its empty state), plus an existence check instead of `pending_about`. Then the upload creates or joins the pending version and the §30 email goes out.
     - (b) Keep the current path.
2. **`git merge build/full-release` was refused by the permission system** ("Git Destructive"). I have not worked around it. After the merge (BUZ or Leo runs it, or grants it):
   - Resolve conflicts in `lib/cv-build.ts` and both suites.
   - Photo route: `recordActor` → an author check on `fn_record_author`. It must answer 303 `/signin` as today, so not `requireRecordAuthor`'s `redirect()`, which would 307 a POST.
   - Replace `publishGuardianPhoto` with `publishGuardianChange(recordId, who.personId)`, called after the person update. Read the approved and pending `photoPath`s before the call and pass them to `forgetPlayerPhoto` after it.
   - Retire perms photo8–10 and add: the route calls `publishGuardianChange` only for a guardian author; a 16–17's guardian upload is refused (R12, red on 52eb643).
   - Rewrite write photo-w2 (the history line becomes "{guardian first name} changed the page.") and photo-w3 (the guardian's photo now **joins** a waiting child's version and publishes on approval).
   - Rerun everything.
3. **No migration.** 0169 is full-release's; I need none.

## Found (out of lane)

- `approvePendingVersion` writes `edit_approved` with no `subject_id`, so `fn_consent_timeline` never shows a guardian's approval in the family history. This may already be fixed on full-release.
- **D-26 leaves photos behind.** `fn_erase_child` deletes rows, but no storage object, public or private, is removed. CLAUDE.md says photos are deleted in that cascade. `removeImage` exists now, so the fix is small.
- **Production data.** Any under-16 whose photo changed after approval under the old code has an approved snapshot naming `player/{rid}.jpg`, and that key now holds the newer, unapproved photo. The bytes that were approved are gone. Re-approval is a product decision.
- The adult coach photo still overwrites a fixed public key served immutable for a year. A minor's coach photo now gets a new key each time, but the old one is not deleted.
- After a child's photo-only upload, the build page says just "Saved.". Nothing tells the child it waits until they save the form.

## Copy for BUZ

None added or removed. The dev-only `/private-photo` route answers "Not found" with a 404; it never runs in production. The proposed /g/pending words are listed above and are not built.

## Risks

- Production signing is untested against a real bucket. The `/object/sign` call and its `signedURL` response shape follow storage-api / supabase-js, and dev models only the rule.
- A deleted public object may stay in Supabase's CDN cache for a while.
- Every live under-18 CV read now makes one sign call, two on `/p/[token]` (metadata and body). `test:timing` was not run.
- A save running at the same moment as an upload could snapshot a photo the upload has just deleted. The window is small, and the page falls back to initials.

## GO-LIVE (in this order)

1. **Before the push:** create the bucket `private-images` in the Sydney project, **private**.
2. **Before the push:** set `SUPABASE_PRIVATE_BUCKET=private-images` in Vercel Production.
3. **Push/deploy.** If the bucket or the variable is missing, under-18 uploads answer "That file didn't work" and photos show as initials.
4. **Straight after the deploy:**
   ```
   node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.production-db.local scripts/private-photos.mts --ca supabase/prod-ca.crt
   ```
   - The env file needs `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, the service-role key and `SUPABASE_PRIVATE_BUCKET`.
   - Run it again with `--apply`, then once more as a plan, which must read 0.
   - Run before the deploy, the old code would show broken images.

Lesson: an image address with a query string is not a page. Any crawler that filters assets by the end of the URL breaks the moment the address is signed.
