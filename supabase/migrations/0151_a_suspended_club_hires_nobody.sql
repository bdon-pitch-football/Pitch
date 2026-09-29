-- ---------------------------------------------------------------------------
-- 0151 — a suspended club's coaching roles come off the jobs board (brief L,
-- follow-up 2, 29 Sep; round K's report, Found 2; 0140).
--
-- WHY. 0140 made "a suspended club advertises nothing" true of trial notices
-- and players-wanted notices, and left /jobs alone because a coaching role is
-- an adult job ad, not a notice. Round K found /jobs still listing a
-- suspended club's roles, and the club's own page still saying it "is looking
-- for coaches". A club Pitch has taken down — for a child-safety reason, or
-- any other — was recruiting the adults who would coach its children, from
-- our board. The most restrictive reading of "advertises nothing" hides them,
-- and Leo has asked for it (restrictive default; he tells BUZ).
--
-- THE RULE. One answer, the way 0140 wrote the notices' answer:
--
--   fn_coaching_roles_advertised()   every coaching role on the board: not
--                                    closed, its closing day not passed
--                                    (0019's rule, which each page applied
--                                    for itself), and its club advertises
--                                    (fn_club_advertises, 0140 — not
--                                    suspended, of any class).
--
-- Read by the board (/jobs), a role's own page (/jobs/[roleId]), the apply
-- action, the club page's "looking for coaches" card, and the counts on
-- /home. A club's own management of its own roles (/club/roles) reads the
-- table, as it does for its notices: a club can see and close what it
-- posted. The permission suite pins which pages read what (susp-ad-s3).
--
-- Suspension HIDES; it never deletes. A role applied for before the
-- suspension keeps its applications, and re-verifying the club puts every
-- open role back on the board as it was. Nothing here writes a row.
--
-- SECURITY INVOKER, stable, plain SQL — the same shape as 0140, for the same
-- reason (L26: through the anon key it meets coaching_role's row-level
-- security like any other read).
-- ---------------------------------------------------------------------------

create function fn_coaching_roles_advertised() returns setof coaching_role
language sql stable as $$
  select r.* from coaching_role r
  where r.closed_at is null
    and (r.closes_on is null or r.closes_on >= (now() at time zone 'Australia/Melbourne')::date)
    and fn_club_advertises(r.club_id);
$$;

comment on function fn_coaching_roles_advertised() is
  'brief L (0151) — every coaching role on the jobs board: open, not past its closing day, and its club not suspended. Every page that lists a role reads this.';

-- No new table here, so nothing to enable row-level security on (L26).
