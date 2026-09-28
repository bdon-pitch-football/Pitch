-- ---------------------------------------------------------------------------
-- 0068 — the payment grace is fourteen days from the FIRST failure, and
-- nothing moves it (D-135, doc 14 O4).
--
-- WHY THIS EXISTS. fn_apply_subscription (0012, 0032) wrote grace_until from
-- whatever it was handed, on every call. The webhook hands it a fresh
-- fourteen days on every `customer.subscription.updated` that says past_due,
-- and Stripe sends one of those each time it retries the card or anything
-- else on the subscription changes. So the grace restarted on every event and
-- a club whose card had failed could keep reading children's registrations
-- for as long as Stripe kept talking to us. The `invoice.payment_failed`
-- branch had learned to pass the old date back in (28 Sep); the
-- subscription branch had not, and a rule that holds on one of two doors is
-- not held.
--
-- LEO'S DECISION, 28 Sep: the grace is fourteen days from the first failure.
-- Nothing extends it. Only a successful payment clears it. That is now the
-- function's rule, so it holds whichever branch, event or retry calls it:
--
--   past_due            the grace already running is kept. Only when none is
--                       running does the one handed in start.
--   active / trialing   a payment went through: the grace is cleared.
--   anything else       (canceled, unpaid, incomplete…) the stored date is
--                       left exactly as it was. Clearing it would let a club
--                       that bounced unpaid → past_due start a new fortnight,
--                       which is extending it by another name.
--
-- And because a date can now outlive the status that set it, the register
-- gate reads the grace only while the club is actually past_due. A cancelled
-- club with ten days left on an old grace reads nothing (it read nothing
-- before this too — the webhook nulled the date on cancellation; now the
-- gate, not the caller, is what makes that true).
--
-- D-135 is untouched: suspension hides, it never deletes. Neither function
-- here can delete anything, and O4b/O5 keep asking.
-- ---------------------------------------------------------------------------

create or replace function fn_apply_subscription(
  p_club uuid, p_status text, p_plan text,
  p_period_end timestamptz, p_grace_until timestamptz, p_customer text,
  p_event_at timestamptz default null
) returns void
language plpgsql as $$
begin
  update club set
    subscription_status = p_status,
    plan = coalesce(p_plan, plan),
    current_period_end = coalesce(p_period_end, current_period_end),
    -- 0068: the first failure starts the fortnight; nothing restarts it; a
    -- payment ends it.
    grace_until = case
      when p_status = 'past_due' then coalesce(grace_until, p_grace_until)
      when p_status in ('active', 'trialing') then null
      else grace_until
    end,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id),
    subscription_event_at = coalesce(p_event_at, subscription_event_at)
  where id = p_club
    -- Stale event: nothing to do. A null on either side means we have no
    -- basis to call it stale, so it applies.
    and (p_event_at is null or subscription_event_at is null
         or p_event_at >= subscription_event_at);
  -- club_state is deliberately untouched. A card can never verify a club.
end $$;

-- The subscription gate (D-112, D-135): active, or past_due and inside the
-- grace. Suspension hides rows, never deletes them.
create or replace function fn_register_active(p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from club c
    where c.id = p_club
      and (c.subscription_status in ('active','trialing')
           or (c.subscription_status = 'past_due'
               and c.grace_until is not null and c.grace_until > now())))
$$;
