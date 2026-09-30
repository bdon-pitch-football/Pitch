# builder: Send my CV follow-up — Leo's rulings 1, 3, 4, 6 (30 Sep 2026)
Asked: build four of Leo's rulings on my first report (items 2 and 5 stay as they are):
- 1 · fill in the address only for unclaimed clubs;
- 3 · the club's opt-out must survive the family erasing the child;
- 4 · a valid signature is never rate-limited;
- 6 · a validation error keeps the club filled in.

Did (commit c2622dc on `app`, not pushed):
- `supabase/migrations/0161_a_clubs_stop_outlives_the_send.sql`
  - `fn_send_address_for_club` offers an address only when `club_state = 'unclaimed'`. Claimed and verified clubs still get their name, and `blocked` still applies to them.
  - New table `send_stop_ref (id uuid primary key, address text not null, created_at)`. The id is the share_request id. There is no foreign key to anything, RLS is on, and it has no policies.
  - It is written by an AFTER trigger on `share_request` when `dispatched_at` is first set, so every sending path writes it.
  - It is backfilled for sends already dispatched, so emails already out can still opt out.
  - `fn_send_stop_request` now reads the reference, not the request. A request that was never sent has no reference and stops nothing.
- `app/stop-cvs/actions.ts`: a valid signature always goes to `fn_send_stop_request` and is never counted. Only a failed signature calls `checkRate` (20 per hour per IP). Both land on the same done screen.
- `app/send/[recordId]/page.tsx` and `actions.ts`: a hidden `club` field carries the slug. A validation error redirects to `?error=1&club={slug}`, so the club and its address are filled in again.
- `lib/send-dispatch.ts`: comment only. The link's id is also the stop reference.
- Tests
  - perms:
    - sc-14b: an unsent request leaves no reference; a sent one leaves exactly its address.
    - sc-19: a claimed and a verified club get their name and no address.
    - sc-20: a parent sends, then erases the child; the request is gone and the stop still blocks, through the real trigger and `fn_erase_child`.
    - sc-21: the stop reference has RLS on and no policies.
    - erase8 and erase8b, in the erasure block: a `RETAINED` list names `send_stop_ref` with its reason, checks it holds only id, address and created_at with no foreign key, and that the stop works after the full erasure.
    - sc-s4 rewritten: the valid branch holds `fn_send_stop_request`; `checkRate` appears once, only in the else branch.
  - render:
    - sc-r11: Kingsway (verified, role address) gets its name and no address.
    - sc-r12: `?error=1&club=` shows the error, the address filled in, and the hidden club field.
  - write:
    - sc-w1b: a mistyped address comes back with `&club=` and the fill-in.
    - sc-w9: 20 valid presses from one IP, then a 21st valid press for a new send, still stops that address.

Ran (fresh seed, app on 3280, on 7ea3c1e + this change):
- perms 1948/1948
- render 660/660
- write 519/519
- layout 238 views at 375 and 1280, 0 overflow
- tsc clean
- build:check ok
- csp-prod 5/5
- corpus clean
- secret-scan clean
- gate 263/263
- palette green

Each new check failed on the behaviour it replaces:
- with the fill-in unrestricted and the stop reading `share_request`, sc-14b, sc-19, sc-20 and erase8b fail;
- with the old action, sc-s4 fails;
- with every POST counted, sc-w9 fails: the 21st press lands, and the next send still goes (`?sent=1`).

Found:
1. **Doc 23 needs rows (John's to write).**
   - `send_stop_ref`: the address a CV was sent to, and when, keyed by the send. It is kept for as long as the CV email can exist, so indefinitely unless John sets a period. It holds no child, record, sender or content.
   - `send_block`: stopped addresses and domains, also kept indefinitely.
   - Doc 23 line 165 says that once a record is deleted "that is all that remains anywhere in Pitch, other than a coach's anonymised count". That is now stale. The stop reference's id is also in the consent log's `share_dispatched` row, which already holds the recipient, so the pair adds nothing about the child the log does not already hold.
2. **The stop reference holds whatever address the CV went to**, not only a club's role address. A family can type a coach's personal address, and it is kept after the child is erased. It is a person's address about an adult, not a child's data, but John should know it is there when he writes the doc 23 row.
3. The sc-w9 test itself had a bug on its first run: it posted without the form's action id, so nothing was pressed. It was fixed before the proof run. I re-ran the old-code proof after the fix.

Copy for BUZ: none. No new words. Item 6 reuses the existing error line and the approved fill-in line.

Risks:
- The backfill runs against production's existing dispatched sends. I did not check it against a production-shaped database: it is a straight insert-select with `on conflict do nothing`.
- `x-forwarded-for` is taken as the client IP, as the other endpoints do. It only affects failed-signature counting now.

Lesson: a write test that builds a form post by hand must start from `form.fields`. The hidden action id is in there, and a POST without it answers with no redirect. That looks like "the action refused" and is really "nothing was called" (the same trap as L10).
