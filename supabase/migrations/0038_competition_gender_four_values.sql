-- ---------------------------------------------------------------------------
-- 0038 — D-68 as amended 15 Sep: competition gender is boys, girls, men or
-- women. Nothing else.
--
-- BUZ removed "mixed" and "open". A MiniRoos squad picks boys or girls; a
-- trial open to everyone leaves gender blank and shows under "All". The rule
-- that gender lives on the squad and the trial notice, never on a child
-- (D-25), is unchanged.
--
-- Existing data: "open" squads are senior men's squads in every fixture and
-- become men. "Mixed" squads and trials become blank for the club to re-pick,
-- because guessing boys or girls for them would be inventing a fact.
-- ---------------------------------------------------------------------------
update squad set competition_gender = 'men' where competition_gender = 'open';
update squad set competition_gender = null where competition_gender = 'mixed';
update trial_notice set competition_gender = case competition_gender when 'open' then 'men' else null end
  where competition_gender in ('mixed', 'open');

alter table squad drop constraint if exists squad_competition_gender_check;
alter table squad add constraint squad_competition_gender_check
  check (competition_gender in ('boys', 'girls', 'men', 'women'));

alter table trial_notice drop constraint if exists trial_notice_competition_gender_check;
alter table trial_notice add constraint trial_notice_competition_gender_check
  check (competition_gender in ('boys', 'girls', 'men', 'women'));
