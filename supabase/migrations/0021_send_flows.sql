-- ---------------------------------------------------------------------------
-- 0021 — table L, the send flows. Three real gaps the spec found.
--
-- 1. L11 — fn_can_dispatch ignored the guardian's PAUSE. A paused profile
--    could still be sent to a club, and the club's first click would land on
--    the link-state page. "A send that resolves to the link-state page is a
--    send that misleads the club."
--
-- 2. L6/L7 — there was no SEND switch. D-22's off-switch was built for
--    discovery only, but a 16-17 year old sends their own CV (L5) and their
--    guardian must be able to stop that without pausing the whole profile.
--    Most-restrictive-wins: either guardian setting it turns it off (L7).
--
-- 3. L20 — standing must be re-checked at DISPATCH, never carried from the
--    moment of approval. A guardianship revoked between the two fails closed.
--    fn_can_dispatch is a stable function called by the trigger on every
--    insert AND update of share_request, so this holds by construction; the
--    tests pin it.
-- ---------------------------------------------------------------------------
alter table guardian_setting add column send_disabled boolean not null default false;

drop trigger if exists share_token_issuer_entitled on share_token;
drop trigger if exists share_request_dispatch_entitled on share_request;
drop trigger if exists share_card_approval_gate on share_card_approval;
drop function if exists fn_can_dispatch(uuid, uuid);

create function fn_can_dispatch(p_actor uuid, p_record uuid) returns boolean
language plpgsql stable as $$
declare v_person uuid; v_band text;
begin
  if p_actor is null then return false; end if;   -- L14: no system actor, ever
  select dr.person_id, fn_age_band(p.dob) into v_person, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return false; end if;

  -- L10: an unapproved or revoked u16 record has no send surface at all.
  if v_band = 'u16' and not fn_has_approved_guardian(v_person) then
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

create trigger share_token_issuer_entitled
  before insert on share_token
  for each row execute function share_token_issuer_entitled();

create trigger share_request_dispatch_entitled
  before insert or update on share_request
  for each row execute function share_request_dispatch_entitled();

create trigger share_card_approval_gate
  before insert or update on share_card_approval
  for each row execute function share_card_approval_gate();

-- ----------------------------------------------------------------------------
-- L61 / J44 — a child's own club has no business knowing which OTHER clubs
-- the family wrote to. This is the read path for send rows, and the only one:
-- the guardian and the player, and nobody else. Not a coach, not the TD, not
-- the club administrator, not support.
-- ----------------------------------------------------------------------------
create function fn_send_log(p_viewer uuid, p_person uuid)
returns table (at timestamptz, recipient text, sending_actor uuid, band_at_send text)
language plpgsql stable as $$
begin
  if p_viewer is null then return; end if;
  -- Only the person themself or an approved guardian (L57, L58's owner).
  if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null)
  ) then return; end if;

  return query
    select ce.at,
           ce.detail->>'recipient',
           ce.actor_id,
           ce.detail->>'band_at_send'
    from consent_event ce
    where ce.subject_id = p_person and ce.event = 'share_dispatched'
    order by ce.at desc;
end $$;
