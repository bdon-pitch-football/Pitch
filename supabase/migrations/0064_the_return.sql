-- ---------------------------------------------------------------------------
-- 0064 — coming back after a season away (D-25, D-49, D-53, D-65 as amended
-- by D-81, D-74/D-90; doc 34 rule 6; doc 14 N22, B11; LESSONS L23).
--
-- WHY THIS EXISTS. A family is gone from March to September. That is the
-- football year, not a failure, and resuming is an ordinary stage rather than
-- a lapse to be recovered from. Nothing on /home knows how long anybody has
-- been away, so a parent who last opened Pitch in July gets the identical
-- screen to one who opened it yesterday: a queue of things waiting on THEM,
-- oldest first, the oldest of which has been waiting since July. The first
-- thing a returning parent reads is a list of their own omissions — while the
-- database holds the answer to the question they actually came back with,
-- which is "did anything happen?".
--
-- The facts are already here: an append-only read ledger with a named reader
-- (register_read_log, 0037; disclosable under doc 34 rule 6, 0047), the live
-- share token's expiry (D-53), and the curated trials board (D-74, D-90).
-- What was missing was (a) any record of when somebody was last here and (b)
-- one answer to "what happened while they were away" that a page cannot get
-- wrong on its own (L23).
--
-- ============ THE FOUR THINGS THIS DELIBERATELY IS NOT ======================
-- Each was proposed during the 24 Sep review and killed in the same review;
-- the reasoning is in docs/design/reports/2026-09-24-research-layers-and-life.md.
--   · NOT A SEND. Nothing here is emailed, texted or pushed. It is computed on
--     arrival and read on arrival. The moment it becomes a send it is a
--     re-engagement prompt, which is banned outright over a minor (D-65 as
--     amended by D-81: "notifications to minors are strictly functional — no
--     streaks, no re-engagement prompts, ever") and is a marketing send to a
--     guardian, which launch does not have.
--   · NO STREAK, NO BADGE, NO VISIT COUNT. There is no column here that only
--     goes up. `last_seen_at` is OVERWRITTEN, never appended to: it is one
--     timestamp, not a history of when a family opened an app, and that is the
--     difference between the minimum a feature requires and behavioural
--     tracking, which D-25 forbids outright on a minor.
--   · NO COUNT OF READS. "Your CV has been opened eleven times" is a score. A
--     number that only rises makes a quiet month read as a bad month, and the
--     child cannot do anything about either.
--   · NOTHING AIMED AT A CHILD. See the u16 refusal below, which is in this
--     function rather than in a page precisely so that no later page can
--     route around it.
--
-- ============ THE UNDER-16 REFUSAL, AND WHY IT IS HERE =======================
-- Read receipts are sixteen-and-over today: fn_register_readers (0047) gives
-- an under-16 asking about themselves an empty set, and doc 34 rule 6 puts a
-- child's read ledger on the guardian's screens until sixteen. That is a doc
-- 34 decision and this migration does not touch it.
--
-- What follows from it is that the best line in this block — a named person at
-- a named club opened your CV on a date — does not exist for an under-16, and
-- what is left is their own link expiry and a public trial date, both of which
-- are already on their page. So:
--   · fn_note_arrival records nothing at all for an under-16. No timestamp of
--     a fourteen-year-old's visits is written anywhere, which is D-25 read as
--     it is written rather than as it is convenient.
--   · fn_return_facts returns nothing at all to an under-16 viewer.
-- fn_age_band treats a null date of birth as u16 (0003), so an account with no
-- date of birth recorded gets neither — the restrictive answer, deliberately
-- (TRAINING §3.8).
--
-- WHETHER an under-16 should see a reduced version of this block at all is a
-- product decision about a minor and it is BUZ's, not the build's: the mockup
-- that specifies this block says explicitly that nothing goes on a player's
-- home, and the instruction that commissioned it says to build what is lawful
-- for each band. Where those disagree this takes the restrictive side and says
-- so out loud, which is the rule.
--
-- ============ SIXTY DAYS, AND THE DAY THE BLOCK STAYS UP =====================
-- Away is sixty days, from the review. Two columns rather than one, because a
-- block that vanishes when a parent presses Back and comes home again is a
-- block nobody reads twice:
--   · last_seen_at advances on every arrival;
--   · returned_at / returned_from record that an arrival OPENED a return, and
--     from when, so the block renders for the rest of that day and then stops.
-- Twenty-four hours is a product number and it is marked as a proposal in the
-- handoff.
--
-- Read with: 0037 and 0047 (the read ledger and who may ask), 0007 (the trial
-- notice and its added_on / last_checked stamps), 0002 (share_token,
-- guardianship_link), D-53, D-74, D-90, doc 34 rule 6.
-- ---------------------------------------------------------------------------

-- ---- 1 · when somebody was last here --------------------------------------
-- One timestamp, overwritten. Not a log, not a count, not a streak.
alter table person
  add column last_seen_at timestamptz,
  add column returned_at timestamptz,
  add column returned_from timestamptz;

comment on column person.last_seen_at is
  'Last arrival on their own home, overwritten (D-25: the minimum the return block needs, never a history). Never written for an under-16.';
comment on column person.returned_at is
  'When an arrival opened a 60-day return. The return block renders for 24 hours from here.';
comment on column person.returned_from is
  'The last_seen_at the return was measured from — the start of the away window.';

-- fn_note_arrival — called once by /home for the seat it is rendering, and by
-- nothing else. Returns the instant the away window started, or null when
-- there is no return to show: a first visit is not a return, and neither is
-- coming back after a week.
create function fn_note_arrival(p_person uuid) returns timestamptz
language plpgsql as $$
declare v_last timestamptz; v_returned timestamptz; v_from timestamptz; v_band text;
begin
  if p_person is null then return null; end if;

  select last_seen_at, returned_at, returned_from, fn_age_band(dob)
    into v_last, v_returned, v_from, v_band
    from person where id = p_person;
  if not found then return null; end if;
  -- Nothing is recorded about a child's visits at all — not the arrival, not
  -- the return. This is the write half of the refusal; fn_return_facts holds
  -- the read half, so neither depends on the other being remembered.
  if v_band = 'u16' then return null; end if;

  if v_last is not null and v_last <= now() - interval '60 days' then
    update person set returned_from = v_last, returned_at = now(), last_seen_at = now()
     where id = p_person;
    return v_last;
  end if;

  update person set last_seen_at = now() where id = p_person;

  -- Still inside the day a return opened: the same window, so the block does
  -- not disappear between two presses of the same screen.
  if v_returned is not null and v_returned > now() - interval '24 hours' then
    return v_from;
  end if;
  return null;
end $$;

-- ---- 2 · what happened while they were away --------------------------------
-- Three facts, dated, in the order the block renders them. Every one of them
-- is something we already hold, and every one of them is gated by an answer
-- that already exists rather than by a query written here (L23).
--
-- Rows are omitted, never guessed. A family with no read, no live link and no
-- checked trial notice gets an empty set and the page renders no block at all,
-- which is the correct answer to "did anything happen?" when nothing did.
create function fn_return_facts(p_viewer uuid, p_since timestamptz)
-- `subject` is the child's first name, or NULL when the subject is the viewer
-- themselves — the same shape components/RegisterReaders.tsx already uses, so
-- the page writes "your CV" and "Deniz's CV" from one branch and never has to
-- compare a name to a name to work out whose page it is on.
returns table (kind text, fact_on date, subject text, club_name text,
               reader_name text, reader_role text, surface text, checked_on date)
language plpgsql stable as $$
declare v_subjects uuid[];
begin
  if p_viewer is null or p_since is null then return; end if;
  -- Nothing at all for a child. The refusal is here so that no page, now or
  -- later, can assemble this block for an under-16 by calling the parts.
  if (select fn_age_band(dob) from person where id = p_viewer) = 'u16' then return; end if;

  -- Whose facts this viewer may be shown: themselves, and every child whose
  -- guardianship is approved and live. At eighteen a guardianship is
  -- visibility and only if re-granted (D-49, M3) — asked in the same words as
  -- fn_register_readers, so the two cannot drift apart.
  v_subjects := array(
    select p_viewer
    union
    select g.child_id
      from guardianship_link g
      join person ch on ch.id = g.child_id
     where g.guardian_id = p_viewer
       and g.approved_at is not null and g.revoked_at is null
       and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null));

  -- 1 · THE READ. The strongest thing we own: a named person at a named club
  -- opened this child's CV on a date, and the ledger can prove it. The gate is
  -- fn_register_readers' own — doc 34 rule 6 — which is why this asks that
  -- function rather than register_read_log: an under-16 asking about
  -- themselves gets an empty set from it, and so does anybody who is not the
  -- child or an approved guardian.
  --
  -- ONE row. Not a count (a number that only goes up is a score) and not a
  -- list (a list of eleven readers is a count with names on).
  --
  -- The CV read wins over the list read when both fall in the window, and then
  -- the most recent. Both are true; "a named person opened your child's CV" is
  -- the one a parent came back for, and "saw them in the list" is what a club
  -- does by loading a page. Ordering by date alone would bury the stronger fact
  -- under the routine one every time.
  return query
    select 'read',
           (r.last_read at time zone 'Australia/Melbourne')::date,
           case when p.id = p_viewer then null else p.first_name end,
           r.club_name, r.reader_name, r.reader_role, r.surface, null::date
      from unnest(v_subjects) s(id)
      join person p on p.id = s.id
      cross join lateral fn_register_readers(p_viewer, s.id) r
     where r.last_read is not null
       and r.last_read >= p_since
       and r.reader_name is not null
     order by (r.surface = 'cv') desc, r.last_read desc
     limit 1;

  -- 2 · THE LINK. When it expires, and nothing about renewing it: the renewal
  -- control is where it has always been, on the child's own card below (D-53).
  -- The soonest expiry across the viewer's people, because that is the date
  -- that matters first.
  return query
    select 'link_expiry',
           (st.expires_at at time zone 'Australia/Melbourne')::date,
           case when p.id = p_viewer then null else p.first_name end,
           null::text, null::text, null::text, null::text, null::date
      from unnest(v_subjects) s(id)
      join person p on p.id = s.id
      join development_record dr on dr.person_id = p.id
      join lateral (
        select t.expires_at from share_token t
         where t.record_id = dr.id and t.revoked_at is null and t.paused = false
           and t.expires_at is not null and t.expires_at > now()
         order by t.issued_at desc
         limit 1) st on true
     order by st.expires_at
     limit 1;

  -- 3 · THE TRIAL DATE, AND THE REASON IT CAN BE OMITTED.
  -- The index is hand-curated (D-74, D-90) and every notice carries added_on
  -- and last_checked for exactly this reason. A block that prints a trial
  -- window somebody has not checked, in the first week of October, is worse
  -- than no block at all — so the date is never a season we have written down
  -- somewhere; it is the earliest upcoming notice WE ACTUALLY HOLD, and it is
  -- omitted entirely unless a human has checked that notice inside thirty
  -- days. Thirty days is a product number and is flagged as a proposal.
  --
  -- Not filtered to this family, this club or this age group: the board is
  -- chronological and has no recommender and no personalisation, ever (D-74).
  -- The check stamp travels with the date so the page can say when it was last
  -- looked at, as /trials already does.
  return query
    select 'trials', t.trial_on, null::text, null::text, null::text, null::text, null::text,
           t.last_checked
      from trial_notice t
     where t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
       and t.last_checked >= (now() at time zone 'Australia/Melbourne')::date - 30
     order by t.trial_on, t.last_checked desc
     limit 1;
end $$;
