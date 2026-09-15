-- ---------------------------------------------------------------------------
-- 0033 — the guardian's send switch becomes something the log can record.
--
-- 0021 added guardian_setting.send_disabled and fn_can_dispatch has honoured
-- it since (doc 14 L6/L7, green). But no screen could change it, so doc 15
-- §22's promise to the parent of a 16–17 — "the switch is yours if you ever
-- want it off" — pointed at nothing. The guardian controls now carry it, and
-- every control on that screen writes the consent log. The vocabulary is a
-- closed CHECK, so the event has to be added here before it can be written.
-- ---------------------------------------------------------------------------
alter table consent_event drop constraint consent_event_event_check;
alter table consent_event add constraint consent_event_event_check check (event in (
  -- consent funnel (D-78)
  'invite_created','email_sent','email_delivered','email_opened','sms_sent',
  'sms_delivered','guardian_landed','email_verified','sms_verified',
  'approved','nudge_sent','purged',
  -- consent & audit spine
  'tos_accepted','policy_accepted','share_issued','share_revoked','share_paused',
  'share_request_created','share_dispatched','card_requested','card_approved',
  'edit_submitted','edit_approved','outside_contact_logged','age_transition',
  'registration_created','registration_withdrawn','invitation_created',
  'invitation_replied','deletion_requested','deletion_completed','report_filed',
  -- 0033: a guardian turned a 16-17's own sending off or back on (L6)
  'send_switch_changed'
));
