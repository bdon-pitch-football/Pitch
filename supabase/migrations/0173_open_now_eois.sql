-- ---------------------------------------------------------------------------
-- 0173 — "Open now": an expression of interest with no closing date, on the
-- trials board while the trials desk keeps seeing its form open (BUZ approved
-- 3 Oct; John's ruling 3 Oct, 13-Board-Room/JOHN-to-PRODUCT-DESIGN-open-now-
-- eois-3-oct.md; docs/design/reports/2026-10-02-proposal-open-now-eois.md;
-- D-74 as clarified 3 Oct, D-90, D-172).
--
-- WHY THIS EXISTS. A listing needed a date (0007: trial_on not null), and an
-- expression of interest is dated by its closing date. Most clubs' EOI forms
-- give none — the 2 Oct coverage audit found 57 — so the board could carry
-- none of them, and a family in a region whose only open doors are forms saw
-- the empty card. The form being open today is a real, current fact. D-74's
-- promise is that a listing comes off when it stops being true; for a dated
-- notice the date proves that, and for an open form the proof has to be the
-- check itself. BUZ recorded the clarification on D-74, in his words: "For an
-- expression of interest with no closing date, its date is seven days after
-- the trials desk last saw its form open."
--
-- THE SHAPE.
--
--   · trial_on may be null, and only on a notice Pitch compiled. A null date
--     IS an open-now expression of interest: there is no other kind of
--     undated notice, so there is no kind column to disagree with it. A
--     club's own notice still needs its date (the club's form requires one,
--     and the constraint refuses it anyway); so does a trial.
--
--   · confirmed_open_at — the last time the trials desk saw the form taking
--     responses, read logged out. Set to now() by the operator's own
--     functions only (0130's wall still holds): an add or an edit that leaves
--     the notice undated, and a check of an undated notice. NEVER by the link
--     checker, which only knocks on the door — a closed Google Form still
--     answers 200. A dated notice carries none, so its "checked" stamp can
--     only ever be last_checked.
--
--   · form_url — the form the desk watches (https). Never shown and never
--     linked: "The club's own notice" is source_url, the club's own page or
--     post that links the form (D-90, John 3 Oct: "Never link a form that no
--     club page or post of the club points to"). An open-now notice must name
--     one, so the desk always knows what it is watching.
--
--   · time_venue on an open-now notice is the ground alone ("Online — see the
--     club's notice"). There is no closing time to state, and a time without
--     a date is refused.
--
-- THE LAPSE IS COMPUTED WHEN THE BOARD IS READ, NEVER STORED, AND NO JOB RUNS
-- IT (the house rule for permissions, applied to freshness). An open-now
-- notice is on the board while now() < confirmed_open_at + 7 days, and off
-- from that instant (John: 7, not the proposal's 30). A null stamp is never
-- on (fail closed). The rule is said once, in fn_trial_notice_current, and
-- fn_trial_notices_advertised — the read every page uses (0140, L23) —
-- calls it, as do the operator's live counts.
--
-- TAKEN DOWN AT ONCE. When the desk finds the form or the page closed, full,
-- or no longer linked by the club, it writes a `gone` row, which goes live on
-- its own through fn_ops_remove_notice (0130), unchanged: the notice is
-- deleted in that statement and the curation_event keeps what it said.
-- Nothing waits for the seven days.
--
-- A LAPSED NOTICE is still in the table, off the board. The desk's export
-- lists it (scripts/sync-trials.mjs marks it lapsed), so a `check` — the
-- desk has seen the same form open again, the words BUZ approved unchanged —
-- puts it back, and a `gone` takes it out. The operator's own list of a
-- club's notices shows it for the same reason.
--
-- THE WRITES. fn_trial_notice_check, fn_ops_add_notice and fn_ops_edit_notice
-- gain a last parameter, p_form_url, defaulted to null, so every existing
-- caller (the operator console, sync-trials, import-trials, the seed, the
-- suites) is unchanged; each old signature is dropped first so no call can
-- be ambiguous. Nothing else about them changes.
--
-- WHAT IS NOT CHANGED. The club's own post-trial form, the registration's
-- trial tag (a page never offers an undated notice as one — the club page,
-- the board and register-interest read only dated notices for it), the
-- curation wall, and fn_ops_remove_notice. No new table, so no row-level
-- security to add (L26).
--
-- Read with: 0007 (the stamps and the expiry rule), 0130 (the operator's
-- functions and the wall), 0140 and 0152 (the board's one read), D-74, D-90,
-- D-172.
-- ---------------------------------------------------------------------------

-- ---- 1 · the columns and the rules on them --------------------------------
alter table trial_notice alter column trial_on drop not null;
alter table trial_notice add column confirmed_open_at timestamptz;  -- the desk saw the form open
alter table trial_notice add column form_url text;                  -- the form it watches; never shown

-- Only Pitch compiles an undated notice, and an undated notice always says
-- when it was last seen open and which form was watched.
alter table trial_notice add constraint trial_notice_open_now
  check (trial_on is not null
         or (source = 'compiled' and confirmed_open_at is not null and form_url is not null));
-- A dated notice has no open-now stamp: its "checked" is last_checked.
alter table trial_notice add constraint trial_notice_open_now_undated
  check ((confirmed_open_at is null and form_url is null) or trial_on is null);
alter table trial_notice add constraint trial_notice_form_url
  check (form_url is null or (form_url ~ '^https://[^[:space:]/]+\.[^[:space:]]+$' and length(form_url) <= 500));

comment on column trial_notice.confirmed_open_at is
  '0173 — an undated (open-now) expression of interest: when the trials desk last saw its form taking responses. Set only by fn_ops_add_notice, fn_ops_edit_notice and fn_ops_check_notice; never by the link checker. On the board until 7 days after (fn_trial_notice_current).';
comment on column trial_notice.form_url is
  '0173 — the form an open-now notice''s desk watches. Never shown, never linked: the board links source_url, the club''s own page (D-90).';

-- ---- 2 · the one rule for "still current" ---------------------------------
-- A dated notice until its day has passed (0007); an undated one until seven
-- days after the desk last saw its form open (D-74 as clarified 3 Oct).
-- Stable plain SQL, so the planner inlines it into every read.
create function fn_trial_notice_current(p_trial_on date, p_confirmed_open_at timestamptz) returns boolean
language sql stable as $$
  select case when p_trial_on is not null
              then p_trial_on >= (now() at time zone 'Australia/Melbourne')::date
              else coalesce(p_confirmed_open_at > now() - interval '7 days', false) end;
$$;

comment on function fn_trial_notice_current(date, timestamptz) is
  '0173 — D-74: a dated notice is current until its day has passed; an undated (open-now) one until 7 days after the trials desk last saw its form open. A null stamp is never current. The one place the seven days are written.';

-- The board, as 0140 and 0152 wrote it, with the date rule said once.
create or replace function fn_trial_notices_advertised() returns setof trial_notice
language sql stable as $$
  select t.* from trial_notice t
  where fn_trial_notice_current(t.trial_on, t.confirmed_open_at)
    and fn_club_advertises(t.club_id)
    and (t.source = 'compiled'
         or exists (select 1 from club c where c.id = t.club_id and c.club_state = 'verified'));
$$;

comment on function fn_trial_notices_advertised() is
  'brief K item 1 (0140), BUZ on M7 (0152), open now (0173) — every trial notice on the board: current (fn_trial_notice_current: its day not passed, or an open-now EOI seen open within 7 days), its club not suspended, and a club''s own notice only while the club is verified. Every page that lists a notice reads this.';

-- ---- 3 · the checks a compiled notice passes ------------------------------
drop function fn_trial_notice_check(text, text[], text, date, text, text, text[], text);
create function fn_trial_notice_check(p_title text, p_ages text[], p_gender text, p_trial_on date,
                                      p_time text, p_ground text, p_positions text[], p_source_url text,
                                      p_form_url text default null)
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
    -- Open now (0173): no date, so no time, and the form it watches.
    if fn_tidy(p_time) is not null then
      raise exception 'an open-now expression of interest has no date, so no time' using errcode = 'check_violation';
    end if;
    if coalesce(btrim(p_form_url), '') !~ '^https://[^[:space:]/]+\.[^[:space:]]+$' or length(btrim(p_form_url)) > 500 then
      raise exception 'an open-now expression of interest names the form the desk watches (https)' using errcode = 'check_violation';
    end if;
  elsif length(coalesce(fn_tidy(p_time), '')) not between 1 and 40 then
    raise exception 'a notice needs its time and its ground' using errcode = 'check_violation';
  end if;
  if length(coalesce(fn_tidy(p_ground), '')) not between 2 and 120 then
    raise exception 'a notice needs its time and its ground' using errcode = 'check_violation';
  end if;
  if not (coalesce(p_positions, '{}'::text[]) <@ fn_positions_ten()) then
    raise exception 'positions come from the ten (D-92)' using errcode = 'check_violation';
  end if;
  if coalesce(p_source_url, '') !~ '^https?://[^\s/]+\.[^\s]+$' or length(p_source_url) > 500 then
    raise exception 'a compiled notice links to the club''s own public notice (D-90)' using errcode = 'check_violation';
  end if;
end $$;

-- ---- 4 · add, edit, check -------------------------------------------------
-- As 0130 wrote them. An undated add or edit is the desk seeing the form open
-- today, so it stamps confirmed_open_at; a dated one clears it and the form.
drop function fn_ops_add_notice(uuid, text, uuid, text, text[], text, date, text, text, text[], text);
create function fn_ops_add_notice(p_operator uuid, p_email text, p_club uuid, p_title text, p_ages text[],
                                  p_gender text, p_trial_on date, p_time text, p_ground text,
                                  p_positions text[], p_source_url text, p_form_url text default null) returns uuid
language plpgsql as $$
declare v_email text; v_id uuid; v_open boolean := p_trial_on is null;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  perform fn_curatable_club(p_club);
  perform fn_trial_notice_check(p_title, p_ages, nullif(p_gender, ''), p_trial_on, p_time, p_ground, p_positions, p_source_url, p_form_url);
  if p_trial_on < (now() at time zone 'Australia/Melbourne')::date then
    raise exception 'a notice for a day that has passed would never show' using errcode = 'check_violation';
  end if;
  perform set_config('pitch.curating', 'on', true);
  -- The time and the ground are one line, as the club's own form writes them;
  -- an open-now notice has only its ground.
  insert into trial_notice (club_id, title, trial_on, time_venue, position_needs, competition_gender,
                            source, source_url, added_by, added_by_email, confirmed_open_at, form_url)
  values (p_club, fn_tidy(p_title), p_trial_on,
          case when v_open then fn_tidy(p_ground) else fn_tidy(p_time) || ' · ' || fn_tidy(p_ground) end,
          coalesce(p_positions, '{}'::text[]), nullif(p_gender, ''),
          'compiled', btrim(p_source_url), p_operator, v_email,
          case when v_open then now() end, case when v_open then btrim(p_form_url) end)
  returning id into v_id;
  insert into trial_notice_age_group (trial_notice_id, age_group)
    select v_id, a from (select distinct unnest(p_ages) as a) x;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_added', p_operator, v_email, p_club, v_id, jsonb_build_object(
    'title', fn_tidy(p_title), 'trial_on', p_trial_on, 'ages', p_ages, 'source_url', btrim(p_source_url))
    || case when v_open then jsonb_build_object('open_now', true, 'form_url', btrim(p_form_url)) else '{}'::jsonb end);
  return v_id;
end $$;

-- A change moves last_checked, as a club's own edit does. Once anybody has
-- registered for the trial its date is fixed: moving it would leave families
-- holding the day they signed up for (app/club/post-trial, the same rule).
drop function fn_ops_edit_notice(uuid, text, uuid, text, text[], text, date, text, text, text[], text);
create function fn_ops_edit_notice(p_operator uuid, p_email text, p_notice uuid, p_title text, p_ages text[],
                                   p_gender text, p_trial_on date, p_time text, p_ground text,
                                   p_positions text[], p_source_url text, p_form_url text default null) returns void
language plpgsql as $$
declare v_email text; v_old trial_notice%rowtype; v_on date; v_open boolean;
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
  v_open := v_on is null;
  perform fn_trial_notice_check(p_title, p_ages, nullif(p_gender, ''), v_on, p_time, p_ground, p_positions, p_source_url, p_form_url);
  if v_on is distinct from v_old.trial_on and v_on < (now() at time zone 'Australia/Melbourne')::date then
    raise exception 'a notice for a day that has passed would never show' using errcode = 'check_violation';
  end if;
  perform set_config('pitch.curating', 'on', true);
  update trial_notice set
    title = fn_tidy(p_title), trial_on = v_on,
    time_venue = case when v_open then fn_tidy(p_ground) else fn_tidy(p_time) || ' · ' || fn_tidy(p_ground) end,
    position_needs = coalesce(p_positions, '{}'::text[]), competition_gender = nullif(p_gender, ''),
    source_url = btrim(p_source_url),
    last_checked = (now() at time zone 'Australia/Melbourne')::date,
    confirmed_open_at = case when v_open then now() end,
    form_url = case when v_open then btrim(p_form_url) end
  where id = p_notice;
  delete from trial_notice_age_group where trial_notice_id = p_notice;
  insert into trial_notice_age_group (trial_notice_id, age_group)
    select p_notice, a from (select distinct unnest(p_ages) as a) x;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_edited', p_operator, v_email, v_old.club_id, p_notice, jsonb_build_object(
    'before', jsonb_build_object('title', v_old.title, 'trial_on', v_old.trial_on, 'time_venue', v_old.time_venue,
                                 'source_url', v_old.source_url, 'form_url', v_old.form_url),
    'after', jsonb_build_object('title', fn_tidy(p_title), 'trial_on', v_on, 'ages', p_ages,
                                'source_url', btrim(p_source_url), 'form_url', case when v_open then btrim(p_form_url) end)));
end $$;

-- "Last checked", re-stamped with one call: the operator has looked at the
-- club's own notice again today and it still says this (D-74). On an
-- open-now notice that means the form was seen taking responses, so it moves
-- confirmed_open_at too — the stamp families see and the seven days' start
-- are one fact. A lapsed open-now notice seen open again is back from now.
create or replace function fn_ops_check_notice(p_operator uuid, p_email text, p_notice uuid) returns void
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
  update trial_notice set
    last_checked = (now() at time zone 'Australia/Melbourne')::date,
    confirmed_open_at = case when trial_on is null then now() end
  where id = p_notice;
  perform set_config('pitch.curating', '', true);
  insert into curation_event (action, operator_id, operator_email, club_id, trial_notice_id, detail)
  values ('notice_checked', p_operator, v_email, v_old.club_id, p_notice,
          jsonb_build_object('was', v_old.last_checked)
          || case when v_old.trial_on is null then jsonb_build_object('was_open', v_old.confirmed_open_at) else '{}'::jsonb end);
end $$;

-- ---- 5 · the operator's reads ---------------------------------------------
-- The live count is the board's rule. The list of a club's compiled notices
-- also keeps a lapsed open-now notice, so the operator can see it and take
-- it down; the board does not show it.
create or replace function fn_ops_clubs(p_q text) returns table (
  id uuid, name text, suburb text, state text, club_state text, public_slug text, notices_live int
)
language sql stable as $$
  with q as (select replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as s)
  select c.id, c.name, c.suburb, c.state, c.club_state, c.public_slug,
    (select count(*)::int from trial_notice t
     where t.club_id = c.id and fn_trial_notice_current(t.trial_on, t.confirmed_open_at))
  from club c, q
  where q.s = '' or c.name ilike '%' || q.s || '%' or coalesce(c.suburb, '') ilike '%' || q.s || '%'
  order by lower(c.name), lower(coalesce(c.suburb, ''));
$$;

create or replace function fn_ops_club(p_club uuid) returns table (
  id uuid, name text, suburb text, state text, club_state text, public_slug text, contact_email text,
  listing_source text, listed_by_email text, listed_at timestamptz, notices_live int
)
language sql stable as $$
  select c.id, c.name, c.suburb, c.state, c.club_state, c.public_slug, c.contact_email,
    c.listing_source, c.listed_by_email, c.listed_at,
    (select count(*)::int from trial_notice t
     where t.club_id = c.id and fn_trial_notice_current(t.trial_on, t.confirmed_open_at))
  from club c where c.id = p_club;
$$;

create or replace function fn_ops_club_notices(p_club uuid) returns table (
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
    and (t.trial_on is null or fn_trial_notice_current(t.trial_on, t.confirmed_open_at))
  order by t.trial_on nulls last, t.title;
$$;
