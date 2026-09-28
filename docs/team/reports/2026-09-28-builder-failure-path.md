# builder: the failure path — 404, 500, a refused sign-in, the report confirmation (2026-09-28)

Asked: design and build the failure path (no 404, no 500, "Welcome back" on a wrong password, silent `?needs=profile`, a `/report?done=1` with no heading), put every string in one place as a proposal, and prove none of it opens an enumeration oracle.

Did (branch `builder-failure-path`, worktree `.claude/worktrees/builder-failure-path`, 6 commits on top of `app` 2c9da1d; `app` merged in twice, never rebased — at c979a3b, then at 2c9da1d):

- `components/FailureState.tsx` (new). One shell for every failure screen, modelled on LinkState: mark top right, glyph tile, h1, reason, sunken card, then the way out. **`FAILURE_COPY` holds every string on the failure path, and none of them is approved.** The screens carry a `data-failure` marker, and the suites find them by that marker rather than by their words, so BUZ can change any word without turning a check red (L32).
- `app/not-found.tsx` (new). This is the 404 for all 52 `notFound()` calls and for every unmatched URL. Next passes it no props, so it has nothing to tell one cause from another. It has its own title; before, the tab showed the landing page's line.
- `app/error.tsx` (new, client component, which Next requires). It shows nothing from the error: no message, no digest, no stack (D-94 §1). The title is set with React's `<title>`.
- `app/global-error.tsx` (new). This one catches failures in the root layout itself. It gets no globals.css, so it draws the mark, uses literal Night Match values from `lib/palette` and adds the focus ring with one inline rule.
- `app/dev/boom/page.tsx` (new). A route that throws so the 500 can be proven. It is `notFound()` in production, the same gate as `/design` and `/dev/outbox`.
- `app/signin/actions.ts`: every refusal now redirects to `/signin?refused=1`. The four causes are wrong password, no such account, an unproved address and the rate limit, and they get one destination and one line. Success still goes to `/home`. D-94 §2 asks for an identical response, not a silent one.
- `app/signin/page.tsx`: reads `refused` and shows the line in an amber `role="alert"` card.
- `app/coach/edit/page.tsx`: reads `needs` and shows the line when it is `profile`. **This closes `qa-silent1`, the last deliberately red check on `app`; it is now green.**
- `app/report/page.tsx` (done state). The heading is now a real `<h1>`. The police line moves above the thanks and changes from the muted 12.5px sunken style to ink on an accent card. The tab title changes via `generateMetadata`. There is now a way off the screen; the layout check found there had been none. The sentences are unchanged from doc 15 §7.
- `components/cv/LinkState.tsx`: "Ask the family" now uses `btn-primary`, as `LinkState.dc.html` draws it. It had drifted to the grey well.
- The way back from every failure screen goes to **`/home`**, not `/`. Before launch `/` is the waitlist page, which has no door into the product. `/home` carries the console shell, which has sign-out for every seat (rail on a laptop, More sheet on a phone). Signed out, `/home` is the sign-in prompt. None of the failure screens uses the shell itself.
- Tests:
  - render `fp1`–`fp14`
  - write `p19g`, `p19h` and `sr1`–`sr4`
  - perms `fail1`–`fail6`
  - layout: 4 failure views at each width, handed to the chrome pass, so the page colour is checked against `--bg` from globals.css rather than a second list of colours.
  - `layout-check`'s 404 detector now reads the marker instead of "This page could not be found".
  - The perms check "D-94: sign-in has exactly one outcome" counted `redirect(` calls and was pinning this defect. It is replaced by the rule itself (two outcomes, and a refusal never names its cause), not deleted (L33).
- **No migration.** No permission rule changed: the 404 decides nothing about who may see what. It serves the same nothing to everyone.

Ran (all on commit `8b7b5e3`, this worktree, dev db on 54345, app on 3045, Chrome on CDP 9345):
- perms **1250/1250**
- render **498/498**
- reseed, then write **344/344**
- reseed, then layout **196 views at 375 and 1280, 8 of them failure-path views, 0 overflow**; chrome pass 22 controls, all rings and `--bg` green
- palette green · corpus 0/0 · secret-scan clean · gate-coverage 262/262 · `tsc` 0 errors · `build:check` compiled
- Timing, 9-run medians in dev:
  - dead club slug vs dead club slug: 30 vs 31 ms (fp7)
  - paused registrant vs a club that never existed: 29 vs 31 ms (p19h)
- Disk: 20 GiB free at the start; 21 GiB at resume (after the coordinator cleared space); 16 GiB at the end, with other builders running. My `.next` and `.next-check` are deleted.

Proof on the old code (L20), run on the pre-merge tree:
- **Removing the three failure pages:** render fp1–fp6 and fp8 failed (12 checks). The layout check failed all 6 of the 404 and 500 views (3 paths × 2 widths) with `background rgb(255, 255, 255)`, no mark and no way back. With only `error.tsx` removed, `global-error.tsx` still caught the 500, so both layers are live.
- **Reverting the sign-in, report and LinkState files, and giving `not-found.tsx` a `searchParams` branch:**
  - perms: the D-94 two-outcomes check, fail1, fail2 and fail5 failed
  - render: fp9, fp11, fp12, fp13 and fp14 failed
- **Adding a segment-level `not-found.tsx` under `/club/register/cv`, the realistic way this regression would arrive:** p19g failed and named the differing words. p19h also failed (801 vs 423 ms), but that run included a first compile, so I do not count it as a timing proof.
- **Not proven on old code:**
  - fp10 is a guard; the old `/home` never carried the line either.
  - sr2–sr4 were not run against the old action. The perms check and fp9 cover the same change.

Found:
1. **Two measurements in the brief did not hold at HEAD a67b70b.**
   - LinkState's Pitch mark is not missing. It renders through `HeaderMark`, and fp14 on the old code read the mark as present with the button wrong. Only the grey button was real.
   - The footer's links are `--muted`, not green, so the "about 1.8:1" figure does not apply. The white page was real, and only because of Next's forced `body{background:#fff}`.
2. **A `notFound()` thrown inside a route, and every 500, reach the browser as an RSC payload painted by React.** The HTML body is empty until JavaScript runs. I measured this on the dev server and on a production build (`next build && next start`). An unmatched URL is server-rendered. With JavaScript blocked, a dead club slug is a blank page. This is Next's streaming model, not something a boundary file can change. The fetch checks read the payload, and the browser checks read what is painted.
3. **Production, outside my lane (`lib/db.ts`).** A failure at module load, for example `SUPABASE_DB_URL` unset, serves a bare `text/plain` "Internal Server Error" of 21 bytes. No `error.tsx` or `global-error.tsx` can catch it, because it happens before React starts.
4. **Dev only.** The served HTML for a route-thrown 404 or 500 carries the thrown message and a stack trace with absolute filesystem paths, inside a `<template>`. I did not check whether the production 500's HTML carries the message; I checked only its title, h1 and marker.
5. **Not an existence oracle, but reported:** head metadata differs between 404s from different route families.
   - `/c/<dead slug>` still advertises `og:image` at `/c/<dead slug>/opengraph-image`, because `/c/[slug]` has its own image route.
   - `/club/register/cv/*` carries its own `noindex, nofollow` into the payload.
   - Both tell you which route you typed, not whether anything was there.
   - fp6 and p19g let the robots directive through by name and nothing else.
   - I did not check what the coach OG route returns for a dead slug.
6. **Sign-in timing (pre-existing, in `lib/auth` and the action's flow).** A rate-limited sign-in skips password hashing, so it answers faster than a wrong password. It does not reveal whether an account exists (`verifyPassword` already hashes a decoy for missing accounts), but it does tell "limited" from "checked".
7. **`/billing?error=1`: the coordinator says another seat fixed it.** `qa-silent1` passes on this tree, so the class is closed.
8. **I deliberately added no `loading.tsx`.** Per Next's docs, `notFound()` answers 200 on a streamed response. A root `loading.tsx` would make responses streamed and turn every 404 in the product into a 200.
9. **Environment notes.**
   - The PGlite dev database serves one connection, so a production server and a dev server pointed at the same dev database cause ECONNRESET 500s. My first production measurement read those as product 500s until I stopped the dev app.
   - `export const metadata` works in `not-found.tsx` on 16.3.5, although Next's docs describe it only for `global-not-found`.

Copy for BUZ — **every line below is a proposal and none of it is approved.** All of it lives in `components/FailureState.tsx`:

- **404** (tab title "Page not found · Pitch Football"):
  - Heading: "This page isn’t here"
  - Reason: "The address may be wrong, or what was here may have been taken down."
  - Card: "We don’t say whether something was here and has gone, or was never here at all. The answer is the same either way, so a wrong address can’t be used to find out who is on Pitch."
  - Button: "Go to the start"
- **500** (tab title "Something went wrong · Pitch Football"):
  - Heading: "Something went wrong at our end"
  - Reason: "This is a fault on Pitch, not something you did."
  - Card: "Trying again often works. If it keeps happening, there is a way to tell us at the foot of every screen."
  - Buttons: "Try again" · "Go to the start"
- **Refused sign-in** (the design seat's wording, used as it proposed): "That didn’t work. Check the email address and the password and try again."
- **Coach editor, `?needs=profile`:** "We couldn’t save that — there is no coach page to save it to yet. Put your name and region in below and save, then add it again."
- **Report confirmation.** The design seat proposed the order; the words are doc 15 §7's except the new title and button.
  - New tab title: "Report received · Pitch Football"
  - New button: "Go to the start"
  - Heading, unchanged: "We’ve received your report"
  - Now first, in ink on an accent card: "If it concerns a child’s immediate safety, contact your local police first; we are not an emergency service."
  - Now second: "Thanks — we have your report and a person will look at it. We aim to respond within one business day."
- **Unchanged words, changed look:** "Ask the family" on the dead-link page is now the primary button.
- **Two calls that are BUZ's, not mine:**
  - (a) Where a reporter with no account lands after "Go to the start". It is `/home` today, which for a stranger is the sign-in prompt. The options are that, the waitlist `/`, or back to the public page they reported.
  - (b) Whether the 500 shows a support reference (Next's digest). I show none, the more restrictive choice.

Risks:
- Route 404s and all 500s need JavaScript to paint (Found 2).
- The dev timing numbers are not production numbers, and E10-style timing on Vercel is unmeasured.
- `global-error.tsx` is proven only by removing `error.tsx` in dev, not by a real layout failure.
- The 375px and 1280px views are measured, but 768–1023px is not.
- The safety seat and the copy seat have not yet read this.

Lesson: a write-suite check that signs in has to use an account nothing earlier in the run changes. My sr4 went red on the first full run because the 0062 sessions block had already reset `guardian@example.com`'s password. The product was right and the fixture had moved (L13, L32). Brand-new fixtures that no suite touches, such as `new@example.com`, are the safe accounts to sign in as.
