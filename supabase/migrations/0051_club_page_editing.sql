-- ---------------------------------------------------------------------------
-- 0051 — a club edits its own page (BUZ, 19 Sep).
--
-- The philosophy, pathway line, year founded, players-wanted notices and the
-- alumni wall were read by the public page and written by nothing: only the
-- dev seed ever filled them. The club's technical director or administrator
-- now edits them from "Crest & club page".
--
-- The alumni wall is club-authored free text on a public page, and an entry
-- never names a person under 18 (the D-74 reinstatement guardrail). We cannot
-- check an age, so every entry carries the person who confirmed "Everyone
-- named here is 18 or over", and when. An entry without that confirmation
-- cannot be written — the database refuses it, not just the form.
-- ---------------------------------------------------------------------------
alter table alumni_entry
  add column created_at timestamptz not null default now(),
  add column added_by uuid references person(id),
  add column adults_confirmed_by uuid references person(id),
  add column adults_confirmed_at timestamptz;

create function alumni_entry_needs_adults_confirmed() returns trigger
language plpgsql as $$
begin
  if new.adults_confirmed_by is null or new.adults_confirmed_at is null then
    raise exception 'an alumni entry needs "Everyone named here is 18 or over" confirmed';
  end if;
  return new;
end $$;
create trigger alumni_entry_adults_confirmed before insert on alumni_entry
  for each row execute function alumni_entry_needs_adults_confirmed();

alter table players_wanted_notice add column added_by uuid references person(id);

-- The same caps the form holds, so a request that skips the form hits a wall.
alter table club
  add constraint club_philosophy_len check (philosophy is null or char_length(philosophy) <= 400),
  add constraint club_pathway_len check (pathway_line is null or char_length(pathway_line) <= 80),
  add constraint club_established_year check (established is null or established ~ '^(18|19|20)[0-9]{2}$');
alter table players_wanted_notice
  add constraint wanted_title_len check (char_length(title) between 1 and 60),
  add constraint wanted_detail_len check (detail is null or char_length(detail) <= 100);
alter table alumni_entry
  add constraint alumni_line_len check (char_length(line) between 1 and 80),
  add constraint alumni_detail_len check (detail is null or char_length(detail) <= 80);
