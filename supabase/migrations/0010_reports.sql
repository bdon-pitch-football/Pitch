-- ============================================================================
-- 0010 · Report & takedown (D-64) and share-card approval (D-101)
-- A quiet "Report this page" affordance on every public page feeds a
-- complaints queue. No account and no reason are required: a parent whose
-- child appears in someone else's content must be able to reach us in one
-- tap. While a report is open the content is not visible to anyone.
-- ============================================================================
create table report (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null check (subject_kind in ('player_cv','coach_cv','club_page','trial_notice','other')),
  subject_ref text not null,            -- slug or token hint; never a raw token
  reason text,                          -- free text, hostile, escaped on output
  reporter_email text,                  -- optional: no account required
  created_at timestamptz not null default now(),
  actioned_at timestamptz,
  actioned_by text,                     -- named human, same discipline as doc 27
  outcome text check (outcome in ('removed','no_action','referred'))
);

-- While a report is open on a record, everything outward-facing stops. This
-- is the same computed effect as a guardian pause (A16) — no new flag on the
-- record, just an input the permission function reads.
create table content_hold (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references development_record(id) on delete cascade,
  report_id uuid references report(id),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create function fn_record_held(p_record uuid) returns boolean
language sql stable as $$
  select exists (select 1 from content_hold where record_id = p_record and released_at is null)
$$;

alter table report enable row level security;
alter table content_hold enable row level security;

-- Fold the hold into the single tokenised read path: a held record's links
-- go dead exactly like a paused one, and for the same reason — nothing
-- outward-facing survives while a person looks at the report.
create or replace function fn_token_read(p_token_hash bytea) returns jsonb
language plpgsql stable as $$
declare
  v_record uuid;
  v_person uuid;
  v_band text;
  v_content jsonb;
begin
  select st.record_id, dr.person_id
    into v_record, v_person
  from share_token st
  join development_record dr on dr.id = st.record_id
  where st.token_hash = p_token_hash
    and st.revoked_at is null
    and st.paused = false
    and (st.expires_at is null or st.expires_at > now());
  if not found then return null; end if;

  if fn_record_held(v_record) then return null; end if;

  select fn_age_band(dob) into v_band from person where id = v_person;

  if coalesce((select profile_paused from guardian_setting where child_id = v_person), false) then
    return null;
  end if;

  if v_band = 'u16' then
    if not fn_has_approved_guardian(v_person) then return null; end if;
    select content into v_content from profile_version
      where record_id = v_record and status = 'approved';
    if not found then return null; end if;
  else
    v_content := null;
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;
