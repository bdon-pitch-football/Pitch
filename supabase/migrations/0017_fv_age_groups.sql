-- ---------------------------------------------------------------------------
-- 0017 — the full age range a club might actually run, MiniRoos to U23
-- (BUZ, 7 Sep).
--
-- D-73 said age groups are a lookup table and never an enum. This is the
-- migration that pays for that: the range widens by rows, not by a schema
-- change and not by a deploy-shaped panic when a club says "we take U6s".
--
-- The decision here is that PITCH DOES NOT PRESCRIBE the competition
-- structure. A club sets up the squads it actually runs and the register
-- groups by those; we do not model whose pathway is whose. That matters more
-- than it looks, because the structures genuinely disagree with each other —
-- Football Victoria's 2026 advanced junior competitions run U13/U14/U15/U16/
-- U18 for boys but U13/U15/U17 for girls, so a single prescribed list would
-- be wrong for one of them on day one, and wrong again the next time FV
-- restructures. Letting the club say it is the only version that survives
-- contact with a second state, a second season, or a summer futsal comp.
--
-- `stage` exists so a picker can group the list rather than showing a club
-- president twenty-two undifferentiated chips. MiniRoos is Football
-- Australia's own name for the small-sided game, so it is the word a club
-- uses, not one we coined.
-- ---------------------------------------------------------------------------
alter table age_group add column stage text
  check (stage in ('miniroos','junior','youth','senior'));

insert into age_group (code, label, sort) values
  ('U5','Under 5s',5), ('U6','Under 6s',6), ('U7','Under 7s',7),
  ('U19','Under 19s',19), ('U20','Under 20s',20), ('U21','Under 21s',21),
  ('U23','Under 23s',23)
on conflict (code) do nothing;

-- MiniRoos is U5-U11 (Football Australia's small-sided format), juniors run
-- U12-U18, and U19-U23 are the youth/reserve grades above them.
update age_group set stage = case
  when sort between 5 and 11 then 'miniroos'
  when sort between 12 and 18 then 'junior'
  when sort between 19 and 23 then 'youth'
  else 'senior'
end;

alter table age_group alter column stage set not null;
