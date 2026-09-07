-- ---------------------------------------------------------------------------
-- 0018 — a club page that looks like a club: a banner, and club video.
--
-- BANNER. One nullable column. Unlike a crest, a banner IS meant to be
-- cropped wide, so the upload route uses `cover` where the crest uses
-- `contain`.
--
-- VIDEO. A LINK, never a file. The video stays on YouTube or Veo and Pitch
-- stores a URL, exactly as player highlights do — we render a click-to-play
-- façade (D-97) and nothing reaches a third party until a viewer presses
-- play. This is deliberately NOT the hosting question, which is parked.
--
-- The guardrail is the alumni wall's, because it is the same hazard: this is
-- club-authored free text and links on a public page, and a public page is a
-- pillar-zero surface. A club admin pasting a link is not a child's guardian
-- consenting. So a caption may not name a person under 18 — the club talks
-- about the club, and named entries are 18+ only.
--
-- The honest limit, stated here so nobody later assumes otherwise: we can
-- police the caption we store, not the footage inside somebody else's video.
-- That is the same limit the alumni wall carries.
-- ---------------------------------------------------------------------------
alter table club add column banner_path text;

create table club_video (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id) on delete cascade,
  url text not null,             -- host-allowlisted in the app layer, façade-rendered
  title text not null,           -- hostile free text: escaped on output, never HTML
  sort int not null default 0,
  added_by uuid references person(id),
  created_at timestamptz not null default now()
);
alter table club_video enable row level security;
