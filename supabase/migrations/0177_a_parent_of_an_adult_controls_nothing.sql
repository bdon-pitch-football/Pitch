-- ---------------------------------------------------------------------------
-- 0177 — A parent of an adult controls nothing (D-49; doc 14 F17, P15, A5).
-- Hotfix, Leo 3 Oct, found by Staff while planning John's J-4 question
-- (13-Board-Room/JOHN-to-LEO-five-packages-3-oct.md §4.4).
--
-- WHY THIS EXISTS. D-49: at 18 "guardian visibility auto-expires; the adult
-- can re-grant". The expiry is computed, never stored, so nothing revokes the
-- guardianship_link row on the birthday. fn_read_level and fn_record_actor
-- check the age band. Five other places check only "approved and not
-- revoked", so a parent kept everything over their child's record after the
-- child turned 18, with no re-grant needed:
--   · fn_erase_child (0084): the parent could erase the adult's whole record;
--   · fn_consent_timeline (0169) and fn_who_looked (0025): the parent read the
--     adult's consent history and who at Pitch looked;
--   · /g/controls (page and actions, in app code): new and renewed share
--     links, pause, the send switch, switching a link off, and the erasure;
--   · /g/card, /g/send, /g/interest and lib/interest-dispatch (app code): a
--     request the child made before 18 could still be approved or dispatched
--     by the parent, including putting the adult on a club's register.
-- Proved on an in-memory database: a parent of an 18-year-old, never
-- re-granted, erased her record with fn_erase_child.
--
-- THE RULE, IN ONE PLACE (L23). fn_guardian_controls(guardian, person): an
-- approved, unrevoked guardian of a person who is not 18plus. A re-grant
-- gives no controls: D-49 restores visibility, not authority (P15, L9,
-- SQ3f). Every gate above asks it, and the app's gates ask it instead of
-- their own join.
--
-- WHAT A RE-GRANT SHOWS (John, 3 Oct, JOHN-to-LEO-adult-guardian-3-oct.md
-- §2; doc 14 G11). "D-49 gives back the record, not the log." A re-granted
-- guardian reads the CV (fn_read_level 'full', unchanged) and, when it is
-- built, /season (A29, from a read-only predicate). Never the consent
-- timeline, who-looked, the send log, the return facts or the register
-- readers, which are records of what the adult does and who deals with them.
-- Those five now ask fn_guardian_controls, so for an adult they return
-- nothing, re-granted or not. The person themself is unchanged.
--
-- THE RE-GRANT CLAUSE (John J-4 and §1). fn_record_actor answered 'guardian'
-- for a re-granted guardian of an adult, which opened every family write
-- route (/build, /send, the share card, register interest, /g/pending): a
-- re-granted guardian could write an adult's CV. fn_withdraw_registration
-- let them withdraw the adult's registration. Both now ask
-- fn_guardian_controls. Afterwards fn_read_level is the only function that
-- reads regranted_at, and this file checks that. Nothing in the product
-- writes regranted_at, so no row in production changes meaning.
--
-- HOW IT EDITS. Each function's live definition is read, the gate clause must
-- appear exactly once or the file refuses, the clause is swapped, and the
-- result is checked. Nothing else in the bodies changes, so 0084's erasure,
-- 0169's timeline and 0095's withdrawal keep every other line.
--
-- PRODUCTION (after 0174–0176). One new function and eleven
-- `create or replace function` (eight here, three in the folded block at the
-- end) on unchanged signatures, in the runner's
-- single transaction. No table is locked or rewritten, and grants and owners
-- are kept. fn_erase_child's revokes from anon and authenticated (0067, 0084)
-- survive a replace. A re-run is refused by the ledger and by the guards,
-- which find no old clause.
-- ---------------------------------------------------------------------------

create function fn_guardian_controls(p_guardian uuid, p_person uuid) returns boolean
language sql stable as $$
  select p_guardian is not null and p_person is not null and exists (
    select 1 from guardianship_link g
    join person c on c.id = g.child_id
    where g.guardian_id = p_guardian and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and fn_age_band(c.dob) <> '18plus')
$$;
comment on function fn_guardian_controls(uuid, uuid) is
  'D-49 (0177): may this guardian act for this person — an approved, unrevoked guardian of someone under 18. A re-grant restores reading (fn_read_level), never controls.';

-- Nothing outside the server asks this: through the API it would answer
-- "is this person that child's parent" for any two ids (0165's pattern).
revoke all on function fn_guardian_controls(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_guardian_controls(uuid, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_guardian_controls(uuid, uuid) from authenticated';
  end if;
end $$;

do $m$
declare
  -- (function, old clause, new clause, a fragment that must be in the result)
  v_edits constant text[][] := array[
    array['public.fn_erase_child(uuid, uuid)',
'if p_guardian is null or p_child is null or not exists (
    select 1 from guardianship_link
    where guardian_id = p_guardian and child_id = p_child
      and approved_at is not null and revoked_at is null
  ) then',
'if p_guardian is null or p_child is null or not fn_guardian_controls(p_guardian, p_child) then'],
    array['public.fn_consent_timeline(uuid, uuid)',
'if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return; end if;',
'if p_viewer <> p_person and not fn_guardian_controls(p_viewer, p_person) then return; end if;'],
    array['public.fn_who_looked(uuid, uuid)',
'if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return; end if;',
'if p_viewer <> p_person and not fn_guardian_controls(p_viewer, p_person) then return; end if;'],
    array['public.fn_record_actor(uuid, uuid)',
'if exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_person and g.child_id = v_owner
      and g.approved_at is not null and g.revoked_at is null
      and (v_band <> ''18plus'' or g.regranted_at is not null)
  ) then return ''guardian''; end if;',
'if fn_guardian_controls(p_person, v_owner) then return ''guardian''; end if;'],
    array['public.fn_withdraw_registration(uuid, uuid)',
'-- the player themself, or an approved guardian. Guardianship auto-expires
  -- at 18 (D-49, computed never stored): for an adult it counts only if
  -- the adult re-granted it.
  if p_actor <> v_player and not exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_actor and g.child_id = v_player
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> ''18plus'' or g.regranted_at is not null)
  ) then return false; end if;',
'-- the player themself, or a guardian who may act for them (0177): never
  -- for an adult, re-granted or not (D-49 restores reading, not control).
  if p_actor <> v_player and not fn_guardian_controls(p_actor, v_player) then return false; end if;'],
    array['public.fn_send_log(uuid, uuid)',
'v_is_guardian := exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> ''18plus'' or g.regranted_at is not null));',
'-- 0177 (John, 3 Oct, G11): a guardian of someone under 18. An adult''s
  -- sends are their own correspondence, re-granted or not.
  v_is_guardian := fn_guardian_controls(p_viewer, p_person);'],
    array['public.fn_register_readers(uuid, uuid)',
'or exists (
            select 1 from guardianship_link g
            join person ch on ch.id = g.child_id
            where g.guardian_id = p_viewer and g.child_id = p_person
              and g.approved_at is not null and g.revoked_at is null
              and (fn_age_band(ch.dob) <> ''18plus'' or g.regranted_at is not null));',
'-- 0177 (John, 3 Oct, G11): never an adult''s parent, re-granted or not.
       or fn_guardian_controls(p_viewer, p_person);'],
    array['public.fn_return_facts(uuid, timestamp with time zone)',
'-- Whose facts this viewer may be shown: themselves, and every child whose
  -- guardianship is approved and live. At eighteen a guardianship is
  -- visibility and only if re-granted (D-49, M3) — asked in the same words as
  -- fn_register_readers, so the two cannot drift apart.
  v_subjects := array(
    select p_viewer
    union
    select g.child_id
      from guardianship_link g
      join person ch on ch.id = g.child_id
     where g.guardian_id = p_viewer
       and g.approved_at is not null and g.revoked_at is null
       and (fn_age_band(ch.dob) <> ''18plus'' or g.regranted_at is not null));',
'-- Whose facts this viewer may be shown: themselves, and every child they
  -- are a guardian of while that child is under 18. At eighteen, nothing,
  -- re-granted or not (0177, John 3 Oct, G11: a re-grant shows the record,
  -- never the log). Asked through fn_guardian_controls, as
  -- fn_register_readers asks it, so the two cannot drift apart.
  v_subjects := array(
    select p_viewer
    union
    select g.child_id
      from guardianship_link g
     where g.guardian_id = p_viewer
       and fn_guardian_controls(p_viewer, g.child_id));']
  ];
  v_fn  regprocedure;
  v_def text;
  v_n   int;
  i     int;
begin
  for i in 1 .. array_length(v_edits, 1) loop
    v_fn := v_edits[i][1]::regprocedure;
    v_def := pg_get_functiondef(v_fn);
    v_n := (length(v_def) - length(replace(v_def, v_edits[i][2], ''))) / length(v_edits[i][2]);
    if v_n <> 1 then
      raise exception '0177: expected the guardian gate exactly once in %, found %', v_edits[i][1], v_n;
    end if;
    execute replace(v_def, v_edits[i][2], v_edits[i][3]);
    v_def := pg_get_functiondef(v_fn);
    if v_def not like '%fn_guardian_controls(%' or v_def like '%regranted_at%' then
      raise exception '0177: % does not ask fn_guardian_controls as it should', v_edits[i][1];
    end if;
  end loop;

  -- fn_read_level is the only function left that reads a re-grant (G11),
  -- and the erasure is still not callable by the API roles.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname <> 'fn_read_level'
                and p.prosrc like '%regranted_at%') then
    raise exception '0177: a function other than fn_read_level still reads regranted_at';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_function_privilege('authenticated', 'public.fn_erase_child(uuid, uuid)', 'execute') then
    raise exception '0177: fn_erase_child became callable by authenticated';
  end if;
end $m$;

-- ---------------------------------------------------------------------------
-- Folded in (Leo, 3 Oct), from build/john-four's safety review
-- (safety-john-four.md): the same family, a guardian's controls.
--
-- F1 · A 16–17's guardian never sends (doc 14 L5–L7, E16; John's 3 Oct §3
-- table: a 16–17's guardian may not "Make a link" or "Send the CV").
-- fn_can_dispatch (0048) let any approved guardian dispatch a 16_17 record,
-- so /g/send could make a link and send it in two ways: a request the child
-- composed at 15 still waiting at 16, and a 16–17's own send left behind when
-- the switch went off. For 16_17 it now answers the player alone, and the
-- switch stops them. A request composed for a guardian to send, before the
-- 16th birthday, is void from the birthday: nobody can send it (fail closed,
-- G7), and fn_lapse_send_requests clears it with the 14-day lapses.
--
-- N3 · One record's failure no longer stops the birthday clear. Each record
-- in fn_clear_waiting_at_16 (0174) runs in its own subtransaction: a failure
-- is rolled back for that record alone, logged with its SQLSTATE only (never
-- an id), and the loop goes on. The daily job also carries on past the whole
-- step (app/api/jobs/daily/route.ts).
--
-- N1 · The write functions 0174 and 0175 added lose the default EXECUTE for
-- PUBLIC, as 0122, 0167, 0169 and 0170 do. No exploit was found; it is the
-- standing pattern, and fn_guardian_replace_link takes the guardian's id as an
-- argument.
-- ---------------------------------------------------------------------------
do $m$
declare
  v_edits constant text[][] := array[
    array['public.fn_can_dispatch(uuid, uuid)',
'-- L6/L7: the send switch. Off stops the PLAYER sending; the guardian can
  -- still send, because the switch exists to route sending through them
  -- rather than to stop the family sending at all.
  if v_band = ''16_17'' and p_actor = v_person then
    return not coalesce((select send_disabled from guardian_setting where child_id = v_person), false);
  end if;',
'-- L5–L7, E16 (John, 3 Oct; 0177, safety review F1): a 16–17 sends, and their
  -- guardian never does. The switch stops the player sending; a request left
  -- behind, or one composed before 16 for a guardian to send, is sent by nobody.
  if v_band = ''16_17'' then
    return p_actor = v_person
       and not coalesce((select send_disabled from guardian_setting where child_id = v_person), false);
  end if;',
     '%if v_band = ''16_17'' then%'],
    array['public.fn_lapse_send_requests()',
'where dispatched_at is null and created_at < now() - interval ''14 days''',
'where dispatched_at is null
      and (created_at < now() - interval ''14 days''
           -- 0177 (F1): composed before the 16th birthday for a guardian to
           -- send. Void from the birthday (Melbourne, G9).
           or exists (select 1 from development_record dr join person p on p.id = dr.person_id
                       where dr.id = share_request.record_id and p.dob is not null
                         and fn_age_band(p.dob) <> ''u16''
                         and (share_request.created_at at time zone ''Australia/Melbourne'')::date < (p.dob + interval ''16 years'')::date))',
     '%0177 (F1)%'],
    array['public.fn_clear_waiting_at_16()',
'record_id := r.rec;
    photo := fn_clear_waiting(r.rec);
    return next;',
'record_id := r.rec;
    -- 0177 (N3): one record''s failure is rolled back for that record alone,
    -- logged by SQLSTATE (never an id), and the rest go on.
    begin
      photo := fn_clear_waiting(r.rec);
    exception when others then
      raise warning ''0177: the birthday clear failed for one record (%); the rest go on'', sqlstate;
      continue;
    end;
    return next;',
     '%exception when others then%'],
    -- B1 (safety review, 4 Oct): the share-card gate asked fn_can_dispatch
    -- alone, which after F1 answers a 16–17 and never their guardian, so the
    -- parent's /g/card press raised. The card keeps what it had before F1:
    -- whoever may send (a 16–17 themself, doc 14 Q9), or a guardian who acts
    -- for the child (never an adult's parent), and nobody while it is paused.
    array['public.share_card_approval_gate()',
'if new.approved_by is not null and not fn_can_dispatch(new.approved_by, new.record_id) then',
'if new.approved_by is not null and not (
       fn_can_dispatch(new.approved_by, new.record_id)
       or (fn_guardian_controls(new.approved_by,
             (select dr.person_id from development_record dr where dr.id = new.record_id))
           and not coalesce((select gs.profile_paused from guardian_setting gs
                              join development_record dr on dr.person_id = gs.child_id
                              where dr.id = new.record_id), false))) then',
     '%fn_guardian_controls(new.approved_by,%']
  ];
  v_fn  regprocedure;
  v_def text;
  v_n   int;
  i     int;
begin
  for i in 1 .. array_length(v_edits, 1) loop
    v_fn := v_edits[i][1]::regprocedure;
    v_def := pg_get_functiondef(v_fn);
    v_n := (length(v_def) - length(replace(v_def, v_edits[i][2], ''))) / length(v_edits[i][2]);
    if v_n <> 1 then
      raise exception '0177: expected the clause exactly once in %, found %', v_edits[i][1], v_n;
    end if;
    execute replace(v_def, v_edits[i][2], v_edits[i][3]);
    if pg_get_functiondef(v_fn) not like v_edits[i][4] then
      raise exception '0177: % did not take its change', v_edits[i][1];
    end if;
  end loop;
end $m$;

-- N1: nothing outside the server calls these.
revoke all on function fn_clear_waiting(uuid) from public;
revoke all on function fn_clear_waiting_at_16() from public;
revoke all on function fn_release_own_page(uuid, uuid) from public;
revoke all on function fn_guardian_replace_link(uuid, uuid, bytea, text) from public;
revoke all on function fn_guardian_renew_link(uuid, uuid) from public;
do $$
declare f text;
begin
  foreach f in array array['fn_clear_waiting(uuid)', 'fn_clear_waiting_at_16()', 'fn_release_own_page(uuid, uuid)',
                           'fn_guardian_replace_link(uuid, uuid, bytea, text)', 'fn_guardian_renew_link(uuid, uuid)'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f);
    end if;
  end loop;
end $$;
