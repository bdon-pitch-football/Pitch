-- ---------------------------------------------------------------------------
-- 0065 — a provider's delivery receipt writes the consent spine, and the age
-- transition writes it too (D-78; doc 14 F8, B11; LESSONS L5, L13).
--
-- WHAT WAS WRONG. D-78 says it in one sentence: "Email and SMS provider
-- delivery webhooks write into the same table." They did not. The Resend
-- webhook set `message_outbox.delivered_at` and stopped there, and there was
-- no SMS delivery endpoint at all — so on the spine "the parent ignored us"
-- and "Gmail spam-foldered us" were the same row, which is the whole reason
-- the spine exists. Meanwhile the guardian's own screen renders a line for
-- `email_delivered`, `sms_delivered` and `age_transition`, and nothing in the
-- product could ever write any of the three. A parent was being promised a
-- history that could not happen.
--
-- 0013 has the same hole from the other end: `age_transition_notice
-- .delivered_at` is commented "written by the provider receipt (D-78)" and
-- nothing wrote it, so doc 14 B11's gate — no receipt, no discovery — was
-- ungated by a receipt that could never arrive. The same function closes it.
--
-- THREE THINGS HERE.
--
-- 1. message_outbox.subject_id — who the message is ABOUT, which is not who
--    it went TO. `to_person` is the recipient (a guardian); the spine's
--    `subject_id` is the child. Without the link, a receipt arriving from a
--    provider has no way back to the person the funnel is about, and the row
--    it writes cannot appear on that child's consent log (doc 14 F8).
--
-- 2. fn_record_delivery — ONE writer for every provider receipt, email and
--    SMS. The outbox column, the spine row and 0013's notice receipt move
--    together in one statement, so a receipt cannot half-land. It is
--    idempotent by construction: providers retry, and the update only claims
--    a row whose delivered_at is still null, so the second delivery of the
--    same receipt writes nothing at all.
--
--    A FAILURE WRITES NO SPINE ROW, deliberately. D-78's vocabulary is fixed
--    and has no word for a bounce (L5: one event, one meaning — a bounce is
--    not a delivery and must not borrow its word). The failure is recorded on
--    the outbox row, where the reason column already lives, and the spine
--    says what it can honestly say: nothing delivered.
--
-- 3. fn_record_age_transitions — doc 14 F8 requires a guardian reading the
--    consent log to see "every approval, revocation, share, outside-contact
--    attempt and age transition". Bands are computed, never stored (D-49), so
--    nothing ever happens on a birthday for a log to record. This appends one
--    row per person per band they reach, from the date they reached it.
--
--    It looks back seven days rather than at today alone: a cron that misses
--    a morning must not lose the row. `detail->>'on'` carries the date the
--    band actually changed, because the row is written when we noticed, and
--    those are not always the same day. The band itself is the idempotency
--    key, so a catch-up run writes nothing twice.
--
-- Read with: D-78 (the spine), doc 14 F8 (what a guardian sees), doc 14 B11
-- (the delivery receipt gates discovery at sixteen), 0009 (the outbox), 0013
-- (the notice), 0031 (the columns a receipt lands in).
-- ---------------------------------------------------------------------------

alter table message_outbox add column subject_id uuid references person(id);

comment on column message_outbox.subject_id is
  'The person the message is ABOUT (D-78) — never the recipient, which is to_person. A provider receipt writes the spine row against this.';

-- ---------------------------------------------------------------------------
-- The one writer of a provider delivery receipt (D-78).
--
-- p_outcome is 'delivered' or 'failed'. Returns the spine event written, or
-- null when there was nothing to claim — a receipt for a message we do not
-- have, or a second copy of one we already recorded.
-- ---------------------------------------------------------------------------
create function fn_record_delivery(
  p_provider_id text, p_outcome text, p_reason text default null
) returns text
language plpgsql as $$
declare
  v_id uuid;
  v_channel text;
  v_subject uuid;
  v_key text;
  v_event text;
begin
  if p_provider_id is null or length(trim(p_provider_id)) = 0 then return null; end if;

  if p_outcome = 'delivered' then
    update message_outbox set delivered_at = now()
    where provider_id = p_provider_id and delivered_at is null
    returning id, channel, subject_id, message_key into v_id, v_channel, v_subject, v_key;
    if v_id is null then return null; end if;

    -- The vocabulary is decided here, from the channel the message actually
    -- went out on, so no caller can pick the wrong word for its own receipt.
    -- Written out rather than concatenated: D-78's words are a closed list and
    -- a word that exists only as string arithmetic cannot be grepped for, which
    -- is how a label on the guardian's screen came to have no writer at all.
    v_event := case v_channel when 'sms' then 'sms_delivered' else 'email_delivered' end;
    insert into consent_event (event, subject_id, detail)
    values (v_event, v_subject, jsonb_build_object('message_key', v_key, 'channel', v_channel));

    -- doc 14 B11: the sixteenth-birthday notice becomes DELIVERED here and
    -- nowhere else. 0013 said the provider receipt writes this; this is that
    -- receipt. Discovery at sixteen turns on a receipt or it does not turn on.
    update age_transition_notice set delivered_at = now()
    where outbox_id = v_id and delivered_at is null;

    return v_event;
  end if;

  if p_outcome = 'failed' then
    -- failure_reason never carries message content (0009): a provider status
    -- and nothing else. No spine row — see the header.
    update message_outbox set failed_at = now(), failure_reason = p_reason
    where provider_id = p_provider_id and failed_at is null
    returning id into v_id;
    return null;
  end if;

  return null;
end $$;

comment on function fn_record_delivery(text, text, text) is
  'Provider delivery receipts, email and SMS, write the consent spine here (D-78). Idempotent: a retried receipt claims nothing.';

-- ---------------------------------------------------------------------------
-- Age transitions on the consent log (doc 14 F8, D-49).
-- ---------------------------------------------------------------------------
create function fn_record_age_transitions() returns int
language plpgsql as $$
declare n int;
begin
  with today as (select (now() at time zone 'Australia/Melbourne')::date as d),
  due as (
    select p.id as person_id, b.band, (p.dob + (b.years || ' years')::interval)::date as on_date
    from person p
    cross join (values ('16_17', 16), ('18plus', 18)) as b(band, years)
    cross join today t
    where p.dob is not null
      and (p.dob + (b.years || ' years')::interval)::date between t.d - 7 and t.d
      and not exists (
        select 1 from consent_event e
        where e.event = 'age_transition' and e.subject_id = p.id
          and e.detail->>'band' = b.band)
  ),
  written as (
    insert into consent_event (event, subject_id, detail)
    select 'age_transition', person_id,
           jsonb_build_object('band', band, 'on', to_char(on_date, 'YYYY-MM-DD'))
    from due
    returning 1
  )
  select count(*)::int into n from written;
  return n;
end $$;

comment on function fn_record_age_transitions() is
  'One consent-log row per band a person reaches (doc 14 F8). Bands stay computed (D-49); only the fact that one changed is recorded.';
