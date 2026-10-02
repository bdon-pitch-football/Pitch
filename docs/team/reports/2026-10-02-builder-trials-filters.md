# builder: the trials board filters package — Show, Region and the fold, Club level, Distance (2 Oct 2026)

Asked: build the filters package BUZ approved on 2 Oct (HoPD → Leo package; John's two rulings; proposal §5–§7 on e727360) in four parts, one commit each, suites green at each, on `build/trials-filters` from bbbc10b.

Did:
- **Part 1 · Show** — 6571da0. `app/trials/page.tsx`: `?kind=trial|eoi`. Trials hides the EOI section; EOI hides the trials and the count line, the heading leads with its number, no rule above it (`.tb-sec.first`), `aria-live` on the number. Offered only while both kinds have listings under the other choices; a chosen kind stays.
- **Part 2 · Region, the fold, panel order, the rail** — d639695. `lib/regions.ts` (14 regions, each whole councils, keys never a suburb's name), `public/places-vic.4306391711.json` (2,945 VIC localities: postcode, council, centre; ABS ASGS Ed. 3) built by `scripts/places-vic.mjs`, provenance in `lib/places-vic-file.ts`, server lookups in `lib/places-vic.ts`, one pure filter in `lib/trials-filter.ts`. Panel: State (only with two states), Region, Age group, Show, More filters (`<details>`, names its groups, opens itself when something inside is chosen). Rail: `max-height: calc(100dvh - 84px - 16px); overflow-y: auto`. Also: no chip prints "0" any more, chosen ones included; Positions wanted hides when no listing under the other choices names a position. Write crawl skips `/trials?…area|kind|level=` (L32).
- **Part 3 · Club level** — a31b098. `supabase/migrations/0172_club_level.sql`: `competition_tier` (empty since 0002) becomes the levels lookup with `sort` (npl, vpl, sl, community); new `club_level` (club_id PK, level FK, league_as_named, source_url, checked_on — all NOT NULL, source must be http(s), RLS on). `scripts/load-club-levels.mjs`: dry-run by default, `--apply` in one transaction, `--ca` as apply-migrations, joins by name+suburb via `fn_club_listing_key`, refuses no source / no checked_on / future date / unplaceable league / unknown club / duplicate / **Alamein FC (any spelling, before any lookup)**. Seed writes Riverside (SL), Kingsway (VPL), Kestrelford (NPL) through the script; Westgate has no source → no level. Board reads only the level code; rows never get the league. Honesty line under the heading; active chip "{level} clubs".
- **Part 4 · Distance** — 51b5172. `components/floodlit/TrialsBoard.tsx` (client; the board drawn from the same rules on server and device), `components/floodlit/NearField.tsx` (combobox; places file fetched whole on first focus; no name, no form, autocomplete/spellcheck/autocorrect/autocapitalize off; state only in React), `TrialRow` gains `about` ("about {n} km" in the foot, `display:none` in print; omitted at 0 km per D-162). Radii 10/20/40, 20 first, hidden at zero; nothing in range offers the next radius with its count; chip reads only "Within {n} km"; survives a chip tap, gone on reload. Credit text is `ABS_CREDIT_PENDING_BUZ_WORDS`, rendered nowhere.
- Final (this report's commit): two render checks anchored so they fail on base (tf-region3, tf-level4); before/after screenshots of 9 states × 390/1280 in `docs/design/reports/2026-10-02-trials-filters-shots/` (before = bbbc10b at the same URLs).

Ran (each from a fresh seed, TRAINING §4 order, my ports 54641/3441/9641/9642):
- p1 6571da0: perms 2214/2214 · render 874/874 · write 662/662 · layout 274 views green · palette, tsc, build, csp-prod 5/5, corpus, secret-scan, gate 267/267.
- p2 d639695: perms 2217 · render 882 · write 662 · layout green (+tf-rail2) · rest green.
- p3 a31b098: perms 2229 · render 887 · write 662 · layout green · rest green.
- p4 51b5172: perms 2233 · render 888 · write 662 · layout green (tf: 4 views, 60 requests read) · rest green. (First p4 run: write ag4 red and tf-near1 false positive — both fixed before commit, see Found.)
- final (51b5172 + anchors): perms 2233/2233 · render 888/888 · write 662/662 · layout 274 views ALL GREEN · palette · tsc · build · csp-prod 5/5 · corpus 0/0 · secret-scan clean · gate-coverage 267/267, 0 open.
- Red on base (bbbc10b product code, HEAD checks): render all 19 tf checks FAIL; layout tf-rail2 FAIL (last chip at 924px of 800), tf-near1 ×2 and tf-near2 ×3 FAIL; perms tf blocks throw (module/table/component absent) — 3 of 3 blocks red. tf-near1 also proven red on HEAD by planting a leak (sessionStorage + cookie + fetch + replaceState): caught as session, cookie, request `/api/x?q=Preston`, and the RSC request carrying it in a header.
- Load script dry-run against the seed (app stopped, 54641):
  ```
  to insert: 1 · to update: 1 · unchanged: 2 · refused: 4
    insert  Westgate Rangers (Altona) → sl · State League 4 North-West · checked 2026-10-01 · https://westgaterangers.example.au/seniors
    update  Kingsway Rovers FC (Brunswick West) → vpl · Victoria Premier League 1 · checked 2026-10-01 · … (was vpl · Victoria Premier League 2 · checked 2026-09-30)
    refuse  Brindlewood Rovers SC (Bulla): no source_url
    refuse  Wrenmoor Wanderers FC (Altona): no checked_on
    refuse  Alamein FC (Ashburton): held by BUZ, 2 Oct: "keep that out of our list for now"
    refuse  Coburg City FC (Coburg): league not placed in a level: "Metro League 2"
  plan only. Nothing changed. Add --apply to write it.
  ```

Found:
1. **Data file name.** The package says levels load from `clubs-vic-load-2026.csv` `tier`; Leo says `club-levels-2026.csv` (scout). The loader takes either `league_as_named` or `tier`, but `clubs-vic-load-2026.csv` has no `source_url` column, so every row of it would be refused — correctly, under John's condition. The scout's file needs: club, suburb, league_as_named, source_url, checked_on.
2. **ABS data is already public from part 2.** `/places-vic.4306391711.json` is served from part 2 on and Region's council mapping is ABS-derived, so the CC BY credit arguably applies to Region too, not only Distance. Decision for Leo/BUZ: hold Region with Distance, or approve the credit before either ships.
3. **Pre-existing D-162 gap, fixed in my lane:** a chosen chip with nothing behind it printed "0" (`/trials?gender=men` → "Men 0"). Now no chip prints a zero (tf-zero1). Touches the existing Age/Competition/Positions chips.
4. **Every filtered view now ships every upcoming listing's public facets** (incl. club centre point and level code) in the page payload — the same listings the unfiltered board shows anyone; the club's suburb is not sent. This made write check ag4's raw-HTML "not on this page" read the payload; ag4 now strips scripts (L32/L33).
5. next dev keeps its own IndexedDB of server responses (`__next_debug_channel`); the privacy check reads IndexedDB contents (bytes decoded) after clearing origin storage, rather than exempting it.
6. Postcode matching is one postcode per locality (the postal area its centre falls in), plus 3000 → Melbourne; a suburb spanning two postcodes is found under one.
7. Clubs whose suburb field is not a locality ("Parkville (seniors); Avondale Heights (juniors)") get no region and no centre: they appear only under "Any region" and in no radius.

Product questions (not chosen by me):
- **Peri-urban councils** (proposal "Calls for BUZ"): built as drafted — Macedon Ranges → Bendigo, Mitchell → Shepparton & North East, Golden Plains → Geelong & Surf Coast, Moorabool → Ballarat, Cardinia → Melbourne South-East, Baw Baw → Gippsland. The package does not record BUZ's answer. One line each in `lib/regions.ts`.
- **Region names that are also localities** ("Bendigo"; "Ballarat" the city): the regions are council groups, not finer (keys are `bendigo-region`, `ballarat-region`), but the approved display names coincide with a suburb name. John's Q3 is about granularity; flagging in case he reads names too.
- **Same-suburb club at 0 km:** built as no distance on that row (D-162: omit, never "about 0 km"). Alternative: "about 1 km" (inside the approved pattern, slightly untrue). BUZ's call.
- **Stale levels:** a level stays until re-loaded. Option: hide a level whose `checked_on` predates the current season's changeover. Not built.

Copy for BUZ: every visible string is from the package's approved list, verbatim: "Show", "Trials", "Expressions of interest", "All" (reused), "Region", "Any region", the 14 region names, "More filters", "Club level", "The club's senior league, not the trial's.", "Any level", "NPL", "Victoria Premier League", "State League", "Community", "{level} clubs", "Distance", "Suburb or postcode", "10 km", "20 km", "40 km", "Within {n} km", "about {n} km", "Clear suburb" (screen readers), "Worked out on this device. Never sent to Pitch or saved.", "No Victorian suburb or postcode matches that." Screen-reader labels follow the existing "Remove {chip}" pattern ("Remove Within 20 km", "Remove NPL clubs" as W10/W19; "Remove Melbourne North", "Remove Trials", "Remove Expressions of interest"). Combobox options are ABS place data ("Preston 3072").
**Needs BUZ (Distance must not ship without it), proposed ABS credit, placed under the Distance note or in the site footer's legal line:**
  - Option A: "Suburb and postcode data: Australian Bureau of Statistics, CC BY 4.0."
  - Option B (ABS's own form): "Source: Australian Bureau of Statistics, Australian Statistical Geography Standard (ASGS) Edition 3, CC BY 4.0."
  Currently in code: "Suburb, postcode and council data: Australian Bureau of Statistics, ASGS Edition 3, CC BY 4.0." (`ABS_CREDIT_PENDING_BUZ_WORDS`).

Risks: production needs 0172 applied before the board deploys (the page joins `club_level` and reads `competition_tier.sort`); the level filter shows nothing until the scout's CSV is loaded with BUZ. Distance checks run against `next dev`, not a production build (prefetching is production-only; chip hrefs carry no place, but not measured there). Screenshots carry the dev "N" badge. Not run: test:timing (not in scope of the change; board timing unaffected by design but unmeasured).

Lesson: a page that ships its data to the browser turns every raw-HTML "not on this page" assertion into a test of the payload — strip scripts before asserting absence, and prove each new check red on the base (two of mine passed there until anchored).
