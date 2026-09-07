-- ============================================================================
-- 0014 · Credentials (D-80, D-94 §2)
-- Supabase Auth is the production session store and the stack decision (D-52);
-- this table is the credential half behind lib/auth's interface, so the app
-- works end to end now and the implementation swaps without touching callers.
--
-- Passwords are stored as scrypt hashes with a per-row salt. Reset tokens are
-- stored HASHED, single-use, and expire in an hour — a database dump must not
-- yield a working reset link, exactly as for share tokens.
-- ============================================================================
create table auth_credential (
  person_id uuid primary key references person(id) on delete cascade,
  password_hash text not null,          -- scrypt: salt:derived, both hex
  updated_at timestamptz not null default now()
);

create table auth_reset (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index auth_reset_live on auth_reset(person_id) where used_at is null;

-- Devices we have seen, so a sign-in from a new one can be flagged (doc 15
-- §33). Stored as a hash: never an IP, never a city, never a fingerprint we
-- could reverse.
create table auth_device (
  id bigint generated always as identity primary key,
  person_id uuid not null references person(id) on delete cascade,
  device_hash bytea not null,
  first_seen timestamptz not null default now(),
  unique (person_id, device_hash)
);

alter table auth_credential enable row level security;
alter table auth_reset enable row level security;
alter table auth_device enable row level security;
