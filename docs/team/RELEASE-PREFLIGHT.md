# Release pre-flight — before 0051 meets a database that has rows

Written 28 Sep 2026 by the builder seat, from the release seat's report of the
same day (`reports/2026-09-28-release-where-we-are.md`, Part 6). Documentation,
not a migration change: nothing here alters `0051`.

## When this applies, and when it does not

`0051_club_page_editing.sql` adds seven CHECK constraints. On a database that
already holds a row breaking one of them, **the migration fails and the whole
deploy rolls back** — `scripts/migration-on-data.mjs` shows it failing on
`club_philosophy_len` in its "dirty" scenario.

- **An empty project (the first deploy, 0001 to the latest in one go):** none of
  the queries below can return a row. Nothing to do.
- **A database that was brought up at 0050 or earlier and has rows** — a staged
  deploy, or a restore from a backup taken before 0051: run all seven first.

Before 0051, nothing in the product wrote these columns. Only the dev seed and a
person typing SQL did. So on a real database a row returned here was typed by
hand, by us. Expect zero.

## How to run them

1. Open the SQL editor on the Sydney project. The queries are read-only.
2. Run all seven. Write down **ids and counts only**. Do not copy a club's text
   or an alumni line into chat, a ticket or a log: an alumni line can name a
   person.
3. If every count is zero, deploy.
4. If any is not zero, follow its row below. Make every fix in **one
   transaction**, then run all seven again. Deploy only when all seven return
   nothing.
5. Six of the migrations after 0050 cannot be re-run once applied (the release
   report, Part 6). If a deploy stops partway, finish it by hand from the file
   that failed. Do not re-run the chain from the start.

These queries are copied from `PREFLIGHT` in `scripts/migration-on-data.mjs`.
The permission suite checks that the two lists match (`pf1`). If you change
one, change the other.

## The seven, and what to do with each result

**1 · `club_philosophy_len`**
```sql
select id from club where philosophy is not null and char_length(philosophy) > 400;
```
This is the club's own public wording. **Do not cut it mid-sentence.** Ask the
club's technical director for a version of 400 characters or fewer and enter
that. If you cannot reach them before the deploy, BUZ decides whether to set
`philosophy = null`, so the page shows no philosophy until the club writes one
in the editor. Never truncate it silently.

**2 · `club_pathway_len`**
```sql
select id from club where pathway_line is not null and char_length(pathway_line) > 80;
```
Same as 1. It is a single line of the club's wording. Agree a version of 80
characters or fewer with the club, or BUZ decides to set it to null.

**3 · `club_established_year`**
```sql
select id from club where established is not null and established !~ '^(18|19|20)[0-9]{2}$';
```
Mechanical, and safe to fix without asking. If the value holds exactly one year
from 1800 to 2099 (`Est. 1974`, `1974 `), set it to that year. If it holds no
such year, or more than one (`1790`, `since the 70s`), set it to null and tell
the club. The editor lets them enter the year again.

**4 · `wanted_title_len`**
```sql
select id from players_wanted_notice where char_length(title) not between 1 and 60;
```
An **empty** title is a broken notice that renders as nothing: delete it and
tell the club. A title **over 60** characters is the club's wording: agree a
shorter one with them. If you cannot, BUZ decides whether to take the notice
down until they re-post it.

**5 · `wanted_detail_len`**
```sql
select id from players_wanted_notice where detail is not null and char_length(detail) > 100;
```
Agree a version of 100 characters or fewer with the club. If you cannot, set
`detail = null`. The title still carries the notice.

**6 · `alumni_line_len`**
```sql
select id from alumni_entry where char_length(line) not between 1 and 80;
```
**First, read the line for a name of anyone under 18.** If it names one, delete
the entry now, whatever its length: that is the D-74 guardrail, and it outranks
the deploy. An **empty** line renders nothing, so delete it. A line **over 80**
characters is the club's wording: agree a shorter one, or remove the entry and
let the club add it again through the editor, which asks the 18-or-over
question.

**7 · `alumni_detail_len`**
```sql
select id from alumni_entry where detail is not null and char_length(detail) > 80;
```
Same under-18 read as 6. Then agree a version of 80 characters or fewer, or set
`detail = null`. The line still carries the entry.

## One more query, and it is not a CHECK

0051 stores who confirmed "Everyone named here is 18 or over" on each alumni
entry. **An entry written before 0051 has no confirmation and stays on the
public wall.** From 0071 it cannot be edited until someone confirms it, but
0071 does not take it down.

```sql
select id, club_id from alumni_entry where adults_confirmed_by is null or adults_confirmed_at is null;
```

If this returns rows, **what happens to them is BUZ's decision**, not the
deploy's. The options are:

- **(a)** hide or delete them until the club confirms them in the editor;
- **(b)** an operator confirms them after reading each line, on the club's word
  given on the phone;
- **(c)** leave them up as they are.

The builder's report of 28 Sep puts this to him. Until he answers, the
restrictive choice is (a).
