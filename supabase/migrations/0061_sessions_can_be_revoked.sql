-- ---------------------------------------------------------------------------
-- 0061 — a session is a row, and ending it ends it everywhere (D-94 §2 and
-- §4; QA bug hunt 28 Sept, findings F1 and F2).
--
-- What was wrong. The session cookie was the person's id plus an HMAC of that
-- id, and nothing else: no session identifier, no issued-at, no server-side
-- record. There was therefore nothing to revoke. `clearSession` deleted the
-- browser's copy of the cookie; `setPassword` wrote a credential and ended
-- nothing. A cookie captured once was a permanent bearer token for that
-- account — measured still opening /home after Sign out, after the password
-- was changed, and after signing back in.
--
-- Who that costs. Not an attacker with a zero-day. The ex-partner, the older
-- sibling, the person who borrowed the phone. A parent who realises somebody
-- is inside their child's account does the two things every product on earth
-- has taught them to do — change the password, sign out everywhere — and
-- until this migration neither of them did anything at all. The other party
-- kept the child's record, the share links, pause and deletion, for as long
-- as they kept the cookie. And the reset screen told that parent, in our own
-- words, that signing back in would sign them out everywhere else (F2).
--
-- The rule this installs. A session is a row in `auth_session`. The cookie
-- carries an opaque random token — never the person id — and the token is
-- stored only as a sha256 hash, the same standard as a share token (D-94 §4)
-- and a reset token (0014): a dump of this table yields no working session.
-- Every read resolves the cookie through `fn_session_person`, which refuses a
-- revoked one, an expired one, an unknown one, and one belonging to a person
-- who no longer exists. Sign-out revokes the row. Setting a password revokes
-- every live session for that person.
--
-- Interim, and deliberately so. lib/session.ts still calls itself interim
-- until Supabase Auth lands, and D-80 keeps Supabase Auth for session only.
-- This is not that migration and does not pre-empt it: revocation semantics
-- are what matter to a family, they survive the swap, and waiting for it
-- means shipping a product in which Sign out is decoration.
--
-- Session lifetime is a PROPOSAL, flagged as one: 30 days from issue,
-- absolute, no sliding renewal. 30 days is what the cookie already carried
-- (`maxAge: 60 * 60 * 24 * 30`), so no user's experience changes — the only
-- change is that the server now enforces the same number the browser was
-- trusted with. Absolute rather than idle because a sliding window means a
-- session that is used daily never expires, and "everything is revoked
-- eventually" is then false for exactly the person most likely to be being
-- watched. Nothing in the register settles this; if BUZ wants a different
-- number it is one interval in fn_session_issue.
--
-- Read with: D-94 §2 (cookie rules, enumeration, rate limits), D-94 §4
-- (tokens: ≥128 bits, stored hashed), D-80 (Supabase Auth is session only),
-- doc 14 J18/J19, L26 (row-level security in the same file).
-- ---------------------------------------------------------------------------

create table auth_session (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  -- The token itself is never stored. There is no `token` column and there
  -- must never be one: this table is a database dump away from being every
  -- live session in the product.
  token_hash bytea not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index auth_session_live on auth_session(person_id) where revoked_at is null;
-- L26: a table is exposed until you say otherwise. No policies on purpose —
-- every read goes through the service role and a permission function (D-80),
-- so enabled-and-policyless denies the automatic API everything.
alter table auth_session enable row level security;

-- Issuing one. The lifetime lives here and nowhere else: the caller sets the
-- cookie's expiry from the answer this returns, so the cookie and the row can
-- never disagree about when the session is over.
create function fn_session_issue(p_person uuid, p_token_hash bytea) returns timestamptz
language plpgsql as $$
declare v_expires timestamptz;
begin
  insert into auth_session (person_id, token_hash, expires_at)
  values (p_person, p_token_hash, now() + interval '30 days')
  returning expires_at into v_expires;
  return v_expires;
end $$;

-- The one answer to "whose session is this, if it is still a session at all".
-- Four ways to be nobody, and they are indistinguishable to the caller —
-- revoked, lapsed, never existed, and belonging to a person who has been
-- deleted. The last one is not new: a session outliving a guardian's deletion
-- used to mean every action wrote a person id into a foreign key and got a
-- database error instead of a sign-in screen.
create function fn_session_person(p_token_hash bytea) returns uuid
language sql stable as $$
  select s.person_id
    from auth_session s
    join person p on p.id = s.person_id
   where s.token_hash = p_token_hash
     and s.revoked_at is null
     and s.expires_at > now();
$$;

-- Sign out. This session, on every device that holds it — which is one
-- device, because a cookie is not shared — and nothing else: a parent
-- signing out of the laptop does not sign out of their phone.
create function fn_session_revoke(p_token_hash bytea) returns void
language sql as $$
  update auth_session set revoked_at = now()
   where token_hash = p_token_hash and revoked_at is null;
$$;

-- A new password ends every live session for that person (F1.3). This is what
-- makes the sentence already on the reset screen true — "This signs you out
-- everywhere else once you sign back in" — rather than something to delete.
-- Returns the count because a test needs a number, and because a count of
-- sessions is a fact about nobody.
create function fn_sessions_revoke_all(p_person uuid) returns integer
language plpgsql as $$
declare v_count integer;
begin
  update auth_session set revoked_at = now()
   where person_id = p_person and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Reset links: one live at a time, and using one burns it (F1.1, F1.2).
--
-- QA got 24 live reset links to one address and the OLDEST still opened the
-- set-a-new-password form; a second one still worked after the first had been
-- used. Both are the same missing rule — a reset link is a key to an account
-- and there is never a reason for two of them to turn.
--
-- `revoked_at` and NOT `used_at`, and this is the trap in this migration:
-- 0056 reads a USED auth_reset row as evidence that somebody opened a link we
-- sent to their address. Marking superseded links used would have manufactured
-- that evidence out of links nobody ever opened, which is L21 — the exact hole
-- 0056 was written to close.
-- ---------------------------------------------------------------------------
alter table auth_reset add column revoked_at timestamptz;

-- Issuing one invalidates the ones outstanding. A trigger rather than a line
-- in lib/auth, because "at most one live reset per person" is a property of
-- the data and the next route to send a reset must not have to remember it.
create function fn_auth_reset_one_live() returns trigger
language plpgsql as $$
begin
  update auth_reset set revoked_at = now()
   where person_id = new.person_id and id <> new.id
     and used_at is null and revoked_at is null;
  return null;
end $$;

create trigger auth_reset_one_live
  after insert on auth_reset
  for each row execute function fn_auth_reset_one_live();

-- Using one. Marked used in the same statement that reads it, so two
-- simultaneous uses cannot both succeed (this is 0014's rule, moved from
-- lib/auth into the database beside the two new ones — one question, one
-- answer, L23). Then: every other live link for that person dies with it, and
-- the address proof 0056 asks for is written if this link went to the account
-- holder's own inbox.
create function fn_use_auth_reset(p_token_hash bytea) returns uuid
language plpgsql as $$
declare v_id uuid; v_person uuid; v_proves uuid;
begin
  update auth_reset set used_at = now()
    where id = (select id from auth_reset
                 where token_hash = p_token_hash
                   and used_at is null and revoked_at is null and expires_at > now()
                 limit 1)
    returning id, person_id, proves_person_id into v_id, v_person, v_proves;
  if v_person is null then return null; end if;

  update auth_reset set revoked_at = now()
   where person_id = v_person and id <> v_id
     and used_at is null and revoked_at is null;

  -- Written after the row is marked used, because the 0056 trigger asks for
  -- the evidence before it will accept it.
  if v_proves is not null then
    update person set email_proved_at = coalesce(email_proved_at, now()) where id = v_proves;
  end if;
  return v_person;
end $$;
