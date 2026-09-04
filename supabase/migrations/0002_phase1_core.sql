-- ============================================================================
-- 0002 · Phase 1 core schema
-- Built from doc 09 v1.3 (§⓪ wins), doc 27 (verification call = 13 fields),
-- doc 16 (closed vocabulary), CLAUDE.md 25-Aug schema delta.
-- Decisions cited as D-xx (doc 06). Where a comment says a constraint is
-- ABSENT, the absence is deliberate — do not "fix" it.
--
-- Construction rule (doc 09 §④): permissions are COMPUTED from
-- (age band + guardianship + membership + verification) at read time.
-- There is no is_visible, no can_view, no stored age band, anywhere.
-- Doc 14 §J1 asserts their absence.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Lookup tables, never enums (D-73): age groups, tiers, pathways change with
-- the football calendar; an enum change is a migration, a row is not.
-- ---------------------------------------------------------------------------
create table age_group (
  code text primary key,          -- 'U8' … 'U18', 'Senior'
  label text not null,
  sort int not null
);

create table competition_tier (
  code text primary key,
  label text not null
);

insert into age_group (code, label, sort) values
  ('U8','Under 8s',8),('U9','Under 9s',9),('U10','Under 10s',10),
  ('U11','Under 11s',11),('U12','Under 12s',12),('U13','Under 13s',13),
  ('U14','Under 14s',14),('U15','Under 15s',15),('U16','Under 16s',16),
  ('U17','Under 17s',17),('U18','Under 18s',18),('SEN','Seniors',99);

-- ---------------------------------------------------------------------------
-- person — one account per human; roles are hats (doc 09 §①).
-- DOB drives the age state machine (D-49) and is derived at read time —
-- never stored as a band. dob_locked / signup_hold are D-96.
-- ---------------------------------------------------------------------------
create table person (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,             -- Supabase Auth = session only (D-80)
  email text unique,                    -- sign-in identity; children may have none
  first_name text not null,
  last_name text,                       -- pending child invitations hold first name only (D-17)
  dob date,
  dob_locked boolean not null default false,   -- no upward amendment without guardian/club confirmation (D-96)
  signup_hold boolean not null default false,  -- age-contradiction hold: routed to a human, never auto-rejected (D-96)
  country text not null default 'AU',          -- accounts Australia-only at launch (D-63)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- guardianship_link — the legal spine (D-17, D-51). ≤2 guardians, equal
-- visibility, either approves, both notified, most-restrictive-wins.
-- Auto-expiry at 18 is COMPUTED from the child's DOB (D-49), never stored;
-- an adult can re-grant via regranted_at.
-- ---------------------------------------------------------------------------
create table guardianship_link (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references person(id),
  child_id uuid not null references person(id),
  approved_at timestamptz,              -- null = pending invitation state (D-17)
  regranted_at timestamptz,             -- adult re-grant after 18 (D-49)
  created_at timestamptz not null default now(),
  unique (guardian_id, child_id),
  check (guardian_id <> child_id)
);

-- Pending child-initiated invitations (D-17): first name + DOB + guardian
-- contact ONLY, auto-purged after 14 days if unapproved. The CV is built
-- after approval, never before.
create table pending_invitation (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  dob date not null,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
  -- purge job deletes unapproved rows at created_at + 14 days (D-17)
);

-- ---------------------------------------------------------------------------
-- club — with club_state, "the single most important column in the schema"
-- (D-126). verified is written ONLY by an operator action; the FK to the
-- verification_call row makes that structural: you cannot reach 'verified'
-- without a human-logged call. Doc 14 §M4.
-- Subscription fields live on the club row per doc 09 §⓪ ("Fields on the
-- club record"). subscription_status is written only by the Stripe webhook
-- (D-112) and MUST NOT be able to touch club_state — they are two
-- independent inputs to one computed permission.
-- ---------------------------------------------------------------------------
create table club (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  suburb text,
  state text,
  club_state text not null default 'unclaimed'
    check (club_state in ('unclaimed','claimed','verified','suspended')),
  verified_call_id uuid,                -- FK added below (verification_call defined after)
  -- verification suspension is instant and revocable (doc 27 rule 2)
  crest_path text,
  philosophy text,                      -- hostile free text: escape on output
  contact_email text,
  -- subscription (D-112, D-135): status written by webhook ONLY; payment
  -- failure suspends the register via these fields and NEVER via club_state.
  plan text check (plan in ('free','register_monthly','register_annual')),
  subscription_status text,             -- Stripe-shaped; webhook is sole writer
  current_period_end timestamptz,
  grace_until timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  -- M4 structural anchor: 'verified' requires a logged human call.
  check (club_state <> 'verified' or verified_call_id is not null)
);

-- ---------------------------------------------------------------------------
-- verification_call — doc 27's thirteen fields, built as written.
-- No unique on club_id: re-verification (new claimant, annual, on report)
-- produces repeat rows by design.
-- ---------------------------------------------------------------------------
create table verification_call (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  called_at timestamptz not null,       -- Australia/Melbourne (env TZ)
  operator text not null
    check (length(trim(operator)) > 0 and lower(trim(operator)) not in ('system','admin')),
    -- "The human. Named, every time. Never 'system', never 'admin'."
  number_called text not null,
  number_source text not null check (length(trim(number_source)) > 0),
    -- "A blank here invalidates the call" — ringing the number on the claim
    -- form verifies nothing.
  answered_by text,
  club_confirmed boolean,
  person_confirmed boolean,
  incorporated text check (incorporated in ('yes','no','unknown')),        -- three-state, never collapsed
  authority_confirmed text check (authority_confirmed in ('yes','no','unknown')),
  outcome text not null check (outcome in ('verified','not_verified','suspended','takedown')),
    -- stored snake_case; display string for not_verified is "not verified"
  notes text,
  policy_version text not null          -- doc@version (D-144)
);

alter table club add constraint club_verified_call_fk
  foreign key (verified_call_id) references verification_call(id);

-- ---------------------------------------------------------------------------
-- squad — a lens, not a container. competition_gender and age_group live
-- HERE and never on a person (D-68; D-25 is the reason — "U15 Girls is a
-- fact about a competition, not an identity attribute on a minor").
-- ---------------------------------------------------------------------------
create table squad (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  name text not null,
  age_group text references age_group(code),
  competition_gender text check (competition_gender in ('boys','girls','mixed','open','men','women')),
  season text not null,                 -- 'U14 Girls 2027' scoping (doc 09 §②)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- membership — defines "inside the club" (D-19). Roles per D-93; a person
-- holding two roles gets the UNION at read time, never stored.
-- club_admin holds NO development-record access by any path (D-93);
-- technical_director holds club-wide access and is granted by the club,
-- confirmed at verification, never self-declared.
-- ---------------------------------------------------------------------------
create table membership (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id),
  club_id uuid not null references club(id),
  squad_id uuid references squad(id),
  role text not null check (role in ('player','coach','technical_director','team_manager','club_admin','guardian')),
  season text,
  started_at timestamptz not null default now(),
  ended_at timestamptz                  -- on departure the club drops to aggregates (D-48)
);

-- ---------------------------------------------------------------------------
-- development_record — player-owned, portable, never paywalled to its owner
-- (D-10, D-31, D-48). surfaced_stats is D-105 and belongs in the FIRST
-- migration: the player's choice of which stats surface; STAT_SETS in
-- TypeScript is the default pre-selection, not the renderer.
-- ---------------------------------------------------------------------------
create table development_record (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references person(id),
  positions text[] not null default '{}'
    check (cardinality(positions) <= 3),          -- ordered, max 3 (D-69); domain validated in TS
  squad_number int,
  foot text check (foot in ('Left','Right')),
  about text,                                     -- hostile free text
  surfaced_stats text[] not null default '{}',    -- D-105
  created_at timestamptz not null default now()
  -- Deliberately ABSENT (D-69): primary_position, secondary_position,
  -- position_status. position_group derives from positions[1] at read time.
  -- Deliberately ABSENT (D-114): any school field. School football lives in
  -- experience_entry, which grants access to nobody.
);

-- ---------------------------------------------------------------------------
-- player_stat — ROWS NOT COLUMNS. "The irreversible one" (D-70).
-- Values nullable with NO zero default — a keeper, a brand-new player and a
-- striker in a drought must never be byte-identical (the never-zero rule).
-- The catalogue lives in TypeScript (lib/football.ts), not here.
-- ---------------------------------------------------------------------------
create table player_stat (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  season text not null,
  stat_key text not null,               -- domain = lib/football.ts STAT_KEYS
  value int check (value >= 0),         -- no negative statistic exists at all (D-67)
  source_experience_id uuid,            -- FK to experience_entry added below
  provenance text not null check (provenance in ('self_reported','coach_verified','official_import')),
  unique (record_id, season, stat_key, source_experience_id)
);
-- NULLs are distinct in the unique constraint above, so directly-entered
-- stats (no source experience) need their own uniqueness for upserts.
create unique index player_stat_direct on player_stat(record_id, season, stat_key)
  where source_experience_id is null;

-- ---------------------------------------------------------------------------
-- record_entry — the typed atomic unit of the record (D-71). A type
-- discriminator, NOT a competency-scores table with extras bolted on, so
-- effort and participation are never second-class.
-- ---------------------------------------------------------------------------
create table record_entry (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  entry_type text not null check (entry_type in
    ('attendance','participation','effort_observation','milestone','coach_note','competency_observation')),
  author_id uuid references person(id), -- server-derived from the actor, never from the request body
  body jsonb not null default '{}'::jsonb,
  provenance text not null check (provenance in ('self_reported','coach_verified','official_import')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- experience_entry — "other football" (D-72). ZERO permission surface.
-- org_name is free text with NO foreign key to club — DELIBERATELY. The
-- tempting shortcut (nullable club_id + free text) is a hole into a child's
-- record. Doc 14 carries a mandatory test that this grants nothing to anyone.
-- ---------------------------------------------------------------------------
create table experience_entry (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  kind text not null check (kind in ('school','futsal','representative','ntc_academy','tournament','other')),
  org_name text not null,               -- free text, hostile, NO FK — deliberate (D-72)
  competition text,
  season_label text,
  positions text[] not null default '{}',
  notes text,
  provenance text not null default 'self_reported' check (provenance = 'self_reported'),
  created_at timestamptz not null default now()
);

alter table player_stat add constraint player_stat_source_experience_fk
  foreign key (source_experience_id) references experience_entry(id);

-- ---------------------------------------------------------------------------
-- highlight — added_as_minor is what makes D-88's grandfathering buildable:
-- clips added while a minor survive the 18th birthday permanently; the
-- free-adult cap of three applies only to clips added from 18 on.
-- ---------------------------------------------------------------------------
create table highlight (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  url text not null,                    -- YouTube/Instagram/Veo — click-to-play façade only (D-97)
  title text,
  added_at timestamptz not null default now(),
  added_as_minor boolean not null       -- server-derived from DOB at insert (D-88)
);

-- achievement — part of the record (doc 09 §2.3): titles a family typed in.
create table achievement (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  title text not null,                  -- hostile free text
  detail text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profile_version — the approved/pending pair for under-16 records (D-119).
-- Doc 09 gives behaviour, not names; this shape satisfies all four
-- properties: link-holders keep reading the last approved version; the page
-- never blanks; NO job ever publishes a pending version (§R7 — silence keeps
-- the approved page live indefinitely); the guardian reviews a derivable
-- diff (both versions retained).
-- At 16–17 and 18+ edits apply directly and no pending row is created.
-- ---------------------------------------------------------------------------
create table profile_version (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  content jsonb not null,               -- the renderable CV content snapshot
  status text not null check (status in ('approved','pending','superseded')),
  created_by uuid references person(id),
  created_at timestamptz not null default now(),
  approved_by uuid references person(id),
  approved_at timestamptz
);
-- at most one live approved + one pending per record
create unique index profile_version_one_approved on profile_version(record_id) where status = 'approved';
create unique index profile_version_one_pending on profile_version(record_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- share_token — the tokenised read path's data (D-53, D-80). Stored HASHED,
-- compared in constant time; a database dump must not yield working links.
-- Expiry/revocation/pause enforced server-side on every read. U16 default
-- expiry 90 days (set by the app at issue).
-- ---------------------------------------------------------------------------
create table share_token (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  token_hash bytea not null unique,     -- sha-256 of a >=128-bit random token
  token_hint text,                      -- display-only fragment (never enough to reconstruct)
  issued_by uuid not null references person(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,               -- null = no expiry (adult links)
  revoked_at timestamptz,
  paused boolean not null default false -- guardian pause (D-53)
);

-- share_request — D-91: a U16 asks to share; the guardian dispatches.
-- "Child requests, guardian dispatches" is an object, not a permission cell.
create table share_request (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  requested_by uuid not null references person(id),
  destination text,                     -- e.g. club contact address, guardian-reviewed (D-99)
  created_at timestamptz not null default now(),
  dispatched_by uuid references person(id),
  dispatched_at timestamptz,
  share_token_id uuid references share_token(id)
);

-- share_card_approval — D-101 as amended. The guardian sees the exact
-- artefact; NO image is generated or given a URL before approval; once out
-- it cannot be recalled. image_hash asserts byte-identity (doc 14 §Q2).
create table share_card_approval (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  requested_by uuid not null references person(id),
  card_kind text not null,
  image_hash bytea,                     -- set at generation; approved artefact must match byte-for-byte
  storage_path text,                    -- populated ONLY at/after approval — never before (D-101)
  requested_at timestamptz not null default now(),
  approved_by uuid references person(id),
  approved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- registration — the Interest Register row (D-108, D-130). Owned and read by
-- the club. NOT an application; no verdict is ever owed. A trial is a TAG on
-- the registration, never a separate object.
-- ---------------------------------------------------------------------------
create table registration (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references person(id),
  club_id uuid not null references club(id),
  squad_target uuid references squad(id),      -- lookup FK per D-73's discipline
  positions text[] not null default '{}' check (cardinality(positions) <= 3),
  trial_tag text,                              -- nullable: the tag, not a parent object
  note text,                                   -- child-authored; lives on OUR row, not behind the token (D-128)
  club_status text not null default 'new'
    check (club_status in ('new','shortlisted','invited')),
    -- exactly three values, none a verdict (doc 16 §3d, doc 14 N11).
    -- declined / rejected / unsuccessful CANNOT be written, and this column
    -- is never serialised to any player-facing response (N10).
  disclosed_by uuid references person(id),     -- who consented/sent (guardian for u16)
  policy_version text not null,                -- doc@version (D-144)
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
  -- D-128 / doc 14 N7: withdrawal empties note IN THE SAME TRANSACTION —
  -- enforced by the withdraw function (task: permission layer) and by the
  -- trigger below as a belt.
);

-- Belt for N7: a withdrawn row can never retain a readable note.
create function registration_withdrawal_empties_note() returns trigger
language plpgsql as $$
begin
  if new.withdrawn_at is not null then
    new.note := null;
  end if;
  return new;
end $$;

create trigger registration_withdrawal_note
  before insert or update on registration
  for each row execute function registration_withdrawal_empties_note();

-- ---------------------------------------------------------------------------
-- invitation — the ONLY club→family route (D-117). Lands inside Pitch; the
-- outbound notification is a bare wake. read_at is FAMILY-PRIVATE: no route
-- may expose it (or any seen/pending/counter state) to the club (D-138) —
-- silence must be indistinguishable from never-arrived.
-- ---------------------------------------------------------------------------
create table invitation (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  registration_id uuid not null references registration(id),
  body text not null,                   -- hostile free text
  created_at timestamptz not null default now(),
  read_at timestamptz                   -- family-private, never club-visible
);

-- invitation_reply — guardian chooses field by field; NOTHING shared by
-- default. The club never receives a phone number or email address through
-- Pitch, before or after.
create table invitation_reply (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitation(id),
  replied_by uuid not null references person(id),
  shared_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- verification_challenges (D-80) — the guardian two-channel waterfall.
-- Supabase Auth is session only; this table is what the permission function
-- reads. Never phone-OTP sign-in as the second factor.
-- ---------------------------------------------------------------------------
create table verification_challenge (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id),
  channel text not null check (channel in ('email','sms')),
  token_hash bytea not null,
  sent_at timestamptz not null default now(),
  verified_at timestamptz,
  attempts int not null default 0,
  expires_at timestamptz not null
);

-- adult trust layer (D-22, D-28, D-98): the engine keys off a club-attested
-- boolean WWCC state. The check NUMBER is never stored, rendered, logged or
-- returned anywhere — there is deliberately no column for it.
create table wwcc_attestation (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id),
  club_id uuid not null references club(id),
  attested_by uuid not null references person(id),
  attested_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- consent_event — THE append-only spine (D-19, D-26, D-144). Also carries
-- the consent-funnel vocabulary (D-78); provider delivery webhooks write
-- into the SAME table so "parent ignored us" and "spam-foldered" are
-- distinguishable. Append-only is enforced at the storage level below.
-- ---------------------------------------------------------------------------
create table consent_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null check (event in (
    -- consent funnel (D-78)
    'invite_created','email_sent','email_delivered','email_opened','sms_sent',
    'sms_delivered','guardian_landed','email_verified','sms_verified',
    'approved','nudge_sent','purged',
    -- consent & audit spine
    'tos_accepted','policy_accepted','share_issued','share_revoked','share_paused',
    'share_request_created','share_dispatched','card_requested','card_approved',
    'edit_submitted','edit_approved','outside_contact_logged','age_transition',
    'registration_created','registration_withdrawn','invitation_created',
    'invitation_replied','deletion_requested','deletion_completed','report_filed'
  )),
  actor_id uuid,                        -- null for system/webhook events
  subject_id uuid,                      -- the person the event is about
  detail jsonb not null default '{}'::jsonb,   -- NEVER contains a raw token or personal free text
  policy_version text                   -- doc@version where acceptance-shaped (D-144)
);

-- Append-only at the storage level: no UPDATE or DELETE path exists in code,
-- and the database refuses them outright.
create function consent_event_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'consent_event is append-only (D-19/D-26)';
end $$;

create trigger consent_event_no_update before update or delete on consent_event
  for each row execute function consent_event_immutable();

-- ---------------------------------------------------------------------------
-- Anticipated empty tables (doc 09 §⑤) — free to change, specified now so
-- record/assessment tables accept December without migration.
-- ---------------------------------------------------------------------------
create table competency (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  framework_version text not null,
  corner text,                          -- the four corners; six Ps mapping in copy (D-85)
  age_stage text,
  position_scope text not null default 'all' check (position_scope in ('all','gk','outfield')),
  band_descriptors jsonb not null default '{}'::jsonb,
  owner_club_id uuid references club(id),      -- null = Pitch spine
  unique (code, framework_version)
);

create table assessment_block (
  id uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz not null default now()
);

create table assessment_session (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references person(id),
  mode text check (mode in ('player_major','competency_major')),
  created_at timestamptz not null default now()
);

create table assessment_entry (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  competency_id uuid not null references competency(id),  -- (competency_id, framework_version) via competency row — never by name
  block_id uuid references assessment_block(id),
  session_id uuid references assessment_session(id),
  band text not null check (band in ('introduced','developing','consolidating','owns_it')),  -- never numeric (D-60)
  entry_type text not null default 'coach' check (entry_type in ('coach','td_sample','moderation')),
  author_id uuid not null references person(id),
  context_marker jsonb,                 -- relative age in band (D-61/D-84)
  supersedes_entry_id uuid references assessment_entry(id),
  created_at timestamptz not null default now()
  -- DELIBERATELY NO unique constraint on (record_id, competency_id, block_id):
  -- append-only supersession leaves room for a later TD moderation entry
  -- without a migration (D-71). Do not add it.
);

create table match_appearance (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  squad_id uuid references squad(id),
  played_at date,
  minutes int,                          -- family sees season totals; staff per-match; NEVER on the public CV (D-66)
  created_at timestamptz not null default now()
);

create table growth_note (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references development_record(id) on delete cascade,
  entered_by uuid not null references person(id),  -- guardian only, enforced in the permission layer
  height_cm numeric not null,
  measured_on date not null,
  created_at timestamptz not null default now()
  -- guardian-entered, coach-invisible, no classification (D-84)
);

-- ---------------------------------------------------------------------------
-- RLS: enabled on every table with NO policies — default deny. The anon and
-- authenticated roles can read nothing. All reads flow through the permission
-- functions (next migration) and the single tokenised server route (D-80).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
      and tablename in (
        'age_group','competition_tier','person','guardianship_link','pending_invitation',
        'club','verification_call','squad','membership','development_record','player_stat',
        'record_entry','experience_entry','highlight','achievement','profile_version','share_token',
        'share_request','share_card_approval','registration','invitation','invitation_reply',
        'verification_challenge','wwcc_attestation','consent_event','competency',
        'assessment_block','assessment_session','assessment_entry','match_appearance','growth_note')
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
