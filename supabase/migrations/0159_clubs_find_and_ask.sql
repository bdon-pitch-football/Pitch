-- A club person finds their club and claims it, or asks for it to be added
-- (BUZ, 30 Sep: "Right now they can't sign up. That is a real problem.").
-- Production opened with no club listings, so the claim flow (0019, /claim)
-- had nothing to claim, and a new club account had no way to find anything.
--
-- 1 · fn_club_search: name or suburb, two characters or more, twenty rows,
--     listed clubs only (not suspended). Public: a club is not a person, and
--     nothing here reaches a player (D-126 is untouched: claiming is not
--     verification).
-- 2 · club_request: "Tell us your club". Only an adult whose address is
--     proved may ask, three open asks each. The club's email is the address
--     the claim code will go to, so BUZ checks it before adding (D-126's
--     spirit: a human decides). No row reaches anyone but the operator.

create function fn_club_search(p_q text) returns table (
  name text, suburb text, state text, public_slug text, club_state text
)
language sql stable as $$
  with q as (
    select btrim(coalesce(p_q, '')) as raw,
           replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as esc
  )
  select c.name, c.suburb, c.state, c.public_slug, c.club_state
  from club c, q
  where length(q.raw) between 2 and 80
    and c.public_slug is not null
    and c.club_state in ('unclaimed', 'claimed', 'verified')
    and (c.name ilike '%' || q.esc || '%' or c.suburb ilike '%' || q.esc || '%')
  order by (c.name ilike q.esc || '%') desc, c.name, c.suburb
  limit 20;
$$;
comment on function fn_club_search(text) is
  'Find your club (0159): listed, not suspended clubs by name or suburb. Returns no person.';

create table club_request (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references person(id) on delete cascade,
  name text not null,
  suburb text not null,
  state text not null,
  contact_email text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_how text check (closed_how in ('added', 'dismissed')),
  closed_by_email text
);
create index club_request_open on club_request (created_at) where closed_at is null;
-- L26: no policies. Only the functions below read or write it.
alter table club_request enable row level security;

create function fn_club_request_add(p_person uuid, p_name text, p_suburb text, p_state text, p_email text)
returns uuid
language plpgsql as $$
declare v_id uuid; v_dob date;
begin
  select dob into v_dob from person where id = p_person;
  if not found or fn_age_band(v_dob) is distinct from '18plus' or not fn_email_proved(p_person) then
    raise exception 'an adult with a confirmed address asks for a club' using errcode = 'insufficient_privilege';
  end if;
  -- The claim code goes to this address, so it must be one.
  if fn_tidy(p_email) is null then
    raise exception 'the contact address is not an email address' using errcode = 'check_violation';
  end if;
  perform fn_club_listing_check(p_name, p_suburb, p_state, p_email, 'asked by the club');
  if exists (select 1 from club where fn_club_listing_key(name, suburb) = fn_club_listing_key(p_name, p_suburb)) then
    raise exception 'that club is already listed (same name and suburb)' using errcode = 'unique_violation';
  end if;
  if (select count(*) from club_request where requested_by = p_person and closed_at is null) >= 3 then
    raise exception 'three open asks at a time' using errcode = 'check_violation';
  end if;
  insert into club_request (requested_by, name, suburb, state, contact_email)
  values (p_person, fn_tidy(p_name), fn_tidy(p_suburb), p_state, lower(fn_tidy(p_email)))
  returning id into v_id;
  return v_id;
end $$;

-- The operator's queue. The club's details only: who asked stays out (D-79).
create function fn_ops_club_requests(p_operator uuid, p_email text) returns table (
  id uuid, name text, suburb text, state text, contact_email text, created_at timestamptz
)
language plpgsql stable as $$
begin
  perform fn_ops_operator(p_operator, p_email);
  return query
    select r.id, r.name, r.suburb, r.state, r.contact_email, r.created_at
    from club_request r where r.closed_at is null order by r.created_at limit 100;
end $$;

create function fn_ops_club_request_close(p_operator uuid, p_email text, p_request uuid, p_how text)
returns void
language plpgsql as $$
declare v_email text;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  if p_how not in ('added', 'dismissed') then
    raise exception 'closed as added or dismissed' using errcode = 'check_violation';
  end if;
  update club_request set closed_at = now(), closed_how = p_how, closed_by_email = v_email
   where id = p_request and closed_at is null;
end $$;

-- A count for the Today screen and the 7am email. Counts only.
create function fn_club_requests_open() returns int
language sql stable as $$ select count(*)::int from club_request where closed_at is null $$;
