# Pitch

**A player development and pathway platform for Australian football.** A player — usually a child — owns a living record of their football. Clubs and coaches see it when they are allowed to. Nobody can contact a child directly.

**EBSD Enterprises Pty Ltd** · ACN 701 879 718 · ABN 65 701 879 718 · trading as **Pitch Football**

---

## Read these, in this order, before writing any code

| | |
|---|---|
| **`docs/17-Handover.md`** | Start here. Four minutes. It exists to stop the six mistakes this codebase most invites. |
| **`CLAUDE.md`** | The build brief. **Read §0 first — it wins over anything later in the file.** |
| **`docs/14-Permission-Tests.md`** | 243 rows. **This is the launch gate**, and it is not a date. |
| **`docs/09-Data-Model.html`** | The object model. **§⓪ first** — six objects joined it late and it says so. |
| **`docs/06-Register.html`** | Every decision, numbered. **The single source of truth.** If a document and the register disagree, the register wins. |

## The one rule underneath all of it

**Most users are children, and about half the decisions in `docs/06-Register.html` exist to protect them.**

So when something is ambiguous, the answer is **not** "pick the sensible default" — the sensible default was designed for adults. A 404 that differs from a 403 is fine in most products and is an information leak in this one. **If a behaviour is not specified, ask. Never invent product behaviour, and never for anything touching a minor.**

## Before you commit

```bash
python3 scripts/corpus-check.py .
```

Twelve assertions that the documents agree with each other — prices, dates, decision citations, the entity, banned words, the domain. **Every one has already failed for real at least once.** It runs in about a second and it exits non-zero on failure.

## Secrets

`.env.example` documents every variable with the reason attached. **Nothing secret is ever committed.** The Supabase project is in the **Sydney** region and that is not negotiable — personal data resides in Australia (D-29).
