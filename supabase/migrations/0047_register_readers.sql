-- ---------------------------------------------------------------------------
-- 0047 — who has read my registration (doc 34 rule 6; doc 32 C4b).
--
-- Every register read already carries a named person (register_read_log,
-- 0037). Rule 6 is what makes the other seven enforceable: a family can see
-- who read their registration. BUZ, 17 Sep: build it. The build's reading,
-- the restrictive-where-it-matters one:
--
--   · the reader is named — first and last name, and their role at that club
--     (doc 26 v1.6: "each read recorded — and you can ask us who");
--   · both kinds of read are shown: appearing in the club's list, and
--     opening the CV, with the most recent of each;
--   · who may ask: an approved guardian (as fn_send_log: for an adult child,
--     only if re-granted), and the player themselves from sixteen. An
--     under-16 asks through their guardian, as with everything else.
--
-- Nobody else gets a row, and the answer for "not yours" is the answer for
-- "nothing there": an empty set.
-- ---------------------------------------------------------------------------
create function fn_register_readers(p_viewer uuid, p_person uuid)
returns table (registration_id uuid, club_name text, registered_at timestamptz, withdrawn boolean,
               reader_name text, reader_role text, surface text, last_read timestamptz)
language plpgsql stable as $$
declare v_ok boolean;
begin
  if p_viewer is null or p_person is null then return; end if;

  v_ok := (p_viewer = p_person
             and exists (select 1 from person where id = p_person and fn_age_band(dob) <> 'u16'))
       or exists (
            select 1 from guardianship_link g
            join person ch on ch.id = g.child_id
            where g.guardian_id = p_viewer and g.child_id = p_person
              and g.approved_at is not null and g.revoked_at is null
              and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null));
  if not v_ok then return; end if;

  return query
    select r.id, c.name, r.created_at, r.withdrawn_at is not null,
           nullif(btrim(coalesce(rd.first_name, '') || ' ' || coalesce(rd.last_name, '')), ''),
           (select case m.role when 'technical_director' then 'Technical director'
                               when 'coach' then 'Coach'
                               when 'club_admin' then 'Club administrator'
                               else 'Club staff' end
              from membership m where m.person_id = rd.id and m.club_id = r.club_id
              order by m.ended_at is null desc, m.started_at desc nulls last limit 1),
           l.surface,
           max(l.read_at)
    from registration r
    join club c on c.id = r.club_id
    left join register_read_log l on l.registration_id = r.id
    left join person rd on rd.id = l.person_id
    where r.player_id = p_person
    group by r.id, c.name, r.created_at, r.withdrawn_at, rd.id, rd.first_name, rd.last_name, r.club_id, l.surface
    order by r.created_at desc, max(l.read_at) desc nulls last;
end $$;
