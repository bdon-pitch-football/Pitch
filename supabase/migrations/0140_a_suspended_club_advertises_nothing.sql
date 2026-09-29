-- ---------------------------------------------------------------------------
-- 0140 — a suspended club advertises nothing (brief K item 1, 29 Sep; D-90,
-- D-74, doc 14 M10; round I's report).
--
-- WHY THIS EXISTS. Round I found a suspended club's trial notices still on
-- /trials and on its own page. Suspension was built as the end of every
-- minor-facing permission (M10, 0022, 0057) and nobody had asked what the club
-- goes on SAYING to families while it is down. A notice is an invitation to
-- bring a child to a ground. A club Pitch has taken down — for a child-safety
-- reason, or for any other — was still issuing them, from our board, under
-- our name, and a compiled notice was one Pitch itself had written.
--
-- THE RULE. A club whose club_state is 'suspended' advertises nothing: no
-- trial notice, club-posted or Pitch-compiled, and no players-wanted notice.
-- EVERY class: child_safety, administrative, non_payment, and a suspension
-- with no class recorded at all. The class decides who is TOLD (0066,
-- fn_suspension_tells_families); it does not decide what the club may go on
-- publishing, and a family reading the board cannot see a class anyway. The
-- takedown outcome writes the same state (app/ops/call), so it is covered.
--
-- What this does NOT hide: a register whose payment lapsed (D-135). That is a
-- billing state and never club_state (0002), and notices are the free tier.
--
-- ONE ANSWER, READ BY EVERY PAGE (L23). Until now each page wrote its own
-- query against trial_notice, and each applied 0007's expiry rule for itself,
-- so a fourth page would have had to remember both rules. Here they are once:
--
--   fn_club_advertises(club)        the club is not suspended.
--   fn_trial_notices_advertised()   every notice that is on the board: its day
--                                   has not passed (0007) and its club
--                                   advertises.
--   fn_players_wanted_advertised()  the same, for players-wanted notices.
--
-- The board, the club page, a player's "next trial" on /home, a club's own
-- count of its live notices and the trial a registration may carry all read
-- the two set-returning functions; the permission suite fails on a new page
-- that reads trial_notice directly for display (susp-ad-s1).
--
-- Suspension HIDES; it never deletes (D-135's rule, and 0068's). Re-verify the
-- club and its notices are back as they were. Nothing here writes a row.
--
-- SECURITY INVOKER, stable, plain SQL: the planner inlines them, and called
-- through the anon key they run into trial_notice's row-level security like
-- any other read, so they widen nothing (L26).
--
-- Read with: 0002 (club_state), 0007 (the expiry rule), 0025 and 0066 (the
-- classes), 0130 (compiled notices), D-90, D-74, D-135.
-- ---------------------------------------------------------------------------

create function fn_club_advertises(p_club uuid) returns boolean
language sql stable as $$
  select exists (select 1 from club c where c.id = p_club and c.club_state <> 'suspended');
$$;

comment on function fn_club_advertises(uuid) is
  'brief K item 1 (0140) — a suspended club, of any class, advertises nothing. The one place that says so.';

create function fn_trial_notices_advertised() returns setof trial_notice
language sql stable as $$
  select t.* from trial_notice t
  where t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
    and fn_club_advertises(t.club_id);
$$;

comment on function fn_trial_notices_advertised() is
  'brief K item 1 (0140) — every trial notice on the board: still to come (0007) and its club not suspended. Every page that lists a notice reads this.';

create function fn_players_wanted_advertised() returns setof players_wanted_notice
language sql stable as $$
  select w.* from players_wanted_notice w
  where fn_club_advertises(w.club_id);
$$;

comment on function fn_players_wanted_advertised() is
  'brief K item 1 (0140) — every players-wanted notice a club page may show: its club is not suspended.';
