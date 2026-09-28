-- ---------------------------------------------------------------------------
-- 0095 — a held registration that is taken off is removed (doc 14 M6, D-126).
--
-- Doc 14 M6: "A family withdraws while a registration is held — the row is
-- removed and the count decrements. Assert the club is never able to learn
-- that a held registration existed." Until now every withdrawal kept its row,
-- emptied and marked withdrawn, which is what D-128 and N7 ask of a
-- registration a club could read. Round C stopped on the conflict; brief D
-- (Leo, 29 Sep) takes round C's option (a): split by whether any club could
-- ever have read the row.
--
--   HELD — the club has never been verified. D-126: nothing reaches a club
--   until BUZ has verified it, so the club has only ever seen a count
--   (fn_register_count), never a row, and no reader is on record
--   (register_read_log, doc 34 rule 6). There is nothing for D-128 to keep
--   for the family and nothing for the club to have read. The row is deleted,
--   in this same statement's transaction, and the count goes down with it.
--   A club verified later has nothing to release: the row is gone.
--
--   READABLE — every other registration: at a verified club, or at a club that
--   was verified once and is suspended now (it may have read the row before).
--   Unchanged: the row stays, withdrawn, its note emptied in the same update
--   (D-128, N7), and the family keeps the record of who at the club read it
--   (fn_register_readers, 0047; the log cascades from this row).
--
-- "NEVER BEEN VERIFIED" is read from the calls, not the state. club_state says
-- what the club is now; a suspended club says nothing about whether it was
-- verified before. So: no verification_call with outcome 'verified' for the
-- club, ever, and the club not verified now. A call logged as verified whose
-- update was refused (the onboarding pause, M13) counts as verified — the
-- doubt goes to keeping the row, which is D-128's answer and the one that
-- loses nothing. Two belts, each of which also keeps the row: a reader on
-- record (register_read_log), and an invitation (none can exist for a held
-- club, P12, and the foreign key would refuse the delete).
--
-- WHAT ELSE POINTS AT THE ROW. registration_request.registration_id (0005):
-- when a guardian sent a child's request, the request points at the
-- registration it made. That pointer is cleared, so the delete can happen;
-- the request itself is the family's own and is left as it was. The consent
-- log's registration_withdrawn event (app/registers/actions.ts) still records
-- the withdrawal: it is append-only (0025) and no club reads it.
--
-- The club learns nothing: ids are uuids, so there is no sequence to show a
-- gap; nothing club-side carries a timestamp that a withdrawal moves; the
-- only club-side trace is the count, which reads as if the row had never
-- been. Doc 14 J61 measures the pages, in bytes and in time.
-- ---------------------------------------------------------------------------
-- Whether no club could ever have read this registration: the test above, on
-- its own so the permission suite can ask it directly.
create or replace function fn_registration_held_unread(p_registration uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from registration r join club c on c.id = r.club_id
    where r.id = p_registration
      and c.club_state <> 'verified'
      and not exists (select 1 from verification_call vc where vc.club_id = c.id and vc.outcome = 'verified')
      and not exists (select 1 from register_read_log l where l.registration_id = r.id)
      and not exists (select 1 from invitation i where i.registration_id = r.id))
$$;

create or replace function fn_withdraw_registration(p_actor uuid, p_registration uuid) returns boolean
language plpgsql as $$
declare v_player uuid; v_club uuid;
begin
  select player_id, club_id into v_player, v_club from registration where id = p_registration and withdrawn_at is null;
  if not found then return false; end if;
  -- the player themself, or an approved guardian. Guardianship auto-expires
  -- at 18 (D-49, computed never stored): for an adult it counts only if
  -- the adult re-granted it.
  if p_actor <> v_player and not exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_actor and g.child_id = v_player
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null)
  ) then return false; end if;

  -- Hold the club still while deciding. A verification committing between
  -- the test and the delete would make the row readable for that moment; the
  -- operator's update (M5) waits on this lock, or this waits on it and then
  -- reads the club as verified and keeps the row.
  perform 1 from club where id = v_club for share;
  if fn_registration_held_unread(p_registration) then
    update registration_request set registration_id = null where registration_id = p_registration;
    delete from registration where id = p_registration;
  else
    update registration set withdrawn_at = now(), note = null where id = p_registration;
  end if;
  return true;
end $$;
