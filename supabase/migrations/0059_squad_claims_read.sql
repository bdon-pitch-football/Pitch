-- ---------------------------------------------------------------------------
-- 0059 — the "Waiting on you" list becomes the database's answer (X1
-- follow-up, 23 Sep; D-126, doc 14 A17/A18, M10, L2, L23).
--
-- 0057 closed the club's side of that page: a suspended club reads nothing
-- there and can do nothing there. This closes the other half of the same
-- defect. Every other read on that screen is a function — fn_squad_roster,
-- fn_squad_asked, fn_squad_askable — and the claims list was an inline query
-- on app/club/squads/[squadId]/page.tsx with a page-level boolean in front of
-- it. A page with its own query is a second answer to "who may see this
-- child", which is a second place to be wrong (L23), and this one was wrong.
--
-- WHAT IT WAS MISSING, measured against its two neighbours rather than
-- guessed. fn_squad_roster and fn_squad_asked each resolve the club from the
-- squad, refuse unless the club is minor-facing, ask who is reading, and
-- apply fn_person_hidden. The claims query had fn_person_hidden and the
-- page's boolean, and nothing else:
--
--   1. A17/A18 — the consent behind the ask. A claim exists only because an
--      approved guardian made it (0052/0054's trigger). Revoke that
--      guardianship afterwards and the row stayed, so a VERIFIED club kept
--      reading a thirteen-year-old's first AND last name for an ask nobody
--      standing behind it any more. fn_join_squad already refuses to confirm
--      it (0054, SQ8g) — so the club was being shown a child's name for an
--      act that could not complete.
--   2. The same for a 16-17 whose parent has since turned the send switch
--      off, and for a child who has since turned 18 with a parent's claim
--      still open (M3, D-49): in both, fn_can_act_on_squad is now false and
--      the join is now refused, and the name was still on the screen.
--   3. Nothing to answer. fn_squad_asked drops anyone already in the squad;
--      the claims query did not, so a player who arrived by some other door
--      left a stale claim the club could still press, and pressing it
--      reported a failure about that child.
--   4. The club gate lived on the PAGE (squad.works), not in the read.
--
-- ONE PREDICATE, asked by the list and by the answer. fn_can_answer_claim is
-- the whole rule, per row, and both the list and answerClaim() call it — so
-- a claim the club cannot see is a claim the club cannot act on, in exactly
-- the same words. That is what keeps the disappearance silent: a claim whose
-- guardianship has gone answers precisely as a claim that never existed
-- (D-77's shape, applied to a club surface), and nothing on the screen ever
-- reports that something happened to it.
--
-- WHAT A CLUB SEES: THE FIRST NAME, AND NOT THE SURNAME — TD and club
-- administrator alike. This is a decision and it is the restrictive side of
-- an unclear question (TRAINING §3.8), so it is written down here rather
-- than left in a page.
--
--   · The two models on this page disagree. fn_squad_roster gives both seats
--     a surname — but those are children the club has already confirmed into
--     a squad, and the club knows who they are. fn_squad_asked gives a first
--     name only, "as the register gives it", for a child who is NOT yet in
--     the squad. A claim is the second shape, not the first: the family is
--     asking, and nothing has been agreed.
--   · The register's own closed payload is a first name (D-115). A club that
--     may not have a surname from its register may not have one from a claim
--     against the same squad, or the claim is a way around the register.
--   · The cost is real and belongs to BUZ, not to me: a technical director
--     with two children called Wren in the same age group has less to go on.
--     The honest answer if that turns out to matter is a product decision
--     about what a family's own ask may carry, not a quiet surname here.
-- ---------------------------------------------------------------------------

-- Whether this person may see, and therefore answer, this claim. Everything
-- the ask was checked against at write, asked again now, because weeks pass
-- between the ask and the answer and the world moves (M10).
create function fn_can_answer_claim(p_person uuid, p_claim uuid) returns boolean
language plpgsql stable as $$
declare v_squad uuid; v_player uuid; v_asked_by uuid; v_answered timestamptz; v_club uuid;
begin
  if p_person is null or p_claim is null then return false; end if;
  select squad_id, person_id, asked_by, answered_at
    into v_squad, v_player, v_asked_by, v_answered
    from squad_claim where id = p_claim;
  if not found or v_answered is not null then return false; end if;

  select club_id into v_club from squad where id = v_squad;
  if v_club is null then return false; end if;
  -- The club: verified, and this person works its squads. Since 0057 that is
  -- one question (D-126, M10).
  if not fn_can_work_squads(p_person, v_club) then return false; end if;

  -- The child: a pause, a content hold or an age-contradiction hold (0049).
  if fn_person_hidden(v_player) then return false; end if;

  -- The consent behind the ask, still standing. This is A17/A18 on the
  -- guardian branch, B4 on the 16-17 branch and M3 at eighteen, in the one
  -- question the join will ask when the club presses yes (0054's
  -- fn_join_squad) — so the list and the answer cannot disagree.
  if not fn_can_act_on_squad(v_asked_by, v_player) then return false; end if;

  -- Nothing left to answer: they are in this squad already, by whatever
  -- door. fn_join_squad refuses this, so a club could press a button that
  -- only ever reported a failure about a child.
  if exists (select 1 from membership m
             where m.person_id = v_player and m.squad_id = v_squad
               and m.role = 'player' and m.ended_at is null) then
    return false;
  end if;
  return true;
end $$;

-- The list itself, in the shape fn_squad_asked already has on this page: the
-- club resolved from the squad, the gate once at the top, and then the
-- per-row predicate as the authority. A first name and when they asked.
create function fn_squad_claims(p_person uuid, p_squad uuid)
returns table (claim_id uuid, first_name text, created_at timestamptz)
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return; end if;
  if not fn_can_work_squads(p_person, v_club) then return; end if;
  return query
    select sc.id, p.first_name, sc.created_at
    from squad_claim sc
    join person p on p.id = sc.person_id
    where sc.squad_id = p_squad
      and sc.answered_at is null
      and fn_can_answer_claim(p_person, sc.id)
    order by sc.created_at;
end $$;
