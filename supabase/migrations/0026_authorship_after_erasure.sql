-- ---------------------------------------------------------------------------
-- 0026 — D-48 / doc 14 F7 and I3: what an authoring coach keeps after a
-- family erases the record.
--
-- The gap: development_record cascades on delete, so record_entry went with
-- it and an authoring coach was left with nothing at all. That is not what
-- D-48 says. A coach who wrote twenty observations over two seasons keeps
-- **an anonymised count** — evidence they did the work, with no child in it.
--
-- Why a count and not the content: the family exercised erasure. Retaining a
-- coach's note about a named child after that would make the erasure a
-- fiction. Retaining "you authored 20 entries in 2026 at Riverside" is a fact
-- about the COACH, which is theirs, and carries no child at all.
--
-- Deliberately absent from this table: the record, the child, the entry text,
-- and any identifier that could be joined back to a person. A count, a club,
-- a season, and who did the writing.
-- ---------------------------------------------------------------------------
create table coach_authorship (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references person(id),
  club_id uuid references club(id),
  season text,
  entries int not null,
  erased_at timestamptz not null default now()
  -- No record_id. No person. No body. If a column here could identify the
  -- child, the erasure did not happen.
);
alter table coach_authorship enable row level security;

create function record_erasure_keeps_counts() returns trigger
language plpgsql as $$
begin
  -- One aggregate row per author, per club, at the moment of erasure.
  insert into coach_authorship (author_id, club_id, season, entries)
  select re.author_id,
         (select m.club_id from membership m
          where m.person_id = re.author_id and m.role in ('coach','technical_director')
          order by m.started_at limit 1),
         to_char(min(re.created_at), 'YYYY'),
         count(*)::int
  from record_entry re
  where re.record_id = old.id
    and re.author_id is not null
    and re.provenance = 'coach_verified'
  group by re.author_id;
  return old;
end $$;

create trigger record_erasure_keeps_counts
  before delete on development_record
  for each row execute function record_erasure_keeps_counts();

-- What a coach may read back. Their own counts, and nobody else's.
create function fn_my_authorship(p_person uuid)
returns table (club_id uuid, season text, entries int, erased_at timestamptz)
language sql stable as $$
  select ca.club_id, ca.season, ca.entries, ca.erased_at
  from coach_authorship ca
  where p_person is not null and ca.author_id = p_person
  order by ca.erased_at desc
$$;
