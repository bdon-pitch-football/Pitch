-- ---------------------------------------------------------------------------
-- 0152 — only a verified club posts its own trial notice, and only a verified
-- club's own notices are on the board (BUZ's ruling on doc 14 M7, 29 Sep:
-- "D-90 stands"; D-90; 0130; 0140; 0150).
--
-- THE RULING. Doc 14 M7 said an unverified club MAY post a trial notice. D-90
-- names the board's two sources: a verified club posts its own, and Pitch
-- compiles the rest from the club's own public notice (0130). BUZ ruled for
-- D-90 and doc 14 M7 now reads "Refused ... Nobody advertises a trial to
-- families until BUZ has rung the club."
--
-- WHY IT GOES IN THE DATABASE. Until now the refusal lived in one place, the
-- query /club/post-trial runs on its page and again in its action. That is
-- the product's only door, and it holds; but doc 14's first rule is that its
-- tests run against the database, "a test that passes through the application
-- proves nothing about a query written later", and permissions live in
-- Postgres (D-80, the brief §3). A second screen that writes a notice would
-- have had to remember D-90. Now it cannot forget it.
--
-- THE TWO HALVES.
--   · A club-sourced notice ('club') is written only for a club whose
--     club_state is 'verified' — at insert, or when an edit moves a notice to
--     another club or relabels it 'club'. A compiled notice is Pitch's, and
--     0130's wall already decides where those go (unclaimed or
--     claimed-and-unverified, never verified, never suspended).
--   · The board shows a club's own notices only while the club is verified.
--     0140 took a SUSPENDED club off the board. 0150 made a second way out of
--     verified — a failed call leaves the club 'claimed' — and a club in that
--     state would otherwise have gone on advertising the notices it posted
--     while it was verified, which is exactly what the ruling says does not
--     happen. A compiled notice stays on the board for a claimed club, as
--     0130 intends. Nothing is deleted; verified again, the notices are back.
--
-- What this does NOT touch: players-wanted notices (M7 is about trial
-- notices, and whether a claimed club may post a players-wanted notice is not
-- something BUZ has ruled on — reported, not decided); a club's own
-- management screen, which reads its own notices from the table (0140's
-- susp-ad-s1 list); and any row already written.
-- ---------------------------------------------------------------------------

create function trial_notice_club_source_verified() returns trigger
language plpgsql as $$
begin
  if new.source = 'club'
     and (tg_op = 'INSERT' or new.club_id is distinct from old.club_id or new.source is distinct from old.source)
     and not exists (select 1 from club c where c.id = new.club_id and c.club_state = 'verified') then
    raise exception 'only a verified club posts its own trial notice (D-90)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

comment on function trial_notice_club_source_verified() is
  'BUZ on doc 14 M7, 29 Sep (0152) — D-90: a club posts its own trial notice only while it is verified. Refused at the write.';

create trigger trial_notice_club_source_verified
  before insert or update of club_id, source on trial_notice
  for each row execute function trial_notice_club_source_verified();

-- The board, as 0140 wrote it, plus the second half of the rule.
create or replace function fn_trial_notices_advertised() returns setof trial_notice
language sql stable as $$
  select t.* from trial_notice t
  where t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
    and fn_club_advertises(t.club_id)
    and (t.source = 'compiled'
         or exists (select 1 from club c where c.id = t.club_id and c.club_state = 'verified'));
$$;

comment on function fn_trial_notices_advertised() is
  'brief K item 1 (0140), BUZ on M7 (0152) — every trial notice on the board: still to come, its club not suspended, and a club''s own notice only while the club is verified. Every page that lists a notice reads this.';

-- No new table here, so nothing to enable row-level security on (L26).
