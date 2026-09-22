-- ---------------------------------------------------------------------------
-- 0058 — a club gets its Technical Director on the verification call, and
-- nowhere else (BUZ, 23 Sep, option A; D-93, D-126, D-137; LESSONS L29).
--
-- Why this exists. 0054 closed the self-declared TD at club claim — a claimant
-- becomes a `club_admin`, full stop — which was right (D-93: "I am the TD"
-- typed into a form is a claim, not a credential) and left no route to a TD at
-- all. The TD is the only role that reads the register (D-154), so after 0054
-- every real club would have had a register it could never open. Closing a
-- door means naming what replaces it (L29). This is the replacement, and it is
-- the one D-93 always named: **confirmed at club verification.**
--
-- The shape, and each piece is here because a decision asks for it:
--
--   · verification_call.td_name / td_email — the operator records the person
--     the club named, on the call, and ONLY on a call whose outcome is
--     `verified` (the check constraint). That is D-137's audit record: a
--     human, named, timestamped, against the operator who took the call.
--
--   · The role attaches only when that address is PROVED (0056, L21). An
--     address is not a person until they have opened a link we sent to it, and
--     this is the highest-privilege role in the product — club-wide read
--     across children's records. So a call can record a TD before that person
--     has an account, or with an unproved one: the club's TD is then RECORDED
--     but NOT YET ACTIVE, and nothing is readable on it.
--
--   · fn_td_membership_write_rule is the wall. A `technical_director`
--     membership can be written by one path and no other: the club is
--     verified, a verified call recorded that person's address as its TD, that
--     address is proved, and the person is an adult. No claim, no form, no
--     self-declaration, no seed, no future route that forgets (D-93, doc 14
--     H10). The action is a caller; the trigger is the guarantee.
--
-- WHERE THE ATTACHMENT HAPPENS, AND WHY THERE. Two triggers on the two events
-- that can make the rule true — the club becoming verified with a TD recorded,
-- and that address becoming proved — never a check on sign-in. Sign-in is one
-- door of several (an approval, a reset and the confirm link all prove an
-- address), so a check there would be a rule that only some paths obey, and it
-- would leave the role inactive for a person who is proved but has not signed
-- in since — the club's register would be readable or not depending on who
-- last opened a browser. The proof itself is the event; the database is where
-- it is seen.
--
-- HANDOVER IS OUT OF SCOPE (BUZ, 23 Sep: fast-follow). A reader looking here
-- for "the club changed its TD" will not find it, deliberately. A later call
-- that records a different person ADDS a TD; it does not end the previous
-- one's membership, and there is no screen that removes one. What already
-- works today and is not handover: a departing TD's membership is ended
-- (doc 14 H9, and the ended row cannot be revived without the evidence), and a
-- club losing verification takes every minor-facing read with it (H5, M10).
--
-- Read with: D-93 (the role and the granting rule), D-126 (verification is a
-- human call), D-137 (the authority question and the named record), D-154 (the
-- TD is the register's reader), 0056 (email_proved_at / fn_email_proved),
-- doc 27 (the call sheet), doc 14 H9, H10, M4.
-- ---------------------------------------------------------------------------

-- ---- 1 · the call records the person -------------------------------------
alter table verification_call add column td_name text;
alter table verification_call add column td_email text;

-- Recorded at the same moment as a verified outcome, or not at all. A call
-- that did not verify the club confirms nobody's role either.
alter table verification_call add constraint verification_call_td_with_verified
  check (
    (td_name is null and td_email is null)
    or (outcome = 'verified'
        and length(trim(td_name)) > 0
        and length(trim(td_email)) > 0
        and position('@' in td_email) > 1)
  );

-- ---- 2 · the one answer: did a call record this person as this club's TD --
create function fn_td_on_call(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
    from verification_call vc
    join person p on p.id = p_person
    where vc.club_id = p_club
      and vc.outcome = 'verified'
      and vc.td_email is not null
      and p.email is not null
      and lower(trim(vc.td_email)) = lower(trim(p.email))
  );
$$;

-- What the operator console reads, so the screen asks the database rather than
-- assembling its own answer (L23). One row per club, or none.
create function fn_club_td(p_club uuid)
  returns table (person_id uuid, td_name text, td_email text,
                 recorded_at timestamptz, recorded_by text, active boolean)
language sql stable as $$
  select
    p.id,
    vc.td_name,
    vc.td_email,
    vc.called_at,
    vc.operator,
    exists (select 1 from membership m
            where m.person_id = p.id and m.club_id = p_club
              and m.role = 'technical_director' and m.ended_at is null)
  from verification_call vc
  left join lateral (
    select p2.id from person p2
    where lower(trim(p2.email)) = lower(trim(vc.td_email))
      and p2.email_proved_at is not null
    order by p2.created_at
    limit 1
  ) p on true
  where vc.club_id = p_club and vc.outcome = 'verified' and vc.td_email is not null
  order by vc.called_at desc
  limit 1;
$$;

-- ---- 3 · the wall: nothing else writes this role -------------------------
create function fn_td_membership_write_rule() returns trigger
language plpgsql as $$
begin
  if new.role = 'technical_director' and new.ended_at is null then
    if not exists (select 1 from club c where c.id = new.club_id and c.club_state = 'verified') then
      raise exception 'a technical director exists only at a verified club (D-126)'
        using errcode = 'check_violation';
    end if;
    if not fn_td_on_call(new.person_id, new.club_id) then
      raise exception 'the technical director is the person the verification call recorded, never a claim or a form (D-93, doc 14 H10)'
        using errcode = 'check_violation';
    end if;
    if not fn_email_proved(new.person_id) then
      raise exception 'the role attaches only to an address somebody proved (0056, L21)'
        using errcode = 'check_violation';
    end if;
    if coalesce(fn_age_band((select dob from person where id = new.person_id)), '') <> '18plus' then
      raise exception 'club-wide access to children''s records is never held by a person under 18 (D-82)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- Every write, not only inserts: reviving an ended membership is a write of
-- the live role and is re-checked against the same evidence. Ending one is
-- untouched, which is what keeps H9 (a departing TD) working.
create trigger membership_td_write_rule
  before insert or update on membership
  for each row execute function fn_td_membership_write_rule();

-- ---- 4 · what turns "recorded" into "active" -----------------------------
-- Quiet by design: it returns null rather than raising when the rule is not
-- yet met, because both callers are triggers on events that happen whether or
-- not there is a TD to attach.
create function fn_attach_recorded_td(p_club uuid) returns uuid
language plpgsql as $$
declare v_person uuid; v_id uuid;
begin
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then
    return null;
  end if;
  select p.id into v_person
  from verification_call vc
  join person p on lower(trim(p.email)) = lower(trim(vc.td_email))
  where vc.club_id = p_club
    and vc.outcome = 'verified'
    and vc.td_email is not null
    and p.email_proved_at is not null
    and fn_age_band(p.dob) = '18plus'
  order by vc.called_at desc, p.created_at
  limit 1;
  if v_person is null then return null; end if;

  select id into v_id from membership
   where person_id = v_person and club_id = p_club
     and role = 'technical_director' and ended_at is null
   limit 1;
  if v_id is not null then return v_id; end if;

  insert into membership (person_id, club_id, role)
    values (v_person, p_club, 'technical_director')
    returning id into v_id;
  return v_id;
end $$;

-- The club is verified (or re-verified) with a TD recorded on the call.
create function fn_club_verified_attaches_td() returns trigger
language plpgsql as $$
begin
  perform fn_attach_recorded_td(new.id);
  return null;
end $$;

create trigger club_verified_attaches_td
  after update on club
  for each row
  when (new.club_state = 'verified'
        and (old.club_state is distinct from new.club_state
             or old.verified_call_id is distinct from new.verified_call_id))
  execute function fn_club_verified_attaches_td();

-- The call is logged against a club that is verified already (re-verification,
-- and the order the seed writes in).
create function fn_call_attaches_td() returns trigger
language plpgsql as $$
begin
  if new.outcome = 'verified' and new.td_email is not null then
    perform fn_attach_recorded_td(new.club_id);
  end if;
  return null;
end $$;

create trigger verification_call_attaches_td
  after insert or update on verification_call
  for each row execute function fn_call_attaches_td();

-- The recorded person proves their address — the moment the role becomes
-- real, however they proved it (the confirm link, a reset they set a password
-- from, or a guardian approval that settled the address).
create function fn_proof_attaches_td() returns trigger
language plpgsql as $$
declare v_club uuid;
begin
  for v_club in
    select vc.club_id from verification_call vc
    where vc.outcome = 'verified' and vc.td_email is not null
      and lower(trim(vc.td_email)) = lower(trim(new.email))
  loop
    perform fn_attach_recorded_td(v_club);
  end loop;
  return null;
end $$;

create trigger person_proof_attaches_td
  after update of email_proved_at on person
  for each row
  when (new.email_proved_at is not null and old.email_proved_at is null and new.email is not null)
  execute function fn_proof_attaches_td();

-- ---- 5 · the rows that are already here ----------------------------------
-- A rule installed with exceptions left behind is a rule with exceptions. Any
-- live technical_director membership that this path would not have written is
-- ended now, the same way a departing TD's is (D-48: they keep only what they
-- authored). There is no production data today; this is what makes the
-- invariant true of the whole table rather than only of future writes.
update membership m set ended_at = now()
 where m.role = 'technical_director' and m.ended_at is null
   and not (
     exists (select 1 from club c where c.id = m.club_id and c.club_state = 'verified')
     and fn_td_on_call(m.person_id, m.club_id)
     and fn_email_proved(m.person_id)
   );
