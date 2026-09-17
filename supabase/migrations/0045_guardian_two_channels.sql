-- ---------------------------------------------------------------------------
-- 0045 — D-155 (a guardian is an adult) and D-156 (D-24's two channels).
--
-- D-156. The approval text and the approval email each carry their own
-- random token, stored hashed like a share token (D-80): a dump of this
-- table yields no working link. A channel is confirmed when the parent
-- PRESSES "Yes, it's me — continue" on the page its link opens. Opening
-- the link confirms nothing: mail scanners follow links, and a GET that
-- confirmed would turn one real channel into a log that says two.
-- Approval needs both, in either order, and the database refuses it
-- otherwise, whatever the application does.
--
-- D-155. A guardianship link can never be written to an account that is
-- under 18 by date of birth. An invitation whose named email belongs to
-- such an account is HELD: held_at is set, nothing is linked, and every
-- screen reads exactly as an ordinary approval would (D-77, J2). The hold
-- is visible only to operators, and the 14-day purge takes it like any
-- other unapproved invitation. A guardian declares they are 18 or over at
-- approval: adult_declared_at on the person, and on the consent row.
-- ---------------------------------------------------------------------------
alter table pending_invitation
  add column sms_token_hash bytea unique,
  add column email_token_hash bytea unique,
  add column sms_confirmed_at timestamptz,
  add column email_confirmed_at timestamptz,
  add column held_at timestamptz;

alter table person add column adult_declared_at timestamptz;

-- D-156, structurally: approved_at cannot be set without both channels.
alter table pending_invitation add constraint pending_invitation_two_channels
  check (approved_at is null or (sms_confirmed_at is not null and email_confirmed_at is not null)) not valid;
-- Rows approved before this migration (one channel) are left as history;
-- `not valid` applies the rule to every write from here on.

-- D-155, structurally: never a guardian under 18 by date of birth.
create function fn_guardian_is_not_a_minor() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from person p where p.id = new.guardian_id
             and p.dob is not null and fn_age_band(p.dob) <> '18plus') then
    raise exception 'a guardian must be an adult (D-155)' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger guardianship_link_adult_guardian
  before insert or update of guardian_id on guardianship_link
  for each row execute function fn_guardian_is_not_a_minor();
