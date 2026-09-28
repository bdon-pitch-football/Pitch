-- ---------------------------------------------------------------------------
-- 0075 — free at launch, the Interest Register included (D-163).
--
-- BUZ, 28 Sep: "at launch everything will be free … the interest register
-- included. Premium will be priced at further notice." D-163 records it and
-- names the part that does not move: a club reads the register because a
-- human verified it (D-126) and a TD or a named coach holds the grant (D-93).
-- Payment was never the gate; verification is. A free register is the same
-- wall with no toll in front of it.
--
-- WHAT CHANGES, AND IT IS ONE SWITCH IN ONE PLACE.
--
--   app_config 'billing_enabled'   'false' at launch. Nothing else in the
--                                  product holds a second copy of the answer.
--   fn_billing_enabled()           the only reader of that row. The pages ask
--                                  it through lib/billing; the register gate
--                                  asks it here.
--
-- Turning billing on later is `update app_config set value = 'true' where key
-- = 'billing_enabled'` plus BUZ's copy — the Stripe build (checkout, portal,
-- webhook, receipts, dunning) stays in the codebase and is exercised by the
-- suites with the switch on. Not a rebuild.
--
-- THE REGISTER GATE (fn_register_active, 0004 → 0068).
--
--   billing off   a VERIFIED club's register is active. Nothing about money
--                 is read: a subscription status left over from before the
--                 switch (a seeded past_due, a club that once cancelled)
--                 neither opens nor closes it.
--   billing on    exactly 0068's rule, unchanged: active or trialing, or
--                 past_due inside the grace.
--
-- The off branch asks for club_state = 'verified' itself, although every
-- caller (0034, 0035, 0037, 0049) already refuses an unverified club before it
-- asks this. With billing on, payment could never open an unverified club's
-- register because the callers said no first; with billing off the gate's own
-- answer would be "yes" for any club at all if it did not ask, and a caller
-- written tomorrow that forgets the verification line would read children's
-- registrations off a claimed page. D-126 is kept in the gate as well as in
-- front of it. A suspended club is not 'verified', so it reads nothing either
-- way.
--
-- WHERE THIS CLUB STANDS WITH US (fn_register_payment_state, 0063) gains one
-- value, 'free': billing is switched off, so no money state applies — no plan,
-- no charge date, no dunning card. It is asked AFTER the membership check, so
-- a stranger still gets null, never 'free'. The pages render nothing about
-- money for it, which is how "no price anywhere a person can reach" holds on
-- /home and /club/register without either screen knowing about the switch.
--
-- D-126, D-93, D-82 and D-137's verification-call question are untouched.
-- Read with: 0004, 0063, 0068, D-163, D-126, D-93, D-153, D-135.
-- ---------------------------------------------------------------------------

insert into app_config (key, value) values ('billing_enabled', 'false')
  on conflict (key) do nothing;

-- Anything but the literal 'true' is off, and so is a missing row. A typo in
-- a config change must not switch payment on.
create function fn_billing_enabled() returns boolean
language sql stable as $$
  select coalesce((select value = 'true' from app_config where key = 'billing_enabled'), false)
$$;

comment on function fn_billing_enabled() is
  'D-163: billing is off at launch. The one answer to "is money switched on"; app_config billing_enabled holds it.';

create or replace function fn_register_active(p_club uuid) returns boolean
language sql stable as $$
  select case
    -- D-163: free at launch. Verification is the gate (D-126), and nothing else.
    when not fn_billing_enabled() then exists (
      select 1 from club c where c.id = p_club and c.club_state = 'verified')
    -- The subscription gate (D-112, D-135, 0068): active, or past_due and
    -- inside the grace.
    else exists (
      select 1 from club c
      where c.id = p_club
        and (c.subscription_status in ('active','trialing')
             or (c.subscription_status = 'past_due'
                 and c.grace_until is not null and c.grace_until > now())))
  end
$$;

create or replace function fn_register_payment_state(p_person uuid, p_club uuid) returns text
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
  -- 0075, D-163: while billing is off there is no money state to report.
  if not exists (select 1 from club where id = p_club) then return null; end if;
  if not fn_billing_enabled() then return 'free'; end if;

  select subscription_status into v_status from club where id = p_club;
  if not found then return null; end if;
  if v_status is null then return 'unsubscribed'; end if;
  if v_status in ('active','trialing') then return 'active'; end if;
  if v_status = 'canceled' then return 'cancelled'; end if;
  return case when fn_register_active(p_club) then 'grace' else 'suspended' end;
end $$;
