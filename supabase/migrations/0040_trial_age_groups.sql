-- ---------------------------------------------------------------------------
-- 0040 — D-68 as amended 16 Sep: a trial names every age group it is for.
--
-- trial_notice.age_group held one code, so "U14 & U15 Boys" was findable
-- under only one of them. And a trial a CLUB posted never set it at all (the
-- post-a-trial form had no such field), so the board's day-one age filter
-- (D-74) could never match anything a club posted.
--
-- A notice now carries one or more age groups as rows, each pointing at the
-- age_group lookup (D-73: a lookup, never free text, never an enum — which is
-- why this is a table and not a text[]: an array element cannot carry a
-- foreign key). The old single column is folded in and dropped, so there is
-- one place the answer lives.
--
-- Age group and gender stay on the squad and the notice, never on a child
-- (D-25).
-- ---------------------------------------------------------------------------
create table trial_notice_age_group (
  trial_notice_id uuid not null references trial_notice(id) on delete cascade,
  age_group text not null references age_group(code),
  primary key (trial_notice_id, age_group)
);
alter table trial_notice_age_group enable row level security;

insert into trial_notice_age_group (trial_notice_id, age_group)
  select id, age_group from trial_notice where age_group is not null;

alter table trial_notice drop column age_group;
