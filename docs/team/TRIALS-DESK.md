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
6. **An EOI has a real closing date**, not a booking-system default (a year out, 31 Dec, after the season). An EOI whose club states no closing date can still be listed as **open now**, under its own test below.
7. **John's rules (D-172):**
   - no person's name, email, phone, fee, poster or photo;
   - nothing about an identifiable child;
   - our words, never the club's prose;
   - none of the banned words (D-85, D-108).

## Open now: an EOI with no closing date (BUZ, 3 Oct; John, 3 Oct; migration 0173)

Many clubs take expressions of interest on a form that gives no closing date. The board lists one as **Open now** while the desk keeps seeing its form open. **D-74, as BUZ clarified it on 3 Oct:** "For an expression of interest with no closing date, its date is seven days after the trials desk last saw its form open." The database works that out each time the board is read; no job runs it.

**What an open-now `add` needs.** It is the strict test above with test 6 replaced. All of these must hold:
1. **The club's own source.** The form is on the club's own site, or linked from it or from the club's own post (D-90). A form found only by search doesn't count. `source_url` is the club's page or post that links the form, and it is what "The club's own notice" opens. `form_url` is the form itself, which we watch but never show. Link straight to a form only when the club publishes nothing but the form link, from its own post, and then `source_url` is that post. Never list a form that no club page or post points to (John, 3 Oct).
2. **The ages rule.** The club names the age groups or states a range. "All ages" counts. "Juniors", "players" or "all programs" don't.
3. **The season.** The club names it (2027). A standing "register your interest" form with no season fails.
4. **Taking responses today, read logged out.** A form that needs a sign-in to view can't be confirmed, so it can't be listed. The desk never signs in and never submits.
5. **The club states no closing date.**
   - If the club states one, it's a dated EOI under test 6.
   - **A booking system's default close date is never treated as real or stored.** That means a year out, 31 Dec, or after the season. The listing is open now.
   - A date that applies only to some players (for example "returning players by 31 Oct") doesn't make it dated.
6. **The club's pages agree** that it's open. If they don't, hold it.
7. **John's rules (D-172), unchanged.** Our words in the title. `trial_on` and `time` are blank. Ground is `Online — see the club's notice`.

**A new open-now notice waits for BUZ's yes**, like every new notice.

**The seven-day re-confirm.**
- Open-now notices are re-read on **every morning sweep**, not on the three-hourly runs. They have no date or time to drift.
- A `check` means all of these still hold: the club's page still links the form, it still names 2027, the ages are unchanged, and the form is still taking responses.
- Only a `check` or an `edit` moves "seen open" (`confirmed_open_at`) and the "checked" stamp families see. The link checker never does: a closed Google Form still loads.
- **The checker opens every open-now `check` at least once a week.** For dated checks it's one in five, as now. This is the one place a "page loads" mistake would keep a closed form on the board.
- **If a page can't be read, there's no row.** The stamp stops moving, families see that, and seven days after the last check the listing comes off by itself.

**Take-down triggers.** Each is a `gone` row, which goes live on its own, as now, and comes off the board at once:
- the form says it's closed, unavailable, full or "no longer accepting responses";
- the club's page says closed, full, or "trials have been held";
- **the club's page no longer links the form,** even if the form is still open, because D-90 breaks;
- the page or form now names another season, or no ages;
- the page or form is dead. `check-trial-links.mjs` takes it down; it now checks the form address too.

**Moves, not take-downs.**
- **The club states a real closing date:** an `edit` gives `trial_on` (and `time` `EOI closes`), and the row moves up into the dated group. It goes live on its own, because the title is unchanged.
- **Trial dates appear:** a new trial notice, which waits for BUZ. The EOI stays while its form is open.

**Lapsed notices.** A notice not confirmed for seven days is off the board but still in the export, marked `lapsed` = `yes`. If the desk sees the same form open again, a `check` puts it back (it goes live on its own, words unchanged, and the checker opens every one). If not, a `gone` removes it. The morning report says "{n} lapsed (7 days without a check)" and lists club and title.

**The brake** (12 notices, or a quarter of the board) still applies to `gone` rows. The seven-day lapse isn't a take-down by the desk, so it sits outside the brake. The brake protects the board from a desk that misread every page; the lapse protects families from a desk that read nothing.

**The CSVs.**
- The export gains `form_url`, `confirmed_open_at` and `lapsed`. An open-now notice has a blank `trial_on`.
- `changes.csv` gains `form_url`. An open-now `add` or `edit` has a blank `trial_on` and a blank `time`, and must give `form_url` (https). `sync-trials.mjs` refuses one without it, or with a time.

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

- **Pages we can't read:** Facebook-only clubs and pages built by script aren't watched. Their notices can't be confirmed, and they go stale on the board. Their "checked" date stops moving, which is visible to families (John, 30 Sep). An open-now notice nobody can confirm comes off seven days after its last check.
- **Runs need the Mac awake:** the schedule runs on BUZ's Mac. A missed run happens when the Mac wakes.
- **Whose name is on the changes:** changes are made under BUZ's operator account. The curation_event log shows each one.
