-- ============================================================================
-- 0013 · The sixteenth-birthday transition (D-22, D-49, doc 14 §B11)
-- Discovery that switches on for a 16-year-old whose parent was never
-- successfully told is discovery without consent. So the transition is gated
-- on the doc 15 §13 notice having DELIVERED — not merely been sent. No
-- receipt, no discovery, and the account is flagged for a human.
-- ============================================================================
create table age_transition_notice (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references person(id) on delete cascade,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,             -- written by the provider receipt (D-78)
  outbox_id uuid references message_outbox(id)
);

create function fn_transition_notice_delivered(p_child uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from age_transition_notice
    where child_id = p_child and delivered_at is not null)
$$;

-- fn_searchable, amended: a 16–17 is discoverable only when the guardian
-- notice actually landed. Everything else about the function is unchanged.
create or replace function fn_searchable(p_searcher uuid, p_person uuid) returns boolean
language plpgsql stable as $$
declare
  v_band text;
begin
  select fn_age_band(dob) into v_band from person where id = p_person;
  if not found then return false; end if;

  if v_band = 'u16' then return false; end if;                    -- B1/B2: never

  if v_band = '16_17' then
    if p_searcher is null then return false; end if;              -- B5
    if coalesce((select discovery_disabled from guardian_setting where child_id = p_person), false)
      then return false; end if;                                  -- B6
    -- B11: the 30-day notice must have DELIVERED, or discovery stays off.
    if not fn_transition_notice_delivered(p_person) then return false; end if;
    return fn_is_verified_adult(p_searcher);                      -- B3/B4
  end if;

  return true;                                                    -- B7: adults
end $$;

-- Children whose sixteenth birthday is thirty days away and who have not been
-- noticed yet. The daily job reads this.
create function fn_children_turning_16() returns table (child_id uuid, first_name text, guardian_id uuid, guardian_email text)
language sql stable as $$
  select c.id, c.first_name, g.guardian_id, p.email
  from person c
  join guardianship_link g on g.child_id = c.id and g.approved_at is not null and g.revoked_at is null
  join person p on p.id = g.guardian_id
  where c.dob + interval '16 years'
        between (now() at time zone 'Australia/Melbourne')::date + 30
            and (now() at time zone 'Australia/Melbourne')::date + 31
    and not exists (select 1 from age_transition_notice t where t.child_id = c.id)
    and p.email is not null
$$;

alter table age_transition_notice enable row level security;
