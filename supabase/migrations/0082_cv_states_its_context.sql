-- ---------------------------------------------------------------------------
-- 0082 — the CV states its context: age group and birth quarter (D-84, D-164 (2)).
--
-- BUZ, 28 Sep: "A TD could not tell a fourteen-year-old's CV from a
-- seventeen-year-old's, which is the fact that makes everything else on the
-- page mean something." D-84 (locked 25 Aug) already said why the quarter
-- matters: a January child and a December child banded identically, with no
-- marker, is the relative-age bias the published critique names.
--
-- The CV now reads "U15 · born Jan–Mar" under the name. The age group is the
-- one the page already shows (the confirmed squad, fn_cv_club / the live
-- assembly). The quarter is DERIVED ON EVERY READ from the date of birth and
-- is never stored, exactly as the band is (doc 14 §J1): it is stamped on the
-- way out of fn_approved_cv here, and read beside the band by the live
-- assembly (lib/record-read). A date of birth is a calendar date, so the
-- quarter is the same in every zone; nothing here reads a clock.
--
-- What this function gives out is three months wide and nothing narrower: no
-- date of birth, no year, no exact age (D-164). It returns null when there is
-- no date of birth, and the page then renders nothing rather than a guess.
--
-- Where it NEVER goes: the Open Graph image, the share card, and anything
-- else D-89 governs. Those surfaces cache for good and may carry pride,
-- never locator data; an age group is already refused there, and a birth
-- quarter narrows a child further. They do not read this key (permission
-- suite ctx*).
--
-- Read with: D-84, D-164, D-89, 0054 (fn_approved_cv, fn_cv_club), 0061.
-- ---------------------------------------------------------------------------

create function fn_birth_quarter(p_dob date) returns text
language sql immutable as $$
  select case
    when p_dob is null then null
    when extract(month from p_dob) <= 3 then 'Jan–Mar'
    when extract(month from p_dob) <= 6 then 'Apr–Jun'
    when extract(month from p_dob) <= 9 then 'Jul–Sep'
    else 'Oct–Dec'
  end
$$;

comment on function fn_birth_quarter(date) is
  'D-84: the birth quarter, and nothing narrower. Derived at read time; never stored, never on a card (D-89).';

-- The approved snapshot as it is served (0054, 0061), now with the quarter
-- stamped on the way out — the same place the club line and the D-161 filter
-- are applied, so the token path, the register CV, the squad CV and the
-- family's preview cannot disagree about it.
create or replace function fn_approved_cv(p_record uuid) returns jsonb
language sql stable as $$
  select pv.content || fn_cv_club(dr.person_id)
    || jsonb_build_object('otherFootball', (
         select coalesce(jsonb_agg(e), '[]'::jsonb)
         from jsonb_array_elements(coalesce(pv.content -> 'otherFootball', '[]'::jsonb)) e
         where fn_experience_public(p_record, e ->> 'kind')))
    || jsonb_build_object('birthQuarter', fn_birth_quarter(p.dob))
  from profile_version pv
  join development_record dr on dr.id = pv.record_id
  join person p on p.id = dr.person_id
  where pv.record_id = p_record and pv.status = 'approved'
$$;

-- No new table here, so nothing to enable row-level security on (L26).
