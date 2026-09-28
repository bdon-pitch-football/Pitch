-- ---------------------------------------------------------------------------
-- 0070 — the SMS kill switch and spend cap, on the same switchboard as the
-- other two (D-81, D-94 §10: "kill switches that a tired founder can hit at
-- 11pm: SMS spend cap, a global pause on public profile serving, and the
-- ability to revoke all live tokens at once").
--
-- Until now the SMS half was environment-only: SMS_KILL_SWITCH and
-- SMS_MONTHLY_CAP_CENTS are read by lib/messaging, so turning SMS off meant
-- editing Vercel and redeploying — not a founder on a phone at 11pm, and the
-- release seat's report of 28 Sep ranked it as a launch gap. Two of the three
-- switches D-94 names were reachable from /ops/switches; this is the third.
--
-- The environment stays the ceiling, and the database can only make things
-- stricter:
--   · SMS is off if EITHER says off. The database cannot switch on what the
--     environment has switched off.
--   · The cap in force is the LOWER of the two. The database can lower the
--     cap, never raise it above SMS_MONTHLY_CAP_CENTS; with no cap in the
--     environment, production still refuses every SMS (BUZ decision 5, R4),
--     whatever this table says.
-- That rule is lib/sms-policy's (effectiveSmsCapCents), because only the
-- application can read the environment. This table only records what an
-- operator asked for, and who, and why.
--
-- Same shape as 0044: operator-only (lib/ops-guard, checked in the action),
-- one row, and every change appended to ops_switch_event with the operator's
-- name, email and reason in the same transaction as the switch.
-- ---------------------------------------------------------------------------

alter table ops_switch
  add column sms_off boolean not null default false,
  -- Null means "no lower cap here: the environment's cap applies". A cap of
  -- zero is not a cap, it is the off switch, and it has one of those.
  add column sms_cap_cents int check (sms_cap_cents is null or sms_cap_cents > 0);

-- The switch log learns the four new words. One event, one meaning (L5):
-- switching SMS off is not pausing links, and a cap is not a count of links,
-- so the cap gets its own column rather than borrowing links_affected.
alter table ops_switch_event drop constraint ops_switch_event_action_check;
alter table ops_switch_event add constraint ops_switch_event_action_check
  check (action in ('links_paused', 'links_resumed', 'links_all_revoked',
                    'sms_off', 'sms_on', 'sms_cap_set', 'sms_cap_cleared'));
alter table ops_switch_event add column sms_cap_cents int;

-- What the send layer reads, once per SMS. Stable, no arguments, one row.
create function fn_sms_switch() returns table (sms_off boolean, sms_cap_cents int)
language sql stable as $$
  select coalesce((select s.sms_off from ops_switch s), false),
         (select s.sms_cap_cents from ops_switch s)
$$;

-- Switch SMS off or back on. Returns true when the state changed; flipping it
-- to where it already is writes nothing, as fn_ops_set_links_paused.
create function fn_ops_set_sms_off(p_off boolean, p_operator uuid, p_email text, p_reason text)
returns boolean
language plpgsql as $$
declare
  v_changed int;
begin
  update ops_switch set sms_off = p_off where sms_off <> p_off;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then return false; end if;
  insert into ops_switch_event (action, operator_id, operator_email, reason)
  values (case when p_off then 'sms_off' else 'sms_on' end, p_operator, p_email, p_reason);
  return true;
end $$;

-- Set a lower monthly cap, or clear it (null) so the environment's applies.
-- The caller has already refused a cap above the environment's; this refuses
-- a cap that is not a positive number, because zero is the off switch.
create function fn_ops_set_sms_cap(p_cents int, p_operator uuid, p_email text, p_reason text)
returns boolean
language plpgsql as $$
declare
  v_changed int;
begin
  if p_cents is not null and p_cents <= 0 then
    raise exception 'an SMS cap is a positive number of cents; to stop SMS, switch it off';
  end if;
  update ops_switch set sms_cap_cents = p_cents where sms_cap_cents is distinct from p_cents;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then return false; end if;
  insert into ops_switch_event (action, operator_id, operator_email, reason, sms_cap_cents)
  values (case when p_cents is null then 'sms_cap_cleared' else 'sms_cap_set' end,
          p_operator, p_email, p_reason, p_cents);
  return true;
end $$;
