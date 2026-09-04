-- ============================================================================
-- 0011 · Rate limiting for unauthenticated endpoints (D-94 §2)
-- In-memory limiting dies with the instance; sign-in, reset, the
-- request-access affordance and the token path need a limit that survives.
-- Keys are hashed so the table never holds a raw address or identifier.
-- ============================================================================
create table rate_hit (
  id bigint generated always as identity primary key,
  key_hash bytea not null,
  at timestamptz not null default now()
);
create index rate_hit_window on rate_hit(key_hash, at);

-- Returns true if the caller is INSIDE the limit (and records the hit).
create function fn_rate_ok(p_key_hash bytea, p_max int, p_window_seconds int) returns boolean
language plpgsql as $$
declare n int;
begin
  delete from rate_hit where at < now() - interval '1 day';
  select count(*)::int into n from rate_hit
    where key_hash = p_key_hash and at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into rate_hit (key_hash) values (p_key_hash);
  return true;
end $$;

alter table rate_hit enable row level security;
