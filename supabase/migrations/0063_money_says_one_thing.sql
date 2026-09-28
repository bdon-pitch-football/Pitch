-- ---------------------------------------------------------------------------
-- 0063 — the money says one thing on every screen, and the register says who
-- reads it (D-135, D-136, D-154, D-93; doc 14 O4, O11, N17, N23; LESSONS L23).
--
-- TWO DEFECTS, ONE CAUSE: every screen that needed to know about a club's
-- subscription worked it out for itself.
--
--   1 · app/club/billing/page.tsx:35-36 computes `active` and `pastDue` from
--       c.subscription_status inline. app/club/register/page.tsx:91 computes a
--       different `active` from fn_register_active. The two disagree about a
--       club whose payment failed: the billing page shows the dunning card
--       while the register — the screen the failure actually costs something
--       on — drops SILENTLY to the free tier's "Interest in your trials"
--       heading with nothing about payment anywhere near it. A verified,
--       paying club with ninety-nine families on its register loses the list
--       and is told, in effect, that it never had one. D-135 promises
--       "payment failure suspends, it never deletes"; a screen that says
--       nothing is not a promise kept, it is a promise nobody can see.
--
--   2 · Neither page can say who at the club may read the register, which is
--       the one fact on a billing screen that is genuinely ours and is the
--       whole of D-93's wall: an administrator manages the page, the squads,
--       the notices and the billing, and reads no registration at all. Doc 14
--       N23 already requires the grant list to be visible to the TD on the
--       club's own screens — who, which squads, since when — and no screen in
--       the product shows it.
--
-- WHY IN THE DATABASE. Both are the same class of mistake as 0059's claims
-- list: a page that answers "who may see this child" on its own is a second
-- answer and a second place to be wrong (L23). fn_register_payment_state is
-- one answer to "where does this club stand with us", asked by both club
-- screens in the same words, so they cannot disagree again.
--
-- WHAT IS DELIBERATELY NOT HERE. The card brand, the last four digits and a
-- receipt address. We do not hold any of them and we are not going to: D-25's
-- rule is that a field we do not collect cannot leak, cannot be subpoenaed
-- and cannot be got wrong, and Stripe's own hosted portal already shows the
-- card to the person who entered it (D-112 keeps us at SAQ-A precisely by
-- never touching card data). The portal link is the answer to "which card",
-- not a column here.
--
-- Read with: 0004 (fn_register_active, fn_can_work_register), 0012 and 0032
-- (the webhook is the only writer of subscription state), 0037 (D-154's
-- named readers), 0047 (fn_register_readers — the family's side of the same
-- question), D-93, D-126, D-135, D-136, D-154.
-- ---------------------------------------------------------------------------

-- ---- 1 · where this club stands with us -----------------------------------
-- One answer, six values, and the asker has to be one of the club's own
-- people before there is an answer at all. Billing is club-internal and
-- carries no child data (O11), so the administrator is told as much as the
-- technical director is — and exactly as much, because a treasurer who is
-- shown less than the TD about the club's own money is a treasurer who rings
-- their bank instead of us (D-136).
--
--   null           the asker holds no current TD or administrator membership
--                  at this club. Not "no", not "forbidden": no answer, which
--                  is the same shape every other function on this surface has.
--   'unsubscribed' no subscription state has ever been recorded. The free
--                  tier — the club page, the trial notices, CVs by email.
--   'active'       active or trialing.
--   'grace'        a payment failed and the fourteen days are still running.
--                  The register is STILL READABLE (D-135's grace), which is
--                  why this is not 'suspended' and why the copy for it is
--                  "nothing has changed yet".
--   'suspended'    a payment failed and the grace ran out. The register is
--                  hidden. Nothing is deleted (O4/O5).
--   'cancelled'    the club cancelled. Registrations are destroyed only at
--                  cancellation plus thirty days, by the job, never here
--                  (O5, fn_purge_cancelled_registers).
--
-- Whether the register is readable is NOT re-derived here: fn_register_active
-- is the one answer to that and this asks it. Re-reading grace_until would be
-- the same defect one layer down.
create function fn_register_payment_state(p_person uuid, p_club uuid) returns text
language plpgsql stable as $$
declare v_status text;
begin
  if p_person is null or p_club is null then return null; end if;
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then
    return null;
  end if;

  select subscription_status into v_status from club where id = p_club;
  if not found then return null; end if;
  if v_status is null then return 'unsubscribed'; end if;
  if v_status in ('active','trialing') then return 'active'; end if;
  -- Stripe spells it 'canceled'; our copy is Australian and our value is the
  -- word the product uses. The webhook's string is Stripe's, not ours.
  if v_status = 'canceled' then return 'cancelled'; end if;
  return case when fn_register_active(p_club) then 'grace' else 'suspended' end;
end $$;

-- ---- 2 · who at this club can read the register ---------------------------
-- N23, and the wall D-93 runs through the register, as one list a club can
-- read on its own screen. Computed from membership, the grant row and the
-- WWCC attestation at read time — never a stored "can read" flag (doc 34
-- rule 7), so a coach whose membership ended or whose attestation was pulled
-- leaves this list at the next read without anybody remembering to remove
-- them (N21).
--
-- WHO IS ON IT, and this is the point of it rather than an omission: the
-- technical director, every coach holding a LIVE grant, every club
-- administrator and every team manager. The last two read nothing and are on
-- the list saying so, because "a treasurer made an admin to send invoices
-- must never be able to read a child's development notes" (D-93) is a
-- promise, and a promise a club cannot see is one it cannot hold us to. A
-- coach with no grant is not on it: they are not one of the club's readers,
-- and a fifteen-coach club would bury the three rows that matter.
--
-- WHO MAY ASK, and this is the restrictive side of an unclear question
-- (TRAINING §3.8), written down here rather than left in a page. N23 gives
-- the grant list to the TD. It does not give it to the administrator, and
-- O11's permission for the administrator to read billing carries the explicit
-- condition that it must not widen any minor-facing permission. So:
--   · the technical director gets every row;
--   · an administrator gets ONE row — their own — because what a person's own
--     access is is never a disclosure to them, and the administrator on the
--     billing page is exactly the person D-93's sentence is about;
--   · everybody else gets an empty set.
-- The cost belongs to BUZ and not to this migration: an administrator cannot
-- see, on the screen attached to the money, that the club's coaches are named
-- and few. If he wants that, it is one line — the `v_td` branch widens — and
-- it is his call, not mine.
--
-- `scope` is AUTHORITY, not today's weather. A suspended club's TD still has
-- whole-register authority and reads nothing until a payment goes through;
-- that is what fn_register_payment_state is on the same screen to say, and
-- encoding it twice is how two answers start to disagree.
create function fn_club_register_readers(p_person uuid, p_club uuid)
returns table (reader_id uuid, reader_name text, role_label text,
               scope text, squad_names text[], since timestamptz)
language plpgsql stable as $$
declare v_td boolean;
begin
  if p_person is null or p_club is null then return; end if;
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then
    return;
  end if;
  v_td := fn_can_work_register(p_person, p_club);

  return query
    with people as (
      select distinct m.person_id
      from membership m
      where m.club_id = p_club and m.ended_at is null
        and m.role in ('technical_director','club_admin','team_manager','coach')
        -- a coach is a reader only while a grant of theirs resolves (N19/N21)
        and (m.role <> 'coach'
             or exists (select 1 from fn_register_grant_squads(m.person_id, p_club)))
    )
    select
      p.id,
      nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
      -- A person holding two roles gets the union, computed at read (D-93).
      -- The label is the most powerful role they hold; the scope below is the
      -- union, which is the half that decides anything.
      (select case m2.role
                when 'technical_director' then 'Technical Director'
                when 'coach' then 'Coach'
                when 'team_manager' then 'Team manager'
                else 'Club administrator' end
         from membership m2
        where m2.person_id = p.id and m2.club_id = p_club and m2.ended_at is null
        order by case m2.role when 'technical_director' then 1 when 'coach' then 2
                              when 'team_manager' then 3 else 4 end
        limit 1),
      case
        when fn_can_work_register(p.id, p_club) then 'whole'
        when exists (select 1 from fn_register_grant_squads(p.id, p_club)) then 'squads'
        else 'none'
      end,
      coalesce(array(
        select s.name from squad s
        where s.id in (select fn_register_grant_squads(p.id, p_club))
        order by s.name), '{}'::text[]),
      (select min(m3.started_at) from membership m3
        where m3.person_id = p.id and m3.club_id = p_club and m3.ended_at is null)
    from people
    join person p on p.id = people.person_id
    where v_td or p.id = p_person
    order by
      case when fn_can_work_register(p.id, p_club) then 1
           when exists (select 1 from fn_register_grant_squads(p.id, p_club)) then 2
           else 3 end,
      p.first_name, p.last_name;
end $$;
