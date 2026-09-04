-- ============================================================================
-- 0005 · registration_request — the u16 "child asks, guardian sends" object
-- for the Interest Register (D-91's pattern applied to D-108). The child
-- composes club + squad + positions + one line; nothing reaches any club
-- until the guardian reads the line and presses send, which creates the
-- registration row with disclosed_by = guardian. An undis patched request
-- expires silently with the D-138 discipline: no state anyone else sees.
-- ============================================================================
create table registration_request (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  club_id uuid not null references club(id),
  squad_target uuid references squad(id),
  positions text[] not null default '{}' check (cardinality(positions) <= 3),
  note text,                            -- the one line, <=140 chars app-side; guardian reads it first
  created_at timestamptz not null default now(),
  dispatched_by uuid references person(id),
  dispatched_at timestamptz,
  registration_id uuid references registration(id)
);
alter table registration_request enable row level security;
