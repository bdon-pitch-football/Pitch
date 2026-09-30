-- ---------------------------------------------------------------------------
-- 0160 — "Send my CV" fills in the club's own address, and a club that asks
-- us to stop is never sent to again (John's ruling of 30 Sep §2, cleared by
-- BUZ; D-99, D-91, D-172).
--
-- WHY THIS EXISTS. 183 unclaimed clubs are listed (D-172), and 138 of them
-- carry the address the club publishes on its own website. A family pressing
-- "Send my CV to {club}" on that club's page was still made to find and type
-- the address themselves, which is the one step most likely to go wrong: a
-- fourteen-year-old typing a club address from memory. John ruled (30 Sep §2)
-- that the send screen may fill it in — IN FULL, because D-91 and doc 14 L2/L4
-- exist so that a guardian reads the address and presses send, and a masked
-- address cannot be read. The claim screen keeps its mask (U2); that is a
-- different surface with a different audience, and nothing here touches it.
--
-- THE RULES, each John's:
--
--   · ONLY A ROLE ADDRESS IS EVER FILLED IN (fn_role_address). info@,
--     admin@, secretary@, juniors@ … or an account named after the club
--     itself (westerneagles1950@…). Never a person's name: if
--     john.smith@club.example.au is all a club publishes, that club gets no
--     fill at all, so the address on screen is never a person's and there is
--     nothing to mask. Anything the rule does not recognise is FALSE — it
--     fails closed, and the family types the address as they always have.
--
--   · THE SOURCE AND THE DATE ARE SHOWN, and an address nobody has checked in
--     90 days stops filling in (club.contact_checked_on). "Checked" moves when
--     the address is written or changed, by whatever writes it — the trigger
--     below — so fn_ops_add_club and fn_ops_edit_club need no change. Once we
--     fill an address in, WE are the party asserting it is the club's.
--
--   · THE FAMILY CAN ALWAYS TYPE A DIFFERENT ADDRESS. The field stays; this
--     only gives it a starting value (app/send/[recordId]).
--
--   · THE CV EMAIL IS TREATED AS COMMERCIAL, so it carries a working opt-out
--     (doc 15 §19, /stop-cvs). fn_send_stop_request honours it.
--
--   · IF A CLUB OPTS OUT, WE STOP SENDING TO IT AT ALL — "including an
--     address a family types by hand". send_block holds the stopped address
--     and, where it is the club's own domain, the domain; fn_send_blocked is
--     the one question every door asks (the send screen, composeSend, the
--     dispatch pick-up, and the trigger below as the belt). The family sees a
--     neutral "we can't send to this club through Pitch", with no reason.
--
-- WHEN A DOMAIN IS STOPPED, AND WHEN ONLY AN ADDRESS. An address that is a
-- club's own held address, on a domain that is not free mail, stops the
-- domain too — so juniors@ is stopped along with info@ at the club that asked.
-- A free-mail address (a club run from gmail or bigpond) stops only itself:
-- stopping gmail.com would stop every family sending to every club. And a
-- domain another listed club's address is on is not stopped either, because
-- that would stop sending to a club that never asked (the builder's reading
-- of "stop sending to IT"; reported to Leo, 30 Sep).
--
-- Every new table has row-level security and no policies (L26). Only the
-- functions below read or write send_block.
--
-- Read with: 0002 (club, share_request), 0021 (fn_can_dispatch and the
-- dispatch trigger), 0066 (the destination's address, parsed the same way),
-- 0130 (fn_ops_operator, curation_event), 0159 (club listings).
-- ---------------------------------------------------------------------------

-- ---- 1 · when the address was last checked ----------------------------------
alter table club add column contact_checked_on date;

-- The 183 already listed were checked when they were listed.
update club
   set contact_checked_on = (coalesce(listed_at, created_at) at time zone 'Australia/Melbourne')::date
 where contact_email is not null;

create function club_contact_checked() returns trigger
language plpgsql as $$
begin
  if new.contact_email is null then
    new.contact_checked_on := null;
  elsif tg_op = 'INSERT' or new.contact_email is distinct from old.contact_email then
    new.contact_checked_on := (now() at time zone 'Australia/Melbourne')::date;
  end if;
  return new;
end $$;

create trigger club_contact_checked before insert or update of contact_email on club
  for each row execute function club_contact_checked();

-- ---- 2 · a role address, never a person's -----------------------------------
-- True only when the part before the @, split on . _ - and +, has a token
-- that is a role, or when it contains a distinctive word of the club's own
-- name (four letters or more, generic football words aside). Everything else,
-- including anything that is not shaped like an address, is false.
create function fn_role_address(p_email text, p_club_name text) returns boolean
language sql immutable as $$
  with a as (
    select case when lower(btrim(coalesce(p_email, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                then split_part(lower(btrim(p_email)), '@', 1) end as local
  )
  select coalesce((
    select exists (
             select 1 from regexp_split_to_table(a.local, '[._+-]') t
             where t = any (array[
               'info', 'admin', 'administration', 'office', 'cluboffice', 'secretary',
               'enquiries', 'enquiry', 'contact', 'juniors', 'junior', 'seniors', 'girls',
               'boys', 'committee', 'hello', 'communications', 'mail', 'registrations',
               'registrar', 'rego', 'president', 'ypl', 'miniroos', 'miniroostd',
               'technicaldirector', 'academy', 'football', 'soccer', 'club', 'general',
               'members', 'membership']))
        or exists (
             select 1 from regexp_split_to_table(lower(coalesce(p_club_name, '')), '[^a-z0-9]+') w
             where length(w) >= 4
               and w <> all (array['fc', 'sc', 'afc', 'club', 'soccer', 'football', 'united', 'city', 'the', 'and', 'of'])
               and position(w in regexp_replace(a.local, '[^a-z0-9]', '', 'g')) > 0)
    from a where a.local is not null), false);
$$;
comment on function fn_role_address(text, text) is
  'John 30 Sep §2 (0160): a club''s role address (info@, secretary@, a club-named account), never a person''s. Fails closed.';

-- ---- 3 · who asked us to stop -----------------------------------------------
create table send_block (
  id uuid primary key default gen_random_uuid(),
  address text check (address = lower(btrim(address))),
  domain text check (domain = lower(btrim(domain))),
  -- The club the stop was made for, where there was one. Removing a listing
  -- must not lift the stop, so the row outlives it.
  club_id uuid references club(id) on delete set null,
  source text not null check (source in ('recipient', 'operator')),
  created_at timestamptz not null default now(),
  created_by_email text,
  check ((address is null) <> (domain is null)),
  constraint send_block_address_key unique (address),
  constraint send_block_domain_key unique (domain)
);
-- L26: no policies. Only the functions in this file read or write it.
alter table send_block enable row level security;

-- Free mail: a domain thousands of unrelated people share. Stopping one
-- address there never stops the domain. Broad on purpose — a provider missing
-- from this list means stopping one club would stop everyone on it.
create function fn_free_mail_domain(p_domain text) returns boolean
language sql immutable as $$
  select lower(btrim(coalesce(p_domain, ''))) ~ ('^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|rocketmail|y7mail'
    || '|bigpond|icloud|me|mac|optusnet|iinet|westnet|tpg|internode|dodo|iprimus|ozemail|aol|proton|protonmail'
    || '|fastmail|gmx|zoho|mail)\.(com|com\.au|net|net\.au|on\.net|co\.uk|me)$');
$$;

-- The address inside "Club name <address>", or a bare address. The same
-- parse 0066 uses for a destination.
create function fn_send_address(p_destination text) returns text
language sql immutable as $$
  select nullif(lower(btrim(coalesce(substring(p_destination from '<([^<>]+)>\s*$'), p_destination, ''))), '');
$$;

-- THE one question: may anything be sent to this destination? No, if the
-- address was stopped, or its domain (or a parent domain of it) was.
create function fn_send_blocked(p_destination text) returns boolean
language sql stable as $$
  with a as (select fn_send_address(p_destination) as addr)
  select coalesce((
    select exists (select 1 from send_block b where b.address = a.addr)
        or exists (select 1 from send_block b
                   where b.domain is not null
                     and (split_part(a.addr, '@', 2) = b.domain
                          or split_part(a.addr, '@', 2) like '%.' || b.domain))
    from a where a.addr like '%@%'), false);
$$;

-- A club is stopped when its own held address is. A club with no address is
-- never "stopped": there is nothing held to have stopped.
create function fn_club_send_blocked(p_club uuid) returns boolean
language sql stable as $$
  select coalesce((select c.contact_email is not null and fn_send_blocked(c.contact_email)
                   from club c where c.id = p_club), false);
$$;

-- The domain of a club's held address may be stopped only when it is not free
-- mail and no OTHER club's held address is on it.
create function fn_club_domain_stoppable(p_club uuid, p_domain text) returns boolean
language sql stable as $$
  select coalesce(p_domain, '') like '%.%'
     and not fn_free_mail_domain(p_domain)
     and not exists (select 1 from club o where o.id <> p_club and o.contact_email is not null
                       and split_part(lower(btrim(o.contact_email)), '@', 2) = lower(p_domain));
$$;

-- ---- 4 · what the send screen may fill in ------------------------------------
-- One row for a listed club that is not suspended. The address only when it
-- is a role address, checked within 90 days, and not stopped; the date only
-- with it, so nothing about an address withheld leaves this function.
create function fn_send_address_for_club(p_slug text)
returns table (club_name text, address text, checked_on date, blocked boolean)
language sql stable as $$
  with c as (
    select cl.id, cl.name, lower(btrim(cl.contact_email)) as email, cl.contact_checked_on,
           fn_club_send_blocked(cl.id) as blocked
    from club cl
    where cl.public_slug = p_slug and cl.club_state <> 'suspended'
  ), offered as (
    select c.*, (c.email is not null and not c.blocked
                 and fn_role_address(c.email, c.name)
                 and c.contact_checked_on >= (now() at time zone 'Australia/Melbourne')::date - 90) as ok
    from c
  )
  select name, case when ok then email end, case when ok then contact_checked_on end, blocked
  from offered;
$$;
comment on function fn_send_address_for_club(text) is
  'The address "Send my CV" may fill in (0160): a role address, checked in 90 days, not stopped. Never a person''s.';

-- ---- 5 · the club's own opt-out, from the CV email ---------------------------
-- /stop-cvs verifies the link's signature, then calls this. It stops the
-- address that request went to; if that address is a club's held address,
-- the club's own domain as well (section header). Idempotent. A request that
-- no longer exists stops nothing, and the page says the same thing anyway.
create function fn_send_stop_request(p_request uuid) returns void
language plpgsql as $$
declare v_addr text; v_club uuid; v_domain text;
begin
  select fn_send_address(sr.destination) into v_addr from share_request sr where sr.id = p_request;
  if v_addr is null or v_addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  select c.id into v_club from club c where lower(btrim(c.contact_email)) = v_addr
   order by c.created_at limit 1;
  insert into send_block (address, club_id, source) values (v_addr, v_club, 'recipient')
    on conflict (address) do nothing;
  v_domain := split_part(v_addr, '@', 2);
  if v_club is not null and fn_club_domain_stoppable(v_club, v_domain) then
    insert into send_block (domain, club_id, source) values (v_domain, v_club, 'recipient')
      on conflict (domain) do nothing;
  end if;
end $$;

-- ---- 6 · the operator stops a club -------------------------------------------
-- A club that asks by phone or by email. The club's held address, and its
-- domain on the same terms as above; logged with the operator's name.
alter table curation_event drop constraint curation_event_action_check;
alter table curation_event add constraint curation_event_action_check check (action in (
  'club_added', 'club_edited', 'club_removed',
  'notice_added', 'notice_edited', 'notice_checked', 'notice_removed',
  'club_sends_stopped'));

create function fn_ops_stop_club_sends(p_operator uuid, p_email text, p_club uuid) returns void
language plpgsql as $$
declare v_email text; v_addr text; v_domain text; v_domain_stopped boolean := false;
begin
  v_email := fn_ops_operator(p_operator, p_email);
  select lower(btrim(contact_email)) into v_addr from club where id = p_club for update;
  if not found then
    raise exception 'no such club' using errcode = 'no_data_found';
  end if;
  if v_addr is null then
    raise exception 'this club has no address held to stop' using errcode = 'check_violation';
  end if;
  insert into send_block (address, club_id, source, created_by_email) values (v_addr, p_club, 'operator', v_email)
    on conflict (address) do nothing;
  v_domain := split_part(v_addr, '@', 2);
  if fn_club_domain_stoppable(p_club, v_domain) then
    insert into send_block (domain, club_id, source, created_by_email) values (v_domain, p_club, 'operator', v_email)
      on conflict (domain) do nothing;
    v_domain_stopped := true;
  end if;
  insert into curation_event (action, operator_id, operator_email, club_id, detail)
  values ('club_sends_stopped', p_operator, v_email, p_club, jsonb_build_object(
    'address', v_addr, 'domain', case when v_domain_stopped then v_domain end));
end $$;

-- What the operator's club screen needs: is an address held, and is it stopped.
create function fn_ops_club_sends(p_club uuid) returns table (held boolean, stopped boolean)
language sql stable as $$
  select c.contact_email is not null, fn_club_send_blocked(c.id) from club c where c.id = p_club;
$$;

-- ---- 7 · the belt -------------------------------------------------------------
-- Every sender goes through lib/send-dispatch, which already will not pick up
-- a stopped destination. This refuses the stamp itself, so no other path —
-- a request composed before the club asked, a future door — can send one.
create function share_request_not_stopped() returns trigger
language plpgsql as $$
begin
  if new.dispatched_at is not null
     and (tg_op = 'INSERT' or old.dispatched_at is null)
     and fn_send_blocked(new.destination) then
    raise exception 'this address asked Pitch to stop sending CVs to it (0160)'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger share_request_not_stopped before insert or update on share_request
  for each row execute function share_request_not_stopped();
