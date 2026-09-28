-- ---------------------------------------------------------------------------
-- 0081 — the Premium rows count taps, and count nothing else (D-164 (4), D-82).
--
-- BUZ, 28 Sep: adult player and coach pages carry at most two quiet locked
-- Premium rows ("Unlimited clips", "See who viewed your CV"), with "Coming
-- soon" and no price (D-163: there is nothing to buy). A tap says "Premium is
-- coming. You're first in line." and adds ONE to an anonymous count for that
-- feature. "The tap count is what prices Premium later" (D-164) — so the count
-- is the whole of what is kept.
--
-- WHAT IS KEPT: a feature name and a number. No person id, no session, no
-- IP, no timestamp per tap — there is no row per tap at all, so there is
-- nothing that could be joined back to whoever pressed it, and nothing to
-- erase when somebody is erased (D-25, D-26). Not even a last-changed time:
-- beside a server log, the moment a counter moved says who moved it.
--
-- WHO MAY ADD TO IT: an adult, decided here from the date of birth (D-82: no
-- premium, price, upgrade, locked row OR INTENT CAPTURE on any under-18
-- account, including the 16–17 who coaches MiniRoos). The page renders the
-- rows only for an adult; this function refuses a minor's tap anyway, so a
-- form posted from anywhere cannot record a child's interest in a paid
-- feature. The person id is read to answer that question and is not written.
--
-- A tap is a count, not a person: somebody who taps twice counts twice. That
-- is the cost of keeping nobody's identity, and it is the right way round.
--
-- Read with: D-164, D-82, D-88, D-163, doc 14 J8.
-- ---------------------------------------------------------------------------

create table premium_interest (
  feature text primary key check (feature in ('unlimited_clips', 'who_viewed')),
  taps bigint not null default 0 check (taps >= 0)
);
alter table premium_interest enable row level security;

-- Returns whether the tap was counted. False for anyone who is not an adult,
-- for nobody, and for a feature that is not one of the two.
create function fn_premium_interest(p_person uuid, p_feature text) returns boolean
language plpgsql as $$
begin
  if p_person is null or p_feature is null
     or p_feature not in ('unlimited_clips', 'who_viewed') then
    return false;
  end if;
  if not exists (select 1 from person where id = p_person and fn_age_band(dob) = '18plus') then
    return false;
  end if;
  insert into premium_interest (feature, taps) values (p_feature, 1)
    on conflict (feature) do update set taps = premium_interest.taps + 1;
  return true;
end $$;

comment on table premium_interest is
  'D-164: one anonymous tap count per Premium feature. No person, session, IP or per-tap time, by design.';
