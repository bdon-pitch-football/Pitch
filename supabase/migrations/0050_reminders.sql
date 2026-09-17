-- ---------------------------------------------------------------------------
-- 0050 — the reminders doc 15 promises and nothing sent (BUZ, 17 Sep).
--
-- §3  Day-10 nudge to a parent who has not approved an under-16's page.
--     Once, never twice: the consent log's own 'nudge_sent' row is the
--     record. Not for a held invitation (D-155: nothing reaches a named
--     under-18), and not for a 16–17's parent, whose request does not delete
--     anything at 14 days, which is what §3 says.
-- §5  A week before a guardian-held link expires, once.
-- §23 The same, naming the clubs that hold it, when any do.
--     Grouped per child and expiry day, so a parent gets one email, not one
--     per link. Only for a child with an approved guardian: an adult's links
--     are their own, and doc 15 writes no reminder to an adult.
-- ---------------------------------------------------------------------------
alter table share_token add column renewal_reminded_at timestamptz;

create function fn_pending_nudges() returns table (invitation_id uuid, first_name text, guardian_phone text)
language sql stable as $$
  select pi.id, pi.first_name, pi.guardian_phone
  from pending_invitation pi
  where pi.approved_at is null and pi.held_at is null and pi.child_id is null
    and pi.guardian_phone is not null
    and pi.created_at <= now() - interval '10 days'
    and pi.created_at > now() - interval '14 days'
    and not exists (select 1 from consent_event e
                    where e.event = 'nudge_sent' and e.detail->>'invitation_id' = pi.id::text)
$$;

create function fn_links_to_remind() returns table (
  child_id uuid, first_name text, expires_on text, token_ids uuid[], clubs text[], emails text[])
language sql stable as $$
  with due as (
    select st.id, dr.person_id, st.expires_at
    from share_token st
    join development_record dr on dr.id = st.record_id
    join person p on p.id = dr.person_id
    where st.revoked_at is null and st.paused = false and st.renewal_reminded_at is null
      and st.expires_at > now() + interval '6 days' and st.expires_at <= now() + interval '7 days'
      and fn_age_band(p.dob) <> '18plus'
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
