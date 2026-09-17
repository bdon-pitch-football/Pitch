-- ---------------------------------------------------------------------------
-- 0046 — a player's own send list shows what actually happened (John,
-- 17 Sep, §3 of JOHN-rulings-17-sep.md).
--
-- A send stopped by the daily limit lands on the same "Sent" page a real one
-- does (U-3, J40): that byte-identity is where the oracle lives, at the send
-- endpoint. But the player's own list must not show a send that never
-- happened (APP 10). A held send wrote nothing, so the list could not say
-- "that one didn't go".
--
-- This keeps the club name the player typed and when, for the player's own
-- list, and nothing else: no address, no count, no limit. The list shows it
-- as "didn't go" with no figure. It goes when the person goes (D-26).
-- ---------------------------------------------------------------------------
create table send_held (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  club_name text not null check (length(club_name) between 1 and 60),
  at timestamptz not null default now()
);
create index send_held_person on send_held (person_id, at desc);
alter table send_held enable row level security;
