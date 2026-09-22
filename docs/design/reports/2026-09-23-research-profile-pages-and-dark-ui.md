# Design research: profile-as-product pages, and dark UI at large widths

**What this is.** Design research gathered on 23 September 2026 for the Pitch product design report, covering two questions: (A) pages where a single person's public page *is* the product and has to read as a credible document at desktop width, and (B) dark-mode-first products that handle 1440px and wider without looking empty or like a black void. Everything in it is from public material only — live public pages, published design-system documentation, and writing by the teams themselves. Nothing was behind a login, nothing was downloaded, and no assets were saved. Three labels are used throughout and should be trusted literally: **MEASURED** means I loaded the live public page in a browser at an emulated 1440×900 viewport on 23 September 2026 and read the rendered geometry or the computed CSS custom properties directly off the page — these are first-hand measurements, not published figures, but they are not guesses either; **CITED** means a published line I can attribute to a named source with a URL; **INFERRED** means I am reasoning from adjacent evidence, including contrast ratios I computed myself from published hex values. Two things to flag for whoever reads this next. First, a disclosure: while collecting Part B, navigating to `supabase.com/dashboard` landed on an already-authenticated session in the browser pane. I left immediately and nothing seen on that authenticated surface is in this report — the Supabase notes below come only from their public documentation. Nothing in this work justifies using an authenticated surface, ours or anyone else's. Second, this report is the only artefact written from this research: no screenshots and no downloads were kept, because the machine was at roughly 4GB free disk when it was written.

---

Two notes on method before the findings.

**Everything here is public.** No sign-ins, no downloads. One correction to log: navigating to `supabase.com/dashboard` landed on an already-authenticated session in the browser pane. I left immediately and have excluded everything I saw there; the Supabase notes below come only from their public docs.

**I did more than read.** Alongside the published writing, I loaded the live pages at an emulated 1440×900 viewport and measured the rendered geometry and computed CSS custom properties directly. Numbers labelled MEASURED are first-hand from the live page on 23 Sep 2026; they are not published figures, but they are not guesses either. CITED means a published line I can attribute. INFERRED means I am reasoning.

---

# PART A — "Profile as product"

## The headline finding: the category, as a standalone business, has largely failed

This reframes the whole brief, so it goes first.

- **Read.cv** — acquired by Perplexity (announced 17 Jan 2025); site and posts deleted 16 May 2025. https://techcrunch.com/2025/01/17/perplexity-acquires-read-cv-a-social-media-platform-for-professionals/
- **Posts.cv** — not a successor. It was read.cv's sibling product and died with it. I confirmed this directly: `posts.cv` currently serves a Vercel **"Deployment Paused"** page. MEASURED.
- **Polywork** — shut down 31 Jan 2025. Domain no longer resolves.
- **Bento.me** — confirmed first-hand: `bento.me` now **301-redirects to linktr.ee**. MEASURED. Acquired by Linktree June 2023; full shutdown 13 Feb 2026, data deleted, links redirect. https://alternativeto.net/news/2025/12/bento-to-shut-down-in-2026-as-linktree-takes-over-and-offers-migration-path/
- **About.me** — alive but pivoted to an AI chatbot layer. Its own current copy: "Your page still looks the same — beautiful and simple — but now it talks back." CITED.

**The survivors that read as documents are all features of something else** — GitHub, Notion, Cal.com, Substack. That is the single most useful strategic observation for the report. A person-page appears to be sustainable as a *surface on a system of record*, not as a destination.

## A1. Content width and column structure at 1440px

All MEASURED at 1440px viewport.

| Page | Content band | Structure |
|---|---|---|
| **GitHub profile** | 1216px (112px gutters) | Rail **296** + gap 24 + main **896** |
| **Substack publication /about** | **728** centred (356px gutters) | Single column |
| **Substack social profile** | 1208 shell | Left nav rail + centre feed **568** + right rail |
| **Transfermarkt player** | **1034 fixed** (203px gutters) | Main **689** + right rail **339** |
| **Premier League player** | ~1392 | Left identity rail ~448 + main **928** |
| **Dribbble profile** | 1296 (72px gutters) | Masthead two-up: text **600** + image **636** |
| **Cal.com booker** | **760** centred (340px gutters) | Meta rail **280** + calendar **480** |
| **About.me** | **620** centred (410px gutters) | Single column over full-bleed photo |
| **Notion** | ~700–720, unpublished | Single column; "Full width" is opt-in |
| **Linear (for contrast)** | `--page-max-width: 1024px` | Single column |

Three things fall out of this table.

**The document pages are narrow and the social pages are wide.** Substack is the perfect controlled experiment, because it is the same company shipping both. The publication About page is a **728px single centred column with 356px of empty margin on each side** — and its inline images are set *narrower than the measure* (601px, 446px), centred within it. That is a book move, not a web move. The same company's social profile at `substack.com/@handle` is a **568px feed column flanked by two rails** inside a 1208px shell. Narrower column, wider page, and it reads as a feed.

**Nobody fills 1440.** Transfermarkt is the extreme: a **fixed 1034px** layout that does not respond at all, leaving 203px of dead gutter each side. Cal.com is more extreme in proportion — a 760×490 card floating in a 1440px field, roughly 28% of the viewport width. Neither looks broken. The emptiness reads as margin.

**Linear publishes the number.** `--page-max-width: 1024px` is a real design token on linear.app. CITED (rendered from their own stylesheet). That is the cleanest available precedent for "cap the measure, let the field breathe."

**The rail is either identity or metadata, never both.** GitHub's 296px rail is identity + stable facts (avatar, name, handle, bio, company, location, links, follow). Transfermarkt's 339px right rail is derived data (market value history, transfers). Cal.com's 280px rail is event metadata including host profile. Premier League's ~448px left rail is the player's identity block. In no case does the rail carry the narrative — it carries the facts you would put in a letterhead or a sidebar table.

## A2. How identity is announced, and how much space it eats

MEASURED, vertical distance from viewport top to the first line of substance.

- **GitHub** — no hero at all. The avatar is a **296×296 square filling the full rail width**, name at y=452. But the main column starts at **y=108**, level with the top of the avatar. So the reader reaches substance immediately; the identity block runs *beside* the content, not above it. This is the strongest pattern in the set. It costs zero vertical space because it is spent horizontally.
- **Substack /about** — nav ends at 170px, body starts at **y=202**. No avatar, no name banner. The page opens on prose. The identity is the masthead of the publication, already in the chrome.
- **About.me** — full-bleed background photo, content card 620×342 vertically centred, h1 at **y=389**. Pure hero. Everything is identity; there is no "substance" layer beneath.
- **Dribbble** — masthead runs to roughly y=680 and the shot grid does not start until **y=865**. Roughly **670px of header** — a two-up hero with a 636px banner image, follower/following/like counts, and a Follow button. This is what a social page looks like.
- **Transfermarkt** — the `data-header` does not begin until **y=515**, because of stacked nav and ad slots above it. The header itself is 1024×257 and packs the player image (139×181), name, and a details block in a dense row. Once you are past the chrome, identity is compact and tabular.
- **Cal.com** — avatar is **24×24**, h1 at y=270 inside a vertically centred card. Identity is a caption, not a banner.

**The pattern:** pages that want to read as documents either put identity in a rail (GitHub, Premier League, Cal.com) or skip a visual identity block entirely and open on prose (Substack). Pages that read as social spend 400–700px of vertical space on a hero and put social proof counts in it.

## A3. Sparse profiles — how they avoid looking broken

This is where I could get evidence nobody has published, by finding a genuinely sparse profile and measuring it against a dense one.

**GitHub, dense (`sindresorhus`) vs sparse (`IanMHogan`).** MEASURED.

The grid does not change at all: rail **296px**, main **896px**, avatar **296×296** in both. Page height drops from ~2900px to **1062px**. The mechanism, confirmed by checking element presence directly:

- Profile README card — **absent from the DOM**, not an empty placeholder.
- Achievements — **absent**.
- Organisations — **absent**.
- Pinned items grid — **absent**.
- Contribution graph — **present and rendered in full**, reading "13 contributions in the last year".
- Popular repositories — heading **retained**, with the line "IanMHogan doesn't have any public repositories yet."

So GitHub's technique is **silent omission for authored sections, forced render for machine-generated ones**. The page is short but not holed. And critically, **the rail stays at full width and the avatar stays 296px** — the identity column is load-bearing and never shrinks, so the page always has a solid left edge. All emptiness is confined to the main column, which simply ends.

I'd flag the one wrinkle: that "doesn't have any public repositories yet" line is mildly scolding, and the empty contribution graph is the single most exposing element on a sparse GitHub profile. If the report wants a rule, it is: **omit what the person authored; be careful about rendering an empty grid of what they did.**

**The other mechanisms, ranked:**

1. **About.me — never promise more than a card.** MEASURED: the entire profile is 620×342. Name, location, one paragraph, links. There is nothing to be sparse *relative to*. Cheap and effective, but it caps the ceiling: this format can never carry a CV's worth of content.
2. **Notion — no skeleton at all.** CITED via their docs. There are no sections, only blocks the author added. A three-fact page is a three-block page and looks deliberate. Cost: zero structural guarantee of credibility, so it can't be a format.
3. **Cal.com — an optional rail with a designed fallback.** CITED, and the best single mechanic in the set. The Booker's `hideEventMetadata` prop removes the left rail entirely, and `showTimezoneWhenEventDetailsHidden` substitutes a timezone row above the booker. https://cal.com/docs/platform/atoms/booker — the rail is a boolean with a planned replacement, not a container that can sit empty.
4. **Polywork — badges as filler.** INFERRED. Chips like "vegan", "dad" meant a user with three real facts could still emit a dozen tokens. It solved the empty-state problem and created the credibility problem; arguably a reason the pages never read as professional.
5. **Bento-style grids — the anti-pattern.** INFERRED. A tile grid with three tiles either leaves visible holes or stretches tiles oddly. **A grid advertises what is missing; a single column just ends.** Worth stating as a rule.

## A4. What makes it read as a document rather than a social page

Synthesising the measurements, five specific mechanisms:

**1. Narrow measure with generous margin.** 620–760px is the document band across About.me, Cal.com, Substack and Notion; Linear's published cap is 1024. The citable rationale is not from any of these products — it is Matthew Butterick, *Practical Typography*: an average line of "45–90 characters, including spaces". CITED. https://practicaltypography.com/line-length.html Worth noting in the report that **no profile product in this set publishes a width number** — Butterick is the only published figure available.

**2. Assertion, then provenance, then corroboration.** Stripe Press book pages run title → description → author bio with hard credentials → named praise quotes. OBSERVED. GitHub runs the same shape: author-controlled README on top, machine-generated evidence (contributions, pinned repos) below. Claim first, evidence underneath, in that order.

**3. Stable factual metadata in a fixed position.** GitHub's rail and Transfermarkt's header both read like letterhead: the same fields in the same place on every page. Comparability across people is what makes a page feel like a record rather than an expression.

**4. Absence of engagement metrics.** The single clearest tell in the data. Dribbble's masthead leads with "117,608 followers / 1,820 following / 46,454 likes" and a Follow button. Substack's social profile leads with "36K+ subscribers • #25 in History" and Subscribe/Message. Neither GitHub's rail nor Substack's About page nor Cal.com's booker shows a count of anyone. **Follower counts are the strongest single signal that a page is social.**

**5. Images constrained to the measure.** Substack's About page insets images *narrower* than the 728px column rather than bleeding them. MEASURED. Full-bleed imagery is a magazine/social move; contained figures are a document move.

## A5. Print stylesheets and PDF export — mostly a void, with one real example

I checked `@media print` rule counts directly in each page's stylesheets. MEASURED.

- **Substack /about — 0 print blocks.**
- **Dribbble profile — 0.**
- **Transfermarkt player — 0.**
- **GitHub — 2 print blocks, and they are real.** The substantive one hides all chrome (`.Header`, `.header-search`, `.footer`, `.pagehead-actions`, `.timeline-comment-actions`, `.file-actions`, `.gh-header-sticky`, `.language-color` and more) with `display: none !important`, collapses the language stats graph to `height: 0`, and then controls pagination: `p, .comment h2 { break-inside: avoid; }` and `.markdown-body h2 { break-after: avoid; }`.

That last pair is the technique worth lifting: **strip chrome, then forbid breaks inside paragraphs and immediately after headings** so a heading never orphans at the foot of a page.

**The read.cv PDF premise does not hold, and the truth is more interesting.** Read.cv had **no native PDF export**. Evidence is threefold: a commenter in Andy Chung's own Show HN launch thread asks for exactly that feature (https://news.ycombinator.com/item?id=25634192); the shutdown data export shipped **JSON plus a deployable Next.js project**, not PDF (https://foote.pub/2025/01/18/read-cv-eol-nextjs.html); and a third-party converter, readcvpdf.com, existed to fill the gap and is now itself dead. Read.cv's portability answer was **source code export** — you could redeploy your profile on Vercel and own it. That is a genuinely different answer to "forwardable" and probably a better story for the report than a print stylesheet.

Founder framing worth quoting, from that same Show HN: Andy Chung described it as "simpler than LinkedIn and more dynamic than a PDF," and said he "focused on legibility." CITED. Read.cv positioned itself deliberately *between* social page and document — it did not pick a side.

**Notion is the only product with published export guidance.** CITED, https://www.notion.com/help/export-your-content — PDF export offers paper size, a scale percentage, and an "Include content" dropdown to exclude files and images. `Include subpages` is Business/Enterprise only; custom emoji do not render; a failed PDF export silently falls back to HTML. Also worth noting from their styling docs: "Full width" is opt-in and still not the default despite demand — Notion's answer to page width is that **the document measure wins over filling the viewport**.

**Football-specific gap:** Wyscout and InStat are login-only with no public design documentation. But the industry's expectation is worth noting — commercial scouting-report builders standardise output as **PDF with fixed sections, radar charts and percentile ratings**, so every report on a watchlist looks identical. Comparability, again, is what makes it a record.

---

# PART B — Dark interfaces at 1440px+

## B1. Elevations: how many planes, and how far apart

I pulled the live rendered custom properties from each product's own stylesheet, and extracted GitHub's from the published `@primer/primitives@11.10.0` package. These are exact published values, not third-party extractions.

**Linear** (rendered from linear.app — a named four-level ladder):

```
--color-bg-level-0: #08090a     --color-bg-primary:    #08090a
--color-bg-level-1: #0f1011     --color-bg-secondary:  #1c1c1f
--color-bg-level-2: #141516     --color-bg-tertiary:   #232326
--color-bg-level-3: #191a1b     --color-bg-quaternary: #28282c
--color-bg-panel:   #0f1011     --color-bg-translucent: #ffffff0d
```

**GitHub Primer dark** (published token CSS):
`--bgColor-inset #010409` → `--bgColor-default #0d1117` → `--bgColor-muted #151b23` → `--bgColor-disabled #212830` → `--bgColor-emphasis #3d444d`. Note **inset and overlay both go darker than the page**, the opposite of Material.

**GitHub dark dimmed:** the whole ladder shifts up — `default #212830`, `muted #262c36`, `inset #151b23`. Dimmed's page background is the same value as Dark's *disabled* level.

**Vercel Geist dark:** `--ds-background-200: hsl(0 0% 0%)` (literally black), `--ds-background-100: hsl(0 0% 4%)`, then gray-100 10%, gray-200 12%, gray-300 16%, gray-400 18%. Only **two** background tokens; Geist's docs say to "use Background 1—especially when color is being placed on top." CITED.

**Raycast:** `--color-bg #07080a`, `--color-bg-100 #101111`, `--color-bg-200 #18191a`, `--color-bg-300 #313133`, `--color-bg-400 #494b4d`.

**Railway:** `--background: hsl(250 24% 9%)`, `--secondaryBg: hsl(250 21% 11%)`, gray-50 13%, gray-100 15%, gray-200 22%. Note the **saturation falls as lightness rises** (24% → 21% → 18% → 11%) — a violet-tinted near-black that neutralises as it lightens.

**Sentry:** `--bg-primary #1f1633`, `--bg-secondary #181225`, `--border-color #362d59`. The whole neutral ramp is **chromatic violet**, and the secondary background is *darker* than primary.

**Radix dark gray** (the canonical published scale): `#111111 #191919 #222222 #2a2a2a #313131 #3a3a3a #484848 #606060 #6e6e6e #7b7b7b #b4b4b4 #eeeeee`. Steps 1→4 are roughly **4–4.5 L\* apart each**, about 8 hex points at the dark end.

**The measured answer to "how far apart":** I computed WCAG contrast between adjacent planes. **Elevation steps are essentially invisible on their own.**

| System | Page → next surface | Ratio |
|---|---|---|
| Linear | `#08090a` → `#0f1011` | **1.05:1** |
| GitHub dark | `#0d1117` → `#151b23` | **1.09:1** |
| Raycast | `#07080a` → `#101111` | **1.06:1** |
| Vercel | `#000` → 4% | **1.06:1** |
| GitHub dimmed | `#212830` → `#262c36` | **1.06:1** |

Five independent systems, all landing between 1.05 and 1.09:1. **An elevation step in a good dark UI is around a 1.05–1.10:1 change — you can barely see it, and that is the point.** It is a hint, not a boundary. INFERRED (computed by me from the published hex).

The convergent structural answer is **two to four planes, not a ramp**. Geist: two. Apple HIG: two (base and elevated). Radix: page on step 1, cards *and* sidebars *and* canvas all on step 2. Sentry: three named backgrounds explicitly without elevation. Only Material runs a monotonic lighten-with-depth ramp — and Material 3 replaced the computed overlay with a short enumerated list of container tones.

## B2. What separates regions at width — borders win, and they say why

**The published reason shadows fail.** Material Components for Android states it plainly: shadows "have less contrast with the dark background colors." CITED. https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md

**Primer's practice proves it.** Every *floating* shadow token in Primer dark begins with a hairline ring: `--shadow-floating-small: 0 0 0 1px #3d444d, 0 6px 12px -3px #01040966, ...`. CITED. The blur layers are near-black at 40% alpha, which on a `#0d1117` page can barely darken anything. **The border does the elevation work; the shadow is atmosphere.** Resting shadows carry no ring — cards at rest rely on the background delta plus `--borderColor-default`.

**Hairlines are calibrated deliberately low.** Computed by me:

- Linear `--color-line-primary #37393a` on page = **1.72:1**; `--color-line-secondary #202122` = **1.24:1**. And Linear ships `--border-hairline: .5px` — a **sub-pixel** border token.
- GitHub `--borderColor-default #3d444d` on page = **1.93:1**. Also `--borderColor-muted: #3d444db3` — the same colour at 70% alpha.
- Raycast `--color-border #242728` = **1.33:1**.
- Radix step 6 `#3a3a3a` on step 1 = **1.67:1**; step 7 = 2.07:1; **step 8 `#606060` = 3.01:1** — landing exactly on the WCAG non-text threshold. Radix's "stronger borders and focus rings" step is contrast-calibrated, not eyeballed. Primer independently says step 8 is the "minimum contrast value for interactive control borders." CITED.

So there is a published two-tier rule hiding in here: **decorative hairlines at ~1.3–2:1, interactive borders and focus rings at exactly 3:1.**

**Borders are first-class in the token budget.** Geist spends 3 of its 10 scale steps on border states (400 default, 500 hover, 600 active). Radix spends 3 of 12 (steps 6, 7, 8). Sentry ships two — `border` and `innerBorder`, a lighter outer edge and a darker internal division, which is a neat pattern specifically for wide layouts.

**The dissenting voice is the best one for 1440px.** Vercel's published design guidance: "The page is normally one continuous canvas." And: "Earn a surface or boundary only when it communicates selection, interaction, warning, contrast, or a real grouping." CITED, https://vercel.com/design.md. Spacing first; a border only when it means something.

Linear's own marketing site backs this with a number: `--page-max-width: 1024px` at any viewport. **The answer to "1440 looks empty" is not to fill it — it is to cap the measure and let the dark field be margin.**

## B3. Using one accent without it screaming

Three published mechanisms, and they stack.

**1. Different step for text than for fills.** Radix: step 9 `#0090ff` is the solid fill (5.8:1 on step 1); step 11 `#70b8ff` is the text accent (9.0:1). GitHub does the same: `--bgColor-accent-emphasis #1f6feb` for filled buttons, `--fgColor-accent #4493f8` for links. **The colour you fill with is not the colour you write with.**

There is a hard constraint hiding here. I computed Linear's: `--color-accent #7170ff` on page = **5.18:1** (passes AA), but `--color-brand-bg #5e6ad2` = **4.24:1** (fails AA for body text). And sure enough, `#5e6ad2` is paired with `--color-brand-text: #fff` — it is used as a *background* with white on it, never as text. The token names encode the rule.

**2. Low-alpha tints instead of solid fills.** Raycast is the clearest: every accent ships a companion at 15% alpha — `--color-blue #57c1ff` / `--color-blue-transparent #57c1ff26`, and the same for red, green, yellow. GitHub: `--bgColor-accent-muted: #388bfd1a` (10% alpha). Linear: `--color-accent-tint: #18182f`, a near-black violet wash. **An accent-coloured region is the accent at 10–15% alpha, not the accent.**

**3. Desaturate and lighten.** Google: "more saturated colors tend to visually 'vibrate' against darker backgrounds." CITED. GitHub's dimmed theme applies this mechanically — accent drops from `#4493f8` to `#478be6`.

**Where accent is forbidden:**

- **Never as the sole carrier of meaning.** Primer: validation state "must not rely on color as the sole way" to convey it; charts must use patterns. CITED.
- **Never for sentiment or importance.** Vercel: "Use color only when it adds significant meaning to state, action, or data." Their named anti-patterns are colouring a savings figure green because it is favourable, and colouring a bar because it is important. CITED.
- **Never decoratively.** Vercel's system "avoids decorative gradients, glows, textures, or glass effects entirely." CITED.
- Radix adds a narrow one: be careful with saturated grey app backgrounds when the UI carries many colourful badges, "especially in dark mode."

Primer contributes one unusual rule worth surfacing: their inclusive-design post requires **3:1 contrast between the link colour and the body text colour**, not just against the background. https://github.blog/engineering/user-experience/unlocking-inclusive-design-how-primers-color-system-is-making-github-com-more-inclusive/ Your accent must be distinguishable from your grey, not merely legible on your black.

## B4. The "sea of grey cards" problem — the published answers

In descending order of usefulness:

1. **Vercel: earn the surface.** "The page is normally one continuous canvas… Earn a surface or boundary only when it communicates… a real grouping." CITED. The default is no card.
2. **Figma: make loudness an explicit axis.** Their dark-mode post describes a token schema with a **"Prominence"** dimension — `{default, secondary, tertiary, strong}` — so every surface declares how loud it is rather than inheriting depth from nesting. Token names concatenate: `color-bg-menu-secondary-hovered`. CITED, https://www.figma.com/blog/illuminating-dark-mode/ Figma's other structural insight: surfaces are not uniform — "Menus and toolbars are always dark in Figma regardless of theme, but panels change." You cannot map one grey ramp across all chrome.
3. **Radix: a card is not automatically a new plane.** Step 2 is explicitly for "card background, sidebar background, and canvas area background" — all three on the *same* step. CITED. Cards, sidebars and canvas share a surface; steps 3/4/5 are reserved for component *states*, not surfaces.
4. **Primer: anchor contrast to the harder background.** All Primer text and border contrast is calculated against `bgColor-muted`, not the page. So content stays legible whichever plane it lands on, and you stop needing a distinct card colour to guarantee legibility. CITED.
5. **Material: flatten, don't stack.** They "avoid overdraw with the elevation overlays by calculating a composite blend" rather than stacking translucent layers. CITED. Stacked translucent overlays are literally what produces the mud.
6. **Sentry names the organisational cost.** With eighteen greys, engineers "were forced to think way too long" about which to use. Their landing principle: "consistency is more important than ideological purity." CITED, https://blog.sentry.io/building-dark-mode/
7. **Go chromatic.** Sentry's entire neutral ramp is violet (`#1f1633` page, `#362d59` border). Railway's is violet-tinted with falling saturation. Tailwind's dark greys are blue-cast, not neutral — MEASURED: `--color-gray-950` is `lab(1.9% 0.28 -5.49)`, a clearly negative b\*. A grey with a hue is not a grey card.

## B5. Why not pure white, and contrast in dark themes

**Google is the most explicit.** Pure `#FFFFFF` "would visually 'vibrate' against our dark backgrounds." CITED, https://codelabs.developers.google.com/codelabs/design-material-darktheme The named failure mode, in Google's own words, is "pixel-bleed, where small white letters contrast too heavily and blur against a dark background" — halation. They prescribe dark grey over pure black to "reduce eye strain and pixel-bleed", base surface `#121212`, and text at **87% / 60% / 38%** opacity. CITED, https://design.google/library/material-design-dark-theme

**Every system I measured backs this with values rather than prose.** Body text on the page background, computed:

| System | Body text | Ratio | Pure white would be |
|---|---|---|---|
| Linear | `#f7f8f8` | **18.73:1** | 19.93:1 |
| GitHub dark | `#f0f6fc` | **17.39:1** | 18.92:1 |
| Raycast | `#f4f4f6` | **18.24:1** | 20.04:1 |
| Vercel | `#ededed` | **17.94:1** | 19.80:1 |
| Radix step 12 | `#eeeeee` | **18.5:1** | — |
| GitHub dimmed | `#d1d7e0` | **10.28:1** | 14.88:1 |

Four independent dark systems, none using `#ffffff`, all landing at **17–19:1 where pure white would give 19–20:1**. It is a deliberate, small, consistent step back from the maximum — roughly 5–8%.

**The tell is in GitHub's theme set.** `--fgColor-default` is `#f0f6fc` in dark and `#d1d7e0` in dark dimmed — but `#ffffff` in **dark-high-contrast** only. Pure white is reserved for the accessibility theme. MEASURED from the published primitives. That is the cleanest single piece of evidence for the rule.

**The secondary ladder.** Linear: `#d0d6e0` (13.64:1) → `#8a8f98` (6.13:1) → `#62666d` (**3.45:1**, below AA, so decorative/disabled only). GitHub muted `#9198a1` = 6.5:1. Raycast fg-300 `#78787c` = 4.56:1, just over AA. So: **~18:1 body, ~6:1 secondary, ~3.5:1 disabled.**

**Published targets:**
- Primer: 4.5:1 normal text, 3:1 large text / input borders / functional icons, **7:1** for high-contrast themes. Button borders explicitly exempt — only the label needs to pass. CITED.
- Radix guarantees steps 11 and 12 to **APCA Lc 60 and Lc 90** on a step-2 background — the only system here using APCA rather than WCAG. CITED.
- Primer explicitly exempts non-default themes including dark dimmed from WCAG, on the grounds that "a higher contrast experience may actually be less accessible for the user." CITED. Dimmed measures ~10.3:1 body text against Dark's ~17.4:1 — a deliberate, documented ~7-point reduction because some users want less contrast, not more.
- Primer authors scales in **HSLuv** so that "two colors with the same lightness value will look equally bright." CITED, https://github.blog/news-insights/product-news/accelerating-github-theme-creation-with-color-tooling/
- Linear migrated themes to **LCH**, reducing 98 per-theme variables to three — base colour, accent colour, and a **contrast** variable that "allows us to automatically include super high-contrast themes." CITED, https://linear.app/now/how-we-redesigned-the-linear-ui

**Apple's model is a useful counterpoint:** two background sets only, base and elevated, where "the background color automatically changes from base to elevated when an interface is in the foreground." The plane change is tied to *foreground-ness*, not nesting depth. Caveat: the HIG is client-rendered and this came via search snippets of Apple's page — re-verify in a browser before quoting.

---

## Gaps and cautions for the write-up

- **No profile product publishes a content-width number.** Every width in Part A is either my measurement or Butterick's 45–90 characters. Say so.
- **The read.cv PDF premise is wrong** — the real story is Next.js source export. Invert it; it is a better story.
- **Geist and Supabase publish token *names* but not hex as text.** My Vercel values are rendered, not documented. Supabase's public docs are a stub; the circulating hex values (`#0f0f0f`, `#3ecf8e`, three-tier borders) are third-party extraction and I would not cite them. I deliberately excluded the authenticated dashboard.
- **Railway, Warp, Arc and Spotify have no first-party design writing** on this topic. My Railway and Raycast values are rendered from their marketing sites. Warp's marketing site is light-mode, so nothing useful there.
- **Material m2/m3.material.io and developer.apple.com are client-rendered** and unfetchable. The Material facts above come from Google Codelabs, design.google and the Material Components Android repo — all Google-authored, but not the spec pages. The per-dp overlay table (0dp 0% … 24dp 16%) and M3 tone numbers are third-party; do not quote without re-verifying.
- **Tailwind publishes no dark-palette guidance at all** — only the `dark:` mechanics. Worth stating plainly, because the most-copied dark snippet in the ecosystem (`bg-white dark:bg-gray-800` with a light-mode `ring-gray-900/5` left in) is a mechanics demo, not a design reference.
- **Cal.com shipped a bookings-page redesign on 14 Nov 2025 and reverted it**, citing designs "completed several months before implementation began." https://cal.com/blog/incident-review-booking-page-update-november-14-2025 — a rare, quotable cautionary note about redesigning a page people depend on.
