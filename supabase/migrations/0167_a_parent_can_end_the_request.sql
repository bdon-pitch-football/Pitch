-- ---------------------------------------------------------------------------
-- 0167 — a parent's "No" ends a pending request at once, by the same purge
-- as the fourteen days (D-PD-3; John's rulings of 1 Oct, and his sign-off of
-- the deletion design the same day with four conditions; BUZ, 1 Oct: "Yes to
-- the line" and the label "No, end this request"; D-17, D-25, D-77, D-78,
-- D-155, D-156, U-1; pillar zero 1; doc 14 I2; doc 23 "A pending invitation").
--
-- WHY THIS EXISTS. An under-16's sign-up is a pending invitation: a first name,
-- a date of birth and a parent's contact, and nothing else (D-17). Until today
-- the only way it ended without an approval was the fourteen-day purge, so a
-- parent who had decided "no" — or a stranger the child named by mistake —
-- could only wait, and the child's details sat here for a fortnight after
-- somebody had said so. John: "A parent who has decided should not have to
-- wait a fortnight to be believed." Fail closed means fail towards not
-- collecting.
--
-- ONE DEFINITION OF "DELETE A PENDING CHILD", TWO WAYS TO TRIGGER IT.
--   fn_purge_pending_invitation(id, detail)  the one deletion. Everything the
--       fourteen-day job did to one invitation, now done in one place: the
--       row goes (not flagged, not archived — I2), its messages lose what they
--       carried, and one `purged` event records that it happened.
--   fn_purge_pending()                       the fourteen-day job, unchanged
--       in what it selects, now calling the one deletion for each invitation.
--   fn_end_pending_invitation(token_hash)    the parent's press on /a. It
--       refuses unless the rules below hold, then calls the one deletion.
--
-- WHAT THE PRESS REQUIRES (John, 1 Oct; F15 as he ruled it the same day).
-- It refuses, and changes nothing:
--   · unless the code is one of the invitation's two channel links (D-156) —
--     the invitation id, which the CHILD holds ("Show them my page"), is not
--     a channel and ends nothing; a string that matches no link ends nothing;
--   · if the invitation is approved, or held (D-155). A hold reads as an
--     approval everywhere, and ending one would be an answer that told
--     somebody it was not.
-- Neither link needs to have been confirmed (F15, John, 1 Oct, reversing his
-- own morning condition of "at least one channel confirmed"). The person
-- that condition kept out is the person at a mistyped number — the one who
-- most needs to say no, and who could only do it by first pressing "Yes,
-- it's me", which for them is false. The only way to hold an unconfirmed
-- link is to have received it at the contact the child typed, and the worst
-- a wrong "No" does is make a child ask again. Approving still needs both
-- channels: it creates a relationship and licenses a disclosure; ending
-- creates nothing and discloses nothing. And it is still a press: the app
-- calls this only from a POST on /a, so a mail scanner opening the link
-- ends nothing.
-- A refusal looks like nothing happened (John's condition 1): the caller
-- returns the person to /a as it was, with no error and no reason.
--
-- WHAT IT RECORDS (John's conditions 2 and 4, and F15). The existing `purged`
-- event (D-78's vocabulary; no new word, L5) with three more keys: reason
-- `ended_by_recipient`, the channel TYPE of the link pressed, 'sms' or
-- 'email', and `confirmed`, true or false — whether THAT link had been
-- confirmed by a press before the No. It answers S-1 truthfully: nobody
-- records a channel that no one confirmed as if someone had. The fourteen-day
-- job's event names its reason too, `expired` (doc 23 v1.7: the surviving
-- event carries "the reason (expired or ended)"). The time is the event's
-- own `at`. Nothing that identifies the
-- person: not the address, not the number, and not a hash of either — the
-- screen the parent lands on says "the details we held are deleted", and a
-- fingerprint of their contact would make that untrue in the database. "Who
-- ended it" is answerable as John framed it: whoever held the {email|SMS}
-- link the child gave us, at {time} — and which channels had been confirmed
-- is already on the log, as email_verified / sms_verified for that invitation.
-- The event has no subject and no actor, exactly as the fourteen-day one has
-- none, so it is on nobody's timeline: fn_consent_timeline returns a
-- person's own rows and the funnel rows linked at approval (0077), and a
-- purged invitation was never approved. No club-callable function reads it.
--
-- THE MESSAGES (doc 23: "We do not retain message bodies"). The fourteen-day
-- purge emptied only the texts still waiting (0120). A message that had gone
-- kept its body — the child's first name and age, in the parent's approval
-- request — its subject, and the parent's address, after the invitation it
-- belonged to was gone. That made "the details we held are deleted" false
-- in the database for both endings, so the one deletion now empties every
-- message of the invitation: body and subject cleared, address blanked.
-- The row stays, so a provider's receipt arriving afterwards still finds it
-- by its own id (fn_record_delivery) and the funnel stays countable. A text
-- still waiting is closed as before ('purged'), so the release never sends it.
--
-- No message to anyone (John): at that moment nobody is a guardian yet.
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

create function fn_purge_pending_invitation(p_id uuid, p_detail jsonb default '{}'::jsonb)
returns boolean
language plpgsql as $$
declare v_id uuid;
begin
  -- Never an approved invitation: by then it is a child's account, and a
  -- pending row is all that may be deleted here.
  select id into v_id from pending_invitation
   where id = p_id and approved_at is null
   for update;
  if v_id is null then return false; end if;

  -- A text still waiting is closed and emptied, and the release never sends
  -- it (0120) — exactly as before.
  update message_outbox
     set failed_at = now(), failure_reason = 'purged', body = ''
   where invitation_id = v_id
     and sent_at is null and released_at is null and failed_at is null;
  -- The parent's number, hashed, is the one thing a hash does NOT hide: an
  -- Australian mobile is one of ~10^8 values, so a plain sha256 of it is
  -- recovered in seconds (safety review B-1, 1 Oct). Its hash goes from the
  -- SMS meter too — the rows stay, with their cents and times, so the monthly
  -- spend cap still counts every text; only the link to the number goes.
  -- (sms_opt_out keeps its hash: a STOP must be honoured, Spam Act.)
  update sms_meter
     set number_hash = decode(md5(random()::text || clock_timestamp()::text), 'hex')
   where number_hash in (select number_hash from message_outbox
                          where invitation_id = v_id and number_hash is not null);
  -- And nothing any message of this invitation carried survives it. A text's
  -- hash is overwritten with random bytes rather than cleared: a queued or
  -- released text must still carry one (0120's constraints), and random bytes
  -- match no number, so the link to the parent is gone all the same.
  update message_outbox
     set body = '', subject = null, to_address = '',
         number_hash = case when number_hash is null then null
                            else decode(md5(random()::text || clock_timestamp()::text), 'hex') end
   where invitation_id = v_id
     and (body <> '' or subject is not null or to_address <> '' or number_hash is not null);

  delete from pending_invitation where id = v_id;

  -- The fact, and nothing about anyone. The invitation key comes last, so a
  -- caller's detail can never stand in for it.
  insert into consent_event (event, detail)
  values ('purged', coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('invitation_id', v_id));
  return true;
end $$;

comment on function fn_purge_pending_invitation(uuid, jsonb) is
  'D-17 / D-PD-3 (0167): the one deletion of a pending invitation — the row, what its messages carried, and one subjectless purged event. Called by the fourteen-day job and by a parent''s "No".';

-- The fourteen-day job: the same invitations as ever (unapproved, older than
-- fourteen days, held ones included — D-155), each through the one deletion,
-- and its event says why: `expired` (doc 23 v1.7; Leo, 1 Oct).
create or replace function fn_purge_pending() returns int
language plpgsql as $$
declare
  n int := 0;
  v uuid;
begin
  for v in
    select id from pending_invitation
     where approved_at is null and created_at < now() - interval '14 days'
     order by created_at
  loop
    if fn_purge_pending_invitation(v, jsonb_build_object('reason', 'expired')) then n := n + 1; end if;
  end loop;
  -- The SMS meter needs a number's hash only for its rolling 24-hour limit
  -- (fn_sms_count_24h); past that window the hash is a reversible copy of
  -- somebody's phone number and nothing reads it (B-1). Same daily job.
  update sms_meter
     set number_hash = '\x00'::bytea
   where sent_at < now() - interval '25 hours' and number_hash <> '\x00'::bytea;
  return n;
end $$;

-- The parent's press. Handed the hash of the code from the link (the app
-- never stores or passes the raw code to the database), and answers whether
-- it ended anything — a refusal changes nothing at all.
create function fn_end_pending_invitation(p_token_hash bytea)
returns boolean
language plpgsql as $$
declare
  v_id uuid;
  v_channel text;
  v_confirmed boolean;
begin
  if p_token_hash is null then return false; end if;
  -- Either link, confirmed or not (F15). Whether the link pressed had been
  -- confirmed is read from that link's own channel, never the other one's.
  select id,
         case when sms_token_hash = p_token_hash then 'sms' else 'email' end,
         case when sms_token_hash = p_token_hash then sms_confirmed_at is not null
              else email_confirmed_at is not null end
    into v_id, v_channel, v_confirmed
    from pending_invitation
   where (sms_token_hash = p_token_hash or email_token_hash = p_token_hash)
     and approved_at is null
     and held_at is null
   for update;
  if v_id is null then return false; end if;
  return fn_purge_pending_invitation(v_id,
    jsonb_build_object('reason', 'ended_by_recipient', 'channel', v_channel, 'confirmed', v_confirmed));
end $$;

comment on function fn_end_pending_invitation(bytea) is
  'D-PD-3 (0167), F15: whoever holds either channel link ends a pending request, confirmed or not. Refuses for the invitation id, an approved or held one. Records the channel type and whether that link was confirmed, and nothing about the person.';

-- The app's own connection asks these; nobody else needs to (0122, 0166).
revoke all on function fn_purge_pending_invitation(uuid, jsonb) from public;
revoke all on function fn_end_pending_invitation(bytea) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_purge_pending_invitation(uuid, jsonb) from anon';
    execute 'revoke all on function fn_end_pending_invitation(bytea) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_purge_pending_invitation(uuid, jsonb) from authenticated';
    execute 'revoke all on function fn_end_pending_invitation(bytea) from authenticated';
  end if;
end $$;
