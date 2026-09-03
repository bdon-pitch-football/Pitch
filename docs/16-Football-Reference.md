# 16 · Football Reference

> **Vocabulary note added 27 Aug (D-141):** the product noun for a player's record is **CV**, everywhere — every club-facing surface, every message in doc 15, every table and column name. **"Passport" appears on exactly one line of the front door and nowhere else.** Do not propagate it. Two nouns for one object is how a data model ends up with two.
>
> **And the reverse trap (D-143):** the pre-launch page is a **waitlist**. It never says *register your interest* — those words name the paid club product, and using them for an email capture teaches the market a second meaning for the term before it has learned the first. Applies to the ads that point at the page too. — positions, stat sets, and the three house fixtures

> **What this file is:** the closed football vocabulary the build validates against, and the seed data every screen is built on.
>
> **Whose it is:** the position taxonomy and the stat map belong to **Pep (Head of Football)**. Leo has drafted them so the build is not blocked and so Pep is correcting a list rather than starting from a blank page. **Every section here is marked with who closes it.** Written by Leo, 25 Aug 2026.

---

## 1 · Position taxonomy — 🔒 SET BY BUZ, 25 Aug

**Why it must be a closed list.** Positions drive `STAT_SETS` (D-70), the trials index `position_needs` filter (D-68), and GK-scoped competencies from December (D-60). Free text here means unfilterable data by December and a migration nobody wants.

**Ten positions, set by BUZ 25 Aug:**

| Code | Label | Group |
|---|---|---|
| `GK` | Goalkeeper | GK |
| `RB` | Right back | DEF |
| `CB` | Centre back | DEF |
| `LB` | Left back | DEF |
| `DM` | Defensive midfielder | MID |
| `CM` | Central midfielder | MID |
| `CAM` | Attacking midfielder | MID |
| `RW` | Right wing | FWD |
| `LW` | Left wing | FWD |
| `ST` | Striker | FWD |

**This is the list. It replaces Leo's fourteen-position draft, and it is better** — ten is scannable on a phone in one pass, and the four that went are the four a 13-year-old would have picked badly:

- **Wing back** — a coach's word for a role, not a position a junior is picked in. A kid who plays there picks full back or wide.
- **Right and left midfield** — increasingly folded into the wide-forward roles at junior level. A player who plays wide midfield picks `RW` or `LW`, which is also how a TD reads it.
- **Second striker** — a tactical description, not something anyone gets selected as at junior level. That player is a `CAM` or an `ST`.
- **Sweeper** was already out of the draft and stays out.

**One normalisation Leo applied and is flagging:** the labels are rendered in consistent sentence case (`Right back`, not `Right Back`; `Attacking midfielder`, not `Attacking Midfielder`). The codes and the set are exactly as BUZ gave them. If the capitalisation matters, it is a one-line change.

**Consequence worth naming:** a player who genuinely plays wide midfield now selects `RW` or `LW`, which slightly over-states how advanced their role is. That is the right trade — the alternative is a fourteen-item list where a 12-year-old picks "wing back" because it sounds better than "left back", and we would be capturing vanity rather than position.

**`position_group` is derived at read time from `positions[0]`, never stored** (D-69).

**Closed.** It is a lookup table (D-73), so a later addition is cheap — but these ten codes are what `STAT_SETS` keys off and what the trials index filters on, so the build treats the list as fixed.

---

## 2 · Position → stat set — 🔒 CLOSED BY BUZ, 25 Aug

Per D-70, this lives in TypeScript, not Postgres. Maximum four tiles rendered; nulls omitted, never shown as zero.

**AMENDED 27 Aug (D-105) — these are the DEFAULT SELECTION, not the renderer.** BUZ's call: *"All players should be able to select what stats they want to surface on their page. A defender would have more clean sheets than goals but would still want to publish that."* A player opens the builder with their position's set pre-ticked and changes it. **All four are choosable — BUZ's call, 27 Aug: appearances, clean sheets, goals and assists.** The player decides which come to the forefront. If every stat is switched off, the stats block does not render at all — no empty frame. The self-reported provenance chip renders whenever the block does, whatever is selected. Selection is stored on the record as `surfaced_stats` and goes into the first migration.

**Choice selects; data decides.** Ticking a stat makes it a candidate — the never-zero rule still governs whether it renders. A keeper who ticks goals and has none still shows nothing.

```ts
export const STAT_SETS = {
  GK:    ['apps', 'clean_sheets'],
  DEF:   ['apps', 'clean_sheets', 'goals', 'assists'],
  MID:   ['apps', 'goals', 'assists'],
  FWD:   ['apps', 'goals', 'assists'],
  UNSET: ['apps', 'goals', 'assists'],
} as const
```

**The honesty limit — ruled by BUZ, 25 Aug: *"That should stay out of the catalogue. Simplicity will be key early."***

 the catalogue carries only what a 15-year-old can genuinely know — **appearances, goals, assists, clean sheets**. Deliberately excluded: **tackles, interceptions, duels won, saves, pass completion**.

**AMENDED 27 Aug — `minutes` is removed from the catalogue.** BUZ's call: *"Leave out minutes played for now. This will come in at a later phase once we start tracking minutes played."* And he is right that it does not belong yet — nobody at community level counts minutes, so every figure would be an estimate, which is the exact failure mode D-11 exists to prevent. It returns as a **derived** number when the match-day tracker produces it from real substitutions (D-66), and a derived number is worth something a typed one never was.

> **The cost, named so nobody is surprised by it: this lands almost entirely on goalkeepers.** The GK set is now `apps` and `clean_sheets` — two tiles — and under the never-zero rule a keeper who has not kept a clean sheet yet renders **one**. Nate's fixture exists precisely to prove a keeper's page does not look empty, and this makes that harder. **If the two-tile keeper page does not survive the screenshot test, the honest fix is to give GK back a third number, not to relax the never-zero rule.**

**And the reason this is a safe way to start rather than a limitation:** the catalogue lives in TypeScript, not Postgres (D-70), so adding a stat key later is a code change with zero migration. Starting narrow is fully reversible. Starting wide is not — you can always add a key, but you can never un-collect three seasons of invented tackle counts, and by then they are on real children's records with our name on them. Nobody counts them at community level, so everybody would estimate them upward, and we would have built a moat around numbers people made up (D-11). If defenders need a better answer than a thin number set, the honest one is minutes played, which arrives with the December sprint (D-66).

**No negative statistic exists in the catalogue at all** — there is no `goals_conceded` key to accidentally render (D-67).

---

## 3 · The three house fixtures

Built **day one of the sprint, 29 Aug, before any screen** — they are the test data everything else is built against, and building against Deniz alone means the GK layout and the girls' club rows get discovered in the last week (doc 10).

All three are **fictional and clearly fictional**. No real minor's data appears in any environment, ever.

**These are also Anna's screenshot set. No launch asset ships with only Deniz in it.**

---

### Fixture 1 — Deniz Yılmaz · 14 · the existing house persona

| | |
|---|---|
| **Age band** | u16 — exercises guardian approval, no search surface, guardian-held link |
| **Positions** | `CAM`, `LW` (two of three used) |
| **Number** | 10 · **Foot** Right |
| **Club** | Riverside FC — U15s, Melbourne VIC |
| **Stats 2026** | Apps 18 · Goals 11 · Assists 7 — all `self_reported` |
| **About** | "Right-footed 10 who plays between the lines. Two-footed finisher, working on pressing triggers and weak-foot delivery." |
| **Achievements** | U15 League — Runners up (2026 season) · Players' Player of the Year (Riverside FC, 2025) |
| **Other football** | School — Northcote High 1st XI, 2026 · Futsal — Melbourne Futsal U15, Summer 2025–26 |
| **Highlights** | 2 of 10 used |
| **What he tests** | The happy path, and the U16 share model (child asks, guardian sends — D-91) |

---

### Fixture 2 — Nate Halloran · 17 · goalkeeper

| | |
|---|---|
| **Age band** | 16–17 — exercises discoverability to verified clubs, guardian off-switch, guardian-mediated contact (D-22) |
| **Positions** | `GK` |
| **Number** | 1 · **Foot** Right |
| **Club** | Northern United SC — U18s, Melbourne VIC |
| **Stats 2026** | Apps 22 · Clean sheets 7 — all `self_reported` (minutes removed from the catalogue 27 Aug) |
| **About** | "Reserve keeper pushing for the starting spot. Comfortable playing out under pressure, strong on crosses. Working on my distribution range and commanding the six-yard box." |
| **Achievements** | NPL U18 squad — 2 seasons (2025 and 2026) · Golden Glove, Metro League (Northern United SC, 2025) |
| **Other football** | Representative — Victorian Country carnival, 2026 · Futsal — Brunswick Futsal U18, Summer 2025–26 (outfield) |
| **What he tests** | **D-67 — a CV with no negative number on it.** The GK stat set. And the 16–17 permission band against a real rendered page rather than a synthetic test row, which is a safety win rather than a diversity one |

> **He is the fixture that earns its keep.** Elly's line was the brief: *"My own page makes me look like the worst player at the club. I'd rather send the Veo link on its own."* If Nate's page passes the screenshot test, the CV works for the eight to ten percent of players who are keepers.

---

### Fixture 3 — Georgia Whitcombe · 15 · community club, girls' football — NEW

| | |
|---|---|
| **Age band** | u16 |
| **Positions** | `CM`, `DM` |
| **Number** | 6 · **Foot** Left |
| **Club** | Kingsway Rovers FC — U16 Girls, Melbourne's west |
| **Squad** | `competition_gender: girls`, `age_group: U16` — **on the squad, never on Georgia** (D-68) |
| **Stats 2026** | Apps 16 · Goals 3 · Assists 5 — all `self_reported` |
| **About** | "Left-footed six who likes the ball in tight spaces. Reads the game early and gets on the half-turn. Working on my range of passing and getting into the box more." |
| **Achievements** | Club Player of the Year — U15 Girls (Kingsway Rovers FC, 2025) |
| **Other football** | School — Point Cook Senior College, 2026 · Futsal — Werribee summer league, 2025–26 |
| **Highlights** | 1 of 10 used — deliberately thin, see below |
| **What she tests** | The club page's girls'/women's rows as first-class entries · the trials index gender filter · **a genuinely sparse CV** |

> **Why her page is deliberately thin.** Three goals, five assists, one clip. This is the fixture that answers the question the other two do not: **does a CV with modest numbers still look like something worth sending?** Elly's framing was that a page must survive "a keeper, a defender, and a girl who's played six games" — if Georgia's page looks like an empty form, the design has failed for the majority of players, not the minority. Her "other football" entries are the cheapest honest fill we have, which is exactly what D-72 is for.
>
> **And the market truth behind her** (Pep): Football Victoria runs one girls' tier at U15 and U17 only, so a talented U13 girl has no elite destination and waits two years — which is where a lot of them go. The record's job in girls' football is to carry a player **across a gap and back**, not toward selection. That does not change the build; it changes what we say about it.

---

## 3b · Club-side fixtures

Three adults, so the D-93 role split is exercised rather than assumed:

| Fixture | Role | What it tests |
|---|---|---|
| **Sam Kaya** | `coach`, verified, assigned to Riverside FC U15s | The coach CV, and squad-scoped access — Sam sees his squad and no other |
| **Marina Petrovic** | `technical_director`, Riverside FC | Club-wide development access. Her coach CV renders "Technical Director, Riverside FC" — **not a fourth profile type** (D-93) |
| **Ash Nguyen** | `team_manager`, Riverside FC U16s | D-02's fifth persona. Needs no product at launch; he exists so the role is real in the data and the Match Day design has someone to be for |

**And one negative fixture, which is the point of the split:** a `club_admin` at Riverside FC — the registrar — who must fail every development-record read in doc 14 §H11 and §J13. A club administrator who can read a child's development notes is the bug D-93 was written to prevent, and the only way to know it is prevented is to have one in the fixtures trying.

---

## 3c · Tier limits, and why the child's tier is the generous one

**Free highlight clips — the split is deliberate and it has been broken once already by someone assuming it was a mistake.**

| Band | Free clips | Paid |
|---|---|---|
| **Under 18** | **Ten** | Nothing. No paid tier exists on any under-18 account |
| **18+** | **Three** | Unlimited, in Pitch Pro, from December |
| **Coach** | Three | Coach tier, contents open (D-111) |

**The reasoning, so nobody "fixes" it again.** A minor cannot be sold anything (D-82). There is no upgrade path to hold clips back for, so rationing a child's highlights would create a want they are not permitted to satisfy — a dark pattern with no commercial upside. **The tier that cannot be monetised is the generous one.** The adult tier is where a free limit does honest work.

Locked at D-120, after Leo reduced the under-18 limit from ten to three during a review on the assumption that the screens disagreed by mistake. They did not.

**PDF export is free on every tier**, for players and coaches (D-121). It is not a Pro feature and must not be drawn as one.

---

## 3d · Vocabulary the build must not invent

Bans that live here rather than in the copy doc, because they are data-model constraints:

- **`club_status` is constrained to three values** — `new`, `shortlisted`, `invited`. There is no fourth, and `declined`, `rejected` and `unsuccessful` cannot be written (D-108, doc 14 N11).
- **The words *application*, *applied*, *declined*, *rejected*, *unsuccessful* do not appear in the product**, in any surface, for any actor (D-108 extends D-85).
- **A player registers interest in a *club*.** A trial is a tag on that registration, never a separate object (D-108).
- **Stat keys remain `apps`, `goals`, `assists`, `clean_sheets`.** Minutes played is not in Phase 1 (D-70 as amended).

---

## 4 · Seed data rules

- **Fictional names only, clearly fictional.** Never a real minor's data in any environment, at any time.
- **Clubs are invented.** Riverside FC, Northern United SC and Kingsway Rovers FC do not exist. Check before adding a fourth — an invented name that turns out to be a real club is a call from their committee.
- **All launch stats are `self_reported`** (D-62). No `coach_verified` rows exist until December; no `official_import` rows exist at all.
- **All three carry `provenance` on every stat** — assert it, because a stat without a source is a stat we cannot defend.
- **Georgia and Deniz are u16**, so both must be unreachable through every search path in the test suite (doc 14, section B).

---

## 5 · What Pep still owns, and when it actually bites

Nothing here blocks the build. These block **December**, and one blocks the October design work:

| Item | Blocks |
|---|---|
| **The U13 boys spine** — 12 items, four corners, with observable band descriptors per band | The October assessment UX. It must be designed against real content, not lorem ipsum |
| **The 8-item GK spine** | The first club with a goalkeeping coach |
| **The "carpark set"** — which 6–8 spine competencies are the always-assessed core | The whole arithmetic of the assessment sweep (D-12) |
| **Band descriptors** — two or three concrete behaviour anchors per band per item | Coach calibration. Without them, "verified" means one adult's opinion with a timestamp, and no amount of engineering fixes it |

---

*Doc 16 · Football Reference · v1.1 · 27 Aug 2026 · drafted by Leo (CTO) so the build is unblocked · §1 and §2 both closed by BUZ 25 Aug · fixtures are build-ready as written · **§3c and §3d added 27 Aug (D-120, D-121, D-108, D-70).***
