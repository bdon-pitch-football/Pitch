# Trials desk prompts: the open-now changes (3 Oct 2026)

The two desk prompts, `trials-watch` and `trials-check`, are **not in this repo**. They live in `Pitch 3.0/.claude/agents/` and the scheduled runs read them directly, so editing them changes what tomorrow's 5:30am sweep does. These changes were therefore written as diffs and **not applied**.

**Apply both diffs at the same time as production gets three things:** migration 0173, `scripts/sync-trials.mjs` and `scripts/check-trial-links.mjs` from `build/open-now`. If the prompts go first, the desk writes open-now rows that production can't store. If the code goes first, nothing breaks, because the desk just writes no open-now rows yet.

The rules themselves are in `TRIALS-DESK.md`, under "Open now". These diffs carry those rules into the prompts and add `form_url` to the changes header. They create no scheduled task and change none.

## trials-watch.md

```diff
@@ -9,26 +9,41 @@
 
 ## What you do
 
-**For every notice in the export for your clubs** (`notice_id, club, slug, title, ages, gender, trial_on, time_venue, source_url, last_checked`), open its `source_url` (and the club's own trials/EOI/news page if the source moved) and write exactly one row:
+**For every notice in the export for your clubs** (`notice_id, club, slug, title, ages, gender, trial_on, time_venue, source_url, last_checked, form_url, confirmed_open_at, lapsed`), open its `source_url` (and the club's own trials/EOI/news page if the source moved) and write exactly one row. A notice with a blank `trial_on` is an **open-now EOI** (see below): in `notices` mode skip it; in `sweep` mode re-read it every time.
 - `check` — the club's page still says this date, time, venue and ages.
 - `edit` — the club's page now gives a different date, time, venue, ages or gender. Give the FULL corrected row. Keep the existing `title` unless the old title is now false (then write a new one in our words — it will wait for BUZ).
 - `gone` — the club has taken the notice down, cancelled it, or says it is full/closed. Say why in `reason`.
 - **Multi-session trials (BUZ, 1 Oct):** a notice carries ONE date — the next session. When its `trial_on` is today or past and the club's own page lists later sessions of the same trial, write an `edit` moving `trial_on` (and `time`/`ground` if that session differs) to the next session still to come, title unchanged — so a trial never drops off the board while it still has sessions to run. On the notice's own date, move it only in the morning sweep if today's session has already happened (it hasn't at 5:30am, so leave today's date until tomorrow's sweep).
 - If you cannot read the page today (timeout, login wall, script-only), write NO row for that notice and list it in your notes — never guess, never `gone` a page you could not read.
 
-**In `sweep` mode only**, also look for notices we don't have: each club's own trials/EOI/registration/news pages, the club's own social posts if readable, and the watch list (`content/sales/pipeline/trials-vic-2026-held.csv`, the undated EOIs in `trials-vic-2026-*-notes.md`). Write `add` rows for new notices dated tomorrow or later.
+## Open-now EOIs — no closing date (BUZ, 3 Oct; John, 3 Oct)
+An EOI whose club states no closing date is listed as **Open now** while we keep seeing its form open. It comes off by itself **seven days after the last `check`**, so in `sweep` mode re-read every one, every morning. One marked `lapsed` = `yes` stays down: never `check` or `edit` it.
+- `check` only if ALL still hold: the club's page (`source_url`) still links the form, still names 2027, the ages are unchanged, and the form (`form_url`) is taking responses **read logged out**. Never sign in, never submit. Never `check` one marked `lapsed` — it is refused.
+- `gone` (say which in `reason`): the form says closed, unavailable, full or "no longer accepting responses"; the club's page says closed, full or "trials have been held"; **the club's page no longer links the form** (even if the form is still open); the page or form now names another season or no ages; the page or form is dead.
+- `edit` with `trial_on` (and `time` `EOI closes`): the club now states a real closing date. Title unchanged.
+- A form that needs a sign-in, or a page you cannot read: NO row. Never guess.
+- Trial dates appear: an `add` for the trial (it waits for BUZ); the EOI stays while its form is open.
+- A `lapsed` one whose form is open again: a `gone` for the lapsed row AND a fresh open-now `add` (it goes on BUZ's new list). Never a `check`.
 
+**In `sweep` mode only**, also look for notices we don't have: each club's own trials/EOI/registration/news pages, the club's own social posts if readable, and the watch list (`content/sales/pipeline/trials-vic-2026-held.csv`, the undated EOIs in `trials-vic-2026-*-notes.md`). Write `add` rows for new notices dated tomorrow or later, and for open-now EOIs that pass the open-now test below.
+
 ## The strict test — an `add` or `edit` goes in only if ALL hold
 - The source is the club's own page, post or form (linked from the club's own site or social). No aggregators, no news sites.
 - The club's own pages agree with each other on the date, time and venue. If they disagree, no row — note it.
 - The weekday, if stated, matches the date.
 - The venue is in the notice (for an online EOI, ground is `Online — see the club's notice`).
 - The age groups are stated by the club, not inferred. A range the club states ("U7 to U21") is stated.
-- An EOI has a real closing date — not a booking-system default (a year out, 31 Dec, after the season ends).
+- An EOI has a real closing date — not a booking-system default (a year out, 31 Dec, after the season ends). **Or it is open now**, and then ALL of these hold instead:
+  1. The form is on the club's own site, or linked from it or from the club's own post. A form found only by search doesn't count. `source_url` is the club's page or post that links the form (what families open); `form_url` is the form. If the club publishes only the form link, from its own post, `source_url` is that post. Never a form no club page or post points to.
+  2. The club names the age groups or states a range. "All ages" counts; "juniors", "players" or "all programs" don't.
+  3. The club names the season (2027). A standing form with no season fails.
+  4. The form is taking responses today, read logged out. Sign-in to view = cannot be confirmed = no row.
+  5. The club states no closing date. A booking system's default close (a year out, 31 Dec, after the season) is never a closing date and is never written down. A date for only some players ("returning players by 31 Oct") doesn't make it dated.
+  6. The club's pages agree it is open. If not, no row — note it.
 
 ## Output — `changes.csv` at the path in your brief, header exactly
-`action,notice_id,club,title,ages,gender,trial_on,time,ground,positions,source_url,reason,evidence_url`
+`action,notice_id,club,title,ages,gender,trial_on,time,ground,positions,source_url,form_url,reason,evidence_url`
 - `check`/`gone`: `notice_id`, `club`, `reason` (for gone), `evidence_url`; other columns blank.
+- **Open now** `edit`/`add`: `trial_on` and `time` blank, `ground` `Online — see the club's notice`, `form_url` the form (https). `form_url` is blank on every other row.
 - `edit`/`add`: every field. `ages` semicolon codes from U5 U6 U7 U8 U9 U10 U11 U12 U13 U14 U15 U16 U17 U18 U19 U20 U21 U23 SEN; `gender` boys/girls/men/women or blank; `trial_on` YYYY-MM-DD (first session; for an EOI, its closing date); `time` ≤40 chars (EOI: `EOI closes`); `ground` a place, 2–120 chars; `positions` codes from GK RB CB LB DM CM AM RW LW ST only if the club asks for positions; `source_url` the club's own notice; `club` exactly as in the export or the club list.
 - `title`: our words, plain and factual, 3–120 chars. Never copy the club's prose. Never: application, applied, declined, rejected, unsuccessful, elite, potential, talent identification, insights, struggling.
 - `evidence_url`: the exact page you read for this row.
```

## trials-check.md

```diff
@@ -11,10 +11,11 @@
 - `edit`, `add`, `gone`: open `evidence_url` yourself. Keep the row only if the page proves it: the date/time/venue/ages in the row are exactly what the club's page says (edit/add), or the notice is really gone, cancelled or closed (gone). A page you cannot read proves nothing — strike the row.
 - `edit`/`add` must also pass the strict test in TRIALS-DESK.md (club's own source, pages agree, weekday matches, venue stated, ages stated not inferred, EOI closing date real) and carry no name, email, phone, fee, or banned word. Our words only.
 - `check`: open at least one in five at random, and every one whose notice is within the next 7 days. If a sampled `check` is wrong, turn it into the right `edit` or `gone` — or strike it.
+- **Open-now EOIs** (blank `trial_on`; BUZ and John, 3 Oct). A `check` moves the date it comes off the board (seven days after the last one), so: open **every open-now `check` at least once a week**, and strike any `check` or `edit` on one marked `lapsed` — it stays down; a fresh `add` on BUZ's list is the only way back. An open-now `edit` restarts its seven days too, so open the page AND the form for every open-now `edit`, not only `check`s. A dated notice never turns into an open-now one by an `edit` (refused): `gone` + a new open-now `add`. Open the club's page AND the form, logged out: the page still links the form, still names 2027, the ages are unchanged, and the form is taking responses. A form that loads but says closed, or a page that no longer links it, is a `gone`, not a `check`. An open-now `add` must pass the open-now test in TRIALS-DESK.md: the club's own page or post links the form (`source_url` is that page, never a bare form), ages named, 2027 named, open logged out, no closing date stated (a booking default is not one), `trial_on` and `time` blank, `form_url` given.
 - A notice appearing in two slices, or twice: keep one.
 
 ## Output (in the run folder)
-1. `changes.csv` — the merged, checked rows, same header as the slices: `action,notice_id,club,title,ages,gender,trial_on,time,ground,positions,source_url,reason,evidence_url`.
+1. `changes.csv` — the merged, checked rows, same header as the slices: `action,notice_id,club,title,ages,gender,trial_on,time,ground,positions,source_url,form_url,reason,evidence_url`.
 2. `struck.csv` — every row you struck, with a `why` column first.
 3. `report.md` — for BUZ, short, plain English, no jargon:
    - one line: "{n} confirmed · {n} changed · {n} taken down · {n} new waiting for you · {n} held".
@@ -24,5 +25,6 @@
    - **Retitled, waiting for your yes**: same shape.
    - **Held**: club — why — the link, so a person can confirm it.
    - **Couldn't read today**: clubs, one line.
+   - **Lapsed**: "{n} lapsed (7 days without a check)", then club — title, one line each (the export's `lapsed` = `yes` rows nobody confirmed today).
 
 End with the one-line count.
```
