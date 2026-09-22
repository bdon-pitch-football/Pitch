# Demo walks

What `docs/DEMO-TD.md` tells BUZ to do, written so a browser can do it. Run
them against a demo that is already up:

```bash
npm run demo -- "Balmoral FC" --suburb Balmoral --state VIC --ground "Balmoral Reserve"
node scripts/demo-walk.mjs scripts/demo-walks/run-sheet.txt
node scripts/demo-walk.mjs scripts/demo-walks/widths.txt

# the other story — its own run, and a FRESH one: the claim consumes a
# single-use link and a single-use code, so a second pass on the same demo
# cannot finish.
npm run demo -- "Balmoral FC" --suburb Balmoral --state VIC --ground "Balmoral Reserve" --unclaimed
node scripts/demo-walk.mjs scripts/demo-walks/unclaimed-claim.txt
```

`run-sheet.txt` is every step of the meeting, in order. `unclaimed-claim.txt`
is the club making its own page, from the compiled listing to a page they
wrote. `widths.txt` measures every page in the run sheet at 1280 and 375.
