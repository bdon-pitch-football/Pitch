# build: no school on an under-18's page — D-161 (2026-09-28)

**Asked:** build D-161 — `school` leaves `EXPERIENCE_KINDS` for an under-18: the chip
is not offered, the database refuses the write, no read path renders one, and it stays
available to adults. Migration first, then the form, then the reads.

**Tree:** worktree `.claude/worktrees/builder-no-school`, branch `builder-no-school`,
one commit `68926f5`, rebased onto `app` at `a67b70b` after `app` moved 8 commits
(the console breakpoint and the TD wall merged while I worked). Every number below was
measured on `68926f5`. Ports: database 54336, app 3016 — 3000 and 54322 untouched.
**I did not commit to `app`**: the main checkout holds that branch, so my commit is on
`builder-no-school` for you to merge, the same shape as the other four builders.

## Did

**`supabase/migrations/0061_no_school_under_18.sql`** (new; 0060 was taken by the TD
wall while I worked, so this is the next free number). Header carries the reason and
cites D-161, D-114, D-72, D-80, D-49, D-119.

- `fn_experience_public(p_record, p_kind) -> boolean` — may an entry of this kind
  appear on a public page for this record. `school` is the only kind it can refuse;
  it answers from `fn_age_band(person.dob)`, so **age is derived at the moment of the
  question**, never stored. An unknown record answers false (D-94: restrict).
- `fn_no_school_under_18()` + `before insert or update` trigger on `experience_entry`.
  It refuses a school entry **arriving** on an under-18's record, which is three
  things, not one: a new row, an entry whose `kind` is edited into `school`, and a
  school entry whose `record_id` is moved from an adult's record onto a child's.
- It deliberately does **not** refuse an in-place edit of a row that was already a
  school entry on that same record. Refusing that would not delete the row (nothing
  does); it would only break the demo layer, which rewrites every text column in the
  database to the club being shown. Nothing can create such a row and no page shows one.
- **D-72 is untouched and still asserted.** The invariant is that the entry *grants*
  nobody anything — no club FK, no part in the inside-the-club computation. This runs
  the other way: the record's age decides what the entry may *say*. `fn_read_level`
  still never mentions the table.
- `fn_approved_cv` is re-created to filter `content->'otherFootball'` — see below.
- No new table, so nothing to enable row-level security on (L26).

**Read paths — the enumeration, because the three I was pointed at were not the list.**
Everything that can render an `experience_entry`, what it turned out to be, and what I
did:

| # | Read path | What it is | Checked | Action |
|---|---|---|---|---|
| 1 | `lib/record-read.ts` `assembleCv` | the live assembly (16–17, 18+, and every club-side read) | yes | `and fn_experience_public($1, kind)` in SQL |
| 2 | `fn_approved_cv` (0054) | **the one I had to find.** A u16's page is the JSON a guardian approved, and every snapshot approved before today was built when a school entry was allowed. 0054 had already made this the single function behind the token page, the print view, the club's register CV, the club's squad CV and the family's preview | yes | filtered inside the function, so none of the five had to remember anything |
| 3 | `lib/cv-build.ts` `buildSnapshot` | writes new snapshots | yes | same predicate in SQL |
| 4 | `components/cv/PlayerCV.tsx` | the shared component behind `/p/[token]`, the register CV, the squad CV, both previews | yes | `renderableExperience(p.otherFootball, p.band)` |
| 5 | `app/p/[token]/print/page.tsx` | its own render of the block; the page that outlives the link | yes | same |
| 6 | `app/build/[recordId]/more/page.tsx` | the family's own editor | yes | chips filtered; **the list deliberately not** (below) |
| 7 | `app/p/[token]/opengraph-image.tsx` | the social card | yes — reads `readCvByToken` and renders name, positions, number, stats only. No experience entry, before or after (E12/Q3) | none needed |
| 8 | `app/g/card/[cardId]/image/route.tsx`, `/g/card/[cardId]` | the approved share card | yes — same fields as the OG card, no experience entry | none needed |
| 9 | `app/cv-preview/[slug]`, `app/preview/site` | fixture-fed previews that reach no database at all | yes | covered by 4 — the fixture carries no band, which the component treats as a minor |
| 10 | `app/squad/[personId]`, `/club/register`, `/fc/[slug]`, the trials index, the register CSV-shaped routes | no experience entry anywhere | yes, by grep for `experience_entry` and `otherFootball` across `app/`, `components/`, `lib/` | none needed |

Only two files in `app/` touch the table at all (the editor's page and its action),
and a new suite check asserts no page under `app/` reads one without the band in the
same query.

**`lib/football.ts`** — `experienceKindsOffered(band)` and `renderableExperience(entries, band)`.
`EXPERIENCE_KINDS` itself is unchanged: `school` is still a kind, and it is still an
adult's to use. Absent band means minor, the same restrictive default `fn_age_band`
uses for an unknown date of birth.

**`app/build/[recordId]/more/page.tsx`** — the query now also selects
`fn_age_band(person.dob)`, and the chips come from `experienceKindsOffered`. The
**list is not filtered**: this is the family's own editor behind `requireRecordActor`,
an entry written before the rule is their own words, and `Remove` stays theirs to press.

**`app/build/[recordId]/more/actions.ts`** — the action asks
`fn_experience_public` before it inserts, so a crafted post for a kind that is no
longer on offer is treated exactly like every other kind that is not on the list:
nothing written, nothing said, same redirect. The trigger is the backstop behind it.

**`lib/record-read.ts`** — the snapshot branch is deliberately *not* filtered in
TypeScript; `fn_approved_cv` answers it once, for all five surfaces (L23: a second
answer is a second place to be wrong).

**Fixtures and seed.** `lib/fixtures.ts`: Jordan (22) gains
`{ kind: 'school', orgName: 'Riverside University 1st XI', period: '2023–2025' }` —
the adult half of the rule, so no check can pass by the block having been deleted.
`scripts/dev-db.mts`: a school entry on a child is now the one row the product cannot
write, so the seed writes Deniz's and Georgia's the only way one can now exist — with
the trigger off for that insert and back on immediately, commented as exactly that.
Nate (17) gets one too, because **a 16–17 is the only under-18 band whose page is
assembled live** — a u16's is the snapshot — so without him the live filter would have
been proven only by reading the query. I did not rename Deniz's or Georgia's entries
(L15, separately queued).

**Doc 14 gains A19**, in table A because it is a read for every actor in that table:

> `| A19 | any actor above, on a `school` experience entry | **Never rendered, on any surface, and the write is refused by the database** (D-161) | Same | **Rendered** — a school or university side is an adult's to name |`

Gate coverage: 262 rows, 262 pinned, 0 open.

## Ran

From a fresh seed, in TRAINING §4 order, on `68926f5`:

**perms 1143/1143 · render 392/392 · write 315/315 · reseed · layout 188 views at 375
and 1280, 0 overflow.** Also: gate-coverage 262/262 pinned · `tsc --noEmit` 0 errors ·
palette green · secret-scan clean · validate-migrations green · `build:check` exit 0 ·
`migration-on-data` clean scenario: 0061 applies, **existing data changed: none, table
rewrites: none** (which is D-161's "nothing is deleted", measured rather than claimed).

`df -h /`: **19Gi available before, 11Gi after** — and almost none of that is mine. My
worktree is 430MB with the dev build cache deleted (`node_modules` is an APFS clone of
the main checkout's, so it cost nothing), and I removed `.next` (1.1GB) and
`.next-check` (90MB) on the way out. Four other worktrees are live and at least two ran
builds during the same hours. Both my ports are released; 3000 and 54322 were never
touched.

New checks: 24 in the permission suite (23 labelled A19, 1 labelled D-161 because it
tests the trigger's carve-out rather than that row), 23 labelled A19 in the render
suite, 4 in the write suite. `corpus-check` reports **2 failures that are not mine** — see Found.

**Proved each one can fail (L20).** Old behaviour put back, suite run, restored:

| Reverted | Suite | Went red |
|---|---|---|
| the trigger removed, function kept | perms | 6 — both refusals, the child's row count, the derived-birthday pair, and both update routes |
| `fn_experience_public` forced true | perms | 12 — every read-side answer and every refusal |
| `fn_approved_cv` + both SQL predicates | perms | 3 — the snapshot served a school entry; both "asks the database" checks |
| the render-time filter in `PlayerCV` and print | render | 4 — the two fixture previews. The database-fed pages stayed green, which is the honest result: the component's filter is load-bearing for the pages that reach no database |
| the chip offered again | render | 1 |
| the action's ask removed, trigger kept | write | 1 — the row is still not written (the database refuses) but the response becomes a 500, distinguishable from a success. That is precisely why the action asks |
| trigger AND action's ask removed | — | the **seed aborts**: it cannot disable a trigger that does not exist. The comment there says so on purpose |

One check of mine could not have passed at all before I fixed it: React renders
`checked=""` between `name` and `value` on the first chip, so `name="kind" value="school"`
never matched the adult's page. Found it by reading the served HTML, not the code (L16).

## Found

1. **`docs/design/reports/2026-09-24-audit-every-device.md` fails corpus S2 twice** —
   "28 September" in a file whose name says 2026-09-24, so the exemption BUZ added
   today (a report citing the date in its own filename) does not cover it. **Present at
   `app` HEAD before my branch existed** — I confirmed it in the main checkout. Not mine
   to fix; either the filename or the date is wrong.
2. **`scripts/migration-on-data.mjs` cannot be run with `--base 0058` or later.** Its
   own fixture inserts a `technical_director` membership directly, which 0058's trigger
   correctly refuses, so the tool dies in its own seed. With the documented default
   (`--base 0050`) it passes, because the fixture is written before 0058 exists. The next
   migration author who follows the tool's own `--base` advice will meet this.
3. **`lib/fixtures.ts` Jordan names two real Melbourne clubs** as previous clubs
   (`Pascoe Vale SC`, `Moreland Zebras FC`) on an invented person. Same class as L15 and
   the same queue; the demo layer already swaps both, the fixture file does not.
   Not renamed, per instruction.
4. **The football-history editor's placeholder names a real club** —
   "e.g. Northcote City FC" in `more/page.tsx`. It is an example rather than data about
   a person, so it may be fine; it is the same word-shape as the fault above and worth
   a copy-seat decision.
5. **The demo layer would have broken** on a strict `before update` trigger: it rewrites
   every text column in the database, including a legacy school row. Narrowing the
   trigger to *arrivals* is what keeps `npm run demo` working; if anyone widens it later,
   the demo is where it will show up.
6. **How many exist today.** In the seed: 3 school entries on under-18s (Deniz, Georgia,
   Nate — one of which I added deliberately) and 1 on an adult. For the real database,
   the count before anyone decides anything:
   `select count(*) from experience_entry e join development_record dr on dr.id = e.record_id join person p on p.id = dr.person_id where e.kind = 'school' and fn_age_band(p.dob) <> '18plus';`
7. **What a guardian would see today, unchanged and on purpose.** The entry is still
   listed under "Other football" in Build your CV → More, with its School chip and
   `Remove` beside it. It appears on no public CV, no print view, no OG or share card,
   no club register or squad CV, and no preview. **No message is sent, no banner is
   shown, nothing is deleted** — that is BUZ's call and I have written none of it.
   **The one question inside that boundary that I had to answer to ship:** whether the
   family's own editor keeps listing an entry that no longer renders. I kept it, because
   hiding it would take away the only control they have over their own words without
   telling them, and deleting it is forbidden. If BUZ wants the editor silent as well,
   that is a one-line change in the same place.

## Copy for BUZ

**No new or changed user-visible product string.** Three strings I did add, none of
them product copy, listed verbatim because the rule is verbatim:

- `Riverside University 1st XI` — fixture data on the adult fixture (Jordan), visible on
  the dev preview pages and his seeded CV. Fictional: "Riverside" is already one of the
  seed's invented names and there is no Riverside University in Australia.
- `School 1st XI` — dev seed only, on Nate's record. Names no organisation; it is the
  wording the demo layer already substitutes for a real school.
- `a school entry cannot be written on an under-18 record` — a Postgres exception
  message. It reaches no screen (the action asks first and writes nothing), and it is in
  the report only so nobody is surprised to find English in an error path.

## Risks

- **The trigger allows an in-place edit of an existing legacy row** (org_name, period)
  while refusing every way one can be created or moved. That is a deliberate narrowing,
  argued in the migration header and pinned by a check; if the safety seat disagrees,
  the demo layer's blanket text rewrite is the thing that has to change with it.
- **I did not open a browser.** Every render claim is the served HTML, at 375 and 1280
  through the layout check's real Chrome, but nobody has looked at the editor with the
  School chip missing to see whether the row of chips still reads well one chip shorter.
- **The demo was not run** (its own database and port, and another seat may be in it).
  After this merge it needs a restart before anyone opens it (L14), and the rebuilt
  demo will exercise the trigger's update carve-out for real.
- **`migration-on-data` dirty scenario** stops at 0051 on a pre-existing constraint,
  so 0061 was measured against live-shaped rows only in the clean scenario.
- **Number 0061 was free when I took it.** Two builders are still live; if one of them
  lands 0061 first, mine renumbers with no other change.

## Lesson

**Ask the database where a snapshot is served, not where it is built.** I was pointed
at three places and found five, and the one that mattered was `fn_approved_cv`: a u16's
public page is not assembled on the way out, it is JSON a guardian approved before the
rule existed, so every filter added to an assembly query would have missed the entire
under-16 band — the band the decision is about. 0054 had already collapsed that read to
one function for exactly this kind of reason, and filtering there covered five surfaces
at once. For any rule about what a page may show, find the function that serves the
page, not the one that built the row.
