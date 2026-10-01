# Demo walks

What `docs/DEMO-TD.md` tells BUZ to do, written so a browser can do it. Run
them against a demo that is already up — a FRESH one for the run sheet: step 5
presses send on Nate's invitation, so a second pass on the same demo finds it
already sent and fails there. `widths.txt` sends nothing and can run any time.

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
There is no billing page in either: billing is off (D-163), `/club/billing`
redirects to `/home`, and the run sheet checks exactly that at step 8.
