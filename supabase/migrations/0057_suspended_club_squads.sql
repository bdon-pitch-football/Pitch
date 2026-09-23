-- ---------------------------------------------------------------------------
-- 0057 — a suspended club still read children's names off its own squad pages
-- (safety round 2, X1 — doc 14 M10, D-126).
--
-- M10 says a move from verified to suspended ends every minor-facing
-- permission in the same transaction. fn_can_work_squads (0052) asked one
-- question only — does this person hold a technical_director or club_admin
-- membership that has not ended — and never looked at club_state. Everything
-- else on that page did: fn_squad_roster (0053, 0054), squad_request_rules
-- and fn_join_squad (0054) all refuse unless club_state = 'verified'. One
-- function on one page asking a different question is the whole defect.
--
-- Measured against a database, not read off the source. At a suspended club:
--
--   1. the squad page's "Waiting on you" list (app/club/squads/[squadId]/
--      page.tsx) is gated on fn_can_work_squads alone and returned the FIRST
--      AND LAST NAME of a thirteen-year-old whose family had claimed a squad.
--      A child's name attached to a squad ask is a fact about that child, and
--      D-126 says no fact about a child reaches a club that is not verified.
--   2. fn_squad_asked (0054) returned first names on the same gate, to the
--      technical director AND to the administrator.
--   3. the club could still ACT: mySquad() in that page's actions.ts is the
--      same gate, so a suspended club could answer a family's claim "no",
--      take back an invitation, and take a child OUT of a squad — which
--      moves the club line off that child's approved page, because
--      fn_cv_club follows the membership (0054).
--
-- Confirming a child into a squad and inviting one were already refused, by
-- fn_join_squad and squad_request_rules; 0052's versions of both were
-- dropped and replaced in 0054.
--
-- The fix is the question the rest of the page already asks, asked here too,
-- by the name the product already gives it (fn_club_minor_facing, 0022).
-- It closes all three at once.
--
-- NOT split into two functions. A split would need a second question — "may
-- this person act for this club at all" — with somewhere to be asked, and
-- there is nowhere: every live caller of fn_can_work_squads is a squad
-- surface about children (this page, its actions, fn_squad_asked,
-- fn_squad_roster's administrator branch). The club work that survives
-- suspension so a club can fix itself — billing and the portal (D-135:
-- payment failure suspends and never deletes), seeing its own state on
-- /home, its squads list, its club page, its coaches — never calls this
-- function; all of it reads membership directly and is untouched.
--
-- What a CLAIMED, not-yet-verified club loses: nothing it had. A claim, an
-- invitation and a membership can only exist at a verified club (0054's
-- trigger and fn_join_squad), so all three lists on that page were already
-- empty for it. What a SUSPENDED club loses is the three acts above, and
-- neither a claim nor an invitation is stranded by that: an invitation
-- lapses on its own at thirty days (fn_lapse_squad_invitations), and the
-- family's side of a claim or a membership is fn_can_leave_squad, which is a
-- separate question and deliberately asks nothing about the club (D-10).
-- ---------------------------------------------------------------------------
create or replace function fn_can_work_squads(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select fn_club_minor_facing(p_club)
     and exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null)
$$;
