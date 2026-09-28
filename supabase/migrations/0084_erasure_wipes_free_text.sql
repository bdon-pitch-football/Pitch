-- ---------------------------------------------------------------------------
-- 0084 — erasure also wipes the free text that could name the child (D-166).
--
-- BUZ, 28 Sep: D-26's deletion completes for every child (0067), and the
-- investigation trail survives with its subject nulled (U-6, Leo's call). But
-- two of its columns are free text a person typed ABOUT that child —
--
--   investigation_access.what   the investigator's note of what was looked at
--   report.reason               what the reporter wrote on the report
--
-- — and an anonymous row that says the child's name is not anonymous. Both
-- are now set to NULL, inside the erasure, for the rows about that child. The
-- trail keeps who looked (the grant's investigator), when (`at`), under which
-- grant and for which report id, with no link to the child. Whether the trail
-- is kept at all after an erasure is John's question (doc 36); this is the
-- safe default meanwhile.
--
-- WHICH ROWS ARE "ABOUT THE CHILD". Asked before anything that ties them to
-- the child is deleted or unlinked, because afterwards nothing can tell:
--   · a report an investigation grant on the child was opened for;
--   · a report that holds the child's record (content_hold, 0010);
--   · a player_cv report whose reference is the hash of one of the child's
--     share tokens (how /report records a CV, app/report);
--   · a coach_cv report on the child's own coach page (a 16–17 may coach,
--     D-82).
--   The logged looks are those under a grant on the child. A report that was
--   also about somebody else loses its reason too: the text may name the
--   erased child, and losing words is the restrictive direction.
--
-- HOW, given the log is append-only by trigger (0025). The same shape of
-- exception 0067 built for a name (fn_is_erasing_name): an UPDATE is let
-- through only inside an erasure (pitch.erasing, set with is_local by
-- fn_erase_child), only on a row whose grant is on the child being erased,
-- only setting `what` to NULL, and with every other column unchanged. A
-- DELETE is still refused, always. `what` loses NOT NULL for this, and a
-- trigger keeps the rule for a new row: a logged look says what was looked
-- at. report.reason was already nullable (no reason is required to report).
--
-- NOT WIPED, and named so nobody assumes it was: investigation_grant's
-- extended_reason (free text, typed when a grant is extended once) and
-- report.reporter_email / actioned_by. D-166 names two columns; the property
-- check (permission suite erase7*) lists every text column on the trail and
-- says which it covers, so a new free-text column fails by name.
--
-- Also here: player_stat.verified_by and player_stat_history.verified_by
-- (0083) name a person, so the erasure takes the name off them, as it does
-- for every other row the erased person merely signed.
--
-- Read with: 0067, 0025, 0010, 0083, D-166, D-26, D-25, U-6.
-- ---------------------------------------------------------------------------

alter table investigation_access alter column what drop not null;

create function investigation_access_says_what() returns trigger
language plpgsql as $$
begin
  if new.what is null then
    raise exception 'a logged look says what was looked at; only an erasure removes it'
      using errcode = 'not_null_violation';
  end if;
  return new;
end $$;

create trigger investigation_access_says_what before insert on investigation_access
  for each row execute function investigation_access_says_what();

create or replace function investigation_access_immutable() returns trigger
language plpgsql as $$
begin
  -- 0084, D-166: the one update an erasure may make. Nothing else, ever.
  if tg_op = 'UPDATE'
     and coalesce(current_setting('pitch.erasing', true), '') <> ''
     and new.what is null
     and (to_jsonb(old) - 'what') = (to_jsonb(new) - 'what')
     and exists (select 1 from investigation_grant g
                 where g.id = old.grant_id
                   and g.subject_id::text = current_setting('pitch.erasing', true)) then
    return new;
  end if;
  raise exception 'the investigation access log is append-only';
end $$;

create or replace function fn_erase_child(p_guardian uuid, p_child uuid) returns void
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

  -- 0084, D-166: the free text a person typed about this child, before the
  -- rows that tie a report to them are deleted or unlinked below. The report
  -- and the logged looks stay (the trail, U-6); what they said does not.
  update report set reason = null
   where reason is not null and id in (
     select ig.report_id from investigation_grant ig where ig.subject_id = p_child
     union
     select ch.report_id from content_hold ch
       join development_record dr on dr.id = ch.record_id
      where dr.person_id = p_child and ch.report_id is not null
     union
     select r.id from report r
       -- Compared as hex, so a reference that is not a hash cannot make
       -- decode() throw and roll the whole erasure back.
       join share_token st on encode(st.token_hash, 'hex') = r.subject_ref
       join development_record dr on dr.id = st.record_id
      where r.subject_kind = 'player_cv' and dr.person_id = p_child
     union
     select r.id from report r
       join coach_profile cp on cp.public_slug = r.subject_ref
      where r.subject_kind = 'coach_cv' and cp.person_id = p_child);
  update investigation_access set what = null
   where what is not null
     and grant_id in (select id from investigation_grant where subject_id = p_child);

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
  -- 0083/0084: a stat the child verified as a (16–17) coach stays verified
  -- by the club, and stops naming them.
  update player_stat set verified_by = null where verified_by = p_child;
  update player_stat_history set verified_by = null where verified_by = p_child;
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

-- Unchanged from 0067: not a function the automatic API hands to anyone.
revoke all on function fn_erase_child(uuid, uuid) from public;
