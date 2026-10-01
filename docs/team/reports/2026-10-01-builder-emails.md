# builder: transactional email and SMS, spec K (1 Oct 2026)

Asked: build spec K (BUZ, 1 Oct, "Yes to all four"). Part 1 is the defects: §33's link, §22 and §39 matching doc 15, E7 hyphens in SMS, and E8 `https://`. Part 2 is the multipart HTML template (E1, E3, E9), with E4 done only as "no button drawn". Presentation only. Branch `build/emails`, off `app` at fd18c82.

Did:
- `lib/email-html.ts` (new) does two things.
  - `withScheme()` adds E8's `https://` to every `pitchfootball.com.au` link in the text part. SMS never comes through here.
  - `renderEmail(key, subject, body)` returns `{text, html}`, with the HTML drawn FROM the text:
    - paragraphs split on blank lines;
    - a `Label: https://…` line becomes a button only if doc 15 draws that label for that key (`BUTTONS`), so a stranger's typed §6 name or role can never become a button;
    - `- ` lines become a list; §34's code and §20's `It goes to:` become wells;
    - the last `— Pitch` stays in the panel, and the lines after it (the site line, §19's opt-out) go to the footer, in the same order. It is the last one so typed words can't move into the footer;
    - doc 15's bold comes from a `BOLD` list that can wrap existing words and never change one;
    - preview line: doc 15's preheader for §2, each email's own opening sentence otherwise;
    - one green button for one action; plain buttons on the equal-weight keys (§5, §6, §13, §20, §22, §23).
  - Dark Night Match, table layout, inline CSS, palette tokens from `lib/palette.ts`. The wordmark is live type. No image, SVG, web font, script, `url(` or tracking. Every href is our domain or the support mailto, exactly as printed. Every value is HTML-escaped.
- `lib/messaging.ts`: `dispatch()` renders both parts from the row's own `(key, subject, body)` at send time. The outbox still stores doc 15's words, and a retried row renders the same. Who gets what, and when, is unchanged.
- `lib/providers.ts`:
  - `sendEmail(…, text, replyTo, html)` sends `{from, to, subject, text, html}` and nothing else.
  - New `fromHeader()` sends the name "Pitch Football" on EMAIL_FROM's address (E3), whatever name the env carries.
  - The comment at :36 now records BUZ's 1 Oct decision: multipart, text canonical. It also says tracking is a domain setting.
  - `./demo` became `./demo.ts` so the suite can import the real adapter.
- `lib/messages.ts`:
  - §33 gets `Change your password: …/reset` as its own line inside doc 15's sentence. Joined, the three lines are doc 15's sentence.
  - §22's merged line becomes doc 15's two buttons, both to `/g/controls/{child}`, where the sent list and the switch both live.
  - E7: hyphens in §3, §15 STOP and §15 HELP.
  - §34's comment no longer says "plain-text email".
- `docs/15-Message-Copy.md`:
  - E7 recorded under §3 and §15, with their quoted texts hyphenated.
  - Rule 9 gives the sender as "Pitch Football".
  - New rule 12: multipart, text canonical, `https://`, the button rule, no image, tracking, crest or colours. It leaves E4's words to John.
- `docs/team/GO-LIVE.md`: a row saying Resend open and click tracking must be OFF on the domain before HTML sends, plus the From-name note.
- `.env.example`: a comment that only EMAIL_FROM's address is read.
- `scripts/permission-tests.mjs`: 34 `em-*` checks. They compose every catalogue builder for real, 40 builders: 33 emails and 7 texts.

Ran (fresh seed, DB 54519, app 3319, CDP 9519, see Found):
- perms 2054/2054 (was 2020; +34 em-*), run twice, the second after the last doc edit;
- render 702/702 · write 566/566 · reseed + restarted dev · layout 250 views at 375/1280, ALL GREEN, 0 overflow;
- tsc clean · build:check (`.next-check`) exit 0 · csp-prod 5/5;
- palette 0 FAIL · corpus 0 failures · secret-scan clean · gate-coverage 263/263.

Each em- check was proven against the bug put back (L20), and all reverted:
- §33 without its link: em-§33 and em-green-c fail;
- §22's merged line: em-text, em-§22, em-§22b and em-green-b fail;
- a dash in §3: em-sms fails;
- a renderer that changes one word: em-text fails;
- an `<img>`: em-clean fails;
- every button green: em-green, em-E4 and em-§22b fail;
- no escaping: em-escape fails;
- text/plain only: em-payload fails;
- no E8: em-https plus 5 more fail;
- "Let it expire" as a button: em-E4 fails;
- the From name taken from the env: em-from and em-payload fail;
- the old footer link regex: em-footer fails;
- no break-all: em-wrap fails;
- the first sign-off instead of the last: em-escape-b fails.

Found:
1. **Ports 54511, 3311 and 9511 were taken** by the `full-release` worktree's dev-db, next-server and Chrome (L30). I used 54519, 3319 and 9519. I touched none of theirs.
2. **§39 v1.4 is NOT applied here.** I tried to apply `build/copy-fixes`' two hunks (doc 15 §39 line + footer, and `lib/messages.ts` §39) with `git diff … | git apply`. The permission system refused, and I did not route around it. On this branch doc 15 v1.3 and the code agree ("turn it off"). `copy-fixes` changes only those lines, which this branch does not touch, so its merge should apply cleanly. The §39 render shows the v1.3 line.
3. **Resend tracking cannot be checked from code.** It is a domain setting. With open tracking on, the new HTML part would carry a pixel. **BUZ must confirm both switches are OFF before this deploys** (GO-LIVE row). K §10.7's screenshot and raw-source check need his account.
4. Doc 15 §5's and §23's notes ("a real button, weighted equally") now differ from the HTML, which draws no button for "Let it expire" (E4). Rule 12 leaves this to John.
5. Defects not in my brief, left alone:
   - §6 has no "Share a new link" link (doc 15: `[Share a new link] · [Ignore]`);
   - §20 has no "Not this one";
   - the SMS meter books a flat 8c per text, so the cap undercounts §1 (3 segments) about 3×;
   - doc 15 §22's example is gendered ("his"), which D-25 forbids the product to write. The code says the name or "their".
6. Not built:
   - R2/R3 footer lines (site and contact line, and the EBSD/ABN line on every email). They were not in the brief and the spec lists them as "confirm". The footer carries only what each message already has.
   - `/dev/outbox` HTML preview: two write tests scrape that page for codes (L32).
7. **§19 vs doc 15, for John (words unchanged):**
   - (a) A 16–17 or adult sender opens "{Name} has sent you their football CV."; doc 15 has the family line only.
   - (b) The player line is "{Name} plays {positions}, currently at {club}.". The clause goes with no club, and the line goes with no positions.
   - (c) Control paragraph: two variants doc 15 lacks.
     - 16–17: "{Name} and their family control it — they can pause or replace it at any time, and it expires on its own. If it stops working, that is normal and it is their choice, not a fault."
     - Adult: "{Name} controls it — they can switch it off or replace it at any time, and it expires on its own. If it stops working, that is their choice, not a fault."
   - (d) Adult reply line: "Replies to this message do not reach {Name}. Pitch does not pass messages on." It has no trial paragraph.
   - (e) Trial paragraph. The app says "If you want {Name} at a trial, post it on Pitch. Families register their interest from your trial, and that is where you can invite them — it goes to {Name} and their parent together, and a record is kept." Doc 15 says "If you want Deniz at a trial, post it on Pitch or send an invitation through their guardian. Both go to the parent, and both keep a record."
   - (f) Doc 15's Never-list bans "the word 'trial'", which its own body uses.
8. **§21 vs doc 15, for John (words unchanged):**
   - Doc 15's third paragraph is "If anyone from the club writes back, it comes to you and your parent together." It has been untrue since U-11.
   - The app sends one of three band lines:
     - under 16: "The club can't reply to the email it got. If it wants to talk to you, it has to ask through Pitch, and it comes to you and your parent together."
     - 16–17: "… it has to ask through Pitch — it comes to you, and your parent is told."
     - adult: "… it has to ask through Pitch."
9. **E4 lines for John** (kept in the text, drawn as no button):
   - `lib/messages.ts:754` (§5) and `:773` (§23): "Let it expire: there's nothing to do.", which is not in doc 15;
   - doc 15 §5 (:150) and §23 (:491): `[Let it expire]`, plus their equal-weight notes (:156, §23 note);
   - doc 15 §6 (:170): `[Ignore]`. Not in the code.

Copy for BUZ (verbatim; every new or changed string a person receives):
- §3 SMS: "Pitch: {Name}'s football profile is still waiting on your OK. It'll be deleted in 4 days if you don't approve it - nothing will be kept." / "pitchfootball.com.au/a/{code} - burak.donmez@pitch-football.com"
- §15 STOP: "Pitch: you're unsubscribed and we won't text this number again. If you were mid-way through approving a child's profile, that will now stop too - reply START or email burak.donmez@pitch-football.com if that wasn't what you meant."
- §15 HELP: "Pitch - a football development platform. You're getting this because someone asked you to approve a child's profile, or you asked us for a code. Reply STOP to opt out. burak.donmez@pitch-football.com - pitchfootball.com.au"
- §22: "See what they sent: pitchfootball.com.au/g/controls/{id}" and "Turn sending off: pitchfootball.com.au/g/controls/{id}". These replace "See what they sent, or turn sending off: …".
- §33: "If it wasn't:" / "Change your password: pitchfootball.com.au/reset" / "— that signs out everywhere, on every device, straight away."
- Every email's text part: `https://` before every pitchfootball.com.au address (E8).
- From name: "Pitch Football" (E3).
- HTML only, no new words, but new presentation:
  - the "PITCH" wordmark as type;
  - a "•" bullet for each "- ";
  - button labels without their colon;
  - §20's "It goes to:" shown in capitals by CSS;
  - each email's opening sentence repeated as the hidden inbox preview line (R1). §2's is doc 15's preheader "Nothing goes live until you say so."
- Doc 15 rule 9 and rule 12, and the E7 notes under §3 and §15 (doc text, not message text).

Risks:
- Not checked in any real mail client (K §10.9 needs BUZ's accounts): Gmail and iOS dark mode, Outlook pictures off. The five renders were checked in headless Chrome at 390 and 640 only. They are in `docs/design/reports/2026-10-01-email-renders/` (untracked), as `.html` and `.txt`.
- Addresses under buttons show `https://`, unlike the mockup, so the HTML text equals the text part exactly.
- The `BOLD` and `BUTTONS` lists are second copies of doc 15. em-bold and em-text fail when they drift from the messages, but not when doc 15 adds emphasis.
- Production sends HTML on deploy. Finding 3 must be done first.

Lesson: when two seats share a machine, read `lsof` on your assigned ports before starting anything. An assignment is not a reservation, and starting on a taken port means attaching to someone else's run (L30).
