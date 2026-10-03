-- ---------------------------------------------------------------------------
-- 0176 · A phone number is held in one form, E.164 (John, 3 Oct, §4; D-81,
-- D-79, D-25; APP 10; doc 23 unchanged — it states periods, not formats).
--
-- WHAT WAS WRONG. A parent's mobile was stored as typed ("0400 818 181") in
-- pending_invitation.guardian_phone and in message_outbox.to_address, while
-- Twilio was handed +61400818181 and the STOP list fingerprinted the same.
-- So the outbox said something untrue about where a text went (0009 promised
-- "email address or E.164 number"), and the support lookup missed a parent
-- who spaced their number differently from how they typed it — which sends
-- support into the database, the thing D-79 exists to prevent.
--
-- NOW. The app writes the one form at the point of entry, with the function
-- that already makes Twilio's To and the fingerprint (lib/number-hash
-- normaliseNumber): lib/guardian-flow for the invitation, lib/messaging for
-- the outbox. No "as typed" copy is kept anywhere. The support lookup
-- normalises its query the same way and matches exact numbers only
-- (app/ops/support).
--
-- THIS FILE rewrites the rows already held. fn_e164 is normaliseNumber in
-- SQL, character for character — JavaScript's \s, which is wider than
-- Postgres's (a no-break space is one), then (?:\+61|61|0)(4\d{8}) — and the
-- permission suite holds the two to the same answers (ph-4). A number that
-- does not normalise was never texted (lib/messaging refuses it before
-- anything is written), so it is left exactly as it is, on its existing
-- clock: 14 days for an invitation (fn_purge_pending), 30 days in the outbox
-- (lib/sent-bodies). Nothing is kept a day longer. The counts are printed —
-- counts only, never a number (scripts/apply-migrations prints notices).
--
-- PRODUCTION (at 0173). Re-running is safe: a row already in E.164 is not
-- matched again, so a second run rewrites nothing and prints zeros. Locks:
-- ROW EXCLUSIVE on pending_invitation and message_outbox, and row locks on
-- the rows it rewrites — production has a handful (SMS has not been live).
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

create or replace function fn_e164(p_number text) returns text
language sql immutable as $$
  select '+61' || substring(
    regexp_replace(coalesce(p_number, ''),
      E'[\x09-\x0d    -     　﻿().-]', '', 'g')
    from '^(?:\+61|61|0)(4[0-9]{8})$')
$$;

comment on function fn_e164(text) is
  'lib/number-hash normaliseNumber in SQL (John, 3 Oct, §4): an Australian mobile as +614…, or null. Used to rewrite stored numbers once (0176); the app writes the form itself.';

do $$
declare n_inv int; n_out int; left_inv int; left_out int;
begin
  update pending_invitation set guardian_phone = fn_e164(guardian_phone)
   where guardian_phone is not null and fn_e164(guardian_phone) is not null
     and guardian_phone <> fn_e164(guardian_phone);
  get diagnostics n_inv = row_count;
  update message_outbox set to_address = fn_e164(to_address)
   where channel = 'sms' and to_address <> '' and fn_e164(to_address) is not null
     and to_address <> fn_e164(to_address);
  get diagnostics n_out = row_count;
  select count(*)::int into left_inv from pending_invitation
   where guardian_phone is not null and guardian_phone <> '' and fn_e164(guardian_phone) is null;
  select count(*)::int into left_out from message_outbox
   where channel = 'sms' and to_address <> '' and fn_e164(to_address) is null;
  raise notice '0176: wrote % invitation number(s) and % text address(es) as E.164; % and % did not normalise and were left on their clocks.',
    n_inv, n_out, left_inv, left_out;
end $$;
