-- ---------------------------------------------------------------------------
-- 0031 — the send layer becomes a send layer (D-81, D-78, doc 15 §15).
--
-- Everything queued into message_outbox and stopped there: the provider
-- dispatch was an empty block, so in production every message would have been
-- written, logged to the consent spine as sent, and never delivered. The
-- guardian approval SMS is the front door of the product — a child signs up,
-- their parent gets a text, and nothing happens until they tap it — so this
-- is the difference between the product working and not.
--
-- TWO THINGS THE SCHEMA WAS MISSING.
--
-- 1. AN OPT-OUT LIST. Doc 15 §15 has the STOP reply written, and there was
--    nowhere to record that somebody sent STOP — so the reply promised "we
--    won't text this number again" and nothing enforced it. Under the Spam
--    Act an unsubscribe facility has to actually work. The number is stored
--    as a HASH, the same shape sms_meter already uses: we need to recognise a
--    number that opted out, never to read the list back.
--
-- 2. ATTEMPTS. A provider call can fail transiently, and a row with no
--    attempt count is a row a retry loop will hammer forever.
--
-- Delivery receipts land in the columns 0009 already declared — sent_at,
-- provider_id, delivered_at, failed_at — which is what makes "ignored us"
-- and "never arrived" distinguishable on the consent spine (D-78).
-- ---------------------------------------------------------------------------
create table sms_opt_out (
  number_hash bytea primary key,
  opted_out_at timestamptz not null default now(),
  -- START puts a number back. Recorded rather than deleted, because "they
  -- opted out and back in" is a different fact from "they never opted out".
  opted_in_at timestamptz
);

comment on table sms_opt_out is
  'STOP list, D-81/doc 15 §15. Hashed numbers only — recognisable, never readable.';

alter table message_outbox add column attempts int not null default 0;
alter table message_outbox add column last_attempt_at timestamptz;

-- The dispatcher claims rows with `for update skip locked`, so two overlapping
-- runs cannot send the same message twice.
create index message_outbox_dispatch on message_outbox (created_at)
  where sent_at is null and failed_at is null;

alter table sms_opt_out enable row level security;
