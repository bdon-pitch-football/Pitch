-- ---------------------------------------------------------------------------
-- 0044 — the two kill switches D-94 §10 asks for, "that a tired founder can
-- hit at 11pm":
--
--   1. A global pause on public profile serving. While it is on, every
--      shared CV link answers exactly as a dead link does (D-77): one page,
--      no name, no hint that the pause exists. It is folded into
--      fn_token_read, the single tokenised read path (D-80), so there is no
--      surface that can forget it. Undoable: switch it off and every link
--      that was live before is live again.
--
--   2. Revoke every live link at once. For a breach. Not undoable: each
--      family sends a new link when they are ready. Every affected child's
--      timeline gets one append-only row saying Pitch did it, so a parent is
--      never left thinking they did.
--
-- Both are operator-only (lib/ops-guard) and both write an append-only row
-- carrying the operator's name, email and reason — the audit log has to be
-- able to answer "what was switched, by whom, when, and why" at the worst
-- possible moment (D-94 §10).
-- ---------------------------------------------------------------------------

-- One row, ever. The check on id makes a second row impossible.
create table ops_switch (
  id boolean primary key default true check (id),
  public_links_paused boolean not null default false
);
insert into ops_switch default values;
alter table ops_switch enable row level security;

-- Who switched what. No foreign key to person on purpose: an operator who
-- later deletes their account must not be able to take the record of what
-- they did with them, and an append-only row cannot be updated to null.
create table ops_switch_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (action in ('links_paused', 'links_resumed', 'links_all_revoked')),
  operator_id uuid not null,
  operator_email text not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  links_affected int
);
alter table ops_switch_event enable row level security;

create function ops_switch_event_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'ops_switch_event is append-only (D-94 §10)';
end $$;

create trigger ops_switch_event_no_update before update or delete on ops_switch_event
  for each row execute function ops_switch_event_immutable();

create function fn_public_links_paused() returns boolean
language sql stable as $$
  select coalesce((select public_links_paused from ops_switch), false)
$$;

-- Pause or resume. Returns true when the state changed; flipping a switch to
-- where it already is writes nothing.
create function fn_ops_set_links_paused(p_paused boolean, p_operator uuid, p_email text, p_reason text)
returns boolean
language plpgsql as $$
declare
  v_changed int;
begin
  update ops_switch set public_links_paused = p_paused where public_links_paused <> p_paused;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then return false; end if;
  insert into ops_switch_event (action, operator_id, operator_email, reason)
  values (case when p_paused then 'links_paused' else 'links_resumed' end, p_operator, p_email, p_reason);
  return true;
end $$;

-- Revoke every live link, in one transaction, and say so on every affected
-- child's timeline. Returns how many links it switched off.
create function fn_ops_revoke_all_links(p_operator uuid, p_email text, p_reason text)
returns int
language plpgsql as $$
declare
  v_count int;
begin
  with gone as (
    update share_token set revoked_at = now()
    where revoked_at is null
    returning record_id
  ), people as (
    select distinct dr.person_id from gone join development_record dr on dr.id = gone.record_id
  ), logged as (
    insert into consent_event (event, actor_id, subject_id, detail)
    select 'share_revoked', null, person_id, jsonb_build_object('kind', 'pitch') from people
    returning 1
  )
  select (select count(*) from gone) into v_count;
  insert into ops_switch_event (action, operator_id, operator_email, reason, links_affected)
  values ('links_all_revoked', p_operator, p_email, p_reason, v_count);
  return v_count;
end $$;

-- The single tokenised read path, with the pause folded in first. Otherwise
-- unchanged from 0010 (content hold) and 0003.
create or replace function fn_token_read(p_token_hash bytea) returns jsonb
language plpgsql stable as $$
declare
  v_record uuid;
  v_person uuid;
  v_band text;
  v_content jsonb;
begin
  if fn_public_links_paused() then return null; end if;

  select st.record_id, dr.person_id
    into v_record, v_person
  from share_token st
  join development_record dr on dr.id = st.record_id
  where st.token_hash = p_token_hash
    and st.revoked_at is null
    and st.paused = false
    and (st.expires_at is null or st.expires_at > now());
  if not found then return null; end if;

  if fn_record_held(v_record) then return null; end if;

  select fn_age_band(dob) into v_band from person where id = v_person;

  if coalesce((select profile_paused from guardian_setting where child_id = v_person), false) then
    return null;
  end if;

  if v_band = 'u16' then
    if not fn_has_approved_guardian(v_person) then return null; end if;
    select content into v_content from profile_version
      where record_id = v_record and status = 'approved';
    if not found then return null; end if;
  else
    v_content := null;
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;
