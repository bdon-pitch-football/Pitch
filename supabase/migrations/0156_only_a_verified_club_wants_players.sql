-- ---------------------------------------------------------------------------
-- 0156 — a club that is not verified shows none of its own players-wanted
-- notices (brief M item 3, 30 Sep; round L's report, "Found" 3; 0140; 0150;
-- 0152, BUZ on doc 14 M7).
--
-- WHAT WAS WRONG. 0140 took a SUSPENDED club's players-wanted notices off its
-- page. 0152 took a club's own trial notices off the board whenever the club
-- is not verified, because 0150 made a second way out of verified — a failed
-- call leaves the club 'claimed' — and a club in that state would otherwise go
-- on advertising what it posted while it was verified. 0152 left players-
-- wanted notices out, because M7 is about trial notices. A players-wanted
-- notice is the same thing in a different box: an invitation to bring a
-- child to a club. So a club that failed its call went on asking for players
-- on its public page.
--
-- THE RULE. The same as 0152 for trials: a club's own notice shows only while
-- the club is verified. Every players-wanted notice is a club's own — the
-- club writes them from /club/page-edit and Pitch compiles none (0130 compiles
-- trial notices only) — so fn_players_wanted_advertised shows a notice only
-- for a verified club. Compiled trial notices are untouched. Nothing is
-- deleted: verified again, the notices are back as they were.
--
-- Enforced in the read the pages use: /fc/[slug] reads
-- fn_players_wanted_advertised and nothing else (susp-ad-s2). The club's own
-- management screen still lists its notices from the table, as 0140 left it.
-- ---------------------------------------------------------------------------

create or replace function fn_players_wanted_advertised() returns setof players_wanted_notice
language sql stable as $$
  select w.* from players_wanted_notice w
  where fn_club_advertises(w.club_id)
    and exists (select 1 from club c where c.id = w.club_id and c.club_state = 'verified');
$$;

comment on function fn_players_wanted_advertised() is
  'brief K item 1 (0140), brief M (0156) — every players-wanted notice a club page may show: its club is verified (and so not suspended).';

-- No new table here, so nothing to enable row-level security on (L26).
