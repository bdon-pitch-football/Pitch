-- ---------------------------------------------------------------------------
-- 0161 — two corrections to 0160 (Leo's rulings on the builder's report,
-- 30 Sep; John's ruling of 30 Sep §2).
--
-- 1 · ONLY AN UNCLAIMED LISTING HAS ITS ADDRESS FILLED IN. The send screen
--     says "The address {Club} publishes on its own website", and that is
--     only what we know of a listing Pitch compiled from the club's own
--     site. A club that has claimed its page may have given us any address
--     since, and a verified club's was confirmed on a call, not read off a
--     website. Those clubs still get their name filled in; the address is
--     the family's to type.
--
-- 2 · A CLUB'S OPT-OUT OUTLIVES THE FAMILY'S ERASURE. The stop link in the
--     CV email (doc 15 §19) named the share_request, and fn_send_stop_request
--     read the address off it. But the request is deleted with the child's
--     record (0002's cascade, fn_erase_child), while the email sits in the
--     club's inbox for good — so a club pressing "Stop them" after the
--     family had deleted the child stopped nothing, and was told "Done".
--     The Spam Act asks that an opt-out work for as long as the message is
--     out there. So each send now leaves a stop reference: the send's id and
--     the address it went to, and nothing else. It is written by a trigger
--     at the moment of dispatch, so no sending path can forget it, and it
--     has NO foreign key to share_request, the record or any person, so no
--     erasure reaches it. It holds no child's data: not the child, the
--     record, the sender, the band or the CV — only an address a CV went to
--     and when. Retained deliberately (the permission suite's erasure block
--     names it, with this reason).
--
-- Every new table has row-level security and no policies (L26).
--
-- Read with: 0160 (fn_send_address, fn_send_address_for_club,
-- fn_send_stop_request), 0002 (share_request), the erasure block of the
-- permission suite (fn_erase_child).
-- ---------------------------------------------------------------------------

-- ---- 1 · fill in only for an unclaimed listing ----------------------------
create or replace function fn_send_address_for_club(p_slug text)
returns table (club_name text, address text, checked_on date, blocked boolean)
language sql stable as $$
  with c as (
    select cl.id, cl.name, cl.club_state, lower(btrim(cl.contact_email)) as email, cl.contact_checked_on,
           fn_club_send_blocked(cl.id) as blocked
    from club cl
    where cl.public_slug = p_slug and cl.club_state <> 'suspended'
  ), offered as (
    select c.*, (c.club_state = 'unclaimed'
                 and c.email is not null and not c.blocked
                 and fn_role_address(c.email, c.name)
                 and c.contact_checked_on >= (now() at time zone 'Australia/Melbourne')::date - 90) as ok
    from c
  )
  select name, case when ok then email end, case when ok then contact_checked_on end, blocked
  from offered;
$$;
comment on function fn_send_address_for_club(text) is
  'The address "Send my CV" may fill in (0160, 0161): an unclaimed listing''s role address, checked in 90 days, not stopped. Never a person''s.';

-- ---- 2 · the stop reference -------------------------------------------------
create table send_stop_ref (
  -- The share_request's id, which the stop link carries. NO foreign key, on
  -- purpose: the request goes when the child is erased, and this must not.
  id uuid primary key,
  address text not null check (address = lower(btrim(address))),
  created_at timestamptz not null default now()
);
-- L26: no policies. Written by the trigger below, read by fn_send_stop_request.
alter table send_stop_ref enable row level security;

-- Every CV already sent keeps its opt-out too.
insert into send_stop_ref (id, address, created_at)
select sr.id, fn_send_address(sr.destination), sr.dispatched_at
from share_request sr
where sr.dispatched_at is not null and fn_send_address(sr.destination) like '%@%'
on conflict (id) do nothing;

create function share_request_stop_ref() returns trigger
language plpgsql as $$
begin
  if new.dispatched_at is not null
     and (tg_op = 'INSERT' or old.dispatched_at is null)
     and fn_send_address(new.destination) like '%@%' then
    insert into send_stop_ref (id, address) values (new.id, fn_send_address(new.destination))
      on conflict (id) do nothing;
  end if;
  return null;
end $$;

create trigger share_request_stop_ref after insert or update of dispatched_at on share_request
  for each row execute function share_request_stop_ref();

-- The stop reads the reference, never the request, so it works after the
-- family has deleted the child. Otherwise exactly 0160's rule: the address,
-- and the club's own domain where the address is the club's and the domain
-- is neither free mail nor shared with another listed club. Idempotent. A
-- send that never went has no reference and stops nothing.
create or replace function fn_send_stop_request(p_request uuid) returns void
language plpgsql as $$
declare v_addr text; v_club uuid; v_domain text;
begin
  select r.address into v_addr from send_stop_ref r where r.id = p_request;
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
