# The trials desk

**What it is.** Pitch shows trial and EOI notices for clubs that haven't claimed their page, compiled from each club's own public notice (D-90). BUZ, 30 Sep: "We need to have a few agents that track this every day and update so the information is very accurate", and "update the information live as soon as non verified clubs update their dates and times".

**The one rule under all the others:** a wrong date is worse than no notice. A family drives across Melbourne on what we show.

## Who does what

| | |
|---|---|
| **trials-watch** (2 seats) | Re-reads each notice's source against the club's own page. Writes `check` / `edit` / `gone` rows, and in the morning sweep `add` rows for new notices. |
| **trials-check** | Re-opens the evidence for every edit, add and take-down, samples the checks, strikes anything unproven, merges, writes BUZ's report. |
| **`scripts/check-trial-links.mjs`** | No agent. Takes down a notice whose page is gone (404/410, dead domain). |
| **`scripts/sync-trials.mjs`** | Applies the checked changes through the operator's own functions (0130). Every change is a curation_event. |

## What goes live without BUZ, and what waits (BUZ, 30 Sep)

| Goes live on its own | Waits for BUZ's yes |
|---|---|
| **Confirmed** — "checked" moves to today | **A new notice** (new words on the site) |
| **Taken down** — cancelled, closed, removed, or dead link | **A changed title** |
| **Changed date, time, venue, ages or gender**, title kept | Anything the checker held |

**The brake:** a run may take down at most 12 notices, or a quarter of the board. More than that, and none come down; BUZ decides. A watch seat that misread every page cannot empty the board.

## Multi-session trials

A notice carries one date: the next session. Once that date has passed and the club's page lists later sessions of the same trial, the watch seats move the notice to the next session (an `edit` that keeps the title, so it applies on its own). A trial never drops off the board while it still has sessions to run.

## The strict test (every `add` and `edit`)

1. **The club's own source:** its site, its own social post, or a form linked from either. No aggregators or news sites.
2. **The club's pages agree** on date, time and venue. If they don't, hold it.
3. **The weekday matches the date**, where one is given.
4. **The venue is in the notice.** An online EOI is `Online — see the club's notice`.
5. **Ages are the club's.** A stated range ("U7 to U21") counts. An inferred one doesn't.
6. **An EOI has a real closing date**, not a booking-system default (a year out, 31 Dec, after the season).
7. **John's rules (D-172):**
   - no person's name, email, phone, fee, poster or photo;
   - nothing about an identifiable child;
   - our words, never the club's prose;
   - none of the banned words (D-85, D-108).

## The one command (BUZ, 1 Oct)

Scheduled runs touch production **only** through `scripts/trials-desk.sh`, so one allow-list entry covers every run and no run stalls on a prompt at 5:30am:

- `trials-desk.sh prepare notices|sweep`: makes the run folder, exports the board, and for `notices` splits it into two halves (whole clubs). The last line printed is the run folder.
- `trials-desk.sh finish <run folder>`: the dead-link check, then the checked `changes.csv` in **safe** scope, logged to `apply.log`. It refuses a folder outside `trials-daily/`, and applies nothing if the checker didn't write `changes.csv`.

The steps below are what the script does underneath.

## The runs

**Every 3 hours, 7am–9pm, notices only.** Only clubs that have a live notice are re-read:

1. **Export the board:** `sync-trials.mjs --export`.
2. **Watch:** 2 seats, `mode: notices`.
3. **Check:** the checker.
4. **Links:** `check-trial-links.mjs --apply`.
5. **Apply:** `sync-trials.mjs --changes … --apply`, safe scope.

**Every morning, 5:30am, the sweep.** The same five steps, with the watch seats in `mode: sweep` so they also look for new notices at all 183 clubs and on the watch list. Then BUZ gets the report.

**The run folder** is `content/sales/pipeline/trials-daily/<YYYY-MM-DD>/<HHMM>/`. It holds:
- `board.csv` (the export);
- `changes-a.csv` and `changes-b.csv`, plus notes, from the watch seats;
- `changes.csv`, `struck.csv` and `report.md` from the checker;
- `apply.log`.

**BUZ applies what's waiting**, after reading the report:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && node --env-file=.env.production-db.local scripts/sync-trials.mjs --ca supabase/rehearsal-ca.crt --operator burak.donmez@pitch-football.com --changes <run folder>/changes.csv --scope all --apply
```

Rows already applied in the safe run are harmless the second time. A `check` re-stamps today, and an edit is idempotent.

## Honest limits

- **Pages we can't read:** Facebook-only clubs and pages built by script aren't watched. Their notices can't be confirmed, and they go stale on the board. Their "checked" date stops moving, which is visible to families (John, 30 Sep).
- **Runs need the Mac awake:** the schedule runs on BUZ's Mac. A missed run happens when the Mac wakes.
- **Whose name is on the changes:** changes are made under BUZ's operator account. The curation_event log shows each one.
