-- ---------------------------------------------------------------------------
-- 0162 — a club's page address keeps its letters (BUZ, 30 Sep: "should be
-- Derzelez").
--
-- fn_club_slug_for (0130) kept a-z and 0-9 and dropped everything else, so
-- "Balmoral FC (Đerzelez)" became /fc/balmoral-fc-erzelez — the Đ simply
-- vanished. Names like it are common in Victorian and NSW football. Letters
-- are now folded to their plain form first (Đ→D, é→e, ø→o, ß→ss …), then the
-- old rule runs unchanged.
--
-- An address already given out keeps working: the old slug is kept in
-- club_slug_former and /fc/<old> answers with a permanent redirect. Only
-- unclaimed listings are moved here (all of them today); a claimed club's
-- address is the club's to change.
-- ---------------------------------------------------------------------------

create table club_slug_former (
  slug text primary key,
  club_id uuid not null references club(id) on delete cascade,
  retired_at timestamptz not null default now()
);
alter table club_slug_former enable row level security;

-- Plain letters for an address: decompose, drop the accents, and spell out
-- the letters that do not decompose.
create function fn_slug_fold(p text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(
           translate(regexp_replace(normalize(coalesce(p, ''), NFD), '[̀-ͯ]', '', 'g'),
                     'ĐđÐðŁłØøĦħıŦŧ', 'DdDdLlOoHhiTt'),
           'ß', 'ss'), 'Æ', 'Ae'), 'æ', 'ae'), 'Œ', 'Oe'), 'œ', 'oe'), 'Þ', 'Th');
$$;

create or replace function fn_club_slug_for(p_name text, p_except uuid) returns text
language plpgsql stable as $$
declare v_base text; v_try text; n int := 1;
begin
  v_base := btrim(regexp_replace(lower(replace(fn_slug_fold(p_name), '&', ' and ')), '[^a-z0-9]+', '-', 'g'), '-');
  v_base := rtrim(left(v_base, 60), '-');
  if v_base = '' then v_base := 'club'; end if;
  v_try := v_base;
  while exists (select 1 from club where public_slug = v_try and id is distinct from p_except)
     or exists (select 1 from club_slug_former where slug = v_try and club_id is distinct from p_except) loop
    n := n + 1;
    v_try := v_base || '-' || n;
  end loop;
  return v_try;
end $$;

-- Move today's unclaimed listings whose letters were dropped.
do $$
declare r record; v_new text;
begin
  for r in select id, name, public_slug from club
           where club_state = 'unclaimed' and name ~ '[^\x01-\x7f]' loop
    v_new := fn_club_slug_for(r.name, r.id);
    if v_new is distinct from r.public_slug then
      insert into club_slug_former (slug, club_id) values (r.public_slug, r.id) on conflict (slug) do nothing;
      update club set public_slug = v_new where id = r.id;
    end if;
  end loop;
end $$;

create function fn_club_slug_now(p_slug text) returns text
language sql stable as $$
  select c.public_slug from club_slug_former f join club c on c.id = f.club_id where f.slug = p_slug;
$$;
