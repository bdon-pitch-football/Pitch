-- ---------------------------------------------------------------------------
-- 0067 — one-tap deletion completes, for every child (D-26, doc 14 I1, U-6).
--
-- WHY THIS EXISTS. The deletion was a list of statements in a server action
-- (app/g/controls/[childId]/actions.ts), and a list is only as good as the
-- tables its author remembered. Two it did not:
--
--   · investigation_access (0025) references investigation_grant with no
--     cascade and is append-only by trigger. The action deleted the grant, the
--     log row could not go, and the WHOLE deletion rolled back. Any child a
--     complaints investigator had looked at could not be deleted. The family
--     pressed the button and kept the record they asked us to destroy.
--   · message_outbox.subject_id (0065, 28 Sep) names the child a message is
--     ABOUT. The guardian flow writes it for every 16–17 who names a parent,
--     and nothing deleted it — so from 28 Sep a 16–17 who signed up through
--     the product could not be deleted either.
--
-- Nothing drove either path: the one test that pressed the button (write
-- suite x3) used a seeded child who had never touched either table.
--
-- WHAT CHANGES.
--
-- 1 · The deletion moves into Postgres as fn_erase_child, so the permission
--     suite runs the same code the button runs, and a property check there
--     enumerates every foreign key onto person(id) from pg_constraint. A table
--     added tomorrow that references a person and is not handled here fails
--     that check by name.
--
-- 2 · Leo's decision, 28 Sep, for the investigation trail: the deletion must
--     succeed, and the trail survives with NO LINK TO THE CHILD. The grant's
--     subject_id is nulled, not deleted, so the log still answers "what was
--     accessed, by whom, for which report, when" without identifying a person
--     who no longer exists. fn_who_looked keys on subject_id and so returns
--     nothing for them, which is correct: there is nobody left to ask.
--     WHETHER the trail should be retained at all after erasure is John's
--     question, and it is in the 28 Sep builder report; this builds retention.
--
-- 3 · Every column where the child is named falls in one of three kinds, and
--     the function says which, table by table:
--       ABOUT or OWNED BY the child — deleted (the record and everything that
--         cascades from it, memberships, registrations, requests, messages to
--         or about them, their tokens, their coach page, grants TO them).
--       SOMEONE ELSE'S ROW the child merely signed — kept, and the name taken
--         off it. An assessment the child wrote on another player's record is
--         that player's record (D-48: "the record travels whole"; D-10), so
--         deleting it would delete part of another child. The attribution
--         goes; the entry stays. Same for a club's alumni line, video, role
--         or notice, a version they approved, a registration they disclosed.
--       SOMEONE ELSE'S ACCESS the child granted or asked for — deleted: a
--         register grant they gave, a coach invite they sent, a squad claim or
--         invitation they raised for another player. Removing access to
--         children is the restrictive direction (TRAINING §3.8), and none of
--         these is a record of what a child did.
--     Most of the second and third kinds are unreachable for a child today —
--     the database already refuses a minor as a guardian (0048), a technical
--     director (0058) or a register reader (0047). They are handled anyway,
--     because the property is "no row names the child", not "no row a child
--     can reach today names the child", and the day one of those rules
--     changes is not the day anyone will remember this function.
--
-- 4 · Six columns that name a person were NOT NULL and must now be able to
--     lose the name: investigation_grant.subject_id and .investigator_id,
--     assessment_entry.author_id, growth_note.entered_by,
--     share_token.issued_by and register_read_log.person_id. A new row still
--     has to carry the name — fn_insert_names_its_person refuses an insert
--     without it — so the only way a row comes to have none is an erasure.
--
-- 5 · Two triggers refuse the update erasure needs, on purpose:
--     record_entry's author is immutable (D-50) and an approved invitation
--     reply must name its approver (D-153). Both now let exactly one update
--     through: removing the name of the person being erased in this
--     transaction (pitch.erasing, set by fn_erase_child with is_local), with
--     every other column unchanged. Nothing else about either rule moves.
--
-- WHAT IS DELIBERATELY KEPT. consent_event carries the child's id with no
-- foreign key, precisely so the proof that permission was given and
-- withdrawn survives the erasure (doc 14 I5, D-26). coach_authorship keeps
-- the anonymised counts 0026 writes for OTHER authors (doc 14 I3).
-- ---------------------------------------------------------------------------

-- ---- 4 · the six names that an erasure may take off ------------------------
alter table investigation_grant alter column subject_id drop not null;
alter table investigation_grant alter column investigator_id drop not null;
alter table assessment_entry alter column author_id drop not null;
alter table growth_note alter column entered_by drop not null;
alter table share_token alter column issued_by drop not null;
alter table register_read_log alter column person_id drop not null;

-- A new row names its person. Only an erasure removes the name afterwards.
create function fn_insert_names_its_person() returns trigger
language plpgsql as $$
begin
  if to_jsonb(new) ->> tg_argv[0] is null then
    raise exception '%.% names a person; only an erasure may remove it', tg_table_name, tg_argv[0]
      using errcode = 'not_null_violation';
  end if;
  return new;
end $$;

create trigger investigation_grant_names_subject before insert on investigation_grant
  for each row execute function fn_insert_names_its_person('subject_id');
create trigger investigation_grant_names_investigator before insert on investigation_grant
  for each row execute function fn_insert_names_its_person('investigator_id');
create trigger assessment_entry_names_author before insert on assessment_entry
  for each row execute function fn_insert_names_its_person('author_id');
create trigger growth_note_names_author before insert on growth_note
  for each row execute function fn_insert_names_its_person('entered_by');
create trigger share_token_names_issuer before insert on share_token
  for each row execute function fn_insert_names_its_person('issued_by');
create trigger register_read_log_names_reader before insert on register_read_log
  for each row execute function fn_insert_names_its_person('person_id');

-- ---- 5 · the two triggers that let an erasure take a name off --------------
-- Exactly one update is let through: the erased person's name removed, and
-- nothing else on the row different.
create function fn_is_erasing_name(p_old jsonb, p_new jsonb, p_col text) returns boolean
language sql stable as $$
  select coalesce(current_setting('pitch.erasing', true), '') <> ''
     and p_old ->> p_col = current_setting('pitch.erasing', true)
     and p_new ->> p_col is null
     and (p_old - p_col) = (p_new - p_col)
$$;

create or replace function record_entry_edit_window() returns trigger
language plpgsql as $$
begin
  -- 0067: an erasure takes the erased author's name off an entry on somebody
  -- else's record. The entry stays; it is theirs (D-48).
  if fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'author_id') then
    return new;
  end if;
  if old.created_at < now() - interval '48 hours' then
    raise exception 'the author edit window has closed; supersede instead';
  end if;
  if new.record_id <> old.record_id or new.author_id is distinct from old.author_id
     or new.provenance <> old.provenance or new.created_at <> old.created_at then
    raise exception 'authorship and provenance are immutable';
  end if;
  return new;
end $$;

create or replace function invitation_reply_approval() returns trigger
language plpgsql as $$
declare v_player uuid; v_band text;
begin
  -- 0067: an erasure takes the erased approver's name off a reply that was
  -- already sent. The reply is the other family's; it stays.
  if tg_op = 'UPDATE' and fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'approved_by') then
    return new;
  end if;
  if new.approved_at is null then return new; end if;
  select r.player_id, fn_age_band(p.dob) into v_player, v_band
    from invitation i
    join registration r on r.id = i.registration_id
    join person p on p.id = r.player_id
    where i.id = new.invitation_id;
  if new.approved_by is null then
    raise exception 'an approved reply names who approved it';
  end if;
  if v_band = '18plus' then
    -- An adult answers for themselves. A re-granted guardianship is
    -- visibility, not control (L9's reasoning, applied here).
    if new.approved_by <> v_player then
      raise exception 'an adult answers for themselves';
    end if;
  elsif not exists (
    select 1 from guardianship_link g
    where g.guardian_id = new.approved_by and g.child_id = v_player
      and g.approved_at is not null and g.revoked_at is null
  ) then
    raise exception 'under 18, a reply goes only when a parent approves it';
  end if;
  return new;
end $$;

-- ---- 1 · the deletion, where the suite can run it --------------------------
-- Called by the guardian's "Delete everything" (the action checks the caller
-- first, and so does this: an erasure is not something a function hands to
-- whoever asks). One transaction: the two consent rows and everything
-- between them, or nothing.
create function fn_erase_child(p_guardian uuid, p_child uuid) returns void
language plpgsql as $$
begin
  if p_guardian is null or p_child is null or not exists (
    select 1 from guardianship_link
    where guardian_id = p_guardian and child_id = p_child
      and approved_at is not null and revoked_at is null
  ) then
    raise exception 'only an approved guardian deletes a child''s record';
  end if;

  insert into consent_event (event, actor_id, subject_id, detail)
    values ('deletion_requested', p_guardian, p_child, '{}');
  perform set_config('pitch.erasing', p_child::text, true);

  -- ABOUT the child. The record first: it cascades stats, entries, clips,
  -- versions, tokens (and the access requests and undo links on them), send
  -- requests and interest requests.
  delete from development_record where person_id = p_child;
  delete from membership where person_id = p_child;
  -- A club's invitation, and any reply, reference the registration with no
  -- cascade.
  delete from invitation_reply where invitation_id in (
    select i.id from invitation i join registration r on r.id = i.registration_id where r.player_id = p_child);
  delete from invitation where registration_id in (select id from registration where player_id = p_child);
  delete from registration where player_id = p_child;
  delete from share_request where requested_by = p_child or dispatched_by = p_child;
  delete from share_card_approval where requested_by = p_child or approved_by = p_child;
  delete from registration_request where dispatched_by = p_child;
  delete from invitation_reply where replied_by = p_child;
  delete from verification_challenge where person_id = p_child;
  -- Messages to them or about them. Two tables point at an outbox row with no
  -- cascade; they keep their row and lose the pointer.
  update age_transition_notice set outbox_id = null where outbox_id in (
    select id from message_outbox where to_person = p_child or subject_id = p_child);
  update access_request set notified_outbox_id = null where notified_outbox_id in (
    select id from message_outbox where to_person = p_child or subject_id = p_child);
  delete from message_outbox where to_person = p_child or subject_id = p_child;
  delete from undo_token where issued_to = p_child;
  delete from abuse_signal where actor_id = p_child;
  -- A 16-17 may coach MiniRoos (D-82), so these can exist for a minor.
  delete from role_application where coach_id = p_child;
  delete from coach_profile where person_id = p_child;
  delete from coach_authorship where author_id = p_child;
  delete from coach_invite where person_id = p_child or invited_by = p_child;
  delete from wwcc_attestation where person_id = p_child or attested_by = p_child;
  delete from register_grant where person_id = p_child or granted_by = p_child or revoked_by = p_child;
  delete from squad_claim where asked_by = p_child;
  delete from squad_invitation where invited_by = p_child;
  delete from guardian_setting where child_id = p_child;

  -- The investigation trail (U-6): kept, with no link to the child.
  update investigation_grant set subject_id = null where subject_id = p_child;
  update investigation_grant set investigator_id = null where investigator_id = p_child;
  update register_read_log set person_id = null where person_id = p_child;

  -- SOMEONE ELSE'S ROW, signed by the child: the name comes off, the row stays.
  update record_entry set author_id = null where author_id = p_child;
  update assessment_entry set author_id = null where author_id = p_child;
  update assessment_session set author_id = null where author_id = p_child;
  update growth_note set entered_by = null where entered_by = p_child;
  update profile_version set created_by = null where created_by = p_child;
  update profile_version set approved_by = null where approved_by = p_child;
  update invitation_reply set approved_by = null where approved_by = p_child;
  update registration set disclosed_by = null where disclosed_by = p_child;
  update squad_claim set answered_by = null where answered_by = p_child;
  update squad_invitation set answered_by = null where answered_by = p_child;
  update guardian_setting set updated_by = null where updated_by = p_child;
  update alumni_entry set added_by = null where added_by = p_child;
  update alumni_entry set adults_confirmed_by = null where adults_confirmed_by = p_child;
  update club_video set added_by = null where added_by = p_child;
  update coaching_role set posted_by = null where posted_by = p_child;
  update players_wanted_notice set added_by = null where added_by = p_child;
  -- A link somebody else's record carries, issued by the person being erased:
  -- it stops, and it stops naming them. Unreachable for a child today (only a
  -- guardian or the player issues, and a guardian is an adult, 0048).
  update share_token set revoked_at = coalesce(revoked_at, now()), issued_by = null where issued_by = p_child;

  delete from guardianship_link where child_id = p_child or guardian_id = p_child;
  -- auth_*, email_proof, send_held, pending_invitation, age_transition_notice,
  -- and the child's own squad claims and invitations cascade from here.
  delete from person where id = p_child;

  perform set_config('pitch.erasing', '', true);
  insert into consent_event (event, actor_id, detail)
    values ('deletion_completed', p_guardian, '{}');
end $$;

-- Not a function the automatic API hands to anyone (L26 for functions). The
-- app connects as the owner and keeps it.
revoke all on function fn_erase_child(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_erase_child(uuid, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_erase_child(uuid, uuid) from authenticated';
  end if;
end $$;
