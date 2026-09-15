-- ---------------------------------------------------------------------------
-- 0039 — the attacking midfielder is AM (D-92, doc 16 §1).
--
-- The register and doc 16 have always named the ten codes GK, RB, CB, LB,
-- DM, CM, AM, RW, LW, ST. The build drifted to CAM. BUZ, 16 Sep, asked for
-- player pages to show the short codes, which put the drift on screen, so it
-- is corrected at the source rather than relabelled on the way out.
--
-- Every place a position code is stored: the player's record, a club
-- registration, a pending registration request, a trial notice's "positions
-- wanted", and the approved snapshot of an under-16 page (D-119), which is
-- JSON and would otherwise keep rendering the old code.
-- ---------------------------------------------------------------------------
update development_record set positions = array_replace(positions, 'CAM', 'AM') where 'CAM' = any(positions);
update registration set positions = array_replace(positions, 'CAM', 'AM') where 'CAM' = any(positions);
update registration_request set positions = array_replace(positions, 'CAM', 'AM') where 'CAM' = any(positions);
update trial_notice set position_needs = array_replace(position_needs, 'CAM', 'AM') where 'CAM' = any(position_needs);

update profile_version
set content = jsonb_set(
  content, '{positions}',
  (select coalesce(jsonb_agg(case when v = 'CAM' then 'AM' else v end order by ord), '[]'::jsonb)
   from jsonb_array_elements_text(content -> 'positions') with ordinality as t(v, ord))
)
where jsonb_typeof(content -> 'positions') = 'array'
  and content -> 'positions' ? 'CAM';
