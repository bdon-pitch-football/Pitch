-- ---------------------------------------------------------------------------
-- 0164 — a password-reset link is checked when it is opened, not after a new
-- password has been typed into it (G-P2; BUZ approved the Floodlit specs'
-- "Recommended yes" defect fixes, 1 Oct).
--
-- /reset/[token] drew the new-password form for any token at all, and only
-- fn_use_auth_reset (0062), at the press, found out the link was used,
-- replaced or expired. A person typed a new password into a dead link and was
-- then told to ask for another one.
--
-- The page asks this instead, on load. It reads and writes nothing else: it is
-- the same predicate fn_use_auth_reset selects with, stated once more beside
-- it, and it never marks the link used — opening a link is not using it, the
-- same rule D-156 applies to an approval link. The press still goes through
-- fn_use_auth_reset, which re-checks in the statement that consumes, so the
-- answer here can only ever be a courtesy, never a grant.
--
-- No enumeration is opened: the token is 128+ random bits stored hashed
-- (0014), the press already said "used or expired" for the same token, and
-- the answer names no person.
--
-- Read with: 0014 (auth_reset), 0062 (revoked_at, fn_use_auth_reset).
-- ---------------------------------------------------------------------------

create function fn_auth_reset_live(p_token_hash bytea) returns boolean
language sql stable as $$
  select exists (
    select 1 from auth_reset
     where token_hash = p_token_hash
       and used_at is null and revoked_at is null and expires_at > now()
  );
$$;

-- The app's own connection asks this; nobody else needs to (0122's pattern).
revoke all on function fn_auth_reset_live(bytea) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_auth_reset_live(bytea) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_auth_reset_live(bytea) from authenticated';
  end if;
end $$;
