# Handoff: Pitch Football — Coming Soon website

## Overview
A single-page "coming soon" site for **Pitch Football** (pitchfootball.com.au) — a football (soccer) record-keeping product for grassroots Australia. The page tells the story (a goal lasts a second, the run took a season), lets a visitor pick one of four personas ("seats"), shows what each persona's built profile looks like, states pricing, and collects a waitlist email. Australia first, Melbourne first.

Four personas, each with its own accent colour, drive the whole page:
- **Player** (on the pitch) — `#3ddc84`
- **Coach** (the sideline) — `#d95926`
- **Club** (the stands) — `#eda100`
- **Parent / guardian** (behind the fence) — `#a479e2`

The selected persona is global state: it changes the "Pick your seat" stage, the "A closer look" phone mock, the pricing tiers, and pre-selects the role on the waitlist form.

## About the design files
Everything in this folder is a **design reference built in HTML** — a prototype that shows intended look, copy and behaviour. It is **not production code to copy**. Recreate it in the target codebase's environment. If none exists yet, recommended stack: **Next.js (App Router) + TypeScript + Tailwind**, deployed as a static site to Vercel / Netlify / Cloudflare Pages with the custom domain pointed at it. The whole page is one route (`/`). No backend is required except the waitlist form endpoint (see State Management).

`Pitch Website - Coming Soon v2.dc.html` is the source of truth. The `{{ holes }}` in its markup are template bindings; the `class Component` block at the bottom holds all data arrays (copy, tiers, tabs) and interaction logic — lift copy directly from there.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy and interactions are final. Recreate pixel-close. The interactive toys (ball shooting range, tactics board, slide-to-send) are part of the design and should be implemented — they are the page's personality — but simplified fallbacks are acceptable on touch devices if pointer handling is problematic.

## Global
- **Page bg** `#070b09`. **Text** `#eef5f0`. **Muted text** `#b9c8bf`. **Dim text** `#7d8f85`. **Surface** `#0d1411` / `#121b16`. **Border** `#1c2822` / `#24322a`.
- **Font**: Archivo (Google Fonts), weights 500/700/800/900. Fallback `system-ui, sans-serif`. Headlines are 900 with tight tracking (−.035em to −.05em).
- **Max content width** 1100px, 24px side padding.
- **Reveal-on-scroll**: sections start `opacity:0; translateY(24px)` and animate to visible (`.7s ease`) when 15% intersects (IntersectionObserver, once).
- **Links** `a { color:#3ddc84 } a:hover { color:#6ce8a3 }`.
- **Responsive**: nav links hidden < 820px; stage height `auto` < 700px (else `min(820px, 92vh)`); all rows use flex-wrap / `repeat(auto-fit, minmax(…))`. Verified at 390px and 360px widths.

## Screens / sections (top to bottom)

### 1. Sticky nav (52px)
`position: sticky; top:0; z-index:50; background: rgba(7,11,9,.72); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,.06)`.
- Left: wordmark "P[symbol]TCH" — 900 / 20px / −.035em, symbol = SVG vertical line + circle in `#3ddc84` (see `assets/brand/`).
- Centre (≥820px): links "Highlights", "Pick your seat", "A closer look", "What it costs" — 12.5px/600 `#b9c8bf`, hover `#eef5f0`. Each smooth-scrolls to its section (offset −60px).
- Right: match clock `00'`–`90'` (page scroll progress × 90, tabular nums, green dot) + pill CTA "Join the waitlist" (`#3ddc84` bg, `#06130c` text, 12.5px/800, radius 999, padding 7px 14px).
- 2px green progress bar along the bottom edge, width = scroll %.

### 2. Hero — scroll film (height 420vh desktop / 360vh mobile, sticky inner viewport)
A pinned full-viewport stage; scrolling drives a 6-beat sequence (fp = 0→1):
- Five full-bleed frames (`assets/film-1..5.png`) cross-fade and slowly scale (1.04→1.18) with a slight horizontal drift. Green soft-light wash at .3 over everything; a white flash peaks at fp≈.5; a huge "GOAL" (`clamp(90px,22vw,320px)`, 900, `#3ddc84`, screen blend, glow) appears fp .5–.67; a warm light-sweep streaks across.
- Bottom-left caption stack (six crossfading headlines, `clamp(40px,7.4vw,112px)` 900 / .9 lh / −.05em, white with text-shadow):
  1. "Somebody should be **writing this down.**" (green span) — sub: "Seasons end. Coaches move. Clubs change. The record should be the thing that stays."
  2. "A goal lasts **a second.**" — "Saturday, 3:07pm. Number 9 picks it up on the wing."
  3. "The run took **a season.**" — "Every Tuesday under lights. Every position he was moved to. Every coach who moved him."
  4. "Nobody wrote **it down.**" (purple span) — "The net, the pile-on, the fence going up. It was there. Then it wasn't."
  5. "The coach **saw it coming.**" (orange span) — "Three seasons ago he moved a full-back to the wing. Nobody wrote that down either."
  6. "Pitch **keeps it.** For all of them." — "The player's page. The coach's record. The club's register. One second on a Saturday, kept for every one of them."
- Time label above (12px/800/.18em uppercase, red pulsing dot): "In build · Australia first" → "Saturday · 3:07pm · 62nd minute" → "… the strike" → "… goal" → "… the sideline" → "Saturday · 3:08pm · the fence".
- Buttons: "Join the waitlist" (green, 52px, radius 14, 15px/800) + "Pick your seat" (glass: `rgba(255,255,255,.12)`, blur, 1px `rgba(255,255,255,.18)` border).
- Film-strip progress bar (3px, green with glow) + hint "Scroll to play the goal" → "Now pick your seat ↓" at fp>.97.
- Keyboard ← / → switches persona anywhere on the page.

### 3. The development story
Centered header: kicker "The development story" (12px/800/.18em, green) · H2 "What if development left a trail, not just a memory?" (`clamp(36px,5.2vw,68px)`, 900, −.04em) · body 16px `#b9c8bf` max 560px.
Three cards (grid `minmax(260px,1fr)`, gap 12): 4:3 image (radius 22) with kicker pill bottom-left, then title 18px/900 and body 13.5px.
1. "Tuesday · training" — **Today: the raw material is kept.** — "Positions, clubs, seasons, the numbers you choose to show, three clips. That's the page, and it's free."
2. "Saturday · match day" — **Next: what Pro is.** — "We're deciding what's in it with the first coaches and clubs, not before them. Until it's settled, the honest word is coming soon."
3. "The sideline · the clipboard" — **Always: under 18 stays free.** — "No paid tier exists on a child's page. Pro, whatever it becomes, is an adult's decision about their own record."

Roadmap row (4 cards, `#0d1411` bg, 1px `#1c2822`, radius 18, padding 18): who (10.5px caps, persona colour) · status pill · title 15.5px/900 · body 12.5px `#7d8f85`.
- Players 18+ · Player Pro · Coming soon · "Adults only. What's in it is being decided with the people who'll use it."
- Coaches · Coach Pro · Coming soon · "Shaped with the first coaches on the record, not before."
- Clubs · Club Pro · Coming soon · "Founding clubs get the first say in what it is."
- Under 18 · Always free · **Settled** (green pill) · "No Pro, no paid anything, on a child's page. Ever."

### 4. Founding XI (clubs)
Card: radius 32, `linear-gradient(160deg,#2b2415 0%,#171409 55%,#0d120e 100%)`, 1px `#4a3a12`, padding `clamp(28px,4vw,56px)`, giant watermark "XI" (300px/900, `rgba(237,161,0,.07)`) top-right.
- Kicker "For clubs · the Founding XI" (amber). H2 "Eleven clubs start this with us. Their names stay on it." (`clamp(30px,3.8vw,48px)`).
- Body (15px, `#d9cfb3`): "Eleven clubs will be the first on Pitch. They'll see it before anyone else, tell us what's wrong with it, and shape Club Pro and Coach Pro with us. A founding club carries the mark for good — and gets no edge in search, ranking or discovery. That's a promise to every other club."
- Three check-chips: "Founding mark on your club page" · "A direct line to the people building it" · "Shape Club Pro and Coach Pro with us".
- Right: 4-col grid of 11 dashed squares numbered 1–11 (1.5px dashed `rgba(237,161,0,.35)`, text `rgba(237,161,0,.55)`, radius 14) + a solid amber "+" tile. Note: "Eleven seats, none taken yet. Founding clubs' names go up when we open." CTA "Register your club's interest" (amber `#eda100` on `#14100a`, 52px, radius 14) → scrolls to form with role=club.

### 5. Get the highlights (horizontal rail)
Header row: red pulsing dot + "The replay · five angles on one goal"; H2 "Get the highlights."; right side counter "1 / 5" and prev/next 38px square buttons (1px `rgba(255,255,255,.14)`, radius 12).
Rail: horizontal scroll-snap, cards `min(440px, 84vw)` × 540px, radius 28, image cover (hover scale 1.05 over .8s), persona-colour soft-light wash .35, dark bottom gradient. Top: persona pill (10.5px caps, blur) + timestamp. Bottom: title 30px/900 white, body 13.5px, thin progress line, "Take this seat →" in persona colour. Click → sets persona and scrolls to the stage.
1. Player · 62:10 · **Your football, finally on the record.** — "Every club, every season, every position you've been moved to. Build it once and it follows you for the rest of your career."
2. Player · 62:11 · **Get seen by the right club.** — "Send your page in one tap and the club opens it live. Down the track, clubs come looking for you — not the other way round."
3. Coach · 62:12 · **Prove what you've built.** — "Squads, seasons, licences and the players you developed — one record that gets you the next job. Then your word on a player's page, carried with them."
4. Club · 62:12 · **Fill squads with players who want in.** — "The Interest Register keeps the players who want to be at your club, by squad. Then the whole pathway, U8s to seniors, in one view."
5. Parent · 62:14 · **You hold every key.** — "Nothing about your child reaches a club until you've read it and slid to send. They get a record to grow into — with no feed to disappear into."
Images: `assets/hl-1..5.png`.

### 6. Pick your seat (persona stage)
Header: kicker "Four seats at the ground", H2 "Pick your seat.", body "The same product looks different from the pitch, the sideline, the stands and the fence. Stand where you stand." Persona chip row (pill, 13px/800, active = `rgba(255,255,255,.12)` bg + persona-colour border; inactive = transparent + `rgba(255,255,255,.1)` border, `#7d8f85` text; each has a colour dot).

Stage: full-width, `min(820px,92vh)` tall, top/bottom 1px `rgba(255,255,255,.06)`. Background scene is pure CSS (perspective-rotated pitch, floodlights with flicker, stands, fence) with a subtle pointer-parallax (±14px). Each scene enters with `sceneIn .7s` (fade + scale 1.03→1). Content: two columns wrapping (text `flex:1 1 340px; max 520px`, toy `flex:1 1 300px`), gap 32, padding 40px 28px.

**Player · on the pitch** (green)
- H2 "Every season you've played, working for you." Body: "Build your page once and never rebuild your history for a new club again. Send it in one tap, get seen by the right clubs, and watch your development add up season on season — until clubs are finding you."
- "Your number" 1–11 chips (38px squares, radius 12); "Where you play · up to three" position chips GK CB LB RB CM AM LW RW ST (max 3).
- CTA "Join the waitlist" (green) + note "Under 18? A parent joins the waitlist for you."
- Toy: a goal-mouth (5px white posts, animated net) with a draggable ball: pull back and release → ball flies (.6s), result GOAL / POST! / WIDE / SHORT flashes; goals and shots tally. Below, a live "Your page" card: number tile, positions on a mini pitch, GOALS / SHOTS / CLUBS stats.

**Coach · the sideline** (orange)
- H2 "Ten seasons on the touchline. Make them count." Body: "You've built squads, moved players, done the courses. Pitch turns that into a record that gets you the next role — and puts your word on the players you developed, so their progress carries your name wherever they go."
- Formation chips 4-3-3 / 4-2-3-1 / 3-5-2 / 4-4-2 + "Wipe the board" (dashed).
- CTA + rotating note ("Formations are the easy bit. Keeping the record of them isn't." → after interaction "That's the whole record of tonight, unless it's kept.").
- Toy: tactics clipboard (`#1c1a17`, rotated −2°) with 3:4 green board; 11 draggable magnets (GK amber, others off-white); drag on empty board draws a dashed yellow run line.

**Club · the stands** (amber)
- H2 "Know who wants to be here before trial night." Body: "Fill squads from players who already want in, see how deep each age group is before trials, and stop losing CVs in an inbox. Then see your whole pathway — U8s to seniors, every coach, every season — in one place."
- "Tap a group on the ground" + "Blow the whistle" toggle (gathers all groups to centre, shows whole-club totals).
- Selected-group card: name, tag, GK/DEF/MID/FWD counts, note. Groups: U15 Boys (Trial notice live, 2/6/5/3, "Sixteen on the register for this squad. Four arrived this week as live pages, not attachments."), U13 Girls (Squad page, 1/4/4/2, "Eleven on the register. The coach reads the record; the registrar sees names and squads only."), Seniors (Open register, 3/8/9/5, "Twenty-five. Adults send their own page; nothing here needed a parent.").
- CTA + note "Interest Register: $49 a month, cancel anytime — or $299 for twelve months."
- Toy: three player clusters (cones + bibs) positioned on the stage; click selects; whistle animates them together (.7s).

**Parent · behind the fence** (purple; scene has a warm dusk gradient and a chain-link fence overlay)
- H2 "You watch from behind the fence. You hold every key." Body: "Your son or daughter builds the page and asks. You read it and slide to send. Nothing reaches a club without you — and they get a record of every season that's theirs at 18, with no feed, messages or leaderboard to disappear into."
- Request card: "Deniz wants to send his page" / "to Kingsway Rovers FC · U15 Boys · 'Right-footed 10, happy anywhere across the front three.'" with a **slide-to-send** control (54px track, purple knob; must pass 92% to confirm; snaps back otherwise). Note "A mis-tap can't send this. Only a slide." On success: green-bordered card "Sent. Deniz gets a text." / "The club opens his live page. Take it back any time and the link dies the same minute." + "Next →" resets.
- CTA "Join the waitlist" (purple `#a479e2` on `#120a1e`).
- Toy: "Your keys" panel — link toggle (on: green; off blurs the pitch in the background scene), "Every send" locked row, **hold-to-pause** row (hold 1.2s fills red; paused greys the whole scene; tap resumes). Status line reads "Page visible to the clubs you chose" / "Page dark to every club" / "Paused — nothing goes anywhere".

Bottom-centre **ground plan** widget (glass pill): mini SVG stadium plan with clickable regions (pitch = player, bench = coach, stand = club, fence = parent), pulsing dot moves to the active seat, label "You're standing / {seat name}", ‹ › buttons.

### 7. A closer look (persona-aware)
Header: kicker in persona colour, H2 "Take a closer look.", sub, persona chip row. Then a phone mock (320px wide, `#0b120e`, radius 40, 14px padding, 6px inner ring `#050806`) and a tab list (`flex:1 1 300px; max 420px`). Clicking a tab highlights the matching block in the phone (others drop to opacity .32; active gets a 2px persona-colour outline, offset 4px). Active tab: `#0d1411` bg, persona border, description expands.

Player — kicker "Your page" · sub "Built once, carried for good. What each part does for you."
- Who you are — "Name, age, position, city, your number. Clubs know exactly who they're looking at." (phone: tile "1", "Nate Okafor", "19 · Goalkeeper · Melbourne")
- Where you play — "Up to three positions, tapped on a pitch rather than picked from a list." (mini pitch with GK dot)
- Every club, every season — "Your whole history in one place, so you never rebuild it for a new club. Coaches add their word as you go." (Brunswick City · Seniors · 2 seasons; Kingsway Rovers · U18 · 3 seasons)
- The numbers you choose — "Appearances, goals, assists, clean sheets — show what makes your case. Season on season, they become your development trail." (38 APPS / 14 CLEAN / 6 PENS)
- Clips that make the case — "YouTube, Instagram or Veo. Three on the free page; your whole season on Pro." (3 clip thumbs)
- The link — "Send it in one tap; the club opens it live. Choose who can open it and for how long." ("Link is on · 2 clubs can open it · 61 days left", toggle)

Coach — kicker "Your record" · sub "Eleven seasons on a touchline, working for you for the first time."
- Who you are — "Name, role, how long you've been at it. The first thing a club sees when it's hiring." (tile "SH", "Sarah Hale", "Head coach · 11 seasons · Melbourne")
- Licences, shown — "Your coaching licences on the record. Clubs see what you're qualified for without asking." (chips "WWCC checked", "C Licence")
- Every squad, every season — "Which clubs, which age groups, which years. Walk into the next interview with proof, not memory." (Kingsway Rovers · U15 Boys 2024–26; Brunswick City · U13 Girls 2021–23; Northcote FC · Seniors asst. 2015–20)
- The players who came through — "How many you've coached and where they went. Proof you develop players — the thing clubs actually hire for." (11 SEASONS / 9 SQUADS / 140 PLAYERS)
- Your word on a player — "A line on a player's page, from you. It follows them club to club, and it carries your name." (quote card: "Deniz — two seasons, never missed a session. Reads the game early.")
- The link — "Send it to a club in one tap. Down the track, clubs looking for a coach find you." ("1 club can open it · 30 days left", orange toggle)

Club — kicker "Your club" · sub "Fill squads, see the pathway, spend volunteer hours on football."
- Your club — "Crest, founded, squads. The place players send their page to — and a founding mark if you were one of the eleven." (tile "KR", "Kingsway Rovers FC", "Est. 1979 · 14 squads · Melbourne", FOUNDING pill)
- Squads and trial notices — "Every age group on one page. Put a trial notice on the squad that needs players and the right ones find it." (U13 G 18 players · U15 B Trial live (amber border) · Seniors 25 players)
- The Interest Register — "Players who want to be at your club, kept by squad and by line. Know how deep U15s are before trial night, and start next season already ahead." (amber card "Interest Register · U15 Boys / 16 want in · 4 new this week / 16"; GK 2 DEF 6 MID 5 FWD 3)
- CVs arrive as live pages — "No attachments lost in an inbox. Open the player's page as it is today, with a coach's word already on it." (Deniz K. · AM / LW · Live page; Nate O. · GK · Live page)
- The pathway — "TD reads the football, registrar runs the squads. Then Club Pro: U8s to seniors, every coach and season, in one view." (row "Two sets of eyes / TD reads the record · registrar sees names and squads", two overlapping avatars)

Parent — kicker "Your keys" · sub "Your child gets a record to grow into. You hold every key until it's theirs."
- You, the guardian — "Your account, with your child's page underneath it. You hold every key until they turn 18." (tile "AK", "Ayşe Kaya", "Guardian of 1 page · holds every key")
- Their page — "Positions, clubs, numbers, clips — every season kept, so at 18 they start with a record, not a blank page." (tile 9, "Deniz · 14 · AM / LW", "Kingsway Rovers U15 · his page, your keys", U18 pill)
- A request to send — "They ask. You read it and slide to send. A mis-tap can't do it." (purple card with mini slider "Slide to send →")
- The keys — "Who can open the page, whether sends are locked, and a hold-to-pause that stops everything." (rows: "The page · 2 clubs can open it" toggle; "Every send · read by you first" lock; "Pause everything · Hold 1s")
- What isn't there — "No feed, no messages, no leaderboard. Nothing for a 14-year-old to disappear into." (three "—" tiles: FEED / MESSAGES / RANKING)

### 8. What it costs (persona-aware)
Header: kicker (persona colour) · H2 "What it costs." · sub · persona chip row. Green banner (1px `rgba(61,220,132,.3)`, gradient tint, radius 16): "**Under 18 is always free.** No paid tier exists on a child's account, ever."
Tier cards: grid `minmax(260px,1fr)`, radius 24, padding 26. Header row: name (11px caps, persona colour) + badge pill. Price 44px/900 −.04em + per-text 13px. Body 14px. Small label (10px caps `#7d8f85`) "What you get" (or "Where it's going" on Coming-soon tiers) then check-list (13px/600, check icon in tier colour).
Card styles: Free = `#0d1411`, 1px `#1c2822`, badge green tint. **Coming soon** = `#0a0f0c`, 1px dashed `#24322a`, neutral badge. **The paid tier** = amber gradient `linear-gradient(160deg,#2b2415,#14170f)`, 1px `#4a3a12`, solid amber badge.

**Players · 18 and over** — "Your page is free for good. Pro is where your development becomes a trail clubs follow."
- Player · Free / Free for good / $0 for good — "Your whole history, three clips, one-tap sends to any club, PDF export." — Never rebuild your football history for a new club again · Get in front of the right club in one tap · Decide who sees your page and for how long
- Player Pro / Coming soon / — adults only — "Where your record becomes a development trail — and clubs start coming to you." — Show a whole season, not three moments · Know when a club opened your page · Clubs asking for your page, not the other way round · Your development, season on season, answered properly

**Coaches** — "Your record is free for good. Coach Pro puts your name on the players you developed."
- Coach · Free / $0 for good — "Squads, seasons, licences, the players who came through. One page, sent like a player's." — Ten seasons on the touchline, finally working for you · Walk into the next club with proof, not memory · Licences on the record — no chasing paperwork
- Coach Pro / Coming soon / — not yet settled — "Where your coaching leaves a trail, not just a memory." — Your word on a player's record, carried club to club · Squad development across a season, in your name · Be found by clubs looking for a coach · Turn a season of sessions into something you can show

**Clubs** — "Your club page is free. The Interest Register fills squads. Club Pro shows the whole pathway."
- Club · Free / $0 every club — "Club page, squads, trial notices, CVs arriving as live pages, WWCC checks shown, PDF export." — Stop losing player CVs in a shared inbox · Trial notices that reach the players who want in · TD and registrar each see what they need
- Interest Register / **The paid tier** / **$49** a month, cancel anytime — "Or $299 for twelve months. Same for every club. The players who want to be at yours, kept by squad." — Fill a squad from players who already want to be here · Know how deep each age group is before trials · Next season's register builds itself — no spreadsheet · Cancel anytime
- Club Pro / Coming soon / — not yet settled — "Development across every squad, for clubs that want to see the trail. Founding clubs shape it first." — The whole pathway, U8s to seniors, in one view · Squad development over a season, coach by coach · Keep players and coaches together across seasons · Fewer volunteer hours on admin, more on football

**Parents and guardians** — "Your child's page is free, always. You hold the keys until it's theirs."
- Under 18 · Free / Always free / $0 always — "The whole page, your keys, every send read by you first. No paid tier exists on a child's account." — Nothing about your child reaches a club without you · Every season kept — a record to grow into · No feed, no messages, no leaderboard to disappear into
- When they turn 18 / Their choice, later / $0 still free — "The page becomes theirs on their eighteenth birthday. Pro is theirs to consider, not yours to pay for." — They start adult football with a record, not a blank page · Your keys hand over cleanly · Pro is their decision — never a bill to you

### 9. Waitlist
Card radius 32, `linear-gradient(160deg,#10201a,#0b1410 60%,#080d0a)`, 1px `#1c2822`, radial persona-colour glow top-right (changes with persona).
- Left: kicker "The waitlist" (persona colour) · H2 "Be there when the whistle goes." · body "One email when Pitch opens — nothing in between. No countdown, no spots left. Australia first." · purple notice "Under 18? Ask a parent to add their email instead. **We never take a child's details before there is a parent to ask.**"
- Right form: "I'm here as" 4-up role chips (Player / Coach / Club / Parent, filled in persona colour when active); "Email · 18 and over" input (52px, `#0a110d`, 1px `#24322a`, radius 14, placeholder `you@example.com.au`; red `#e34948` border on invalid submit); submit button 54px (persona colour when valid, else `rgba(255,255,255,.08)` / `#7d8f85`); note "An email and who you are. Nothing else. Sent by Pitch Football, Melbourne — one email when we open, unsubscribe in it." (→ "Check the email address." on error).
- Success state: green check circle, "You're on the list.", "We'll email you once, when it opens. Nothing else until then.", "What we hold" card (email + role pill, "That's the whole record. No name, no phone, no club."), paragraph "Being on this list isn't an account and doesn't hold a place. When we open, you sign up yourself — and a child's page waits for a parent's yes.", links "Add another" / "Not you? Remove it".

### 10. Footer
Wordmark + "FOOTBALL" micro-label (6.6px/800/.42em green) · "pitchfootball.com.au" · right: "Football, not soccer. Melbourne first, then everywhere the game is played." 12px `#6b7d73`.

## Interactions & behaviour (summary)
- Persona state `persona: 'player'|'coach'|'club'|'parent'` — set by seat chips (3 places), highlight cards, ground plan, ‹ › buttons, ← → keys. Changing persona must **not** scroll the page (prototype restores scrollTop after re-render). Also sets form `role` and resets the closer-look active tab to the first.
- Scroll-driven hero: compute `fp = clamp((52 - rect.top) / (rect.height - vh + 52))` on scroll (rAF-throttled); 6 equal segments with short crossfades. Nav clock/progress from document scroll ratio.
- Smooth-scroll nav (`scrollTo`, −60px offset).
- Easing everywhere: `cubic-bezier(.22,1,.36,1)`; durations .15–.7s. Keyframes: sceneIn, rise, flicker, pulse, net, goalFlash, tick (all in the source `<style>`).
- Highlight rail: scroll-snap x mandatory, prev/next scrolls by card width + 14px gap, index synced on scroll.
- Toys: see section 6. All pointer handling uses `setPointerCapture`; `touch-action: none; user-select: none` on drag surfaces.
- Form validation: simple email regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`. Show red border only after a failed submit.

## State management
Client-only, one component/store:
`persona, role, email, submitted, tried, look (active tab key), hi (rail index), fp/dp (scroll progress), vw` plus toy state (`number, pos[], goals, shots, ball, drag, flying, flash; formation, magnets[], runs[], drawing; group, whistled; linkOn, paused, pauseP, slide, sliding, approved`).
Waitlist submit → POST `{ email, role }` to your endpoint. Store exactly that — copy promises "No name, no phone, no club."

## Waitlist backend — notifications & tracking (build this)
The prototype fakes the submit. Production needs a small pipeline; recommended:

1. **Store** — Supabase (Postgres) table `waitlist`:
   `id uuid pk · email text unique · role text check (player|coach|club|parent) · source text (utm/referrer) · created_at timestamptz default now() · confirmed_at timestamptz null · unsubscribed_at timestamptz null`.
   Unique on `email` — a repeat submit is a no-op that still shows the success state.
2. **API** — Next.js route handler `POST /api/waitlist`: validate email, rate-limit by IP (e.g. Upstash), insert, then fire the notifications below. Never log the email in plain text anywhere else.
3. **Owner notification (how you find out)** — on every new row, send an email to the founder inbox via **Resend** (from `hello@pitchfootball.com.au`): subject `New waitlist: {role}`, body = role, masked email, running total by role. Optionally also a Slack/Discord webhook message for instant pings. Club sign-ups should be flagged (subject `⚑ Club interest — {domain}`) because they feed the Founding XI outreach.
4. **Confirmation to the signer** — one email, sent immediately: "You're on the list" + one-click unsubscribe link (sets `unsubscribed_at`). This is the only email until launch, matching the copy on the page.
5. **Tracking / dashboard (how you watch it)** —
   - Supabase's table view is enough day one; add a saved SQL view `waitlist_daily` (count by day × role).
   - Add **Plausible** or **Vercel Analytics** to the site and fire a custom event `waitlist_submit` with `{ role }` on success, plus `seat_pick` `{ persona }` and `cta_click` `{ location }` so you can see which seat converts.
   - Weekly digest: a Vercel Cron (`0 9 * * 1`) that emails totals by role, week-over-week, and the list of club domains.
6. **Export** — `GET /api/waitlist/export` behind an admin token → CSV for Mailchimp/Resend Audiences when you launch.

Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFY_EMAIL`, `SLACK_WEBHOOK_URL` (optional), `ADMIN_TOKEN`.

## Design tokens
- Colours: bg `#070b09`; surface `#0d1411`, `#121b16`, `#0a0f0c`, `#0b120e`; border `#1c2822`, `#24322a`; text `#eef5f0`; muted `#b9c8bf`, `#c8d6cd`; dim `#7d8f85`, `#6b7d73`; player `#3ddc84` (on-text `#06130c`); coach `#d95926` (`#14080a`); club `#eda100` (`#14100a`, tints `#2b2415`/`#4a3a12`/`#d9cfb3`/`#b9aa7a`); parent `#a479e2` (`#120a1e`, tints `#d6cde6`/`#b9aecc`/`#c9b3f0`); alert `#e34948`; pitch green `#135a34`/`#17683c`/`#14593a`; floodlight `#fff5d6`.
- Glows: `rgba(61,220,132,.22)`, `rgba(217,89,38,.22)`, `rgba(237,161,0,.2)`, `rgba(164,121,226,.22)`.
- Type (Archivo): kicker 11–12px/800/.16–.18em caps; H1 `clamp(40px,7.4vw,112px)`; H2 `clamp(34px,4.6vw,56px)` 900 −.035em lh 1; section H2 alt `clamp(36px,5.2vw,68px)`; card title 15.5–18px/900; body 14–16px/500 lh 1.55–1.6; small 12–13.5px; micro 9–10.5px/800 tracked caps.
- Radii: 999 pills; 10–14 small tiles; 16–18 cards; 22–24 media/tier cards; 28–32 hero cards; 40 phone.
- Shadows: `0 40px 80px -30px rgba(0,0,0,1)` (floating cards), `0 60px 120px -40px rgba(0,0,0,1)` (phone), `0 30px 60px -20px rgba(0,0,0,.9)` (glass widgets).
- Spacing: section padding 90–110px top; inner gaps 6/8/10/12/14/16/18/32/36/40/48.

## Assets (in `assets/`)
- `film-1..5.png` — hero frames (the run, the strike, the net, the sideline, the club/fence). Compress to ≤1600px JPEG/WebP for production.
- `hl-1..5.png` — highlight-card crops; `story-1..3.png` — development-story posters. Placeholders derived from the hero frames — **replace with real photography** shot on dark backgrounds.
- `brand/` — Pitch symbol/wordmark SVG + PNG, app icon.
- Font: Archivo via Google Fonts (`wght@500;700;800;900`).
- Icons are inline SVG strokes (check, chevrons, key, lock, pause, whistle, play).

## Files
- `Pitch Website - Coming Soon v2.dc.html` — the full design (markup + all copy/data + logic).
- `Pitch Coming Soon - Mobile Preview.dc.html` — the page framed at 390px and 360px.
- `support.js`, `image-slot.js` — prototype runtime only; do not port.
