-- ---------------------------------------------------------------------------
-- 0056 — an email address is not a person until they have opened a link we
-- sent to it (BUZ, 23 Sep; safety-week blockers B1 and B2; LESSONS L21).
--
-- What went wrong. Three sign-up doors created a password-bearing account for
-- ANY address, with nothing sent to it, and two lookups then matched a person
-- by that address alone: a club's coach invite (B1) and a guardian approval
-- (B2). Someone who knew a real coach's address could take their place and
-- read a squad's records; someone who knew a parent's address could be handed
-- that parent's child. Neither needed a single email to arrive.
--
-- The rule this migration installs. `person.email_proved_at` is set only when
-- a link WE SENT to that address has been opened — and the database, not the
-- application, is what insists on it:
--
--   · fn_email_proved is the one answer to "is this address proved". Sign-in
--     asks it (D-94 §2: an unproved account signs in nowhere), and the coach
--     lookup will ask it when that package lands.
--   · person_email_proof_has_a_reason refuses to write email_proved_at unless
--     the evidence is in the database: a used email_proof row (the link the
--     sign-up doors send), a used auth_reset row that was emailed to that
--     person's own address (doc 15 §10 / §10a), or a pending_invitation whose
--     email channel the parent confirmed by pressing the button (D-156).
--     Nothing else can set it — not a seed, not an operator, not a future
--     route that forgets.
--   · Proof follows the address. Changing an account's email clears it.
--   · guardianship_link_guardian_proved (B2) refuses to hand a child to an
--     account whose address was never proved. The trigger is the guarantee;
--     lib/guardian-flow is only the path.
--
-- Why "proved" and not "verified": this codebase already spends `verified` on
-- a club (D-126, a human on a phone) and on a WWCC attestation (D-98), and
-- spends `email_verified` on the D-156 channel press. A third meaning on the
-- person row would be a word doing three jobs.
--
-- Read with: D-94 §2 (enumeration, rate limits), D-155/D-156 (the two
-- channels), D-159 (the coach and club doors), doc 14 J18.
-- ---------------------------------------------------------------------------

alter table person add column email_proved_at timestamptz;

-- The link a sign-up door sends. Hashed and single-use like a reset token
-- (0014): a dump of this table yields no working link. Seven days, because
-- the person it belongs to may not be at a computer today and there is
-- nothing urgent about it — an unopened one leaves an account that signs in
-- nowhere, and the doc 15 §10 reset link sets a password and proves the
-- address in one go if it lapses.
create table email_proof (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index email_proof_live on email_proof(person_id) where used_at is null;
-- L26: a table is exposed until you say otherwise.
alter table email_proof enable row level security;

-- doc 15 §10 / §10a go to the guardian for an under-16 (lib/auth createReset),
-- so consuming a reset proves an address only when the link went to the
-- account holder's OWN address. Null means this one proves nothing.
alter table auth_reset add column proves_person_id uuid references person(id) on delete cascade;

-- The one answer. Every caller asks this, nobody reads the column.
create function fn_email_proved(p_person uuid) returns boolean
language sql stable as $$
  select exists (select 1 from person where id = p_person and email_proved_at is not null);
$$;

-- The door's link, opened. Single-use in the same statement that reads it, so
-- two simultaneous opens cannot both consume it.
create function fn_use_email_proof(p_token_hash bytea) returns uuid
language plpgsql as $$
declare v_person uuid;
begin
  update email_proof set used_at = now()
    where id = (select id from email_proof
                where token_hash = p_token_hash and used_at is null and expires_at > now()
                limit 1)
    returning person_id into v_person;
  if v_person is null then return null; end if;
  update person set email_proved_at = coalesce(email_proved_at, now()) where id = v_person;
  return v_person;
end $$;

-- The evidence rule. "Set only when the person has demonstrably opened a link
-- we sent to that address" is a property of the data, so it is checked
-- against the data — an application that forgets, or a hand-written update,
-- is refused rather than trusted.
create function fn_email_proof_has_a_reason() returns trigger
language plpgsql as $$
begin
  -- Proof is proof of ONE address. Changing it unproves the account.
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    new.email_proved_at := null;
  end if;

  if new.email_proved_at is not null
     and (tg_op = 'INSERT' or old.email_proved_at is distinct from new.email_proved_at) then
    if new.email is null then
      raise exception 'an account with no address has no address to prove'
        using errcode = 'check_violation';
    end if;
    if not (
      -- the link a sign-up door sent, opened
      exists (select 1 from email_proof ep
              where ep.person_id = new.id and ep.used_at is not null)
      -- a password set through a link emailed to this person's own address
      or exists (select 1 from auth_reset ar
                 where ar.proves_person_id = new.id and ar.used_at is not null)
      -- a parent who confirmed the email channel of an approval (D-156)
      or exists (select 1 from pending_invitation pi
                 where lower(pi.guardian_email) = lower(new.email)
                   and pi.email_confirmed_at is not null)
    ) then
      raise exception 'an address is proved only by opening a link we sent to it (L21)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger person_email_proof_has_a_reason
  before insert or update on person
  for each row execute function fn_email_proof_has_a_reason();

-- B2, structurally: a child is never handed to an account whose address
-- nobody has proved. An account with no address at all is not a door anyone
-- can walk through — there is nothing to sign in with (lib/auth) — so it is
-- the address-bearing accounts this guards.
create function fn_guardian_email_is_proved() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from person p where p.id = new.guardian_id
             and p.email is not null and p.email_proved_at is null) then
    raise exception 'a child is never linked to an address nobody has proved (B2, L21)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger guardianship_link_guardian_proved
  before insert or update of guardian_id on guardianship_link
  for each row execute function fn_guardian_email_is_proved();
