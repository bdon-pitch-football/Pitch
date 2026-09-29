-- ---------------------------------------------------------------------------
-- 0130 — Pitch curates the trials board: the operator adds an unclaimed club
-- listing, and a trial notice compiled from the club's own public notice
-- (D-74, D-90, D-64; brief I, 29 Sep, BUZ: "build both").
--
-- WHY THIS EXISTS. At launch the trials board is curated by Pitch (D-74), and
-- D-90 names its two sources: a verified club posts its own notice, or Pitch
-- adds one compiled from the club's own public notice. Until now the second
-- source had no door. The only way a club listing or a compiled notice got
-- into the database was the seed script, so on 1 October the board would have
-- held exactly what verified clubs had posted themselves.
--
-- THE SHAPE.
--
--   · A club listing records where Pitch found it (listing_source, required,
--     exactly as number_source is on the call sheet: "a blank here
--     invalidates it"), and who listed it and when. It is `unclaimed`, so the
--     club page carries the D-64 disclaimer it already carries for every
--     unclaimed listing, and it is claimed later through /claim, unchanged.
--     A duplicate by name and suburb is refused, whitespace and case aside.
--
--   · A compiled notice records the URL of the club's own public notice
--     (source_url, required), and who added it; added_on and last_checked
--     are 0007's stamps, and the operator re-stamps last_checked with one
--     button. It expires exactly as a club's own notice does: every renderer
--     already drops trial_on < today (0007). It may only be added to, or
--     changed on, a club that is unclaimed or claimed-and-unverified. A
--     verified club posts its own (D-90); a suspended club gets nothing new.
--
--   · Every write is a function naming the operator, as fn_ops_end_td does
--     (0100): the operator must be a real person whose own address is the one
--     given, and the authority is requireOperator in app/ops, because the
--     schema holds no operator identity (lib/ops-guard). Each write leaves an
--     append-only curation_event row carrying the operator's address.
--
--   · THE WALL. A notice whose source is 'compiled', and its age-group rows,
--     are written only inside these functions: they set pitch.curating for
--     their own transaction, and a trigger refuses every other insert, update
--     or delete of such a row. So no other route — the club's own post-trial
--     action, a future form, a public page — can create one, edit one or
--     turn a club's own notice into one. There is no public submission route
--     and this adds none (D-90).
--
--   · An operator edits or removes only what Pitch wrote: a club listing
--     while it is still unclaimed (a club that has claimed its page runs it),
--     and compiled notices. Removing a compiled notice is allowed whatever
--     state the club is in, because taking a listing down is the safe
--     direction.
--
--   · If the listing's contact address is changed, any claim code already
--     sent to the old address stops working (its challenge is deleted): the
--     address is what /claim proves the club by (doc 15 §34), and a code at
--     an address we have just said is wrong proves nothing.
--
--   · The reads (fn_ops_clubs, fn_ops_club, fn_ops_club_notices) return club
--     facts and counts. No person's data: a club's administrator and TD are
--     on the call sheet, not here (brief I).
--
-- Read with: D-64, D-68, D-73, D-74, D-90, D-92, D-137; 0007 (the stamps and
-- the expiry rule), 0040 (a notice's age groups), 0044 and 0100 (the operator
-- audit pattern), 0030 (the claim challenge).
-- ---------------------------------------------------------------------------

-- ---- 1 · where a listing came from, and who added it ----------------------
alter table club add column listing_source text;       -- "club website /contact"
alter table club add column listed_by uuid;            -- the operator; no FK (0044's reasoning)
alter table club add column listed_by_email text;
alter table club add column listed_at timestamptz;

alter table trial_notice add column source_url text;   -- the club's own public notice
alter table trial_notice add column added_by uuid;     -- the operator; no FK
alter table trial_notice add column added_by_email text;

-- A compiled notice always says where it came from and who added it. NOT
-- VALID so the migration cannot fail on a database holding an older compiled
-- row; every row written from here on is checked.
alter table trial_notice add constraint trial_notice_compiled_provenance
  check (source <> 'compiled' or (source_url is not null and added_by_email is not null)) not valid;

-- ---- 2 · the audit row ----------------------------------------------------
-- No foreign keys, on purpose (0044, 0100): removing a listing must not take
-- the record of its removal with it, and an append-only row cannot be updated
-- to null. detail holds what the listing or notice said (club facts, never a
-- person's).
create table curation_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (action in (
    'club_added', 'club_edited', 'club_removed',
    'notice_added', 'notice_edited', 'notice_checked', 'notice_removed')),
  operator_id uuid not null,
  operator_email text not null check (length(btrim(operator_email)) > 0),
  club_id uuid not null,
  trial_notice_id uuid,
  detail jsonb not null default '{}'::jsonb
);
alter table curation_event enable row level security;

create function curation_event_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'curation_event is append-only (D-90, 0130)';
end $$;

create trigger curation_event_no_update before update or delete on curation_event
  for each row execute function curation_event_immutable();

-- ---- 3 · the wall ---------------------------------------------------------
create function trial_notice_curation_wall() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('pitch.curating', true), '') = ''
     and ((tg_op <> 'DELETE' and new.source = 'compiled')
          or (tg_op <> 'INSERT' and old.source = 'compiled')) then
    raise exception 'a notice Pitch compiled is written only by the operator''s functions (D-90, 0130)'
      using errcode = 'insufficient_privilege';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trial_notice_curation_wall before insert or update or delete on trial_notice
  for each row execute function trial_notice_curation_wall();

-- A compiled notice's age groups are what make it findable (D-68 as amended
-- 16 Sep), so they are behind the same wall. A cascade from a walled delete
-- finds its notice already gone and passes.
create function trial_notice_age_group_curation_wall() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('pitch.curating', true), '') = '' and exists (
       select 1 from trial_notice t
       where t.source = 'compiled'
         and t.id in (case when tg_op <> 'DELETE' then new.trial_notice_id end,
                      case when tg_op <> 'INSERT' then old.trial_notice_id end)) then
    raise exception 'a notice Pitch compiled is written only by the operator''s functions (D-90, 0130)'
      using errcode = 'insufficient_privilege';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trial_notice_age_group_curation_wall before insert or update or delete on trial_notice_age_group
  for each row execute function trial_notice_age_group_curation_wall();

-- ---- 4 · the pieces every write shares ------------------------------------
-- The operator: a person, named by their own address (0100's rule, D-137).
create function fn_ops_operator(p_operator uuid, p_email text) returns text
language plpgsql stable as $$
begin
  if p_operator is null or not exists (
    select 1 from person where id = p_operator
      and email is not null and lower(btrim(email)) = lower(btrim(coalesce(p_email, '')))) then
    raise exception 'an operator is a person, named by their own address (D-137)'
      using errcode = 'insufficient_privilege';
  end if;
  return lower(btrim(p_email));
end $$;

-- Name and suburb as a person would compare them: case and spacing aside.
create function fn_club_listing_key(p_name text, p_suburb text) returns text
language sql immutable as $$
  select regexp_replace(lower(btrim(coalesce(p_name, ''))), '\s+', ' ', 'g')
      || '|' || regexp_replace(lower(btrim(coalesce(p_suburb, ''))), '\s+', ' ', 'g');
$$;

-- Tidy free text: trimmed, runs of spaces made one.
create function fn_tidy(p text) returns text
language sql immutable as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '');
$$;

-- The address a listing's page lives at: /fc/<slug>, plain a-z, 0-9 and
-- hyphens, the next free one (base, base-2, base-3 …), as coach pages do.
create function fn_club_slug_for(p_name text, p_except uuid) returns text
language plpgsql stable as $$
declare v_base text; v_try text; n int := 1;
begin
  v_base := btrim(regexp_replace(lower(replace(coalesce(p_name, ''), '&', ' and ')), '[^a-z0-9]+', '-', 'g'), '-');
  v_base := rtrim(left(v_base, 60), '-');
  if v_base = '' then v_base := 'club'; end if;
  v_try := v_base;
  while exists (select 1 from club where public_slug = v_try and id is distinct from p_except) loop
    n := n + 1;
    v_try := v_base || '-' || n;
  end loop;
  return v_try;
end $$;

create function fn_club_listing_check(p_name text, p_suburb text, p_state text, p_contact text, p_source text)
returns void
language plpgsql immutable as $$
begin
  if length(coalesce(fn_tidy(p_name), '')) not between 2 and 120 then
    raise exception 'a club listing needs the club''s name' using errcode = 'check_violation';
  end if;
  if length(coalesce(fn_tidy(p_suburb), '')) not between 2 and 80 then
    raise exception 'a club listing needs the club''s suburb' using errcode = 'check_violation';
  end if;
  -- D-04: Victoria and New South Wales, the two the trials board filters by.
  if coalesce(p_state, '') not in ('VIC', 'NSW') then
    raise exception 'a club listing is in Victoria or New South Wales (D-04)' using errcode = 'check_violation';
  end if;
  if fn_tidy(p_contact) is not null
     and (length(p_contact) > 254 or btrim(p_contact) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'the contact address is not an email address' using errcode = 'check_violation';
  end if;
  if length(coalesce(fn_tidy(p_source), '')) not between 3 and 300 then
    raise exception 'a club listing says where its details came from' using errcode = 'check_violation';
  end if;
end $$;

-- The ten positions (D-92). Held in TypeScript (lib/football.ts, D-70); this
-- copy exists only to refuse a value the form did not offer, and the
-- permission suite fails if it ever differs from the module's own list.
create function fn_positions_ten() returns text[]
language sql immutable as $$
  select array['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST']::text[];
$$;

create function fn_trial_notice_check(p_title text, p_ages text[], p_gender text, p_trial_on date,
                                      p_time text, p_ground text, p_positions text[], p_source_url text)
returns void
language plpgsql stable as $$
begin
  if length(coalesce(fn_tidy(p_title), '')) not between 3 and 120 then
    raise exception 'a notice needs its title' using errcode = 'check_violation';
  end if;
  -- One or more age groups, every one of them in the lookup (D-68, D-73).
  if coalesce(cardinality(p_ages), 0) = 0
     or (select count(distinct a) from unnest(p_ages) a) <> (select count(*) from age_group where code = any(p_ages)) then
    raise exception 'a notice names every age group it is for, from the lookup' using errcode = 'check_violation';
  end if;
  if p_gender is not null and p_gender not in ('boys', 'girls', 'men', 'women') then
    raise exception 'competition gender is boys, girls, men or women, or blank (D-68)' using errcode = 'check_violation';
  end if;
  if p_trial_on is null then
    raise exception 'a notice needs its date' using errcode = 'check_violation';
  end if;
  if length(coalesce(fn_tidy(p_time), '')) not between 1 and 40
     or length(coalesce(fn_tidy(p_ground), '')) not between 2 and 120 then
    raise exception 'a notice needs its time and its ground' using errcode = 'check_violation';
  end if;
  if not (coalesce(p_positions, '{}'::text[]) <@ fn_positions_ten()) then
    raise exception 'positions come from the ten (D-92)' using errcode = 'check_violation';
  end if;
  if coalesce(p_source_url, '') !~ '^https?://[^\s/]+\.[^\s]+$' or length(p_source_url) > 500 then
    raise exception 'a compiled notice links to the club''s own public notice (D-90)' using errcode = 'check_violation';
  end if;
end $$;

-- ---- 5 · club listings ----------------------------------------------------
create function fn_ops_add_club(p_operator uuid, p_email text, p_name text, p_suburb text,
                                p_state text, p_contact text, p_source text) returns uuid
language plpgsql as $$
declare v_email text; v_id uuid;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  perform fn_club_listing_check(p_name, p_suburb, p_state, p_contact, p_source);
  -- Two operators adding the same club at the same moment: one wins.
  perform pg_advisory_xact_lock(hashtext('pitch.club_listing'));
  if exists (select 1 from club where fn_club_listing_key(name, suburb) = fn_club_listing_key(p_name, p_suburb)) then
    raise exception 'that club is already listed (same name and suburb)' using errcode = 'unique_violation';
  end if;
  insert into club (name, suburb, state, club_state, contact_email, public_slug,
                    listing_source, listed_by, listed_by_email, listed_at)
  values (fn_tidy(p_name), fn_tidy(p_suburb), p_state, 'unclaimed', lower(fn_tidy(p_contact)),
          fn_club_slug_for(fn_tidy(p_name), null), fn_tidy(p_source), p_operator, v_email, now())
  returning id into v_id;
  insert into curation_event (action, operator_id, operator_email, club_id, detail)
  values ('club_added', p_operator, v_email, v_id, jsonb_build_object(
    'name', fn_tidy(p_name), 'suburb', fn_tidy(p_suburb), 'state', p_state,
    'contact', lower(fn_tidy(p_contact)), 'source', fn_tidy(p_source)));
  return v_id;
end $$;

create function fn_ops_edit_club(p_operator uuid, p_email text, p_club uuid, p_name text, p_suburb text,
                                 p_state text, p_contact text, p_source text) returns void
language plpgsql as $$
declare v_email text; v_old club%rowtype; v_contact text := lower(fn_tidy(p_contact));
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select * into v_old from club where id = p_club for update;
  if not found then
    raise exception 'no such club' using errcode = 'no_data_found';
  end if;
  if v_old.club_state <> 'unclaimed' then
    raise exception 'a club that has claimed its page runs it; only an unclaimed listing is Pitch''s to change (D-90)'
      using errcode = 'insufficient_privilege';
  end if;
  perform fn_club_listing_check(p_name, p_suburb, p_state, p_contact, p_source);
  perform pg_advisory_xact_lock(hashtext('pitch.club_listing'));
  if exists (select 1 from club where id <> p_club
               and fn_club_listing_key(name, suburb) = fn_club_listing_key(p_name, p_suburb)) then
    raise exception 'that club is already listed (same name and suburb)' using errcode = 'unique_violation';
  end if;
  update club set
    name = fn_tidy(p_name), suburb = fn_tidy(p_suburb), state = p_state,
    contact_email = v_contact, listing_source = fn_tidy(p_source),
    -- The page's address follows the name, so a corrected typo is not left
    -- in the link. Only while unclaimed, which is the only time this runs.
    public_slug = case when fn_tidy(p_name) is distinct from v_old.name
                       then fn_club_slug_for(fn_tidy(p_name), p_club) else v_old.public_slug end
  where id = p_club;
  -- A code already sent to the old address proves nothing about the club now.
  if v_contact is distinct from v_old.contact_email then
    delete from verification_challenge where club_id = p_club and verified_at is null;
  end if;
  insert into curation_event (action, operator_id, operator_email, club_id, detail)
  values ('club_edited', p_operator, v_email, p_club, jsonb_build_object(
    'before', jsonb_build_object('name', v_old.name, 'suburb', v_old.suburb, 'state', v_old.state,
                                 'contact', v_old.contact_email, 'source', v_old.listing_source),
    'after', jsonb_build_object('name', fn_tidy(p_name), 'suburb', fn_tidy(p_suburb), 'state', p_state,
                                'contact', v_contact, 'source', fn_tidy(p_source))));
end $$;

-- Removes an unclaimed listing, the notices on it and any claim code in
-- flight. Anything else hanging off the club (which an unclaimed listing Pitch
-- wrote does not have) makes the delete fail, and nothing is removed.
create function fn_ops_remove_club(p_operator uuid, p_email text, p_club uuid) returns void
language plpgsql as $$
declare v_email text; v_old club%rowtype; v_notices int;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select * into v_old from club where id = p_club for update;
  if not found then
    raise exception 'no such club' using errcode = 'no_data_found';
  end if;
  if v_old.club_state <> 'unclaimed' then
    raise exception 'a club that has claimed its page runs it; only an unclaimed listing is Pitch''s to remove (D-90)'
      using errcode = 'insufficient_privilege';
  end if;
  perform set_config('pitch.curating', 'on', true);
  with gone as (delete from trial_notice where club_id = p_club returning 1)
  select count(*)::int into v_notices from gone;
  delete from verification_challenge where club_id = p_club;
  delete from club where id = p_club;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, detail)
  values ('club_removed', p_operator, v_email, p_club, jsonb_build_object(
    'name', v_old.name, 'suburb', v_old.suburb, 'state', v_old.state, 'slug', v_old.public_slug,
    'contact', v_old.contact_email, 'source', v_old.listing_source, 'notices', v_notices));
end $$;

-- ---- 6 · compiled notices -------------------------------------------------
-- Only on a club that is unclaimed or claimed-and-unverified (D-90).
create function fn_curatable_club(p_club uuid) returns void
language plpgsql as $$
declare v_state text;
begin
  select club_state into v_state from club where id = p_club for update;
  if not found then
    raise exception 'no such club' using errcode = 'no_data_found';
  end if;
  if v_state not in ('unclaimed', 'claimed') then
    raise exception 'a verified club posts its own notices, and a suspended club gets none (D-90)'
      using errcode = 'insufficient_privilege';
  end if;
end $$;

create function fn_ops_add_notice(p_operator uuid, p_email text, p_club uuid, p_title text, p_ages text[],
                                  p_gender text, p_trial_on date, p_time text, p_ground text,
                                  p_positions text[], p_source_url text) returns uuid
language plpgsql as $$
declare v_email text; v_id uuid;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  perform fn_curatable_club(p_club);
  perform fn_trial_notice_check(p_title, p_ages, nullif(p_gender, ''), p_trial_on, p_time, p_ground, p_positions, p_source_url);
  if p_trial_on < (now() at time zone 'Australia/Melbourne')::date then
    raise exception 'a notice for a day that has passed would never show' using errcode = 'check_violation';
  end if;
  perform set_config('pitch.curating', 'on', true);
  -- The time and the ground are one line, as the club's own form writes them.
  insert into trial_notice (club_id, title, trial_on, time_venue, position_needs, competition_gender,
                            source, source_url, added_by, added_by_email)
  values (p_club, fn_tidy(p_title), p_trial_on, fn_tidy(p_time) || ' · ' || fn_tidy(p_ground),
          coalesce(p_positions, '{}'::text[]), nullif(p_gender, ''),
          'compiled', btrim(p_source_url), p_operator, v_email)
  returning id into v_id;
  insert into trial_notice_age_group (trial_notice_id, age_group)
    select v_id, a from (select distinct unnest(p_ages) as a) x;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_added', p_operator, v_email, p_club, v_id, jsonb_build_object(
    'title', fn_tidy(p_title), 'trial_on', p_trial_on, 'ages', p_ages, 'source_url', btrim(p_source_url)));
  return v_id;
end $$;

-- A change moves last_checked, as a club's own edit does. Once anybody has
-- registered for the trial its date is fixed: moving it would leave families
-- holding the day they signed up for (app/club/post-trial, the same rule).
create function fn_ops_edit_notice(p_operator uuid, p_email text, p_notice uuid, p_title text, p_ages text[],
                                   p_gender text, p_trial_on date, p_time text, p_ground text,
                                   p_positions text[], p_source_url text) returns void
language plpgsql as $$
declare v_email text; v_old trial_notice%rowtype; v_on date;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select * into v_old from trial_notice where id = p_notice for update;
  if not found or v_old.source <> 'compiled' then
    raise exception 'only a notice Pitch compiled is changed here; a club changes its own (D-90)'
      using errcode = 'insufficient_privilege';
  end if;
  perform fn_curatable_club(v_old.club_id);
  v_on := case when exists (select 1 from registration r where r.trial_notice_id = p_notice and r.withdrawn_at is null)
               then v_old.trial_on else p_trial_on end;
  perform fn_trial_notice_check(p_title, p_ages, nullif(p_gender, ''), v_on, p_time, p_ground, p_positions, p_source_url);
  if v_on is distinct from v_old.trial_on and v_on < (now() at time zone 'Australia/Melbourne')::date then
    raise exception 'a notice for a day that has passed would never show' using errcode = 'check_violation';
  end if;
  perform set_config('pitch.curating', 'on', true);
  update trial_notice set
    title = fn_tidy(p_title), trial_on = v_on, time_venue = fn_tidy(p_time) || ' · ' || fn_tidy(p_ground),
    position_needs = coalesce(p_positions, '{}'::text[]), competition_gender = nullif(p_gender, ''),
    source_url = btrim(p_source_url),
    last_checked = (now() at time zone 'Australia/Melbourne')::date
  where id = p_notice;
  delete from trial_notice_age_group where trial_notice_id = p_notice;
  insert into trial_notice_age_group (trial_notice_id, age_group)
    select p_notice, a from (select distinct unnest(p_ages) as a) x;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_edited', p_operator, v_email, v_old.club_id, p_notice, jsonb_build_object(
    'before', jsonb_build_object('title', v_old.title, 'trial_on', v_old.trial_on, 'time_venue', v_old.time_venue,
                                 'source_url', v_old.source_url),
    'after', jsonb_build_object('title', fn_tidy(p_title), 'trial_on', v_on, 'ages', p_ages,
                                'source_url', btrim(p_source_url))));
end $$;

-- "Last checked", re-stamped with one button: the operator has looked at the
-- club's own notice again today and it still says this (D-74).
create function fn_ops_check_notice(p_operator uuid, p_email text, p_notice uuid) returns void
language plpgsql as $$
declare v_email text; v_old trial_notice%rowtype;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select * into v_old from trial_notice where id = p_notice for update;
  if not found or v_old.source <> 'compiled' then
    raise exception 'only a notice Pitch compiled is checked here (D-90)' using errcode = 'insufficient_privilege';
  end if;
  perform fn_curatable_club(v_old.club_id);
  perform set_config('pitch.curating', 'on', true);
  update trial_notice set last_checked = (now() at time zone 'Australia/Melbourne')::date where id = p_notice;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_checked', p_operator, v_email, v_old.club_id, p_notice,
          jsonb_build_object('was', v_old.last_checked));
end $$;

-- Taking a compiled notice down is allowed whatever the club's state.
create function fn_ops_remove_notice(p_operator uuid, p_email text, p_notice uuid) returns void
language plpgsql as $$
declare v_email text; v_old trial_notice%rowtype;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select * into v_old from trial_notice where id = p_notice for update;
  if not found or v_old.source <> 'compiled' then
    raise exception 'only a notice Pitch compiled is removed here; a club removes its own (D-90)'
      using errcode = 'insufficient_privilege';
  end if;
  perform set_config('pitch.curating', 'on', true);
  delete from trial_notice where id = p_notice;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_removed', p_operator, v_email, v_old.club_id, p_notice, jsonb_build_object(
    'title', v_old.title, 'trial_on', v_old.trial_on, 'time_venue', v_old.time_venue, 'source_url', v_old.source_url));
end $$;

-- ---- 7 · the reads: club facts and counts, never a person -----------------
-- Every club, in every state, optionally narrowed by a piece of its name or
-- suburb. The search is typed text, so % and _ in it are literal.
create function fn_ops_clubs(p_q text) returns table (
  id uuid, name text, suburb text, state text, club_state text, public_slug text, notices_live int
)
language sql stable as $$
  with q as (select replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as s)
  select c.id, c.name, c.suburb, c.state, c.club_state, c.public_slug,
    (select count(*)::int from trial_notice t
     where t.club_id = c.id and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date)
  from club c, q
  where q.s = '' or c.name ilike '%' || q.s || '%' or coalesce(c.suburb, '') ilike '%' || q.s || '%'
  order by lower(c.name), lower(coalesce(c.suburb, ''));
$$;

create function fn_ops_club(p_club uuid) returns table (
  id uuid, name text, suburb text, state text, club_state text, public_slug text, contact_email text,
  listing_source text, listed_by_email text, listed_at timestamptz, notices_live int
)
language sql stable as $$
  select c.id, c.name, c.suburb, c.state, c.club_state, c.public_slug, c.contact_email,
    c.listing_source, c.listed_by_email, c.listed_at,
    (select count(*)::int from trial_notice t
     where t.club_id = c.id and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date)
  from club c where c.id = p_club;
$$;

-- The compiled notices still live on the board for one club, with their
-- stamps and where they came from.
create function fn_ops_club_notices(p_club uuid) returns table (
  id uuid, title text, trial_on date, time_venue text, competition_gender text, position_needs text[],
  age_groups text[], source_url text, added_on date, added_by_email text, last_checked date, registered boolean
)
language sql stable as $$
  select t.id, t.title, t.trial_on, t.time_venue, t.competition_gender, t.position_needs,
    array(select ta.age_group from trial_notice_age_group ta join age_group ag on ag.code = ta.age_group
          where ta.trial_notice_id = t.id order by ag.sort),
    t.source_url, t.added_on, t.added_by_email, t.last_checked,
    exists (select 1 from registration r where r.trial_notice_id = t.id and r.withdrawn_at is null)
  from trial_notice t
  where t.club_id = p_club and t.source = 'compiled'
    and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
  order by t.trial_on, t.title;
$$;
