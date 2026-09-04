-- ============================================================================
-- 0012 · Billing (D-112, D-135, D-136, D-137)
-- The authority representation captured at checkout: many community clubs are
-- unincorporated associations with no legal personality, so a volunteer's
-- assent binds nothing. The tick turns an anonymous assent into an identified
-- representation, and BUZ's verification call asks the same question again.
-- ============================================================================
create table checkout_authority (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  person_name text not null,
  role_at_club text not null,
  authorised boolean not null,          -- "I am authorised by [Club] to enter this agreement on its behalf"
  plan text not null check (plan in ('register_monthly','register_annual')),
  agreed_at timestamptz not null default now(),
  policy_version text not null          -- doc@version of the terms shown (D-144)
);

-- Stripe events, recorded so a replayed or duplicate webhook cannot double-apply.
create table stripe_event (
  id text primary key,                  -- Stripe's own event id
  received_at timestamptz not null default now(),
  kind text not null
);

-- The ONLY writer of subscription state (D-112). Nothing else in the codebase
-- may set these columns, and this function cannot touch club_state: payment
-- must never be able to verify a club (D-126).
create function fn_apply_subscription(
  p_club uuid, p_status text, p_plan text,
  p_period_end timestamptz, p_grace_until timestamptz, p_customer text
) returns void
language plpgsql as $$
begin
  update club set
    subscription_status = p_status,
    plan = coalesce(p_plan, plan),
    current_period_end = coalesce(p_period_end, current_period_end),
    grace_until = p_grace_until,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id)
  where id = p_club;
  -- club_state is deliberately untouched. A card can never verify a club.
end $$;

-- Cancellation destroys registrations only after 30 days (D-135). Suspension
-- hides them and never deletes: a family's child is never deleted because a
-- club's card expired.
create function fn_purge_cancelled_registers() returns int
language plpgsql as $$
declare n int;
begin
  with doomed as (
    delete from registration r using club c
    where r.club_id = c.id
      and c.subscription_status = 'canceled'
      and c.current_period_end is not null
      and c.current_period_end < now() - interval '30 days'
    returning r.id
  )
  insert into consent_event (event, detail)
  select 'registration_withdrawn', jsonb_build_object('reason', 'club_cancelled_30d') from doomed;
  get diagnostics n = row_count;
  return n;
end $$;

alter table checkout_authority enable row level security;
alter table stripe_event enable row level security;
