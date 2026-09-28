-- ---------------------------------------------------------------------------
-- 0065 — the class of a suspension is recorded on the call that made it, and
-- the database — not a page — decides which class tells families
-- (doc 31 M11/L29, 7 Sep; doc 15 §37; doc 27's call log; D-126; LESSONS L23).
--
-- WHY THIS EXISTS. 0025 built the whole chain for John's M11/L29 ruling and
-- nothing ever called it. `club.suspension_reason` was added with its closed
-- list; `fn_guardians_to_notify_on_suspension` returned exactly the right
-- recipients; `undo_token`, `/undo/[token]` and `clubDeverifiedEmail`
-- (doc 15 §37) were all written. But `app/ops/call/[clubId]/actions.ts` is
-- the only path in the product that suspends a club, and it wrote
-- `club_state='suspended'` and nothing else — so an operator could take a
-- club down this afternoon for a child-safety reason and no family holding a
-- live link to that club would ever be told. The suspend button ships.
--
-- TWO THINGS THIS FIXES, AND THE SECOND IS THE ONE THAT MATTERS.
--
-- 1 · THE CLASS IS PART OF THE CALL, NOT ONLY THE CLUB. `club.suspension_reason`
--     is a column on a mutable row: verify the club again and the class of the
--     suspension before it is gone. Doc 27 says of the call log, in its own
--     words: "These fields are the record we would produce if a family, a
--     regulator or a court asked how we decided a stranger could receive their
--     child's details." A suspension that told a hundred families, or chose
--     not to, has to be reconstructable from the call that made it — so the
--     class goes on `verification_call` beside the operator's name, the
--     timestamp and the number source, and that row is never updated.
--
--     The check is the same closed list as 0025 and it is tied to the outcome:
--     a call that did not suspend cannot carry a class of suspension, exactly
--     as 0058 refuses a Technical Director on a call that did not verify.
--
-- 2 · THE MAPPING FROM CLASS TO "FAMILIES ARE TOLD" LIVES IN POSTGRES.
--     John's ruling is one sentence: "Ordinary de-verification — lapsed
--     paperwork, non-payment, an admin change — triggers nothing beyond ending
--     club-side access, which is already tested at M10. ONLY the child-safety
--     class notifies families." Doc 15 §37 says the same: "Sent **only** where
--     a club's verification is withdrawn for a **child-safety** reason."
--
--     That sentence is a child-safety judgement, and it must not sit in a
--     server action as `if (reason === 'child_safety')`. A second caller — a
--     cron sweep, a future admin screen, a support tool — would either have to
--     copy it or would silently get it wrong, and the failure mode is a
--     message about their child's club arriving at a hundred families who
--     should never have received it. It cannot be taken back.
--
--     So the gate moves INTO the function that already answers "who must be
--     told". `fn_guardians_to_notify_on_suspension` now returns nobody unless
--     the club is actually suspended AND the recorded class is 'child_safety'.
--     Every way of getting this wrong therefore answers "nobody":
--       · no class recorded at all            → nobody
--       · 'administrative' or 'non_payment'   → nobody
--       · a class left behind on a club that has since been verified → nobody
--     The caller sends to whatever comes back and decides nothing. That is
--     L23: if the product already answers "who may be told about this child",
--     call that answer.
--
-- WHAT THIS DELIBERATELY DOES NOT DO. It does not revoke anything. John:
-- "Force-revoking every token minted by every player registered at that club
-- is worse than it sounds: tokens are not club-bound, so we would be killing
-- links those families sent to OTHER clubs — punishing a family, invisibly,
-- for something a club did." The notice carries a button; the family presses
-- it or does not. Doc 14 M11 as written ("revocation of `verified` is
-- equivalent to revocation of every link that club holds") is the clause John
-- recorded as unbuildable, and it stays unbuilt.
--
-- ALSO NEW IN THE FUNCTION: the club's own name, so the caller composing
-- doc 15 §37 makes one database call and assembles nothing of its own.
-- ---------------------------------------------------------------------------

-- 1 · The class, on the call that made the suspension.
alter table verification_call add column suspension_reason text;
alter table verification_call add constraint verification_call_suspension_reason_list
  check (suspension_reason is null
         or suspension_reason in ('child_safety', 'administrative', 'non_payment'));
-- A call that did not suspend has no class of suspension to record. Same shape
-- as 0058's refusal of a Technical Director on a call that did not verify.
alter table verification_call add constraint verification_call_reason_needs_suspension
  check (suspension_reason is null or outcome in ('suspended', 'takedown'));

comment on column verification_call.suspension_reason is
  'doc 31 M11/L29 — the class of this suspension, recorded on the immutable call row. Only child_safety tells families (doc 15 §37).';

-- 2 · The class gate moves into the answer. The signature changes (club_name
-- is new), so this is a drop and create rather than a replace.
drop function if exists fn_guardians_to_notify_on_suspension(uuid);

create function fn_guardians_to_notify_on_suspension(p_club uuid)
returns table (guardian_id uuid, guardian_email text, child_first_name text,
               token_id uuid, club_name text)
language sql stable as $$
  select distinct g.guardian_id, gp.email, ch.first_name, st.id, c.name
  from share_request sr
  join share_token st on st.id = sr.share_token_id
  join development_record dr on dr.id = sr.record_id
  join person ch on ch.id = dr.person_id
  join guardianship_link g on g.child_id = ch.id
    and g.approved_at is not null and g.revoked_at is null
  join person gp on gp.id = g.guardian_id
  join club c on c.id = p_club
  where sr.dispatched_at is not null
    and st.revoked_at is null
    and (st.expires_at is null or st.expires_at > now())
    and lower(sr.destination) like '%' || lower(coalesce(c.contact_email, '~never~')) || '%'
    -- The ruling, in the one place every caller has to come through. Ordinary
    -- de-verification tells nobody; a class recorded against a club that is
    -- not suspended tells nobody; no class at all tells nobody.
    and c.club_state = 'suspended'
    and c.suspension_reason = 'child_safety'
    and gp.email is not null
$$;

comment on function fn_guardians_to_notify_on_suspension(uuid) is
  'doc 31 M11/L29 — the guardians whose live link went to this club, and ONLY where the club is suspended for the child-safety class. Returns nobody otherwise, so no caller can decide this.';
