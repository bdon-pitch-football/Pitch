-- Doc 29 §3 — the waitlist. One table, and nothing else.
-- It is a dead end, not the seed of a user table: a waitlist row must never
-- become an account automatically. Nothing about a child is ever stored here.

create table public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text        not null,
  role           text        not null check (role in ('player','coach','club','parent')),
  created_at     timestamptz not null default now(),

  -- Spam Act: consent must be provable, not asserted
  consent_at     timestamptz not null default now(),
  consent_text   text        not null,   -- the exact words on screen when they submitted
  policy_version text        not null,   -- 'doc@version', e.g. '20@v2.2'
  source         text        not null default 'web',

  -- unsubscribe has to work before the first send, not after
  unsub_token     text       not null default encode(gen_random_bytes(24),'hex'),
  unsubscribed_at timestamptz
);

create unique index waitlist_email_key on public.waitlist (lower(email));
create index waitlist_created_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
-- No policies. The anon key cannot touch this table.
-- Inserts go through one server route holding the service-role key.
