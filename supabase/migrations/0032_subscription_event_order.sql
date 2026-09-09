-- ---------------------------------------------------------------------------
-- 0032 — subscription state stops depending on the order Stripe happens to
-- deliver in.
--
-- Stripe does not guarantee webhook ordering, and fn_apply_subscription
-- overwrote unconditionally. Replays were already handled (stripe_event), but
-- a REORDER is a different failure and it was wide open in both directions:
--
--   · a `customer.subscription.updated` carrying status=active, emitted
--     before a cancellation but delivered after it, put a cancelled club back
--     to active — register visible again, and the 30-day purge clock (D-135)
--     never starts;
--   · a delayed `invoice.payment_failed` suspends a club that has since paid.
--
-- The second is a support ticket. The first is a paying-club register full of
-- named children staying visible after the club stopped paying, which is the
-- kind of thing that has to be right by construction rather than by luck of
-- delivery order.
--
-- The guard is the event's own timestamp: an event older than the last one
-- applied to that club is acknowledged and ignored. Equal timestamps still
-- apply, because Stripe emits several events in the same second and the last
-- of those is as good an answer as any.
-- ---------------------------------------------------------------------------
alter table club add column subscription_event_at timestamptz;

comment on column club.subscription_event_at is
  'Stripe event timestamp last applied. Older events are ignored — webhooks are not ordered.';

drop function if exists fn_apply_subscription(uuid, text, text, timestamptz, timestamptz, text);

create function fn_apply_subscription(
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
    grace_until = p_grace_until,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id),
    subscription_event_at = coalesce(p_event_at, subscription_event_at)
  where id = p_club
    -- Stale event: nothing to do. A null on either side means we have no
    -- basis to call it stale, so it applies.
    and (p_event_at is null or subscription_event_at is null
         or p_event_at >= subscription_event_at);
  -- club_state is deliberately untouched. A card can never verify a club.
end $$;
