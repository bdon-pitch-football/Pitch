# builder: final E — what the walkthrough rehearsal found (29 Sept 2026)

**Tree:** `.claude/worktrees/builder-final-e`, branch `builder-final-e`, cut from `app` at `44c7444`. `app` did not move during the round.
**Measured on:** the working tree that became `1c999fc`. The only change after measuring was one word in a code comment in `app/join/page.tsx` ("unlabelled" became "bare"), and tsc was re-run after it. Every suite ran from a fresh seed in TRAINING §4 order.
**Ports:** database 54422, app 3220, Chrome CDP 9423. I stopped everything by port only. Dev-server and suite logs went to `.scratch/` inside my tree (untracked).
**Migrations:** none.
**Machine:**
* Load was 4.5–8.4 on 14 cores.
* The first timing run started at a load of 6.1, and the load reached 8.07 during it. That run's J61 came back inconclusive, so I reran the whole suite on a fresh seed and a fresh app at a load of 6.2 (see Ran).
* Free disk went from 18 GiB to 11–13 GiB during the round. My tree's share of that was a `.next` and a `.next-check`; the rest was used elsewhere on the machine. Both are now deleted, and `node_modules` is back to its symlink. The runs used a `cp -al` hard-link copy.

Asked: brief E, six fixes from the rehearsal. They are: Continue with no date of birth does nothing; the role chips have no accessible name; "Somewhere else" has no way back; "1 clubs awaiting a call"; "Sunbury United" in the fixtures; the front door is client-rendered. Each needs a check proven red. No new copy.

## Did

### 1 · `/join`: Continue is never silent (`app/join/page.tsx`)
* No approved words exist for a missing field (I searched `app/`, `components/` and doc 15). So the fallback the brief allows is built, and our own words are held (see Copy for BUZ).
* The fields, the tick and Continue sit in a `<form>` that posts nowhere. It uses `display: contents`, so the column's spacing is unchanged.
* The fields carry `required`: the first name (with `pattern=".*\S.*"`, so a name made only of spaces is refused), the date of birth and the tick.
* Continue is `type="submit"`. Pressing it with anything missing gives the browser's own prompt on the first missing field. When the form is complete, it moves on exactly as before (under 16 to the parent step, otherwise to the account step).
* Continue stays **disabled** only when the door itself is closed: parent, or coach or club under 18. Each of those already shows its amber note saying why.
* The button looks the same as before (45% until complete). Only the cursor changed, and it now says the button can be pressed.

### 2 · `/join`: the role chips are named what they show
* Each chip has `aria-labelledby` pointing at its title and `aria-describedby` pointing at its line underneath.
* Chrome's accessibility tree now reads the names as "Player", "Coach", "Parent / Guardian" and "Club". The sub-lines are kept as descriptions rather than lost, which would have happened with `aria-label`.
* The chips also became `type="button"`, because they now sit next to a form.

### 3 · `/join`: "Somewhere else" has the product's own way back
* The screen's icon-only arrow is replaced by `HeaderMark back={{ href: '/join' }}`, the product's back affordance: an arrow plus the word "Back", top left, 44px.
* It is a link to `/join`, which opens on the country question. It works before any script has run. Nothing is lost, because this screen asks for nothing.
* The static check ctry2 (no field, form or request on that screen) is still green.

### 4 · `/ops/verification`: the count line (`app/ops/verification/page.tsx:57`)
* It now reads `1 club awaiting a call` and `1 registration held`, and uses the plural for any other number.
* The second half of the line ("registrations held") had the same fault, so I fixed it in the same edit.

### 5 · The fixture club named after a real suburb (L15)
* "Sunbury United" (suburb "Sunbury") is now **"Quarrymead United"** (suburb "Quarrymead", VIC). The name is invented, in the same style as the seed's existing "Tarrowvale City FC".
* Its address is `football@quarrymeadunited.example.au`, and its administrator signs in as `quarrymead@example.com` (was `sunbury@example.com`).
* Changed in: `scripts/dev-db.mts`, `scripts/demo-layer.mts` (`CURRENT`, `PREVIOUS`, and the unverified-club block), `app/demo/seats.ts`, `scripts/migration-on-data.mjs`, and every suite's expectations and comments (perms, render, write, timing).
* `docs/team/LESSONS.md` L15: the approved-name list now says Quarrymead United, with a dated amendment that a fixture club is never named after a real suburb either.
* **Not changed, on purpose.**
  * 8 signed design files still say Sunbury United. They are not mine to edit: `design-screens/GuardianHome`, `MyCVAdult`, `MyInterests`, `OpsCall`, `OpsVerification`, `TrialsIndex` and `TrialsIndexAdult` (all `.dc.html`), plus `walk-the-pitch.html`.
  * Six historical reports are a record of what happened: `docs/design/reports/` 09-23, 09-24 and 09-28, and `docs/team/reports/` 09-23-demo-td, 09-28-td-wall and 09-29-final-d.
  * The brief itself.
* Leo: the demo on 3030 still has the old seed until it is restarted (L14). Its "held" seat now signs in as `quarrymead@example.com`.

### 6 · The front door, `/` with the switch on: already server-rendered; now pinned
**This did not reproduce at `44c7444`.** With the switch on, `/` served "Somebody should be writing this down." as an `<h1>`, and the four doors as `<a href="/?for=…">` with their titles as text. I checked five ways:
* `next dev`, with curl, as Chrome, curl, iPhone Safari and Googlebot user agents;
* headless Chrome with JavaScript disabled;
* a production build under `next start`.

The existing checks fd1, fd2 and fd2b already read markup with the scripts stripped. When I wrapped the front door in a client-only component, all three went red. So the suite had been pinning server rendering all along.

No product change was needed. I added fd5 (below) so the guarantee is stated as the brief words it. If Leo saw an empty page, the likeliest cause I found is Found 1, which is a different fault.

## Checks added, each proven red with its bug put back

| Check | Suite | Red with | Result |
|---|---|---|---|
| **j1** Continue with a name and the tick but no date of birth either moves on or makes the browser flag the date. It is pressed with a real `Input.dispatchMouseEvent`, and the browser's `invalid` event is recorded. **j1b** Filled in (adult), it lands on "Your account". | layout pass, 390 and 1280 | old `page.tsx` | j1 FAIL at both widths: "did nothing — no step, and the browser flagged nothing". j1b passed on the old code, as it should. |
| **j2** The four chips' names, read from Chrome's accessibility tree (`Accessibility.getPartialAXTree` on each chip's own node), equal `["Player","Coach","Parent / Guardian","Club"]`. | layout pass | old `page.tsx` | FAIL at both widths: the names were "Player Build your football CV" and so on. |
| **j3** "Somewhere else" has a visible control reading "Back", at least 44px tall. Pressing it lands on "Where do you live?". | layout pass | old `page.tsx` | FAIL at both widths: "no way back a person can see". |
| **ops-r1** The queue's count line agrees with both of its numbers. | render | old `ops/verification/page.tsx` | FAIL: "1 clubs awaiting a call · 4 registrations held". |
| **fd5** With the switch on, `/` serves its `<h1>` and the four doors (player, parent, coach, club) as HTML text with every script removed, to a browser and to Googlebot. | render | front door wrapped in a client-only component (temporary file, deleted) | FAIL: `["",false,false,false,false]` for both. fd1, fd2 and fd2b failed too. |
| **fx1** No seed, demo, suite, demo script, demo doc or L15's name list contains the old name. 234 files are read, and the name is assembled in code so the check does not trip on itself. | perms | the old name put back into `demo-layer.mts` `CURRENT` | FAIL: "still there: scripts/demo-layer.mts". |

## Ran

All on my ports. Fresh seed, then perms, then render, then write; reseed, then layout, then timing; reseed.

* **perms 1650/1650.** 1649 before, plus fx1.
* **render 573/573.** 571 before, plus ops-r1 and fd5.
* **write 397/397.**
* **layout `375 1280`: ALL GREEN.** 206 page views (8 of them failure-path views), 22 controls tabbed to, and 8 presses in the new join pass. It took 1:42.
* **timing 19/19** on the second run.
  * The first run was 18 passed, with J61 "INCONCLUSIVE": the load reached 8.07 during it.
  * The second run was on a fresh seed and a freshly started app, starting at a load of 6.2. J61's resolution was 0.94/0.70 ms (1000 and 1000 rounds). E10 was 0.74 ms, tok-rl 0.63, req-t 0.43 and L40 0.55.
* **tsc: clean.**
* **palette: ALL GREEN.**
* **corpus: 0 failures, 0 warnings.**
* **gate-coverage: 263/263 pinned, 0 open.**
* **secret-scan: none found.**
* **`build:check`: passed.** I confirmed the built chunks carry the new `/join` and the plural.
* **`test:csp-prod` (`CSP_CHECK_PORT=3220`, dev app stopped): 5/5.**

## Found

1. **In a production build, `/` with the switch on can redirect to itself forever.** It is outside this brief, and I have not fixed it.
   * `next start -H 127.0.0.1` on the `44c7444` build answers `/` with `307 → /` on every request (curl, both `127.0.0.1` and `localhost`).
   * I added a temporary log to `proxy.ts` (since removed), and it showed the proxy running **twice** per request: once for `/`, and once for `/front-door`.
   * The rewrite target is built from `req.nextUrl`, whose host Next reports as `localhost`. The server's host is `127.0.0.1`, so Next treats the rewrite as external and proxies it as a new request. The proxy then sees a direct `/front-door` and sends it back to `/` (the "one address" rule).
   * Started without `-H`, the same build serves 200 and the full front door.
   * I have not checked whether the production host behaves like either case. `csp-prod-check` starts with `-H 127.0.0.1` but never asks for `/` with the switch on.
   * Suggestion for release: before launch day, turn the switch on in a preview deploy and fetch `/`.
2. **Items 2 and 3 did not reproduce as described either.**
   * Before the change, Chrome's accessibility tree already named the chips "Player Build your football CV" and so on. The screen had a 44px arrow button labelled "Back" that returned to the country question; I have a 375px screenshot of it.
   * The likely source of "button ×4": the layout check's own `FOCUSED` helper names an element only by `name` or `aria-label`. Its comment says the chips are "four buttons with no name". That is the instrument's view, not a screen reader's.
   * I built what the brief asked for anyway. It is stricter and harmless: the exact title as the name, and the word "Back" beside the arrow.
3. **The chips still don't tell a screen reader which one is chosen.** They have no `aria-pressed` and no radio-group semantics, so the selected role is visual only (the green border). I did not fix this, because I was asked only for names. A small follow-up would be `role="radiogroup"` and `aria-checked`.
4. **The other fixture names, for Leo to rule on. None were changed.** I checked from memory only (no gazetteer, no web).
   * **Elderslie Juniors SC** (`PREVIOUS`): I believe Elderslie is a real place, a suburb in Camden, NSW, and a town in Tasmania. I think it fails the rule.
   * **Kingsway Rovers FC** (`CURRENT` and `PREVIOUS`): Kingsway is not a suburb I know. But I believe there is a real "Kingsway Olympic" club in Perth, which is close to a real club's name. Unsure.
   * **Westgate Rangers** (both lists): Westgate is not a Melbourne suburb as far as I know (it is the bridge and the park). The seed places it in Altona, a real suburb. Unsure.
   * **Northern United SC** (both lists): the name is generic. I don't know whether a real club carries it. Unsure.
   * **Marchfield City FC** (both lists): not a place I know, so probably invented. Unsure.
   * **Quarrymead United**, my own choice: I believe it is invented, but I have not checked it against a gazetteer.
   * **Outside those lists:**
     * L15 itself recommends **Coburg City FC** and **Brunswick Juniors SC**. Coburg and Brunswick are real Melbourne suburbs, and `lib/fixtures.ts` uses both.
     * **Riverside FC** is the house persona's club (CLAUDE.md). Riverside is a suburb of Launceston.
     * The fixture localities (Brunswick, Brunswick West, Preston, Altona, Coburg) are real suburbs by design.
     * Two live placeholders use fixture names: "e.g. Northern United SC" in `app/send/[recordId]/page.tsx:116`, and "Riverside FC" in `app/coach/edit/page.tsx:252` and `:264`. If a name is ruled out, these change with it.
5. **The browser's own prompt for a name made only of spaces is "Please match the requested format."** (Chrome, English). It is not our copy, but it is the least helpful of the three prompts. The held words below would replace it.

## Copy for BUZ

**Held, not rendered anywhere.** These are proposed words for a missing field on `/join`'s first step, to replace the browser's prompt once approved. Each would sit under its field in the page's existing amber-note style:
* First name missing: "Add your first name to carry on."
* Date of birth missing: "Add your date of birth to carry on. It decides whether a parent needs to approve your page."
* Tick missing: "Tick the box to agree to the Terms and Privacy Policy to carry on."

**Rendered, but not new words:**
* "Back" on the Somewhere else screen. This is HeaderMark's existing default label, already used on other screens; it is new in this place only.
* "1 club awaiting a call" and "1 registration held" (operator only). These are the singular forms of the existing line.
* The accessible names "Player", "Coach", "Parent / Guardian" and "Club". These are the chips' existing titles, now spoken alone.
* The browser's built-in prompts, in the browser's language. In Chrome (English) they are "Please fill out this field.", "Please tick this box if you want to proceed." and "Please match the requested format."

**Fixture data a demo audience sees:**
* "Quarrymead United", suburb "Quarrymead VIC", `football@quarrymeadunited.example.au`.
* The demo's held-club seat signs in as `quarrymead@example.com`.

## Risks

* I measured the browser prompts in Chrome only. Safari on iOS also shows a prompt for `required` fields on submit, but I did not run Safari. A very old browser that ignores `required` would move on only when the form is complete: `canContinue` still guards the step, so it can never move on while anything is missing.
* Pressing Enter in the first-name field now submits the step: it prompts, or moves on if complete. Before, it did nothing.
* j2 asserts the names exactly. If a chip's title is ever reworded, j2 must change with it (L32).
* Item 6 was not reproduced, so I cannot rule out whatever Leo saw on 3000. I did not touch Leo's app, by instruction. Found 1 is one way the front door fails without text; the other known one is the Next 16.3.5 empty-document recovery on a render error (APPROVALS, "Route 404s").
* I did not run the club demo (3030) against the rename, only the demo layer's checks inside the permission suite.

## Lesson

A rehearsal finding describes a symptom seen through a tool. Before building the fix, reproduce it in the instrument a real user or crawler would use: Chrome's accessibility tree, a no-JS render, a production build. Two of the six findings came from how a tool names things, not from the product. And the one real production-mode fault (Found 1) turned up only because I went looking for the reported one.
