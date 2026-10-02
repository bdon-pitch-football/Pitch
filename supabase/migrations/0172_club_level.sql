-- ---------------------------------------------------------------------------
-- 0172 — Club level: a club's senior league, as a filter on the trials board
-- (BUZ approved 2 Oct; John's ruling 2 Oct, 13-Board-Room/JOHN-to-PRODUCT-
-- DESIGN-trials-club-level-filter-2-oct.md; docs/design/reports/
-- 2026-10-02-proposal-trials-v2.md §7b; D-73, D-172, D-21, D-74).
--
-- WHAT IT IS. "Club level" narrows the board to listings whose CLUB's senior
-- league is NPL, Victoria Premier League, State League or Community. It is
-- the club's league, never the trial's (the board says so under the
-- heading), it only ever narrows and never orders (D-21, D-74), and no row
-- and no club page ever prints it (John: a league beside an unclaimed club's
-- name drifts toward making the listing look like the club's own, D-172).
--
-- THE LEVELS ARE A LOOKUP TABLE, NOT AN ENUM (D-73). competition_tier has
-- sat empty since 0002 for exactly this; it gains its order and its four
-- rows. Leagues are per state, and a NSW level is a row, not a migration.
--
-- EVERY FACT CARRIES ITS SOURCE AND THE DAY IT WAS CHECKED (John, from
-- D-172's closed list, which allows "leagues, divisions" with "a recorded
-- source per fact"). club_level holds one row per club: the level, the
-- league as its source names it ("State League 3 South-East"), the page it
-- came from and the day someone read that page. Both are NOT NULL, so a club
-- with no source cannot have a level, and drops out of every level chip
-- rather than being guessed. The desk re-checks at season changeover —
-- promotion and relegation move clubs every year — and a re-check is the
-- same load again (scripts/load-club-levels.mjs), which updates the row.
--
-- WHAT WRITES IT (L13). In production, only scripts/load-club-levels.mjs,
-- from content/sales/pipeline/club-levels-2026.csv (Football Victoria's own
-- pages), run by Leo with BUZ. It refuses a row with no source or no checked
-- date, and it refuses Alamein FC (BUZ, 2 Oct: "keep that out of our list for
-- now"). The seed writes its fixture rows through the same script.
--
-- WHO READS IT. The trials board, joined to the listings the board already
-- reads its way (fn_trial_notices_advertised), so the filter sees exactly the
-- clubs the board does. It is a public fact about a club, never about a
-- person. Row-level security is on, like every table (L26).
-- ---------------------------------------------------------------------------

alter table competition_tier add column sort int;
insert into competition_tier (code, label, sort) values
  ('npl', 'NPL', 1),
  ('vpl', 'Victoria Premier League', 2),
  ('sl', 'State League', 3),
  ('community', 'Community', 4);
alter table competition_tier alter column sort set not null;

create table club_level (
  club_id uuid primary key references club(id) on delete cascade,
  level text not null references competition_tier(code),
  league_as_named text not null check (length(btrim(league_as_named)) between 2 and 120),
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$' and length(source_url) <= 500),
  checked_on date not null,
  loaded_at timestamptz not null default now()
);
alter table club_level enable row level security;

comment on table club_level is
  '0172 — a club''s senior league, the trials board''s Club level filter (BUZ 2 Oct; John 2 Oct; D-73, D-172). One row per club, each with its source and the day it was checked; no source, no row, no level. Never shown on a row or a club page. Written only by scripts/load-club-levels.mjs.';
