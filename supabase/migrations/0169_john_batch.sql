-- ---------------------------------------------------------------------------
-- 0169 — John's batch of 1 Oct (BUZ: "John, take the batch"): who may write a
-- record, a guardian's edit is its own approval, the STOP list's fingerprint
-- is keyed, and a sent message keeps no body. (N-10, F14/S-2, §5.1, §5.2 of
-- JOHN-to-LEO-the-batch-photo-first-1-oct; D-17, D-22, D-49, D-51, D-81,
-- D-119; doc 14 R8 and the new R12; doc 23 "We do not retain message bodies".)
--
-- 1 · N-10: A PARENT MAY NOT EDIT A 16–17'S PAGE.
-- fn_record_actor (0020) answers "who are you to this record" — 'self' or
-- 'guardian' — and a guardian of a sixteen- or seventeen-year-old is one. That
-- answer is right for what it guards: the send log, the share card, the
-- invitation replies, the held sends, the controls. It was wrong for one
-- thing: /build and its editors asked it too, so a parent could rewrite their
-- seventeen-year-old's page. John: "A 16–17's page is theirs. The guardian
-- holds visibility and the off-switch (D-22, D-51), not authorship."
--
-- So authorship is its own, narrower question, fn_record_author:
--   'self'      the record's owner, any age;
--   'guardian'  an approved, unrevoked guardian of an UNDER-16 — the band
--               computed from the date of birth now, never stored (D-49);
--   null        everybody else, including every guardian of a 16–17 and
--               of an adult.
-- fn_record_actor is NOT changed, so every reader of it keeps exactly what
-- doc 14 gives a 16–17's guardian. Every caller was checked (report, 1 Oct).
-- The app asks this through requireRecordAuthor, on every /build surface.
--
-- 2 · F14: A GUARDIAN'S OWN EDIT IS ITS OWN APPROVAL.
-- "D-119 exists so that a child's edit returns to a guardian. It was never
-- meant to make a guardian approve themselves." A guardian's change to an
-- under-16's page used to land as a pending version, logged as "{child}
-- submitted a change", and emailed that guardian to come and approve it.
-- fn_publish_guardian_change(record, guardian, content) is the publication:
--   · only for a person fn_record_author calls this record's guardian (so
--     only for an under-16 — doc 14 R8: the machinery is the u16's alone);
--   · the content becomes the approved version at once, with that guardian
--     as its approver, and the old approved version is superseded — one
--     approved version per record, as ever (0002's unique index);
--   · one `edit_approved` event (D-78's vocabulary, no new word — L5) with
--     the guardian as actor and the child as subject, told apart from an
--     approval of the child's edit by kind `guardian_edit`, the way
--     share_revoked's kinds are (lib/link-switch);
--   · no message: nobody is told anything waits, because nothing does. The
--     other guardian gets what they get when one guardian approves a child's
--     edit — no message (D-51; John: "No new message").
-- IF A CHANGE OF THE CHILD'S IS ALREADY WAITING, nothing publishes. A
-- record has one draft, so the snapshot a guardian's save takes carries the
-- child's waiting change with it, and publishing it would publish the
-- child's change unreviewed. The guardian's change joins the pending
-- version instead, and the guardian approves it as before. This is the more
-- restrictive answer, taken until John rules on it (it is not in his ruling).
--
-- The family history says "{guardian first name} changed the page." for it
-- (BUZ, 1 Oct). fn_consent_timeline gains one column, `who`: that first name,
-- for this kind of row only, and only for an actor who is a guardian of the
-- child the history belongs to. Every other row's `who` is null, so the read
-- names nobody it did not name before.
--
-- 3 · §5.2: THE STOP LIST'S FINGERPRINT IS KEYED.
-- sms_opt_out.number_hash (0031) and sms_meter.number_hash (0009) were a
-- plain sha256 of the number, and an Australian mobile is one of ~10^8
-- values, so a plain hash IS the number (safety review B-1). From this
-- release the app writes HMAC-SHA256 under a server secret, NUMBER_HASH_KEY
-- (lib/number-hash.ts); production with no key sends no SMS at all.
-- The database holds no key and cannot re-key a hash it holds, so:
--   · the STOP list must be EMPTY when this runs. Production has never had
--     SMS live (the Twilio bundle is in review), so it is; if it is not, this
--     migration stops rather than keep a plain hash or drop somebody's STOP
--     (the Spam Act), and a human decides;
--   · the meter's hashes go to the zero fingerprint the daily job already
--     uses past 25 hours (0167) — the cents stay, so the monthly cap still
--     counts every one. Empty in production too;
--   · a text still WAITING for SMS (0120) keeps its address until it is
--     released, so the app re-keys those from the address the moment SMS
--     can send, before the first release (lib/messaging releaseWaitingTexts).
-- An empty table needs nothing.
--
-- 4 · §5.1: A SENT MESSAGE KEEPS NO BODY.
-- Doc 23: "We do not retain message bodies." Every sent message kept its
-- body and subject in message_outbox for good — a child's first name and
-- age in a parent's approval request, a club's name, a share link. From
-- this release dispatch() empties both the moment a provider accepts the
-- message, and the moment it is refused for good. What stays is what the
-- receipts and the funnel read (fn_record_delivery: provider id, channel,
-- key, subject, invitation; the ops failure list: channel, time, status)
-- and the address, which the support console counts tries by. Here, the
-- rows already sent or closed lose theirs now. A message still waiting to
-- go keeps its body, because that is what will be sent. Development never
-- dispatches, so /dev/outbox — the inbox the suites read codes from — is
-- untouched.
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

-- 1 · N-10 ------------------------------------------------------------------
create function fn_record_author(p_person uuid, p_record uuid) returns text
language plpgsql stable as $$
declare v_owner uuid; v_band text;
begin
  if p_person is null or p_record is null then return null; end if;
  select dr.person_id, fn_age_band(p.dob) into v_owner, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return null; end if;

  if p_person = v_owner then return 'self'; end if;

  -- A guardian writes an under-16's page and nobody else's (N-10).
  if v_band = 'u16' and exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_person and g.child_id = v_owner
      and g.approved_at is not null and g.revoked_at is null
  ) then return 'guardian'; end if;

  return null;
end $$;

comment on function fn_record_author(uuid, uuid) is
  'N-10 (0169): who may WRITE a record — its owner, or an approved guardian of an under-16. A 16–17''s guardian keeps fn_record_actor''s answer for everything else (D-22, D-51).';

-- 2 · F14 -------------------------------------------------------------------
create function fn_publish_guardian_change(p_record uuid, p_guardian uuid, p_content jsonb)
returns text
language plpgsql as $$
declare v_child uuid;
begin
  if p_record is null or p_guardian is null or p_content is null then return null; end if;
  if fn_record_author(p_guardian, p_record) is distinct from 'guardian' then return null; end if;
  -- One publication at a time per record.
  select person_id into v_child from development_record where id = p_record for update;

  -- The child's change is waiting: the guardian's joins it, and nothing
  -- publishes unreviewed (see the header).
  if exists (select 1 from profile_version where record_id = p_record and status = 'pending') then
    update profile_version set content = p_content where record_id = p_record and status = 'pending';
    return 'pending';
  end if;

  update profile_version set status = 'superseded' where record_id = p_record and status = 'approved';
  insert into profile_version (record_id, content, status, created_by, approved_by, approved_at)
  values (p_record, p_content, 'approved', p_guardian, p_guardian, now());
  insert into consent_event (event, actor_id, subject_id, detail)
  values ('edit_approved', p_guardian, v_child,
          jsonb_build_object('record_id', p_record, 'kind', 'guardian_edit'));
  return 'published';
end $$;

comment on function fn_publish_guardian_change(uuid, uuid, jsonb) is
  'F14 (0169): an under-16''s guardian''s own change becomes the approved version at once, with them as approver and one edit_approved event of kind guardian_edit. Joins a waiting child''s change instead of publishing it. No message.';

revoke all on function fn_publish_guardian_change(uuid, uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_publish_guardian_change(uuid, uuid, jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_publish_guardian_change(uuid, uuid, jsonb) from authenticated';
  end if;
end $$;

-- The family's history, as 0077 wrote it, plus `who` for a guardian's own
-- edit. A changed return type cannot be replaced in place.
drop function fn_consent_timeline(uuid, uuid);
create function fn_consent_timeline(p_viewer uuid, p_person uuid)
returns table (id bigint, at timestamptz, event text, detail jsonb, who text)
language plpgsql stable as $$
begin
  if p_viewer is null or p_person is null then return; end if;
  if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return; end if;

  return query
    select e.id, e.at, e.event, e.detail,
           -- "{guardian first name} changed the page." (BUZ, 1 Oct): the
           -- first name of a guardian of THIS child, for their own edit only.
           case when e.event = 'edit_approved' and e.detail->>'kind' = 'guardian_edit'
                then (select a.first_name from person a
                      where a.id = e.actor_id
                        and exists (select 1 from guardianship_link g
                                    where g.guardian_id = a.id and g.child_id = p_person
                                      and g.approved_at is not null))
           end
    from consent_event e
    where e.subject_id = p_person
    union all
    select e.id, e.at, e.event, e.detail, null::text
    from consent_event_link l
    join consent_event e on e.id = l.event_id
    where l.subject_id = p_person
    order by 2 desc, 1 desc;
end $$;

-- 3 · §5.2 ------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from sms_opt_out;
  if n > 0 then
    raise exception 'sms_opt_out holds % plain-sha256 row(s). They cannot be re-keyed without the numbers, and dropping them would drop a STOP. Decide before migrating (0169).', n;
  end if;
end $$;

update sms_meter set number_hash = '\x00'::bytea where number_hash <> '\x00'::bytea;

comment on table sms_opt_out is
  'STOP list, D-81/doc 15 §15. HMAC-SHA256 of the number under NUMBER_HASH_KEY (0169) — recognisable to the app, never readable, and not a plain hash.';
comment on column sms_meter.number_hash is
  'HMAC-SHA256 of the number under NUMBER_HASH_KEY (0169), kept 25 hours for the per-number limit, then the zero fingerprint (0167).';

-- 4 · §5.1 ------------------------------------------------------------------
update message_outbox
   set body = '', subject = null
 where (sent_at is not null or failed_at is not null)
   and (body <> '' or subject is not null);
