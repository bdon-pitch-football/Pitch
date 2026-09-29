-- ---------------------------------------------------------------------------
-- 0120 — under-18s register at launch, and the parent's text waits for SMS
-- (D-168 as amended, Option A; BUZ 29 Sep; brief H).
--
-- WHY THIS EXISTS. On launch day SMS may not be live: Twilio's business review
-- of an Australian number can take five business days. Until now a child's
-- sign-up with SMS switched off sent the parent's email and REFUSED the text
-- (lib/messaging: 'sms_killed', 'sms_no_cap'), so the invitation could never
-- be approved — approval needs both channels (D-24, D-156) — and it purged
-- fourteen days later (D-17) having been impossible from the first minute.
-- D-168 keeps the rule whole and changes only the ORDER the two messages
-- arrive in: the email goes at once, the text is written down as queued, and
-- it sends by itself the moment SMS can send.
--
-- WHAT "QUEUED" IS, AND WHAT IT IS NOT. A queued text is a message_outbox row
-- with `queued_for_sms_at` set and `released_at` null. It is not a refusal
-- (nothing to retry by hand) and not a failure (nothing went wrong). It has
-- not been metered, because no money was spent, and it has not been written
-- to the consent spine as `sms_sent`, because nothing was sent: the parent's
-- log says "We texted you as well" only once a text has actually left.
-- The generic retry sweep never touches one (app/api/jobs/outbox reads
-- `released_at` for that): a queued row is released through this file's one
-- door, which applies every control, or it is not released at all.
--
-- ONLY THE PARENT'S APPROVAL TEXT QUEUES (doc 15 §1 and §1b). Everything else
-- that cannot send while SMS is down is refused exactly as before. The queue
-- exists so a child can be approved; it is not a backlog of every text the
-- product would have liked to send, and a kill switch that queued everything
-- would stop being a kill switch the moment somebody turned it back off.
--
-- THE CONTROLS, ALL OF THEM, AT RELEASE (fn_sms_release):
--   · the kill switch — the operator's switch is read here, and the
--     environment's (SMS_KILL_SWITCH, no SMS_MONTHLY_CAP_CENTS in production,
--     no provider configured) is lib/sms-policy's smsCanSend, asked by the
--     caller before it calls this at all. Off is off, whichever side said it;
--   · three a day per number — the same sms_meter the send path counts,
--     counted live inside the loop, so a backlog of ten texts to one number
--     releases three and leaves seven queued for tomorrow;
--   · the monthly cap — the cap in force is the caller's (the lower of the
--     environment's and the operator's, lib/sms-policy), and the first text
--     that would cross it stops the run: nothing after it is released;
--   · STOP — a number that opted out is closed, never sent;
--   · the 14-day purge (D-17) — a text whose invitation is gone, approved or
--     held (D-155) is closed and its body emptied, never sent. The purge
--     itself also closes and empties every unsent row of an invitation it
--     deletes (fn_purge_pending, below), so a purged invitation's text is
--     gone twice over: its row is closed, and its invitation no longer exists
--     for the release to find.
-- Oldest first. A text released is metered, stamped released, and written to
-- the spine as `sms_sent` in the same statement's transaction; the caller
-- hands it to the provider after that, exactly as send() does.
--
-- AT QUEUE TIME (fn_sms_queue). Three a day per number holds here too,
-- counting queued texts with sent ones: without it, somebody who knows a
-- stranger's number could line up fifty "approve your child" texts to it
-- while SMS is down and have them drip out at three a day for a fortnight.
-- And a newer text for the same invitation supersedes an older queued one:
-- the support console's resend mints a new link and the old one stops working
-- (D-156), so the older text would carry a dead link to a parent.
--
-- The number hash is written by the application (lib/messaging numberHash),
-- never recomputed here: the meter, the opt-out list and the STOP webhook
-- agree on it byte for byte, and a second copy of the hashing in SQL is a
-- STOP that silently never matches.
--
-- Read with: D-168, D-24, D-156, D-17, D-81, D-78, D-155; 0009 (the outbox
-- and the meter), 0031 (opt-out, attempts), 0070 (the switch), 0077 (the
-- invitation on the outbox row), lib/messaging, lib/sms-policy.
-- ---------------------------------------------------------------------------

alter table message_outbox add column queued_for_sms_at timestamptz;
alter table message_outbox add column released_at timestamptz;
alter table message_outbox add column number_hash bytea;

-- A queued text is an SMS with the hash the controls need. (Its invitation is
-- required by fn_sms_queue, not here: the reference is set null when an
-- invitation is deleted (0077), by the purge or by a cascade from somewhere
-- else, and that delete must never fail on this table. A queued row with no
-- invitation is closed by the release, never sent.)
alter table message_outbox add constraint message_outbox_queued_text check (
  queued_for_sms_at is null or (channel = 'sms' and number_hash is not null)
);
alter table message_outbox add constraint message_outbox_released_after_queued
  check (released_at is null or queued_for_sms_at is not null);

create index message_outbox_queued on message_outbox (queued_for_sms_at)
  where queued_for_sms_at is not null and released_at is null and failed_at is null;

comment on column message_outbox.queued_for_sms_at is
  'D-168: the parent''s approval text, written while SMS could not send. Released only by fn_sms_release.';

-- ---- 1 · the queue --------------------------------------------------------
-- Returns the new row's id, or null when three texts to this number already
-- went or are waiting inside twenty-four hours (the caller reports that as
-- the rate limit, exactly as a live send does).
create function fn_sms_queue(p_key text, p_to_person uuid, p_address text, p_body text,
                             p_subject_id uuid, p_invitation uuid, p_hash bytea,
                             p_per_number int) returns uuid
language plpgsql as $$
declare v_id uuid; v_waiting int;
begin
  if p_invitation is null or p_hash is null then return null; end if;
  -- An older queued text for this invitation carries a link that no longer
  -- works (D-156: a fresh link for a channel retires the old one).
  update message_outbox
     set failed_at = now(), failure_reason = 'superseded', body = ''
   where invitation_id = p_invitation and channel = 'sms'
     and queued_for_sms_at is not null and released_at is null and failed_at is null;
  select count(*)::int into v_waiting from message_outbox
   where number_hash = p_hash and queued_for_sms_at is not null
     and released_at is null and failed_at is null
     and queued_for_sms_at > now() - interval '24 hours';
  if fn_sms_count_24h(p_hash) + v_waiting >= p_per_number then return null; end if;
  insert into message_outbox (message_key, channel, to_person, to_address, body, subject_id,
                              invitation_id, number_hash, queued_for_sms_at, attempts)
  values (p_key, 'sms', p_to_person, p_address, p_body, p_subject_id, p_invitation, p_hash, now(), 0)
  returning id into v_id;
  return v_id;
end $$;

-- ---- 2 · the one door out -------------------------------------------------
-- p_cap_cents: the monthly cap in force (null = none, which only development
-- reaches: production refuses every SMS without one before calling this).
-- p_cost: what one text is metered at. p_per_number: three (D-81).
create function fn_sms_release(p_cap_cents int, p_cost int, p_per_number int, p_batch int)
  returns table (id uuid, message_key text, to_address text, body text)
language plpgsql as $$
#variable_conflict use_column
declare r record; v_spend int;
begin
  -- The operator's switch, read here as well as by the caller: a release
  -- that raced an 11pm "off" must lose.
  if coalesce((select sms_off from fn_sms_switch()), false) then return; end if;
  v_spend := fn_sms_spend_month();

  for r in
    select o.id, o.message_key, o.to_address, o.body, o.number_hash, o.subject_id, o.invitation_id,
           pi.id is not null and pi.approved_at is null and pi.held_at is null as open
      from message_outbox o
      left join pending_invitation pi on pi.id = o.invitation_id
     where o.queued_for_sms_at is not null and o.released_at is null and o.failed_at is null
     order by o.queued_for_sms_at, o.created_at, o.id
     for update of o skip locked
  loop
    -- Purged, approved or held (D-17, D-155): never sent, and the words go.
    if not r.open then
      update message_outbox set failed_at = now(), failure_reason = 'invitation_closed', body = ''
       where message_outbox.id = r.id;
      continue;
    end if;
    -- STOP means stop (doc 15 §15, 0031).
    if exists (select 1 from sms_opt_out s where s.number_hash = r.number_hash
                 and (s.opted_in_at is null or s.opted_in_at < s.opted_out_at)) then
      update message_outbox set failed_at = now(), failure_reason = 'opted_out', body = ''
       where message_outbox.id = r.id;
      continue;
    end if;
    -- Three a day per number, counted live: the meter rows this loop writes
    -- are visible to the next iteration of it.
    if fn_sms_count_24h(r.number_hash) >= p_per_number then continue; end if;
    -- The cap: the first text that would cross it ends the run.
    if p_cap_cents is not null and v_spend + p_cost > p_cap_cents then exit; end if;

    insert into sms_meter (number_hash, cents) values (r.number_hash, p_cost);
    v_spend := v_spend + p_cost;
    update message_outbox
       set released_at = now(), attempts = 1, last_attempt_at = now()
     where message_outbox.id = r.id;
    -- The spine learns a text went only now, when one did (D-78). The same
    -- row sendAndLog writes for a text that went at once, invitation and all
    -- (0077), so the parent's log reads the same either way.
    insert into consent_event (event, subject_id, detail)
    values ('sms_sent', r.subject_id,
            jsonb_build_object('message_key', r.message_key, 'invitation_id', r.invitation_id, 'queued', true));

    id := r.id; message_key := r.message_key; to_address := r.to_address; body := r.body;
    return next;
    p_batch := p_batch - 1;
    exit when p_batch <= 0;
  end loop;
end $$;

-- ---- 3 · what the screens and the digest read ------------------------------
-- The backlog, as a number, so BUZ sees it clear (D-168). Counts only.
create function fn_sms_queued_count() returns int
language sql stable as $$
  select count(*)::int from message_outbox
   where queued_for_sms_at is not null and released_at is null and failed_at is null
$$;

-- Is this invitation's text still waiting? The child's waiting screen asks,
-- and renders its one line only while the answer is yes.
create function fn_invitation_sms_queued(p_invitation uuid) returns boolean
language sql stable as $$
  select exists (select 1 from message_outbox
                  where invitation_id = p_invitation and queued_for_sms_at is not null
                    and released_at is null and failed_at is null)
$$;

-- ---- 4 · the purge takes the text with it ---------------------------------
-- 0008's purge, plus one statement: every unsent row of an invitation it
-- deletes is closed and emptied first. Nothing about a child whose parent was
-- never reached stays in a queue waiting for a phone to ring (D-17).
create or replace function fn_purge_pending() returns int
language plpgsql as $$
declare n int;
begin
  update message_outbox o
     set failed_at = now(), failure_reason = 'purged', body = ''
    from pending_invitation pi
   where o.invitation_id = pi.id
     and pi.approved_at is null
     and pi.created_at < now() - interval '14 days'
     and o.sent_at is null and o.released_at is null and o.failed_at is null;
  with doomed as (
    delete from pending_invitation
    where approved_at is null
      and created_at < now() - interval '14 days'
    returning id
  )
  insert into consent_event (event, detail)
  select 'purged', jsonb_build_object('invitation_id', id) from doomed;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---- 5 · the day-10 nudge does not chase a text that has not gone ----------
-- doc 15 §3 re-mints the texted link before it sends (D-156), which kills the
-- link inside a text still waiting in the queue — and while SMS cannot send,
-- the nudge itself is refused. So an invitation whose approval text is still
-- waiting on day ten would lose its only working text link for nothing, and
-- the parent would be sent a dead one the day SMS came back. A nudge is a
-- reminder about a text the parent HAS; until they have one, there is
-- nothing to remind them of. 0050's function, plus that one condition.
create or replace function fn_pending_nudges() returns table (invitation_id uuid, first_name text, guardian_phone text)
language sql stable as $$
  select pi.id, pi.first_name, pi.guardian_phone
  from pending_invitation pi
  where pi.approved_at is null and pi.held_at is null and pi.child_id is null
    and pi.guardian_phone is not null
    and pi.created_at <= now() - interval '10 days'
    and pi.created_at > now() - interval '14 days'
    and not exists (select 1 from consent_event e
                    where e.event = 'nudge_sent' and e.detail->>'invitation_id' = pi.id::text)
    and not fn_invitation_sms_queued(pi.id)
$$;

revoke all on function fn_sms_queue(text, uuid, text, text, uuid, uuid, bytea, int) from public;
revoke all on function fn_sms_release(int, int, int, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_sms_queue(text, uuid, text, text, uuid, uuid, bytea, int) from anon';
    execute 'revoke all on function fn_sms_release(int, int, int, int) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_sms_queue(text, uuid, text, text, uuid, uuid, bytea, int) from authenticated';
    execute 'revoke all on function fn_sms_release(int, int, int, int) from authenticated';
  end if;
end $$;
