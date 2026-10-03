-- ---------------------------------------------------------------------------
-- 0175 · A 16–17's guardian can stop the child's link, never start or extend
-- one (John, 3 Oct, §3; doc 14 E16, and E4 as qualified; the principle of
-- E15 and N-10; D-91, D-22, R12).
--
-- WHAT WAS WRONG. /g/controls gave every approved guardian Renew and Replace.
-- For a 16–17, Replace made a working link and handed it to the guardian
-- (?link=) — the guardian sharing, which E15 refused on /g/pending by another
-- route — and Renew decided for the player how long their page stayed open
-- to whoever holds the link. Both are authorship, and at 16 authorship is the
-- player's. Both actions wrote share_token themselves, behind a guardianship
-- check that asked nothing about the band.
--
-- NOW. Both are database functions that ask the author answer first
-- (fn_record_author, 0169: 'guardian' only for an under-16's approved
-- guardian) and, for anyone else, return false having written nothing — no
-- token made or lengthened, no consent_event. The actions send a false home,
-- exactly as they send a stranger (D-77). The page draws the two buttons and
-- their help line only for the guardian the database would let press them.
-- Under 16 nothing changes (E2, E4).
--
-- What a 16–17's guardian keeps is untouched: the hint and expiry, the send
-- list and notice of every send (L57, L5), the per-link switch-off
-- (lib/link-switch), pause (E5), the sending switch (L6/L7), discoverability
-- (B6) and deletion. A link a guardian made before the birthday stays live
-- until it expires; the player may switch it off or replace it.
--
-- AND THE REMINDER. fn_links_to_remind (0050) asked parents of every
-- under-18 to renew a link a week before it lapsed — doc 15 §5 and §23 both
-- say "Renew for another 90 days". A 16–17's guardian can no longer renew, so
-- it now returns under-16s only. Whether the player is reminded instead, and
-- in what words, is BUZ's; until then a 16–17's link simply lapses at 90 days,
-- which is the restrictive way to fail.
--
-- PRODUCTION (at 0173). Re-running is safe: two new functions and one
-- create-or-replace with an unchanged signature. No table is altered and no
-- row is touched; it takes no lock beyond the catalogue's.
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

-- Replace: every live link on the record stops, and one new one is made, in
-- one statement's transaction. The raw token never reaches the database; the
-- caller hands its hash and hint (D-80, D-94 §4).
create or replace function fn_guardian_replace_link(p_guardian uuid, p_record uuid, p_hash bytea, p_hint text)
returns boolean
language plpgsql as $$
declare v_child uuid;
begin
  if fn_record_author(p_guardian, p_record) is distinct from 'guardian' then return false; end if;
  select person_id into v_child from development_record where id = p_record;
  update share_token set revoked_at = now() where record_id = p_record and revoked_at is null;
  insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
  values (p_record, p_hash, p_hint, p_guardian, now() + interval '90 days');
  insert into consent_event (event, actor_id, subject_id, detail)
  values ('share_revoked', p_guardian, v_child, '{}'), ('share_issued', p_guardian, v_child, '{}');
  return true;
end $$;

-- Renew: a link that is still ALIVE gets another 90 days (a lapsed one is
-- never revived — the renew action's own rule since the first build).
create or replace function fn_guardian_renew_link(p_guardian uuid, p_record uuid)
returns boolean
language plpgsql as $$
declare v_child uuid;
begin
  if fn_record_author(p_guardian, p_record) is distinct from 'guardian' then return false; end if;
  select person_id into v_child from development_record where id = p_record;
  update share_token set expires_at = now() + interval '90 days'
   where record_id = p_record and revoked_at is null and paused = false
     and (expires_at is null or expires_at > now());
  insert into consent_event (event, actor_id, subject_id, detail)
  values ('share_issued', p_guardian, v_child, jsonb_build_object('renewed', true));
  return true;
end $$;

comment on function fn_guardian_replace_link(uuid, uuid, bytea, text) is
  'doc 14 E2/E4/E16 (John, 3 Oct): an under-16''s guardian replaces the link; anyone else, a 16–17''s guardian included, gets false and nothing is written.';
comment on function fn_guardian_renew_link(uuid, uuid) is
  'doc 14 E16 (John, 3 Oct): an under-16''s guardian renews a live link; anyone else, a 16–17''s guardian included, gets false and nothing is written.';

-- doc 15 §5 / §23: a renew call to action goes only where it can be pressed.
create or replace function fn_links_to_remind() returns table (
  child_id uuid, first_name text, expires_on text, token_ids uuid[], clubs text[], emails text[])
language sql stable as $$
  with due as (
    select st.id, dr.person_id, st.expires_at
    from share_token st
    join development_record dr on dr.id = st.record_id
    join person p on p.id = dr.person_id
    where st.revoked_at is null and st.paused = false and st.renewal_reminded_at is null
      and st.expires_at > now() + interval '6 days' and st.expires_at <= now() + interval '7 days'
      -- Under 16 only (E16): a 16–17's guardian can no longer renew.
      and fn_age_band(p.dob) = 'u16'
  )
  select d.person_id, p.first_name,
         to_char(min(d.expires_at) at time zone 'Australia/Melbourne', 'FMDD FMMonth'),
         array_agg(d.id),
         coalesce(array(select distinct e.detail->>'club_name' from consent_event e
                        where e.event = 'share_dispatched' and e.subject_id = d.person_id
                          and (e.detail->>'token_id')::uuid = any(array_agg(d.id))
                          and e.detail->>'club_name' is not null), '{}'),
         array(select distinct g.email from guardianship_link l join person g on g.id = l.guardian_id
               where l.child_id = d.person_id and l.approved_at is not null and l.revoked_at is null
                 and g.email is not null)
  from due d join person p on p.id = d.person_id
  group by d.person_id, p.first_name, (d.expires_at at time zone 'Australia/Melbourne')::date
$$;
