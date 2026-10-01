-- ---------------------------------------------------------------------------
-- 0165 — a player's CV wears their current club's own colours (D-174, BUZ and
-- John, 1 Oct 2026; 0163; D-126; D-119).
--
-- WHAT IT ANSWERS. The colours a CV may wear, and the state of the club they
-- belong to: {primary, secondary, state}, or null when the CV names no club.
-- lib/record-read is the one caller, beside fn_cv_club, and PlayerCV turns
-- the answer into a theme only while CV_WEARS_CLUB_COLOURS is on and the
-- state is 'verified' (perms cvc1, cvc2).
--
-- THE SAME CLUB AS THE CLUB LINE, ALWAYS (John's condition 2). The membership
-- below is fn_cv_club's, word for word (0155): the player's live player
-- membership, latest first, never at a suspended club. So the colours follow
-- the club line exactly: they change the moment the club line does, and a CV
-- can never wear the colours of a club it no longer names — "a false
-- association that we rendered". Perms cvcol-s1 fails if the two drift.
--
-- AN UNDER-16. The club line is not part of the approved snapshot (D-119); it
-- follows the membership (0054), and an under-16's membership only moves
-- through fn_join_squad once their guardian has acted (D-91, 0052): the
-- guardian asks and the club confirms, or the club asks and the guardian
-- accepts. A claim or an invitation still waiting writes nothing, so the
-- colours move when the guardian approves and not before (perms cvcol5).
--
-- VERIFIED ONLY, HERE AS WELL AS ON THE PAGE. D-174: the theme clears the
-- moment the club is unverified, suspended or unclaimed. A suspended club is
-- not named at all (above). For a claimed or unclaimed club the state is
-- returned and the colours are not, so a page that forgot to ask the state
-- still has nothing to paint with. The more restrictive answer, chosen by the
-- builder (1 Oct) — PlayerCV asks the state too (cvc2).
--
-- NEVER A CARD. The Open Graph image, the share card and the link-preview
-- text never call this or read what it returns (D-89; perms ctx4b, cvcol7).
-- A card is the one artefact that leaves and cannot be recalled.
--
-- Colours are the club's own choice and nothing else (D-174, John's
-- condition 1): the club picks a preset or types its own (0163). Nothing here
-- or anywhere derives one from a crest, a photograph, a kit or a website.
-- ---------------------------------------------------------------------------

create function fn_cv_club_colours(p_person uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
       'primary', case when c.club_state = 'verified' then c.colour_primary end,
       'secondary', case when c.club_state = 'verified' then c.colour_secondary end,
       'state', c.club_state)
     from membership m
     join club c on c.id = m.club_id
     where m.person_id = p_person and m.role = 'player' and m.ended_at is null
       -- 0155: a suspended or taken-down club is not named on a child's CV.
       and c.club_state <> 'suspended'
     order by m.started_at desc
     limit 1
$$;

comment on function fn_cv_club_colours(uuid) is
  'D-174: the colours a CV may wear — the club fn_cv_club names (same membership, same order), its colours only while verified, and its state. Null when the CV names no club. Read by lib/record-read only; never by a card (D-89).';

-- Nothing outside the server asks this.
revoke all on function fn_cv_club_colours(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_cv_club_colours(uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_cv_club_colours(uuid) from authenticated';
  end if;
end $$;

-- No new table here, so nothing to enable row-level security on (L26).
