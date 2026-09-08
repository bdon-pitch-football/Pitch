-- ---------------------------------------------------------------------------
-- 0025 — John's rulings on doc 30 (doc 31, 7 Sep 2026).
--
-- Three go against what was built. Nothing here binds until BUZ calls it in
-- doc 06; it is implemented so the gate can move, and it is reversible.
--
-- U-5 — an under-16 sees THAT a send happened, when, and to WHICH CLUB by
--       name. Not the recipient email address. The guardian still sees it in
--       full. "The reduction costs the child nothing. 'Riverside FC, 12
--       March' answers every question a child actually has about where their
--       football went. The email address answers none of them and is the
--       single field carrying both third-party information and
--       family-conflict risk."
--
-- U-4 — the consent log still records only what happened, never what was
--       attempted and stopped. But a blocked send leaves a trace in a
--       SEPARATE operational record: sending actor, timestamp, reason class.
--       No recipient, no child, no content. Ninety days. "It answers 'is
--       somebody probing us' without answering 'what happened to this
--       child', and those are the right two questions to keep apart."
--
-- U-1 — an unactioned send request lapses at 14 days, matching D-17. Not for
--       consistency but for D-25: a composed-but-unsent request holds a
--       child's free text for no purpose once nobody is going to act on it.
--       Indefinite is not a retention period; it is the absence of one.
--
-- U-6 — a complaints investigator gets a distinct path to send rows. Support
--       does not. Purpose-bound, time-boxed, logged, and DISCLOSED — a
--       guardian may ask who at Pitch looked at their child's record and
--       why, and get a straight answer. That fourth condition is what makes
--       the other three real.
--
-- M11/L29 — L29 stands and M11 is unbuildable: a token is not bound to a
--       club, so "revoke every link that club holds" would kill links those
--       families sent to OTHER clubs — punishing a family for what a club
--       did. Instead, de-verification carries a REASON CLASS, and only the
--       child-safety class notifies affected guardians with a one-tap
--       revoke. Agency, not automation.
-- ---------------------------------------------------------------------------

-- ---- U-5: the send log, reduced for the child ------------------------------
drop function if exists fn_send_log(uuid, uuid);

create function fn_send_log(p_viewer uuid, p_person uuid)
returns table (at timestamptz, club_name text, recipient text, sending_actor uuid, band_at_send text)
language plpgsql stable as $$
declare v_is_guardian boolean;
begin
  if p_viewer is null then return; end if;

  v_is_guardian := exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null));

  if p_viewer <> p_person and not v_is_guardian then return; end if;

  return query
    select ce.at,
           ce.detail->>'club_name',
           -- U-5: an under-16 reading their OWN log sees the club, never the
           -- address. A guardian sees it in full, and so does the person
           -- themself once they are 16 or over.
           case
             when v_is_guardian then ce.detail->>'recipient'
             when fn_age_band((select dob from person where id = p_person)) = 'u16' then null
             else ce.detail->>'recipient'
           end,
           ce.actor_id,
           ce.detail->>'band_at_send'
    from consent_event ce
    where ce.subject_id = p_person and ce.event = 'share_dispatched'
    order by ce.at desc;
end $$;

-- ---- U-4: the operational abuse counter ------------------------------------
-- A different store from the consent log, on purpose. Never rendered as part
-- of any child's record, and never shown to a guardian as though it were
-- about them.
create table abuse_signal (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references person(id),   -- the SENDER. Never the subject.
  reason text not null check (reason in ('rate_limited','blocked','denied','lapsed')),
  surface text not null                  -- 'send', 'access_request', 'signin'
  -- Deliberately absent: recipient, child, record, content. This answers
  -- "is somebody probing us", never "what happened to this child".
);
alter table abuse_signal enable row level security;

create function fn_purge_abuse_signals() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (delete from abuse_signal where at < now() - interval '90 days' returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;

-- ---- U-1: the 14-day lapse -------------------------------------------------
-- The request is GONE, not queued and not flagged (L16). The child is told
-- their own request expired; they are never told a parent did not act.
create function fn_lapse_send_requests() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (
    delete from share_request
    where dispatched_at is null and created_at < now() - interval '14 days'
    returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;

create function fn_lapse_interest_requests() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (
    delete from registration_request
    where dispatched_at is null and created_at < now() - interval '14 days'
    returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;

-- ---- U-6: complaints access, all four conditions ---------------------------
create table investigation_grant (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references report(id),   -- purpose-bound: no standing access
  investigator_id uuid not null references person(id),
  subject_id uuid not null references person(id),  -- whose record may be read
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,                 -- time-boxed
  extended_reason text                             -- extendable once, with a reason on the record
);
alter table investigation_grant enable row level security;

-- Logged: every actual look, append-only, separate from the grant.
create table investigation_access (
  id bigint generated always as identity primary key,
  grant_id uuid not null references investigation_grant(id),
  at timestamptz not null default now(),
  what text not null
);
alter table investigation_access enable row level security;

create function investigation_access_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'the investigation access log is append-only';
end $$;

create trigger investigation_access_immutable
  before update or delete on investigation_access
  for each row execute function investigation_access_immutable();

-- Disclosed: a guardian may ask who looked at their child's record and why,
-- and get a straight answer. This is the function that makes that answerable.
create function fn_who_looked(p_viewer uuid, p_person uuid)
returns table (at timestamptz, investigator text, report_id uuid, what text)
language plpgsql stable as $$
begin
  if p_viewer is null then return; end if;
  if p_viewer <> p_person and not exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return; end if;

  return query
    select ia.at,
           trim(p.first_name || ' ' || coalesce(p.last_name, '')),
           ig.report_id,
           ia.what
    from investigation_access ia
    join investigation_grant ig on ig.id = ia.grant_id
    join person p on p.id = ig.investigator_id
    where ig.subject_id = p_person
    order by ia.at desc;
end $$;

-- ---- M11/L29: the child-safety reason class --------------------------------
-- Ordinary de-verification — lapsed paperwork, non-payment, an admin change —
-- triggers nothing beyond ending club-side access (already M10). ONLY the
-- child-safety class notifies families. Without the flag, either every
-- de-verification alarms families or none does, and both are wrong.
alter table club add column suspension_reason text
  check (suspension_reason in ('child_safety','administrative','non_payment'));

-- Which guardians must be told, and about which link. A family that sent a
-- link to THIS club, and whose link is still live.
create function fn_guardians_to_notify_on_suspension(p_club uuid)
returns table (guardian_id uuid, guardian_email text, child_first_name text, token_id uuid)
language sql stable as $$
  select distinct g.guardian_id, gp.email, ch.first_name, st.id
  from share_request sr
  join share_token st on st.id = sr.share_token_id
  join development_record dr on dr.id = sr.record_id
  join person ch on ch.id = dr.person_id
  join guardianship_link g on g.child_id = ch.id
    and g.approved_at is not null and g.revoked_at is null
  join person gp on gp.id = g.guardian_id
  join club c on c.id = p_club
  where sr.dispatched_at is not null
    and st.revoked_at is null
    and (st.expires_at is null or st.expires_at > now())
    and lower(sr.destination) like '%' || lower(coalesce(c.contact_email, '~never~')) || '%'
$$;

-- ---- The one-tap undo the §36 and §37 notifications point at ---------------
-- The link carries the authority, exactly as a share token does, because a
-- parent who has just been told something alarming must not meet a sign-in
-- wall. Stored hashed; single-purpose; revokes ONE token and can do nothing
-- else. It cannot read a record, cannot see a child and cannot be replayed
-- into anything.
create table undo_token (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  share_token_id uuid not null references share_token(id) on delete cascade,
  issued_to uuid not null references person(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table undo_token enable row level security;
