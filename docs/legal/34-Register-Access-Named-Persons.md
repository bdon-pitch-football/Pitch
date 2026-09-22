# 34 · Who at a club may read the Interest Register

> **Doc 34 · v1.0 · 15 September 2026.** Entity: **EBSD Enterprises Pty Ltd** (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football.
>
> **Status: recommendations, not decisions.** Nothing here binds until BUZ numbers it in doc 06. Written because **D-153 opens invitations to clubs on the free tier, which makes "who at the club is reading this" a live question rather than a theoretical one.**

---

## A · The hole, stated plainly

**Doc 14 N6 says: *"Club reads a live registration."* There is no such actor.**

Doc 14 §0 enumerates people, not organisations, and on the register the enumeration runs out:

| Actor | Can they read a registration? | Why not |
|---|---|---|
| `club_admin_own` | **No, by D-93** | An administrator — registrar, secretary, treasurer — holds **no development-record access at all**. A registration carries a child's name, age, current club, position, a free-text note and a **token to their CV page**. That is a development record by any reading. |
| `coach_own_v` | **Not on the definition** | A verified coach is *"assigned to a squad this player is currently in"*. **A player registering interest is by definition not in one of the club's squads** — wanting to join is the whole point. The definition cannot reach them. |
| `td_own` | **Yes** — the only clean fit | Club-wide development access, granted by the club and confirmed at verification (D-93). |
| `team_manager` | **No** | Squad logistics, never the development record (D-02). |

**So on the written spec, the Interest Register is readable by the Technical Director and by nobody else — and no club will run it that way.** The person who actually works a register at a Victorian junior club is a coach, a director of coaching, or a committee volunteer wearing three hats on a Tuesday night.

**The gap is not that the rule is wrong. It is that there is no rule, and an absent rule gets resolved at the database by whoever implements the query.** That is how `club_admin` got full development access in doc 09 before D-93 closed it — the same hole, in the same place, eighteen days ago.

---

## B · The principle

**A club does not read a register. A named person does.**

An organisation cannot hold a Working with Children Check, cannot be told what it may not do with a child's details, and cannot be removed when it leaves. **Every property we have promised a family about register access — verified, logged, revocable, disclosable — is a property of a person, and we have been writing it as a property of a club.**

*A parent asking "who saw my son's registration" must get a name. "Northern United SC" is not an answer to that question; it is a way of not answering it.*

---

## C · The eight rules I recommend

**1 · Register access is a grant on a named Membership, never a role and never self-declared.** Same shape as D-93's rule for Technical Director: **the club grants it, it is confirmed at club verification, and no person can assert it about themselves.** A grant carries the granting club, the granted person, an operator identity and a timestamp — the M12 pattern.

**2 · `technical_director` holds it by default.** No separate grant needed; it is already club-wide development access confirmed at verification.

**3 · A `coach` may hold it only with `verification = full`, and only by explicit grant.** WWCC and club affiliation both. **A coach assigned to no squad may still hold it** — that is the ordinary case for a register — which is precisely why it must be a grant rather than an inference from squad assignment.

**4 · `club_admin` never holds it, and `team_manager` never holds it.** **D-93's wall runs through this document unchanged.** A treasurer who can read a fourteen-year-old's note and open their CV page is the bug D-93 exists to prevent, and a registration is not less of a development record because the child has not signed yet. *If a club protests that its registrar is the person who does this work, the answer is that the club grants that person a coach membership with a WWCC, or the work moves. It is not a reason to widen the rule.*

**5 · The grant list is visible to the club and it is capped.** The club sees who holds register access, at all times, on its own settings page. **A permission nobody can enumerate is a permission nobody can audit**, and "the club has access" is how a shared login becomes the access model.

**6 · Every read is attributed and logged** — person, timestamp, which registration — **and is disclosable to the guardian on request**, in the same terms as the complaints-investigation path (doc 31 U-6, doc 25). **This is the rule that makes the other seven enforceable rather than aspirational.** It is also already promised: doc 26 tells a technical director that a guardian can ask who looked at their child's record and why, and get a straight answer.

**7 · Revocation is immediate and follows the person, not the paperwork.** A coach leaving the club loses register access **in the same transaction as the membership ending**, and a club losing verification loses every grant at once (M10, M11). *A grant that outlives the relationship by even a job is the failure mode every child-safety scheme in Australian sport has had to write a rule about.*

**8 · The WWCC is a boolean in every surface, always.** The number never appears in an API response, a log line, an error, an image or any view a club can reach (J7, J30, D-53). **A register access grant must not become the place that leaks it.**

---

## D · What the family is told

Doc 26 currently says a verified club's people can find a child. **After this it should say what is actually true and is better:** *a small number of named people at that club, each individually checked, each read recorded, and you can ask us who.*

**That is a stronger sentence than the one we have, and it is only available to us if the rule above exists.** I will write it into doc 26 when this is numbered — not before.

---

## E · Launch gate

**This is not launch-blocking on its own, and I am not going to inflate it.** No family has registered interest with anybody; there is nothing yet to read.

**It becomes blocking the moment the Interest Register opens to a real club with a real child in it**, and that is now closer than it was, because D-153 gives a free verified club a reason to open the register on day one. **Doc 32 gains one row, in section C, and it is the cheap version: no register read may be attributed to an organisation.** Everything else here can follow in the ordinary course.

---

## F · What I am not deciding

**Whether a club may nominate more than one person, and how many.** That is a product and support question — every extra grant is a support conversation and a revocation somebody has to remember — and it belongs to Leo and BUZ. **My only requirement is that the number is knowable, capped at something, and visible to the club.** A cap of one is defensible and will be unworkable; a cap of none is the current state and is worse.

---

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · who at a club may read the register · doc 34 · v1.0 · 15 September 2026 · recommendations for BUZ to call; nothing here binds until numbered in doc 06*
