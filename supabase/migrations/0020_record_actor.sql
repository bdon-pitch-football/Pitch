-- ---------------------------------------------------------------------------
-- 0020 — who may ACT on a record, as opposed to read it.
--
-- Four family-facing routes took a record id straight from the URL and did
-- nothing to check the person holding the session had any business with it:
-- /build, /register-interest, /share-card and /g/pending. They were disabled
-- in production behind `notFound()` and a "until auth lands" comment, so this
-- was never a live hole — but it is what stopped those flows shipping, which
-- is most of the product.
--
-- fn_read_level answers "what may this viewer SEE". That is the wrong
-- question here: a squad coach reads a child's record in full and must never
-- be able to edit it, compose a registration on their behalf, or approve
-- their share card. So this is a separate, much narrower function.
--
--   'self'      the record's owner
--   'guardian'  an approved, unrevoked guardian of a person under 18
--   null        everybody else, including every coach and club
--
-- Guardianship expires at 18 (D-49) unless the adult re-granted it, exactly
-- as fn_read_level treats it. Computed, never stored.
-- ---------------------------------------------------------------------------
create function fn_record_actor(p_person uuid, p_record uuid) returns text
language plpgsql stable as $$
declare v_owner uuid; v_band text;
begin
  if p_person is null then return null; end if;
  select dr.person_id, fn_age_band(p.dob) into v_owner, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return null; end if;

  if p_person = v_owner then return 'self'; end if;

  if exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_person and g.child_id = v_owner
      and g.approved_at is not null and g.revoked_at is null
      and (v_band <> '18plus' or g.regranted_at is not null)
  ) then return 'guardian'; end if;

  return null;
end $$;
