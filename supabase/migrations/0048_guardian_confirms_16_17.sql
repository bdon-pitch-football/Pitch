-- ---------------------------------------------------------------------------
-- 0048 — the parent a 16–17 names is confirmed the same way as an
-- under-16's (D-155 as amended 17 Sep; BUZ's call).
--
-- A 16–17 sign-up used to create the named parent as an APPROVED guardian on
-- the spot — no email, no date of birth, no declaration, approved by nobody
-- but the teenager. Now the parent gets the same two links (D-156), presses
-- "Yes, it's me" on each, ticks the 18-or-over declaration, and only then is
-- the guardianship link written. An account under 18 is never linked (D-155).
--
-- pending_invitation carries the existing child for this case (child_id);
-- approval links to that person instead of creating one. The 14-day purge
-- takes an unconfirmed request as it takes any other.
--
-- Until a parent has confirmed, a 16–17 cannot send their CV. The whole
-- 16–17 promise is "your parent is told every time and holds the switch"
-- (doc 15 §22, D-22), and with no confirmed parent there is nobody to tell
-- and nobody holding it. Building the page is unaffected. (Discovery was
-- already closed: B11 waits on a notice that a fresh 16–17 never had.)
-- ---------------------------------------------------------------------------
alter table pending_invitation add column child_id uuid references person(id) on delete cascade;

create or replace function fn_can_dispatch(p_actor uuid, p_record uuid) returns boolean
language plpgsql stable as $$
declare v_person uuid; v_band text;
begin
  if p_actor is null then return false; end if;   -- L14: no system actor, ever
  select dr.person_id, fn_age_band(p.dob) into v_person, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return false; end if;

  -- L10: an unapproved or revoked u16 record has no send surface at all.
  -- 0048: nor, now, a 16-17 whose parent has not confirmed.
  if v_band in ('u16', '16_17') and not fn_has_approved_guardian(v_person) then
    return false;
  end if;

  -- L11: the guardian's pause stops everything outward-facing, and a send is
  -- the most outward-facing thing there is.
  if coalesce((select profile_paused from guardian_setting where child_id = v_person), false) then
    return false;
  end if;

  -- 18+: the person alone. A re-granted guardianship is visibility, not
  -- control (L9), so it grants no send.
  if v_band = '18plus' then return p_actor = v_person; end if;

  -- L6/L7: the send switch. Off stops the PLAYER sending; the guardian can
  -- still send, because the switch exists to route sending through them
  -- rather than to stop the family sending at all.
  if v_band = '16_17' and p_actor = v_person then
    return not coalesce((select send_disabled from guardian_setting where child_id = v_person), false);
  end if;

  -- L1/L3: a u16 never dispatches, whatever the request says. The child
  -- composes; the guardian sends.
  return exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_actor and g.child_id = v_person
      and g.approved_at is not null and g.revoked_at is null);
end $$;
