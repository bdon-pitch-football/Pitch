-- ---------------------------------------------------------------------------
-- 0023 — N15: a child's free-text field is not a channel.
--
-- The registration note is written by a child, read by a guardian, and then
-- read by a club. It is the one place in the product where a minor writes
-- something a stranger will read, and the app capped its LENGTH and nothing
-- else. A note reading "add me on <platform>, I'm @handle" or carrying a
-- phone number is a contact channel that walks straight past every control
-- in D-18 and D-19 — the whole architecture of "visible, never contactable"
-- defeated by a text box.
--
-- Rejected at WRITE, in the database, so it holds for the app, a future
-- import, a support tool and anything else that ever touches this column.
-- The same rule applies to a coaching-role application message, which is
-- adult-to-adult but lands in the same kind of box.
--
-- Deliberately NOT a cleverness contest with an adversary: this catches the
-- obvious and the accidental, which is what a 14-year-old writing their
-- phone number actually is. It is a guardrail, not a filter, and the
-- guardian reading the note before it goes anywhere remains the real
-- control (D-91).
-- ---------------------------------------------------------------------------
create function fn_text_is_channel(p_text text) returns boolean
language sql immutable as $$
  select p_text is not null and (
    -- a URL or a bare domain
    p_text ~* '(https?://|www\.)' or
    p_text ~* '\m[a-z0-9-]+\.(com|net|org|au|io|co|me|gg|tv)\M' or
    -- an email address
    p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+' or
    -- a phone number: eight or more digits, however they are spaced or
    -- punctuated, which is what defeats a naive \d{8} check
    (length(regexp_replace(p_text, '\D', '', 'g')) >= 8) or
    -- an @handle
    p_text ~ '(^|\s)@[A-Za-z0-9_]{3,}'
  )
$$;

create function registration_note_not_a_channel() returns trigger
language plpgsql as $$
begin
  if fn_text_is_channel(new.note) then
    raise exception 'a note cannot carry a link, an address or a number to call';
  end if;
  if length(coalesce(new.note, '')) > 140 then
    raise exception 'that note is too long';
  end if;
  return new;
end $$;

create trigger registration_note_not_a_channel
  before insert or update on registration
  for each row execute function registration_note_not_a_channel();

create trigger registration_request_note_not_a_channel
  before insert or update on registration_request
  for each row execute function registration_note_not_a_channel();
