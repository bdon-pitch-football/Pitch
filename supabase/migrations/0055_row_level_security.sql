-- ---------------------------------------------------------------------------
-- 0055 — row-level security on the four tables created without it (release
-- seat, 22 Sep; LESSONS L26).
--
-- Locally nothing reads these from outside, so nothing was visibly wrong. On
-- Supabase the automatic REST API serves every table in the public schema to
-- anyone holding the project's anon key unless row-level security says
-- otherwise. We had written that the anon role gets nothing (D-80, D-94 §1)
-- and for these four it was false:
--
--   app_config          operational configuration
--   coach_invite        who a club is bringing in, and which teams (D-154)
--   register_grant      which coach reads which team's registrations
--   register_read_log   who opened a child's registration, and when (N22)
--
-- The last three are facts about named adults and about which children a club
-- is reading. There are no policies here on purpose: every read in the
-- product goes through the service role and a Postgres permission function
-- (D-80), so an enabled-and-policyless table is exactly right — it denies
-- everyone the API could ever be, and changes nothing for the product.
--
-- The rule from here (L26): every `create table` in a migration is followed
-- by `enable row level security` in the same file. The permission suite now
-- fails on any public table without it, so the rule is checked and not hoped.
-- ---------------------------------------------------------------------------
alter table app_config enable row level security;
alter table coach_invite enable row level security;
alter table register_grant enable row level security;
alter table register_read_log enable row level security;
