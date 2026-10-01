-- ---------------------------------------------------------------------------
-- 0168 — the call sheet says, before the call is logged, whether doc 15 §39
-- will go (John's ruling of 1 Oct on §39, condition on the script; BUZ's (A)
-- of the same day; D-126, D-172, D-93; doc 27's close; 0166).
--
-- WHY THIS EXISTS. 0166 answers who receives §39 for a verified call, and
-- answers "nobody" whenever anything about that person is not true — most
-- often, at a small club, because the administrator's account IS the club's
-- published address, which §39 must never reach. But doc 27's close has BUZ
-- say "you'll get an email confirming it" on the phone, and for that club the
-- sentence is false. John: the sheet shows, before BUZ closes the call,
-- whether §39 will send, and the script says the email line only when it will.
--
-- ONE ANSWER, NOT TWO (L23). The part of 0166's answer that is about the
-- PERSON — the club's one live administrator, an adult, at a proved address
-- that is not the club's published one — moves into fn_verified_call_addressee,
-- and fn_verified_call_recipient now asks it, adding only what is about the
-- CALL (verified, the club named the claimant, the call the club now stands
-- on). The sheet asks the same function, so what it promises and what the
-- press sends cannot drift apart. Every failing case still answers "nobody",
-- never somebody else: the function reads no Technical Director, no guardian,
-- no player and no fallback address.
--
-- What the sheet can know before the call is the person. What it cannot is
-- the call's own answers (the club naming the claimant), and doc 27 lets no
-- call verify without them anyway. The sheet shows the person's FIRST NAME
-- and nothing else — never the address (BUZ, 1 Oct: "Logging this call as
-- verified emails {first name} to confirm it." / "Logging this call sends no
-- email, so don't promise one.").
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

create function fn_verified_call_addressee(p_club uuid)
returns table (person_id uuid, email text, first_name text)
language sql stable as $$
  select p.id, p.email, p.first_name
  from club c
  join membership m on m.club_id = c.id and m.role = 'club_admin' and m.ended_at is null
  join person p on p.id = m.person_id
  where c.id = p_club
    and (select count(*) from membership m2
          where m2.club_id = c.id and m2.role = 'club_admin' and m2.ended_at is null) = 1
    and p.email is not null
    and fn_email_proved(p.id)
    and fn_age_band(p.dob) = '18plus'
    and lower(trim(p.email)) <> lower(trim(coalesce(c.contact_email, '~no contact address~')))
$$;

comment on function fn_verified_call_addressee(uuid) is
  'doc 15 §39 (0168) — the person a verified call at this club would confirm it to: the one live administrator, an adult, at a proved address that is not the club''s published one. Nobody otherwise.';

create or replace function fn_verified_call_recipient(p_call uuid)
returns table (person_id uuid, email text, club_name text, called_at timestamptz)
language sql stable as $$
  select a.person_id, a.email, c.name, vc.called_at
  from verification_call vc
  join club c on c.id = vc.club_id
  cross join lateral fn_verified_call_addressee(c.id) a
  where vc.id = p_call
    and vc.outcome = 'verified'
    and vc.person_confirmed is true
    and c.club_state = 'verified'
    and c.verified_call_id = vc.id
$$;

revoke all on function fn_verified_call_addressee(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_verified_call_addressee(uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_verified_call_addressee(uuid) from authenticated';
  end if;
end $$;
