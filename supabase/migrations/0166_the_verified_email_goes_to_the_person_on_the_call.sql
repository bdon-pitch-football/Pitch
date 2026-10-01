-- ---------------------------------------------------------------------------
-- 0166 — who receives doc 15 §39, "Your club is verified" (BUZ, 1 Oct: "Yes
-- to both, hand to Leo"; John's ruling of 1 Oct; D-126, D-137, D-172, D-93;
-- doc 27; doc 14 M9).
--
-- WHY THIS EXISTS. The close of the verification call (doc 27) promises "you'll
-- get an email confirming it", and nothing sent one: John had the line struck
-- until a message existed. §39 is that message, sent once when an operator
-- logs a call as verified, "to the person whose authority was confirmed on
-- that call, at their own account email". Who that is, is a question about
-- people at a club, so it is answered here, once, the way
-- fn_guardians_to_notify_on_suspension answers §37's (0066, L23). The call
-- sheet's action sends to whatever comes back and decides nothing.
--
-- THE PERSON. D-126: the call confirms "that the individual is who they claim
-- to be within it". Doc 27 asks the club to name the person who claimed the
-- page ("who would that be?") and then the authority question about that
-- person, and the log records the first as person_confirmed — "did they
-- independently name the claimant". The claimant is the club's administrator:
-- claiming writes club_admin and nothing else (0054), and nothing adds an
-- administrator (doc 14 M8). So the answer is that one person, and only when
-- the call says the club named them. The Technical Director recorded on the
-- call is NOT included: no authority question is asked about them, and their
-- role attaches later, on proof (0058). Whether a TD named on a handover call
-- should also receive §39 is listed for Leo and BUZ, not decided here.
--
-- EVERY WAY OF GETTING IT WRONG ANSWERS "NOBODY":
--   · a call that did not verify, or a verified call that is not the one the
--     club now stands on (club.verified_call_id), or a club that is not
--     verified (a paused onboarding refuses the move, D-139) → nobody;
--   · the club did not name the claimant (person_confirmed not true) → nobody;
--   · no live administrator, or more than one (the call confirmed one name,
--     and a second would be a person nobody named) → nobody;
--   · an address nobody proved (0056, L21: an address is not a person until
--     they open a link we sent to it) → nobody;
--   · anyone not an adult, or with no date of birth (fn_age_band reads null as
--     u16) → nobody. A player under 18 is never this message's reader;
--   · an account whose address IS the club's published contact address →
--     nobody. That address is held to send the claim code and for nothing
--     else (D-172), anyone at the club may read it, and John's ruling names it
--     as the address §39 must never reach. Compared as 0060 compares it.
-- No guardian or player is reachable from here at all: the only person this
-- reads is the club's administrator. A family is never told anything about a
-- club's verification (doc 14 M9).
--
-- Once per verification: one verified call, one answer. A later verified call
-- (doc 27's re-verification: annual, on a report, on a change of person) is a
-- new call and answers again, for the administrator the club named on it.
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

create function fn_verified_call_recipient(p_call uuid)
returns table (person_id uuid, email text, club_name text, called_at timestamptz)
language sql stable as $$
  select p.id, p.email, c.name, vc.called_at
  from verification_call vc
  join club c on c.id = vc.club_id
  join membership m on m.club_id = c.id and m.role = 'club_admin' and m.ended_at is null
  join person p on p.id = m.person_id
  where vc.id = p_call
    and vc.outcome = 'verified'
    and vc.person_confirmed is true
    and c.club_state = 'verified'
    and c.verified_call_id = vc.id
    and (select count(*) from membership m2
          where m2.club_id = c.id and m2.role = 'club_admin' and m2.ended_at is null) = 1
    and p.email is not null
    and fn_email_proved(p.id)
    and fn_age_band(p.dob) = '18plus'
    and lower(trim(p.email)) <> lower(trim(coalesce(c.contact_email, '~no contact address~')))
$$;

comment on function fn_verified_call_recipient(uuid) is
  'doc 15 §39 (BUZ, 1 Oct) — the one person a verified call confirmed: the club''s administrator, named by the club on the call, at a proved adult account address that is not the club''s published one. Nobody otherwise.';

-- The app's own connection asks this; nobody else needs to (0122's pattern).
revoke all on function fn_verified_call_recipient(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_verified_call_recipient(uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_verified_call_recipient(uuid) from authenticated';
  end if;
end $$;
