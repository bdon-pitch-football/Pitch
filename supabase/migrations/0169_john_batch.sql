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
-- 2 · F14: A GUARDIAN'S OWN EDIT IS ITS OWN APPROVAL — AND ONLY THEIR OWN.
-- "D-119 exists so that a child's edit returns to a guardian. It was never
-- meant to make a guardian approve themselves." A guardian's change to an
-- under-16's page used to land as a pending version, logged as "{child}
-- submitted a change", and emailed that guardian to come and approve it.
--
-- PARENT'S CHANGE ONLY (BUZ, 2 Oct; John confirmed the same day, with four
-- conditions). As first built, a guardian's save snapshotted the WHOLE live
-- record and published it — so a clip, an achievement, other football or a
-- photo the child had added, which no guardian had seen, reached every club
-- on the back of the parent's unrelated save (safety review of John's batch,
-- B-1). John: "it turned a guardian's edit into an approval of the child's."
-- Now the publication is a PATCH: the one change the guardian made, and
-- nothing else, applied to the approved version. "The guardian's change" is
-- what they CHANGED, not what the form posted: the form is prefilled from the
-- live record, which holds the child's unreviewed values, and posts every
-- field (safety review of "parent's change only", B-1, 2 Oct). lib/cv-build
-- reads the form's fields under the record lock before and after the write
-- and hands over only those that moved; a save that changes nothing
-- publishes nothing. fn_cv_patch(content, patch)
-- is the patch, and it can say only three things:
--   {"set": {field: value, ...}}   the build form's fields the guardian
--                                  CHANGED (positions, squadNumber, foot,
--                                  about, surfacedStats) or a photo
--                                  (photoPath) — those keys and no others;
--   {"stats": {season, keys, entries}}  the stats the guardian changed, entry
--                                  by entry, never the whole list; with "set"
--                                  or alone, as one form save;
--   {"add": {"list": l, "item": i}}     one clip, achievement or other-football
--   {"remove": {"list": l, "item": i}}  entry, by the snapshot's own shape —
--                                  highlights, achievements, otherFootball,
--                                  previousClubs and no other list.
-- fn_publish_guardian_change(record, guardian, patch) applies it:
--   · only for a person fn_record_author calls this record's guardian (so
--     only for an under-16 — doc 14 R8: the machinery is the u16's alone),
--     asked AFTER the record's row lock, in the same transaction;
--   · to the PENDING version too, if a change of the child's waits, so that
--     approving it later never reverts the guardian's (John's condition 3).
--     Where both touch one field, the guardian's value wins in both: by
--     editing it they decided it, the child can propose again, and nothing
--     tells the child (condition 2). The rest of the child's change waits;
--   · then to the approved version, which is superseded by a new one with
--     that guardian as its approver — one approved version per record, as
--     ever (0002's unique index). A guardian's removal therefore reaches
--     clubs at once even while a child's change waits (S-2; John: "a removal
--     is the change a parent most needs to land");
--   · if the patch changes nothing on the approved page (a clip only the
--     child's waiting version had), no new version and no event;
--   · with NO approved version (no page yet) nothing publishes: the pending
--     version is patched if there is one, and otherwise the caller opens it
--     (lib/cv-build), so the first approval carries the guardian's work, as
--     it did before F14;
--   · one `edit_approved` event (D-78's vocabulary, no new word — L5) with
--     the guardian as actor and the child as subject, told apart from an
--     approval of the child's edit by kind `guardian_edit`, the way
--     share_revoked's kinds are (lib/link-switch);
--   · no message: nobody is told anything waits, because nothing does. The
--     other guardian gets what they get when one guardian approves a child's
--     edit — no message (D-51; John: "No new message").
--
-- The family history says "{guardian first name} changed the page." for it
-- (BUZ, 1 Oct). fn_consent_timeline gains two columns. `who`: that first
-- name, for this kind of row, and — since 2 Oct — for a guardian's approval
-- of the child's change when the viewer is NOT the guardian who approved it
-- ("{first name} approved a change.", BUZ; John confirmed; D-51's "both
-- notified", by history). Only for an actor who is a guardian of the child
-- the history belongs to; every other row's `who` is null, so the read names
-- nobody it did not name before. `mine`: the viewer is the actor, so the
-- approver's own row reads "You approved a change".
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
-- and the address, which the support console counts tries by, for 30 days
-- (John, 2 Oct, §3: "Addresses are kept 30 days for support … then cleared.
-- The try count stays."). Here, the rows already sent or closed lose theirs
-- now — and the rows the outbox sweep gave up on after its sixth try, which
-- were never sent and never closed and so kept theirs for good (safety
-- review of John's batch, S-4, 2 Oct) — and any of them that ended more than
-- 30 days ago loses its address too. A message still waiting to go keeps its
-- body and address, because that is what will be sent. The count cleared is
-- printed (a count only), as John asked when he approved this clean-up. Development never dispatches, so /dev/outbox — the
-- inbox the suites read codes from — is untouched. The same statement runs
-- after every sweep and from scripts/scrub-sent-bodies.mjs, which GO-LIVE
-- re-runs straight after the deploy: between this migration and the new
-- code going live, the old code still keeps every body it sends (S-5).
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
-- The patch itself: pure, and refusing anything that is not one guardian's
-- one change — no name, no club, no list a guardian does not edit.
create function fn_cv_patch(p_content jsonb, p_patch jsonb) returns jsonb
language plpgsql immutable as $$
declare
  v jsonb := coalesce(p_content, '{}'::jsonb);
  k text; v_op text; v_list text; v_item jsonb; v_idx int; v_season text; v_keys text[];
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or not exists (select 1 from jsonb_object_keys(p_patch)) then
    raise exception 'fn_cv_patch: no patch';
  end if;
  -- One change at a time. A form save is one change: the fields it changed
  -- (set) and the stats it changed (stats), together or apart. A clip, an
  -- achievement or other football is one entry, alone.
  if exists (select 1 from jsonb_object_keys(p_patch) x where x not in ('set', 'stats'))
     and (select count(*) from jsonb_object_keys(p_patch)) <> 1 then
    raise exception 'fn_cv_patch: one change at a time';
  end if;

  if p_patch ? 'set' or p_patch ? 'stats' then
    -- The form's fields, each one the guardian changed. Never stats: a stat
    -- is patched entry by entry below, so touching one never carries the
    -- rest of the live record's (a child's waiting value, a season the form
    -- does not show, a coach's verification) onto the page (safety review of
    -- "parent's change only", B-1).
    for k in select jsonb_object_keys(coalesce(p_patch->'set', '{}'::jsonb)) loop
      if k not in ('positions', 'squadNumber', 'foot', 'about', 'surfacedStats', 'photoPath') then
        raise exception 'fn_cv_patch: % is not a field a guardian sets', k;
      end if;
      v := jsonb_set(v, array[k], p_patch->'set'->k, true);
    end loop;
    if p_patch ? 'stats' then
      -- {"season": s, "keys": [k...], "entries": [...]}: every entry of this
      -- version for (s, k) is replaced by the guardian's entries for (s, k) —
      -- none, if they blanked it — and nothing else in the stats moves. The
      -- order is fn_stat_public's: season, then key.
      v_season := p_patch->'stats'->>'season';
      v_keys := array(select jsonb_array_elements_text(coalesce(p_patch->'stats'->'keys', '[]'::jsonb)));
      if v_season is null or cardinality(v_keys) = 0 then raise exception 'fn_cv_patch: no stat to change'; end if;
      if exists (select 1 from jsonb_array_elements(coalesce(p_patch->'stats'->'entries', '[]'::jsonb)) e
                 where e->>'season' is distinct from v_season or not (e->>'key' = any(v_keys))) then
        raise exception 'fn_cv_patch: a stat entry outside the change';
      end if;
      v := jsonb_set(v, '{stats}', (
        select coalesce(jsonb_agg(e order by e->>'season', e->>'key', src, o), '[]'::jsonb)
        from (select e, 0 as src, o
                from jsonb_array_elements(case when jsonb_typeof(v->'stats') = 'array' then v->'stats' else '[]'::jsonb end)
                     with ordinality t(e, o)
               where not (e->>'season' = v_season and e->>'key' = any(v_keys))
              union all
              select e, 1, o from jsonb_array_elements(coalesce(p_patch->'stats'->'entries', '[]'::jsonb)) with ordinality t(e, o)) x), true);
    end if;
    return v;
  end if;
  v_op := (select x from jsonb_object_keys(p_patch) x);

  if v_op not in ('add', 'remove') then raise exception 'fn_cv_patch: % is not a change', v_op; end if;
  v_list := p_patch->v_op->>'list';
  v_item := p_patch->v_op->'item';
  if v_list is null or v_list not in ('highlights', 'achievements', 'otherFootball', 'previousClubs') then
    raise exception 'fn_cv_patch: % is not a list a guardian edits', v_list;
  end if;
  if v_item is null or jsonb_typeof(v_item) <> 'object' then raise exception 'fn_cv_patch: no item'; end if;

  if v_op = 'add' and exists (select 1 from jsonb_array_elements(coalesce(v->v_list, '[]'::jsonb)) e where e = v_item) then
    -- Already there: an add is idempotent, so a clip the guardian added that
    -- a child's own save then copied into the waiting version never lands
    -- in it twice (safety review of "parent's change only", S-2).
    null;
  elsif v_op = 'add' then
    if v_list = 'previousClubs' then
      -- The snapshot's order: by season, newest first, the newest entry
      -- first among equals (lib/cv-build buildSnapshot).
      v := jsonb_set(v, '{previousClubs}', (
        select coalesce(jsonb_agg(e order by e->>'period' desc nulls last, o), '[]'::jsonb)
        from (select v_item as e, 0::bigint as o
              union all
              select e, o from jsonb_array_elements(coalesce(v->'previousClubs', '[]'::jsonb)) with ordinality t(e, o)) x), true);
    else
      v := jsonb_set(v, array[v_list], coalesce(v->v_list, '[]'::jsonb) || jsonb_build_array(v_item), true);
    end if;
  else
    -- One entry, the first equal to the item: never every look-alike.
    select (o - 1)::int into v_idx
      from jsonb_array_elements(coalesce(v->v_list, '[]'::jsonb)) with ordinality t(e, o)
     where e = v_item order by o limit 1;
    if v_idx is not null then v := v #- array[v_list, v_idx::text]; end if;
  end if;
  if v_list = 'highlights' then
    v := jsonb_set(v, '{highlightsUsed}', to_jsonb(jsonb_array_length(coalesce(v->'highlights', '[]'::jsonb))), true);
  end if;
  return v;
end $$;

comment on function fn_cv_patch(jsonb, jsonb) is
  'F14 as BUZ ruled it, 2 Oct ("parent''s change only"): one guardian change applied to a page version — set form fields or the photo, or add/remove one clip, achievement or other-football entry. Refuses anything else.';

create function fn_publish_guardian_change(p_record uuid, p_guardian uuid, p_patch jsonb)
returns text
language plpgsql as $$
declare v_child uuid; v_id uuid; v_old jsonb; v_new jsonb; v_pending boolean;
begin
  if p_record is null or p_guardian is null or p_patch is null then return null; end if;
  -- One publication at a time per record, and the question asked under it.
  select person_id into v_child from development_record where id = p_record for update;
  if not found then return null; end if;
  if fn_record_author(p_guardian, p_record) is distinct from 'guardian' then return null; end if;

  -- The child's waiting change first: approving it later must never undo
  -- the guardian's, and on a field both touched the guardian's value wins.
  update profile_version set content = fn_cv_patch(content, p_patch)
   where record_id = p_record and status = 'pending';
  v_pending := found;

  select id, content into v_id, v_old from profile_version
   where record_id = p_record and status = 'approved' for update;
  if not found then
    -- No page yet: nothing publishes. The first approval carries it.
    return case when v_pending then 'pending' else 'no_page' end;
  end if;

  v_new := fn_cv_patch(v_old, p_patch);
  if v_new = v_old then return 'unchanged'; end if;

  update profile_version set status = 'superseded' where id = v_id;
  insert into profile_version (record_id, content, status, created_by, approved_by, approved_at)
  values (p_record, v_new, 'approved', p_guardian, p_guardian, now());
  insert into consent_event (event, actor_id, subject_id, detail)
  values ('edit_approved', p_guardian, v_child,
          jsonb_build_object('record_id', p_record, 'kind', 'guardian_edit'));
  return 'published';
end $$;

comment on function fn_publish_guardian_change(uuid, uuid, jsonb) is
  'F14 (0169), parent''s change only (BUZ and John, 2 Oct): an under-16''s guardian''s one change, patched onto the waiting version and published onto the approved one at once, with them as approver and one edit_approved event of kind guardian_edit. Nothing of the child''s rides with it. No message.';

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
returns table (id bigint, at timestamptz, event text, detail jsonb, who text, mine boolean)
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
           -- And "{first name} approved a change." (BUZ, 2 Oct; John
           -- confirmed): a guardian's approval of the child's change, named
           -- for the OTHER guardian. The approver reads "You approved a
           -- change" (mine), so their own name is never needed.
           case when e.event = 'edit_approved'
                 and (e.detail->>'kind' = 'guardian_edit' or e.actor_id is distinct from p_viewer)
                then (select a.first_name from person a
                      where a.id = e.actor_id
                        and exists (select 1 from guardianship_link g
                                    where g.guardian_id = a.id and g.child_id = p_person
                                      and g.approved_at is not null))
           end,
           e.actor_id is not distinct from p_viewer
    from consent_event e
    where e.subject_id = p_person
    union all
    select e.id, e.at, e.event, e.detail, null::text, e.actor_id is not distinct from p_viewer
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
-- lib/sent-bodies.ts SCRUB_SENT_BODIES, byte for byte (the permission suite
-- pins it): the outbox sweep runs it after every run and
-- scripts/scrub-sent-bodies.mjs re-runs it straight after the deploy, so the
-- three cannot drift. It clears a row the sweep gave up on, too (S-4), and an
-- address 30 days after its message ended (John, 2 Oct, §3).
--
-- The count it cleared is printed, as a count and nothing else (John, 2 Oct:
-- "0169 clearing the rows already sent is approved after the fact. Log the
-- count it cleared, and keep it with this note."). scripts/apply-migrations
-- prints a migration's notices, so it lands in the release log beside the
-- file's OK line.
do $$
declare n int;
begin
update message_outbox
   set body = '', subject = null,
       to_address = case when coalesce(sent_at, failed_at, last_attempt_at, created_at) < now() - interval '30 days' then '' else to_address end,
       number_hash = case when number_hash is not null and coalesce(sent_at, failed_at, last_attempt_at, created_at) < now() - interval '30 days' then '\x00'::bytea else number_hash end
 where (sent_at is not null or failed_at is not null or attempts >= 6)
   and (body <> '' or subject is not null or ((to_address <> '' or number_hash <> '\x00'::bytea) and coalesce(sent_at, failed_at, last_attempt_at, created_at) < now() - interval '30 days'));
  get diagnostics n = row_count;
  raise notice '0169 §4: cleared % message row(s).', n;
end $$;
