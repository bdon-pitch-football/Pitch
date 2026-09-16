-- ---------------------------------------------------------------------------
-- 0041 — "take one off": the send log names each send's own link.
--
-- Every send mints its own share token (lib/send-dispatch.ts), so switching
-- off the link ONE club has, and leaving the rest working, was always
-- possible. Nothing in the product could do it: the guardian's only controls
-- were Replace (every link at once) and Pause (the whole page). The launch
-- walkthrough "take one off — it stops working, that minute" described a
-- control that did not exist.
--
-- fn_send_log keeps every rule it had (U-5: an under-16 reading their own
-- log sees the club, never the address; only the person and their approved
-- guardians get anything) and adds two columns: the share token's row id —
-- an internal id, never the token, which is stored hashed (D-80) — and
-- whether that link still opens the page. The action that switches one off
-- re-checks ownership itself; holding an id grants nothing.
-- ---------------------------------------------------------------------------
drop function if exists fn_send_log(uuid, uuid);

create function fn_send_log(p_viewer uuid, p_person uuid)
returns table (at timestamptz, club_name text, recipient text, sending_actor uuid, band_at_send text,
               token_id uuid, live boolean)
language plpgsql stable as $$
declare v_is_guardian boolean;
begin
  if p_viewer is null then return; end if;

  v_is_guardian := exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null));

  if p_viewer <> p_person and not v_is_guardian then return; end if;

  return query
    select ce.at,
           ce.detail->>'club_name',
           case
             when v_is_guardian then ce.detail->>'recipient'
             when fn_age_band((select dob from person where id = p_person)) = 'u16' then null
             else ce.detail->>'recipient'
           end,
           ce.actor_id,
           ce.detail->>'band_at_send',
           (ce.detail->>'token_id')::uuid,
           exists (select 1 from share_token st
                   where st.id = (ce.detail->>'token_id')::uuid
                     and st.revoked_at is null and st.paused = false
                     and (st.expires_at is null or st.expires_at > now()))
    from consent_event ce
    where ce.subject_id = p_person and ce.event = 'share_dispatched'
    order by ce.at desc;
end $$;
