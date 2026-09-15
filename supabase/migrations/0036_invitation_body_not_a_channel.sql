-- ---------------------------------------------------------------------------
-- 0036 — doc 32 B5a / doc 14 P20: an invitation's message is not a channel.
--
-- D-153 gave an under-16 a read path to free text an adult at a club writes,
-- at the same moment their parent reads it. The child's own registration note
-- has been rejected at write since 0023 when it carries a link, an address or
-- a number to call (N15). The adult's inbound message was not checked at all.
-- John: "the channel running from the child outward is filtered; the channel
-- running from an adult inward is not. That is backwards."
--
-- The same validator, called from a second place. Club verification does not
-- close this: it checks an organisation, not a message, and the person
-- writing an invitation is not the person who answered the verification call.
--
-- The app stores the message inside a small JSON object ({kind, note}); older
-- rows and hand-written inserts carry plain text. Both are checked.
-- ---------------------------------------------------------------------------
create function invitation_body_not_a_channel() returns trigger
language plpgsql as $$
declare v_text text;
begin
  v_text := case
    when left(ltrim(coalesce(new.body, '')), 1) = '{' then new.body::jsonb ->> 'note'
    else new.body
  end;
  if fn_text_is_channel(v_text) then
    raise exception 'an invitation cannot carry a link, an address or a number to call';
  end if;
  if length(coalesce(v_text, '')) > 400 then
    raise exception 'that invitation is too long';
  end if;
  return new;
end $$;

create trigger invitation_body_not_a_channel
  before insert or update on invitation
  for each row execute function invitation_body_not_a_channel();
