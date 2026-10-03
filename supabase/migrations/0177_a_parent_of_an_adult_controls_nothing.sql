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
-- PRODUCTION (after 0174–0176). One new function and eight
-- `create or replace function` on unchanged signatures, in the runner's
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
