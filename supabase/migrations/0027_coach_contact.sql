-- ---------------------------------------------------------------------------
-- 0027 — doc 14 L48-L51: a coach's own professional contact route.
--
-- The coach CV had no contact affordance at all, which passed L49/L50/L51 by
-- accident (absent for everybody) and failed L48 (it should be rendered for
-- clubs and adults). A coach whose whole reason for the link is "applying to
-- a club for a position" (D-100) had no way for that club to reach them.
--
-- This is the COACH's own address, published by their own choice — it is not
-- Pitch handing over somebody else's details, which D-100 forbids and which
-- remains forbidden.
--
-- The band rule is the important part, and it is enforced server-side:
--
--   anon             rendered. We cannot know whether a visitor is a child
--                    and MUST NOT guess (L51) — no heuristic, no signal
--                    collection. Safety comes from the architecture, not
--                    from profiling a stranger.
--   signed-in 18+    rendered.
--   signed-in u16    ABSENT FROM THE RESPONSE BODY. Not hidden with CSS,
--   signed-in 16-17  not disabled — absent. Both are minors; D-22's split
--                    governs discovery, not this.
-- ---------------------------------------------------------------------------
alter table coach_profile add column public_contact text;

-- Whether a contact affordance may be rendered to this viewer. Null viewer
-- (anon) is allowed: we do not guess at a stranger's age.
create function fn_coach_contact_visible(p_viewer uuid) returns boolean
language sql stable as $$
  select case
    when p_viewer is null then true               -- L51: no inference attempt
    else coalesce(
      (select fn_age_band(dob) = '18plus' from person where id = p_viewer),
      true)                                        -- unknown person, treat as anon
  end
$$;
