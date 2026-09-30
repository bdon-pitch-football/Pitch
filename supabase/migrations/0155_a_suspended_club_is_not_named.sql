-- ---------------------------------------------------------------------------
-- 0155 — a club that is suspended or taken down is not named on a child's CV
-- (brief M item 3, 30 Sep; round L's report, "Found" 2; D-158; 0054; 0140).
--
-- WHAT WAS WRONG. The club line on a CV follows the player's live membership
-- (0054, D-158): fn_cv_club reads it for every served under-16 snapshot
-- (fn_approved_cv — the share link, the family's preview, the register CV and
-- the squad CV), and lib/record-read's assembleCv read the same thing for
-- itself for 16-17s and adults. Neither asked about the club. A club Pitch
-- had suspended — for a child-safety reason or any other — or taken down was
-- still printed, with its crest and its suburb, on every CV of every child in
-- its squads, on pages the family sends to other clubs. 0140 took a
-- suspended club off the board; nothing took it off a child's page.
--
-- THE RULE. fn_cv_club names a club only while its club_state is not
-- 'suspended' (every class, and the takedown outcome, which writes the same
-- state — app/ops/call). Otherwise the CV renders exactly as it does for a
-- player with no club: no club, no crest, no locality, no squad. No new words.
-- Re-verify the club and the line is back; the membership is untouched and
-- nothing is deleted.
--
-- ONE ANSWER (L23). assembleCv now reads fn_cv_club instead of its own
-- membership query, and so does the CV email's "currently at" clause
-- (lib/send-dispatch), so the line cannot be right on one surface and wrong
-- on another. The permission suite pins that no other CV surface reads a
-- player's club itself (cvclub-s1).
--
-- What this does NOT touch: a club that failed its call and is 'claimed'
-- again (0150) — the brief names suspension and takedown only; reported, not
-- decided. And the family's own screens (their squad card, their menu), which
-- tell them where their child is recorded as playing and are not a CV.
-- ---------------------------------------------------------------------------

create or replace function fn_cv_club(p_person uuid) returns jsonb
language sql stable as $$
  select coalesce(
    (select jsonb_build_object(
       'club', c.name,
       'clubCrestPath', c.crest_path,
       -- The CLUB's suburb and state. Never the child's: we hold no address
       -- for a player and this line must not start looking like one.
       'locality', nullif(trim(concat_ws(' ', c.suburb, c.state)), ''),
       'squad', jsonb_build_object(
         'name', coalesce(s.name, ''),
         'ageGroup', coalesce(s.age_group, ''),
         'competitionGender', s.competition_gender))
     from membership m
     join club c on c.id = m.club_id
     left join squad s on s.id = m.squad_id
     where m.person_id = p_person and m.role = 'player' and m.ended_at is null
       -- 0155: a suspended or taken-down club is not named on a child's CV.
       and c.club_state <> 'suspended'
     order by m.started_at desc
     limit 1),
    jsonb_build_object(
      'club', '', 'clubCrestPath', null, 'locality', null,
      'squad', jsonb_build_object('name', '', 'ageGroup', '', 'competitionGender', null)))
$$;

comment on function fn_cv_club(uuid) is
  'The club line on a CV (0054, D-158): the live membership''s club, crest, club locality and squad — none of it while the club is suspended or taken down (0155). Every CV surface reads this.';

-- No new table here, so nothing to enable row-level security on (L26).
