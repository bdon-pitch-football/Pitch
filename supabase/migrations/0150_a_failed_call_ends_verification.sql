-- ---------------------------------------------------------------------------
-- 0150 — a call that does not verify a verified club ends its verification
-- (brief L, 29 Sep; doc 14 H5 and M10; doc 27 "Re-verification"; D-126,
-- D-137).
--
-- WHAT WAS WRONG, AND WHY IT IS A LAUNCH BLOCKER. Doc 27 re-calls a verified
-- club on any change of the claiming person, every year on the anniversary,
-- and at once on any report under doc 25, and a call has four outcomes:
-- verified · not verified · suspended · takedown. The call sheet offers all
-- four on every club. Two of them took a club down (suspended, takedown,
-- app/ops/call). The third, "not verified", wrote its row and nothing else,
-- so a verified club whose re-verification FAILED stayed verified: its TD
-- still read the register and every CV on it, its coaches still read their
-- squads, and doc 14 H5 ("club loses verified status: all minor data access
-- is revoked immediately") did not hold for the one way a club loses it that
-- is not a suspension. The operator's own record said "not verified" while
-- the database went on treating the club as a human had vouched for it.
--
-- THE RULE. A verification_call with outcome 'not_verified' on a club whose
-- club_state is 'verified' moves the club to 'claimed', in the same
-- transaction as the call. 'claimed' is what doc 14 M(0) calls a club that
-- has not passed verification, and it is the state doc 27 describes for a
-- club that fails its call: it keeps its page, and "it simply receives
-- nothing about a person under 18". Every read that asks for
-- club_state = 'verified' (fn_read_level, fn_register_rows,
-- fn_can_read_registration, fn_squad_roster, fn_can_read_squad_player,
-- fn_register_grant_squads, fn_is_verified_adult, fn_club_minor_facing, the
-- join and the ask) ends at once, by construction, exactly as M10 does for a
-- suspension (0022). Nothing stores "visible".
--
-- WHAT IT DOES NOT DO.
--   · It is not a suspension. No class is recorded and nobody is told
--     (0066): families are told only of a child-safety suspension, and a
--     failed call is not one. The operator who has a child-safety reason
--     chooses "suspended" and that reason, as now.
--   · It never touches a club that is not verified. A 'not_verified' call on
--     a claimed club is the ordinary first call that did not go cleanly; on a
--     suspended club the more restrictive state stands.
--   · It deletes nothing and ends no membership. The TD stays recorded; a
--     later 'verified' call brings the club back (subject to D-139's pause,
--     which refuses every claimed → verified move while it is on).
--   · verified_call_id is kept: it is the call that last verified the club,
--     and M6's held test (fn_registration_held_unread) reads the call history
--     to know the club was once able to read what is on its register.
--
-- IN THE DATABASE, NOT THE ACTION (D-80, the brief §3). The call sheet's
-- action is one writer of verification_call; a trigger is the rule for every
-- writer there will ever be. A trigger on the call (its insert, or an edit
-- of its outcome) runs in the call's own transaction, so there is no moment
-- at which the call says "not verified" and the club does not.
-- ---------------------------------------------------------------------------

create function fn_failed_call_ends_verification() returns trigger
language plpgsql as $$
begin
  -- An edit that turns a call into a failed one counts the same as a failed
  -- call arriving: the record says "not verified", so the club is not.
  if new.outcome = 'not_verified'
     and (tg_op = 'INSERT' or old.outcome is distinct from new.outcome) then
    update club set club_state = 'claimed'
    where id = new.club_id and club_state = 'verified';
  end if;
  return null;
end $$;

comment on function fn_failed_call_ends_verification() is
  'brief L (0150) — doc 14 H5: a not_verified call on a verified club ends its verification in the same transaction. Not a suspension; tells nobody.';

create trigger verification_call_not_verified
  after insert or update of outcome on verification_call
  for each row execute function fn_failed_call_ends_verification();

-- No new table here, so nothing to enable row-level security on (L26).
