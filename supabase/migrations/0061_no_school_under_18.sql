-- ---------------------------------------------------------------------------
-- 0061 — no school reaches a public page for anybody under 18 (D-161, BUZ's
-- call 28 Sep; doc 14 A19).
--
-- The contradiction this closes was between two of our own screens. The child
-- privacy policy tells a fourteen-year-old "We do not know your school. There
-- used to be a box for it and we took it away. Your school plus your age
-- group would tell a stranger where you are on a Tuesday morning." The public
-- CV, signed out, was rendering the club, the age group and the suburb, and
-- below them "school · <a real high school's 1st XI>". D-114 removed the
-- school FIELD and school football legitimately lives in experience_entry as
-- free text (D-72) — both halves were defensible, and together they were the
-- exact disclosure the policy refuses. A reader cannot see the distinction,
-- and a stranger holding a share link does not care about it.
--
-- WHY IT IS HERE AND NOT IN THE FORM. A chip nobody is shown is a UI
-- decision; a write the database refuses is the rule, and it is the rule that
-- survives the next screen somebody builds (D-80, the brief §3). The chip goes
-- too, but the chip is not what this depends on.
--
-- THIS IS NOT A PERMISSION SURFACE ON experience_entry, and the direction
-- matters. D-72's invariant is that the entry GRANTS nothing — no FK to club,
-- no part in the inside-the-club computation, nothing about it widens anybody's
-- read. That is untouched and still asserted (fn_read_level does not mention
-- this table). What is added runs the other way: the record's age band decides
-- what the entry may say. An entry still grants nobody anything.
--
-- AGE IS DERIVED, NEVER STORED (D-49, fn_age_band). One function answers both
-- halves — the write is refused against the date of birth at write time, and
-- the read paths ask the same question at read time — so a child who turns 18
-- is not a special case anybody has to remember, in either direction.
--
-- EXISTING ENTRIES ARE NOT TOUCHED. They are the family's own words, and
-- whether a family is told, and in what words, is BUZ's call and not this
-- migration's (D-161). Nothing here deletes, empties or rewrites a row: the
-- trigger is before insert or update, so a row written before today stays
-- exactly as it was, and fn_experience_public is what stops it rendering.
-- ---------------------------------------------------------------------------

-- May an experience entry of this kind appear on a public page for this
-- record? Asked at read time by every path that assembles a CV, and at write
-- time by the trigger below. Restrictive when the record is unknown, the same
-- default fn_age_band uses for an unknown date of birth (D-94).
create function fn_experience_public(p_record uuid, p_kind text) returns boolean
language sql stable as $$
  select case
    when p_kind <> 'school' then true
    else coalesce((
      select fn_age_band(p.dob) = '18plus'
      from development_record dr join person p on p.id = dr.person_id
      where dr.id = p_record), false)
  end
$$;

create function fn_no_school_under_18() returns trigger
language plpgsql as $$
begin
  -- What is refused is a school entry ARRIVING on an under-18's record: a new
  -- row, an entry whose kind is changed to school, or a school entry moved
  -- from an adult's record onto a child's. Those are the three ways one can
  -- get there, and the second and third are how a rule like this is usually
  -- got round by accident.
  --
  -- What is NOT refused is an in-place edit of a row that was already a school
  -- entry on that same record. Those rows exist and D-161 leaves them alone —
  -- refusing to let anything touch them would not delete them, it would only
  -- mean a correction elsewhere (the demo layer rewrites every text column in
  -- the database to the club it is being shown to) fails on a row that renders
  -- nowhere. Nothing here creates one and no page shows one.
  if new.kind = 'school'
     and (tg_op = 'INSERT'
          or new.kind is distinct from old.kind
          or new.record_id is distinct from old.record_id)
     and not fn_experience_public(new.record_id, 'school') then
    raise exception 'a school entry cannot be written on an under-18 record'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger no_school_under_18
  before insert or update on experience_entry
  for each row execute function fn_no_school_under_18();

-- THE APPROVED SNAPSHOT (D-119). A u16's page is not assembled on the way out:
-- it is the JSON a guardian approved, and every snapshot approved before today
-- was built when a school entry was allowed. Nothing rewrites those rows or
-- that snapshot — so the filter goes where the snapshot is SERVED, and 0054
-- already made that exactly one function for exactly this reason: the token
-- path, the club's register CV, the club's squad CV and the family's preview
-- all read fn_approved_cv, so the four cannot drift apart. Filtering here is
-- why none of the four needed to remember anything.
create or replace function fn_approved_cv(p_record uuid) returns jsonb
language sql stable as $$
  select pv.content || fn_cv_club(dr.person_id)
    || jsonb_build_object('otherFootball', (
         select coalesce(jsonb_agg(e), '[]'::jsonb)
         from jsonb_array_elements(coalesce(pv.content -> 'otherFootball', '[]'::jsonb)) e
         where fn_experience_public(p_record, e ->> 'kind')))
  from profile_version pv
  join development_record dr on dr.id = pv.record_id
  where pv.record_id = p_record and pv.status = 'approved'
$$;

-- No new table here, so nothing to enable row-level security on (L26).
-- experience_entry's own access is unchanged: it is read only through the
-- service role and a permission function, exactly as before.
