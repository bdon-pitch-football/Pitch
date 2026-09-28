-- ---------------------------------------------------------------------------
-- 0076 — `email_opened` leaves the consent vocabulary (BUZ, 28 Sep,
-- docs/team/APPROVALS-28-SEP.md; D-78 as it now stands).
--
-- WHY. The only thing that can write "you opened that email" is an open-
-- tracking pixel in a message to a parent about their own child. That is
-- surveillance, doc 14 J41 refuses the same thing for share links, and the
-- Resend webhook has declined `opened` on purpose since it was built. So the
-- word sat in the vocabulary with no writer, and the guardian's log carried a
-- line — "You opened that email" — that nothing could ever make true. The
-- webhooks builder proposed removing both (report, 28 Sep, Found 1); BUZ
-- approved it. The label goes from the controls page in the same change.
--
-- HOW, AND WHY IT IS NOT A RESTATED LIST. The CHECK has been rewritten three
-- times (0002, 0033, 0052), each by restating every word. Another migration in
-- this range may add a word of its own; restating the list here would quietly
-- drop it. So this reads the constraint the database actually holds, removes
-- the one word, and puts the rest back exactly as they were. It refuses loudly
-- if the constraint or the word is not where it expects — a migration that
-- silently does nothing is how a promise stays on a screen.
--
-- Nothing in the product has ever written the word, so no existing row can
-- violate the narrower check. If one ever did, adding the constraint fails and
-- the migration stops: consent_event is append-only (D-19/D-26), and deleting
-- a row to make a migration pass is not available.
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'consent_event'::regclass and c.conname = 'consent_event_event_check';
  if v_def is null then
    raise exception '0076: consent_event_event_check was not found';
  end if;
  v_new := regexp_replace(v_def, '''email_opened''::text,\s*', '');
  if v_new = v_def then
    raise exception '0076: email_opened is not in the consent vocabulary: %', v_def;
  end if;
  execute 'alter table consent_event drop constraint consent_event_event_check';
  execute 'alter table consent_event add constraint consent_event_event_check ' || v_new;
end $$;
