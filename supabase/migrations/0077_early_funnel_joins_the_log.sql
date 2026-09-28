-- ---------------------------------------------------------------------------
-- 0077 — an under-16's early funnel lines attach to their log at approval
-- (BUZ, 28 Sep, docs/team/APPROVALS-28-SEP.md decision 8; D-78, D-17,
-- doc 14 F8).
--
-- WHAT WAS WRONG. Before a parent approves, an under-16 does not exist — no
-- person row, nothing (D-17, working as intended). So the rows that record
-- the start of their story — "We emailed you", "That email reached your
-- inbox", "You opened the permission page" — were written with no subject,
-- carrying only the invitation id, or not even that: the send rows carried a
-- message key and nothing else, and the delivery receipt inherited nobody.
-- The guardian's consent log reads rows BY SUBJECT, so a parent of an
-- under-16 saw their child's log start at "You approved the profile", with
-- the part they lived through missing. BUZ's call: attach them at approval.
--
-- HOW, AND IT IS APPEND-ONLY BOTH WAYS. consent_event cannot be updated
-- (0002), and "fixing" the subject on those rows would be rewriting history
-- anyway: at the time they were written there was no child to name. So
-- nothing is rewritten. A new append-only table records the link — this
-- event belongs to this child's log, via this invitation, from this moment —
-- and the guardian's log reads its own rows plus the linked ones.
--
--   message_outbox.invitation_id   the invitation a guardian-approval message
--                                  belongs to, so its provider receipt can say
--                                  so too (fn_record_delivery, recreated
--                                  below, puts it in the spine row's detail).
--   consent_event_link             (event, child, invitation, when). No update
--                                  and no delete, the same trigger function
--                                  consent_event uses.
--   consent_event_link_at_approval the trigger. It fires on the `approved`
--                                  row itself — the one row that carries both
--                                  the child and the invitation — so it runs
--                                  whichever code path approves, and it
--                                  cannot run for anything else.
--   fn_consent_timeline            the one read: the viewer must be the person
--                                  or an approved, unrevoked guardian (the
--                                  same wall fn_who_looked uses), and it
--                                  returns the child's own rows and the linked
--                                  ones, nothing else.
--
-- WHICH ROWS. Only an UNDER-16's invitation (pending_invitation.child_id is
-- null — a 16–17 already has a person row, and their funnel carries their id
-- from the first message). Only rows written with no subject, carrying that
-- invitation's id, before the approval. Only the funnel's own words (D-78):
-- invite_created, email_sent, sms_sent, email_delivered, sms_delivered,
-- guardian_landed, email_verified, sms_verified, nudge_sent. Nothing else can
-- ride in on an invitation id.
--
-- Rows written before this migration carry no invitation on the send and
-- receipt rows, so an invitation already open when this ships attaches what
-- it can (invite_created, guardian_landed, the confirmations, the nudge) and
-- nothing is guessed for the rest.
--
-- No foreign key to person, deliberately, exactly as consent_event.subject_id
-- has none: the log outlives an erasure, and an FK would either cascade the
-- record of consent away or block the erasure (0067).
-- ---------------------------------------------------------------------------

alter table message_outbox add column invitation_id uuid references pending_invitation(id) on delete set null;

comment on column message_outbox.invitation_id is
  'The pending invitation a guardian-approval message belongs to (0077). Lets a delivery receipt for an under-16 reach their log at approval.';

create table consent_event_link (
  event_id bigint not null references consent_event(id),
  subject_id uuid not null,
  invitation_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (event_id, subject_id)
);
alter table consent_event_link enable row level security;

comment on table consent_event_link is
  'An early funnel row attached to the child it was about, at approval (0077). Append-only; the spine row itself is never rewritten.';

create trigger consent_event_link_no_update before update or delete on consent_event_link
  for each row execute function consent_event_immutable();

create function consent_event_link_at_approval() returns trigger
language plpgsql as $$
declare v_inv uuid;
begin
  if new.detail->>'invitation_id' is null
     or new.detail->>'invitation_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  v_inv := (new.detail->>'invitation_id')::uuid;
  -- An under-16's invitation only: a 16–17's funnel already names them.
  if not exists (select 1 from pending_invitation pi where pi.id = v_inv and pi.child_id is null) then
    return new;
  end if;
  insert into consent_event_link (event_id, subject_id, invitation_id)
  select e.id, new.subject_id, v_inv
  from consent_event e
  where e.subject_id is null
    and e.detail->>'invitation_id' = v_inv::text
    and e.id < new.id
    and e.event in ('invite_created','email_sent','sms_sent','email_delivered','sms_delivered',
                    'guardian_landed','email_verified','sms_verified','nudge_sent')
  on conflict do nothing;
  return new;
end $$;

create trigger consent_event_link_at_approval after insert on consent_event
  for each row when (new.event = 'approved' and new.subject_id is not null)
  execute function consent_event_link_at_approval();

-- The guardian's consent log: the child's own rows and the rows linked to
-- them, for the person or an approved, unrevoked guardian — nobody else gets
-- a row. The order and the tiebreak are the page's, so they are here too.
create function fn_consent_timeline(p_viewer uuid, p_person uuid)
returns table (id bigint, at timestamptz, event text, detail jsonb)
language plpgsql stable as $$
begin
  if p_viewer is null or p_person is null then return; end if;
  if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return; end if;

  return query
    select e.id, e.at, e.event, e.detail
    from consent_event e
    where e.subject_id = p_person
    union all
    select e.id, e.at, e.event, e.detail
    from consent_event_link l
    join consent_event e on e.id = l.event_id
    where l.subject_id = p_person
    order by 2 desc, 1 desc;
end $$;

-- A provider receipt for a message that belongs to an invitation says so, so
-- the approval can attach it (0065's function, unchanged but for that key).
create or replace function fn_record_delivery(
  p_provider_id text, p_outcome text, p_reason text default null
) returns text
language plpgsql as $$
declare
  v_id uuid;
  v_channel text;
  v_subject uuid;
  v_key text;
  v_inv uuid;
  v_event text;
begin
  if p_provider_id is null or length(trim(p_provider_id)) = 0 then return null; end if;

  if p_outcome = 'delivered' then
    update message_outbox set delivered_at = now()
    where provider_id = p_provider_id and delivered_at is null
    returning id, channel, subject_id, message_key, invitation_id into v_id, v_channel, v_subject, v_key, v_inv;
    if v_id is null then return null; end if;

    v_event := case v_channel when 'sms' then 'sms_delivered' else 'email_delivered' end;
    insert into consent_event (event, subject_id, detail)
    values (v_event, v_subject, jsonb_build_object('message_key', v_key, 'channel', v_channel)
      || case when v_inv is null then '{}'::jsonb else jsonb_build_object('invitation_id', v_inv) end);

    update age_transition_notice set delivered_at = now()
    where outbox_id = v_id and delivered_at is null;

    return v_event;
  end if;

  if p_outcome = 'failed' then
    update message_outbox set failed_at = now(), failure_reason = p_reason
    where provider_id = p_provider_id and failed_at is null
    returning id into v_id;
    return null;
  end if;

  return null;
end $$;
