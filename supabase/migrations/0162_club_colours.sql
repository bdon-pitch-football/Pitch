-- A club's own colours (D-173 change 4, BUZ 1 Oct 2026: "start club colours").
--
-- Two colours, both or neither, each a lower-case #rrggbb. The club's
-- technical director or administrator sets them from "Crest & club page", the
-- same two roles that already edit the rest of the page (0051).
--
-- They dress a CLAIMED club's page only. D-172 puts "club colours as the
-- page's identity" on an unclaimed page's never-list, so an unclaimed club
-- cannot hold them at all: the check below refuses them, and a club that goes
-- back to unclaimed has to lose them in the same statement. The page also
-- ignores them unless the club is claimed or verified (lib/club-colours).
--
-- Readability is not stored or trusted here. The page derives a hero dark
-- enough for white text and a trim visible on the page, by arithmetic, from
-- whatever the club picked (lib/club-colours).
alter table club
  add column colour_primary text,
  add column colour_secondary text,
  add constraint club_colours_hex check (
    (colour_primary is null and colour_secondary is null)
    -- "is not null" spelled out: a check whose answer is NULL passes, so a
    -- half pair would otherwise slip through the pattern match.
    or (colour_primary is not null and colour_secondary is not null
        and colour_primary ~ '^#[0-9a-f]{6}$' and colour_secondary ~ '^#[0-9a-f]{6}$')),
  add constraint club_colours_claimed_only check (
    club_state <> 'unclaimed' or (colour_primary is null and colour_secondary is null));
