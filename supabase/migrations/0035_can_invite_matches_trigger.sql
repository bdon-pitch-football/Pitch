-- fn_can_invite hid fewer cases than invitation_club_entitled() refuses.
--
-- The write trigger (0034) refuses a paused profile and an under-16 with no
-- approved guardian (P12, A17). fn_can_invite did not, so the register and
-- the invite page offered "Invite to trial" for exactly those families, and
-- pressing it threw inside the action and the page 500ed. Found when a
-- guardian link was revoked for a register child and the TD pressed send.
--
-- The rule underneath (John, on the invitation basis, section 4): refusal
-- must be indistinguishable from absence. No greyed button, no different
-- error. So the affordance is simply not there, and it is not there for
-- precisely the cases the database would refuse — no more, no fewer.
-- doc 14 P19 asserts the two agree.
create or replace function fn_can_invite(p_person uuid, p_registration uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid; v_trial uuid; v_withdrawn timestamptz; v_player uuid;
begin
  if p_person is null then return false; end if;
  select club_id, trial_notice_id, withdrawn_at, player_id
    into v_club, v_trial, v_withdrawn, v_player
    from registration where id = p_registration;
  if not found or v_withdrawn is not null then return false; end if;
  if not fn_can_work_register(p_person, v_club) then return false; end if;
  -- D-126: nothing about a family reaches a club before verification.
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  -- P12: a paused profile is not reachable. Same test as the trigger.
  if coalesce((select profile_paused from guardian_setting where child_id = v_player), false) then
    return false;
  end if;
  -- A17: an under-16 with no approved guardian does not exist for a club.
  if (select fn_age_band(dob) from person where id = v_player) = 'u16'
     and not fn_has_approved_guardian(v_player) then
    return false;
  end if;
  -- The paid register: anyone on it.
  if fn_register_active(v_club) then return true; end if;
  -- D-153, the free tier: anyone who registered interest in a trial this club posted.
  return v_trial is not null
    and exists (select 1 from trial_notice t where t.id = v_trial and t.club_id = v_club);
end $$;
