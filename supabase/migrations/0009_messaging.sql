-- ============================================================================
-- 0009 · The outbox (doc 15, D-78, D-81)
-- Every message the product sends lands here first — in development nothing
-- leaves the machine, in production a provider picks it up and writes its
-- delivery receipt back. That receipt is what makes "the parent ignored us"
-- and "Gmail spam-foldered us" different facts (D-78).
--
-- message_key is the doc 15 section. A send with a key outside the catalogue
-- is rejected in code: if a message is not in doc 15, it does not send.
-- ============================================================================
create table message_outbox (
  id uuid primary key default gen_random_uuid(),
  message_key text not null,            -- 'doc15.§1', 'doc15.§24' …
  channel text not null check (channel in ('sms','email')),
  to_person uuid references person(id), -- null for club/inbox addresses
  to_address text not null,             -- email address or E.164 number
  subject text,                         -- email only
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,                     -- provider's own id, for receipts
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text                   -- never contains message content
);

create index message_outbox_pending on message_outbox(created_at) where sent_at is null;

-- SMS controls, required BEFORE the first verification message (D-81):
-- max 3 per number per 24h, a global monthly spend cap, and a kill switch.
create table sms_meter (
  id bigint generated always as identity primary key,
  number_hash bytea not null,           -- hashed: we never index raw numbers
  sent_at timestamptz not null default now(),
  cents int not null default 0
);
create index sms_meter_window on sms_meter(number_hash, sent_at);

-- Count sends to one number inside the rolling 24h window.
create function fn_sms_count_24h(p_number_hash bytea) returns int
language sql stable as $$
  select count(*)::int from sms_meter
  where number_hash = p_number_hash and sent_at > now() - interval '24 hours'
$$;

-- Spend this calendar month, in cents.
create function fn_sms_spend_month() returns int
language sql stable as $$
  select coalesce(sum(cents), 0)::int from sms_meter
  where sent_at >= date_trunc('month', now() at time zone 'Australia/Melbourne')
$$;

alter table message_outbox enable row level security;
alter table sms_meter enable row level security;
