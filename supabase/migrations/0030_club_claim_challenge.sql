-- ---------------------------------------------------------------------------
-- 0030 — the club claim code (D-126, doc 15 §34).
--
-- /claim/[slug] was `if (production) notFound()` — "until email codes land" —
-- so an unclaimed club compiled from public notices had no route in at all.
-- The dev flow claimed the page directly on a button press, which is exactly
-- the version that cannot ship: it would let anybody take any club.
--
-- The proof rides verification_challenge, which already holds a hashed
-- token, an expiry and an attempt counter. It gains a club, because a
-- challenge to claim Riverside is not interchangeable with a challenge to
-- claim anybody else.
--
-- WHERE THE CODE GOES IS THE WHOLE DESIGN. It goes to the address already
-- published on the club's own public listing — the one we compiled the page
-- from — and NEVER to an address the claimant types. A code sent to an
-- address of the reader's choosing proves the reader can read their own
-- email, which is not a fact about the club. Doc 15 §34 says this in the
-- copy; this is the schema that makes it true.
--
-- Claiming still cannot verify. club_state goes to 'claimed', a human call
-- is the only thing that reaches 'verified' (D-126), and the table check
-- from 0002 continues to require a call row for it.
-- ---------------------------------------------------------------------------
alter table verification_challenge add column club_id uuid references club(id);

-- One live claim challenge per person per club. A second request replaces
-- the first rather than leaving two valid codes in the world.
create unique index verification_challenge_one_live_claim
  on verification_challenge (person_id, club_id)
  where club_id is not null and verified_at is null;
