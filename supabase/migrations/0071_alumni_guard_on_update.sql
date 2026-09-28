-- ---------------------------------------------------------------------------
-- 0071 — the alumni wall's "18 or over" guard holds on an edit too.
--
-- The wall is club-authored free text on a public page, and an entry never
-- names a person under 18 (CLAUDE.md, the D-74 reinstatement guardrail). 0051
-- made the database refuse an entry nobody had confirmed "Everyone named here
-- is 18 or over" — but only BEFORE INSERT. An UPDATE was never asked, so an
-- entry could be rewritten to say anything, and an entry that predates 0051
-- (no confirmation at all) could be edited and stay unconfirmed. The release
-- seat's migration-on-data run of 28 Sep printed both.
--
-- There is no product UPDATE path today (app/club/page-edit has add and
-- remove), so this is the belt, not a live hole: the guard now answers the
-- same question whichever way a row is written.
--
-- ONE KIND OF UPDATE IS LET THROUGH, and it is 0067's, not a new rule: an
-- erasure taking the erased person's name off an entry they added or
-- confirmed, with nothing else on the row different (fn_is_erasing_name). The
-- attribution goes, the confirmation's time stays, the entry stays — 0067's
-- "someone else's row the child merely signed" — and taking a name off makes
-- no entry less confirmed than it was. Without this the guard would make that
-- erasure raise, and a guardian's one-tap deletion would fail on an alumni
-- line (the permission suite's I1 found it, 28 Sep). Unreachable for a child
-- today (only a club's TD or administrator adds entries, and a minor can be
-- neither), and handled anyway, as 0067 handles it.
--
-- What this does NOT do: confirm, hide or delete the entries that predate
-- 0051. Whether an unconfirmed entry stays on a public wall is a product
-- decision about a public page and is reported to BUZ, not made here
-- (docs/team/RELEASE-PREFLIGHT.md). After this migration such an entry cannot
-- be edited until someone confirms it; it can still be removed, which the
-- club page's editor already offers.
-- ---------------------------------------------------------------------------
create function alumni_entry_stays_confirmed() returns trigger
language plpgsql as $$
begin
  if fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'adults_confirmed_by')
     or fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'added_by') then
    return new;
  end if;
  if new.adults_confirmed_by is null or new.adults_confirmed_at is null then
    raise exception 'an alumni entry needs "Everyone named here is 18 or over" confirmed';
  end if;
  return new;
end $$;

create trigger alumni_entry_adults_confirmed_on_update before update on alumni_entry
  for each row execute function alumni_entry_stays_confirmed();
