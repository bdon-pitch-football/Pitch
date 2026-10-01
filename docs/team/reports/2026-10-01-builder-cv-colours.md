# builder: club colours on the player CV, John's four conditions, switch on (2026-10-01)

Asked: build club colours on the player CV to John's four conditions (D-174), then turn `CV_WEARS_CLUB_COLOURS` on. Worktree `cv-colours`, branch `build/cv-colours` off build/floodlit `befd37b`.

Did:
- `supabase/migrations/0165_cv_club_colours.sql` (new; renumbered from 0164 on Leo's word, because live-defects takes 0164). `fn_cv_club_colours(p_person uuid) returns jsonb`, giving `{primary, secondary, state}` for the club `fn_cv_club` names, or null when the CV names no club. The membership choice is `fn_cv_club`'s (0155), word for word: role player, `ended_at is null`, club not suspended, `order by started_at desc limit 1`. **The more restrictive choice I made:** colours come back only while the club is `verified`. A claimed club gets `{primary: null, secondary: null, state}`, so a page that forgets to check the state has nothing to paint with. PlayerCV still checks the state itself (cvc2). Execute is revoked from public, anon and authenticated, following the 0083 and 0122 pattern. No new table.
- `lib/record-read.ts`: `fn_cv_club_colours($2) as colours` sits beside `fn_cv_club($2) as membership` in `assembleCv`, and the CV data returns `clubColours`/`clubState`. `CvData` is now `PlayerFixture & { clubColours?, clubState? }`. A u16 page is served from the approved snapshot, which never passes through `assembleCv`, so I added an exported `cvClubColours(personId)`. It is the only other place the function is asked, and it is laid over the snapshot on every read, so a snapshot can never carry stale colours. `wornColours(cv)` is the one way a page hands colours to PlayerCV. No other field of the read changed.
- The four PlayerCV callers each pass `{...wornColours(cv)}`: `/p/[token]`, the club register CV, the squad CV and the family preview. In the three u16 branches that call `fn_approved_cv`, the snapshot also gets `...(await cvClubColours(personId))`. The OG image, the share card and `lib/cv-meta` are untouched.
- `lib/club-colours.ts`: condition 1 is now a comment beside PRESETS, with John's reason in his words. `CV_WEARS_CLUB_COLOURS = true`.
- `app/club/page-edit/page.tsx`: the BUZ-approved picker line sits above "Save the colours", in the form's `hint` style.
- `scripts/dev-db.mts`: this only runs outside a demo, because the demo renames Riverside to a real club and must never dress it in colours that club did not pick.
  - Riverside gets the "Sky blue and navy" preset.
  - A new fixture: Thornbeck Thunder SC in Preston. It is verified, gets a player, then fails a later call (0150), so it is claimed again and still holds "Purple and gold".
  - Its player is Teodor Vance, an invented adult with no account and no guardian, with a link at `/p/dev-teodor`.
  - The name "Thornbeck Thunder SC" was already an invented club in the perms suite. Preston is on fx2's real-suburb list.

Ran (final line, one tree, uncommitted tree that is this commit; reseed → perms → render → write → reseed → layout):
perms 1979/1979 · render 673/673 · write 545/545 · layout 238 views at 375 and 1280, 0 overflow, chrome pass all green · palette ALL GREEN · corpus 0 failures · secret-scan none · gate-coverage 263/263 · tsc 0 errors · build:check exit 0 · csp-prod 5/5 · validate-migrations green. test:timing was not run, because it was not in the brief.

Tests added or changed:
- perms **cvc1** changed. The old regex (`CV club colours … John … cleared`) could never match D-174 as written. It now keys off the entry's own markup: `id D-174`, status chip `Locked`, and a title containing "current club's colours". The switch must equal that. Proved both ways: flag off with D-174 Locked fails, and D-174 set to Open with the flag on fails.
- perms **ctx4b** tightened. The card surfaces are also barred from `clubColours`, `clubState`, `cvClubColours` and `fn_cv_club_colours`.
- perms **cvcol1–5c** are new and run in their own world:
  - a verified club's colours come back;
  - a verified club with no colours gives none, and no club gives null;
  - when a player changes club through `fn_join_squad` (end old, start new), the new club's colours come back at once, then none for a club without colours, then null when the membership ends;
  - after a failed call the club is still named, its colours are gone, and the club row still holds them;
  - a suspended club gives null;
  - for a u16 with an invitation and a claim both waiting, the colours do not move; the child cannot accept alone; the guardian's yes moves them in the same transaction.
- perms **cvcol-s1, s2, s3** are new:
  - s1: the membership choice matches `fn_cv_club`'s text;
  - s2: across every person, a colours answer exists exactly when a club line does;
  - s3: no colours for any non-verified club.
- perms **cvcol6, 6b, 7, 7a, 7b** are new:
  - 6: the function is asked only in `lib/record-read`, by no database function, beside `fn_cv_club` and once for the snapshot;
  - 6b: the snapshot overlay is in place;
  - 7 and 7a: all four surfaces pass `wornColours`;
  - 7b: the only other `<PlayerCV` callers are the two fixture design previews.
- render **cvcol-r1–r5** are new:
  - r1: `/p/dev-deniz` wears the theme (hero colour `#3d7297` and `--cv-lead:#5aa7de`);
  - r2: `/p/dev-nate` (verified club, no colours) is Pitch green;
  - r3: `/p/dev-teodor` (claimed again, holds colours) names its club and carries none of its colours anywhere in the markup;
  - r4: the register CV, squad CV and preview all wear the theme;
  - r5: the link-preview meta has no hex, and the OG PNG has 0 pixels within 12 of the hero or trim. The pixel counter's self-test finds all 800 pixels on a painted image.
- write **cvcol-w0–w5** are new, pressed through the product:
  - w0: Deniz wears the colours before anything changes;
  - w1: for each of the 5 ways off the call sheet (3 suspension classes, takedown, not verified), the colours leave the preview and the link at once and come back with a verified call, while the OG image stays byte-identical in both states;
  - w2: the family's Leave takes the colours off;
  - w3: a guardian's ask still waiting on the club moves no colours;
  - w3b: the club's confirm brings them back, on the squad CV too;
  - w4: the picker line is on the form;
  - w5: the club picks claret and the CV follows; going back to Pitch green turns the CV green; a share card the parent asked for stays byte-identical throughout.
- Proved on broken code (L20):
  - flag off: r1, r4, w0, w1 ×5, w3b and w5 fail;
  - verified gates removed from both the function and PlayerCV: r3 fails;
  - function ordered `asc`: cvcol-s1 fails;
  - no verified case in the function: cvcol4 and s3 fail;
  - ended memberships counted: cvcol3c, s1 and s2 fail;
  - snapshot overlay removed: cvcol6b fails.
  - Every mutation was restored, and the tree was checked with `git diff --stat`.

Screenshots: `docs/design/reports/2026-10-01-cv-colours-shots/`, untracked: `before-colours-off-{390,1280}.png` and `after-colours-on-{390,1280}.png` of `/p/dev-deniz`, device-emulated through CDP.

Found:
1. **CLAUDE.md is stale (L25).** It still says the CV "may wear the current club's colours once John clears it (`CV_WEARS_CLUB_COLOURS` … held off)". I did not edit CLAUDE.md; that is Leo's or BUZ's.
2. **perms E11c is a proxy.** It searches everything after the first word "LinkState" in `app/p/[token]/page.tsx`, which includes the import line. So it fails on the word "club" anywhere in the live branch, not just the dead one. I passed the colours through `wornColours(cv)`, a cleaner single hand-over, and did not touch E11c. Scoping it to the dead branch would make it test what its label says; that is Leo's call, because the label carries a doc 14 row.
3. **Not mine, seen in passing.** The "Football history" now-dot and the Futsal chip stay Pitch green on a themed CV. That is correct under D-173 (green is an action) and is noted only so design is not surprised by it.

Copy for BUZ: one string, already approved on 1 Oct (APPROVALS-28-SEP): "Your colours appear on your club page, and on the CV of players who list your club as their current club." No other copy.

Risks:
- `readCvByToken` now returns `clubColours`/`clubState` on the object the OG image and `cvMetadata` also receive. They never read it (ctx4b is now stricter, and r5 and w1 check the artefact), but the data does ride along.
- `fn_cv_club` and `fn_cv_club_colours` break a tie in `started_at` the same way (they don't break it at all). Two live memberships at different clubs with the same start time could in theory resolve differently. `fn_join_squad` makes that state unreachable outside a seed.
- One extra query on the live u16 share-link read. Dead links are unchanged, so E10 is not touched, but test:timing was not run.
- The screenshots show the dev-only Next indicator, bottom left.

Lesson: a check pinned to a phrase it hopes a future document will say can only ever hold its switch one way. cvc1 could never have gone true. Key a switch to the decision's own markup (id, status, title), and prove it both ways.
