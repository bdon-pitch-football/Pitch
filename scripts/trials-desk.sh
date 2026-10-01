#!/bin/zsh
# The trials desk's database steps, in one fixed command (BUZ, 1 Oct: "build
# the wrapper script"). The scheduled runs call ONLY this for anything that
# touches production, so one allow-list entry covers every run and a run never
# stalls on a prompt nobody is awake to answer. See docs/team/TRIALS-DESK.md.
#
#   trials-desk.sh prepare notices   → new run folder; board.csv, board-a.csv, board-b.csv (whole clubs per half)
#   trials-desk.sh prepare sweep     → new run folder; board.csv (the sweep's clubs are the scout input files)
#   trials-desk.sh finish <run dir>  → dead-link check, then the checked changes.csv in SAFE scope; apply.log
#
# Never --scope all: new notices and retitles are BUZ's (TRIALS-DESK.md).
# It prints the run folder on its last line after `prepare`, so the caller
# can pass it back to `finish`.
set -euo pipefail

ROOT="/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0"
REPO="$ROOT/repo"
DAILY="$ROOT/content/sales/pipeline/trials-daily"
DB=(node --env-file=.env.production-db.local)
COMMON=(--ca supabase/rehearsal-ca.crt --operator burak.donmez@pitch-football.com)

cd "$REPO"

case "${1:-}" in
  prepare)
    mode="${2:-}"
    [[ "$mode" == "notices" || "$mode" == "sweep" ]] || { echo "usage: trials-desk.sh prepare notices|sweep" >&2; exit 2; }
    run="$DAILY/$(TZ=Australia/Melbourne date +%Y-%m-%d)/$(TZ=Australia/Melbourne date +%H%M)"
    mkdir -p "$run"
    "${DB[@]}" scripts/sync-trials.mjs "${COMMON[@]}" --export "$run/board.csv"
    if [[ "$mode" == "notices" ]]; then
      python3 - "$run" <<'PY'
import csv, sys
run = sys.argv[1]
rows = list(csv.DictReader(open(f'{run}/board.csv')))
head = open(f'{run}/board.csv').readline().strip().split(',')
clubs = sorted({r['club'] for r in rows})
# Whole clubs per half, balanced by notice count.
counts = {c: sum(1 for r in rows if r['club'] == c) for c in clubs}
a, b, na, nb = set(), set(), 0, 0
for c in sorted(clubs, key=lambda c: -counts[c]):
    if na <= nb: a.add(c); na += counts[c]
    else: b.add(c); nb += counts[c]
for name, half in (('a', a), ('b', b)):
    with open(f'{run}/board-{name}.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=head); w.writeheader()
        w.writerows([r for r in rows if r['club'] in half])
print(f'split: board-a {na} notices at {len(a)} clubs · board-b {nb} notices at {len(b)} clubs')
PY
    fi
    echo "$run"
    ;;
  finish)
    run="${2:-}"
    [[ -n "$run" && -d "$run" && "$run" == "$DAILY"/* ]] || { echo "finish needs a run folder under $DAILY" >&2; exit 2; }
    [[ -f "$run/changes.csv" ]] || { echo "no checked changes.csv in $run — the checker did not finish; nothing applied" >&2; exit 3; }
    {
      echo "== dead links ($(TZ=Australia/Melbourne date '+%d %b %H:%M'))"
      "${DB[@]}" scripts/check-trial-links.mjs "${COMMON[@]}" --apply
      echo "== checked changes, safe scope"
      "${DB[@]}" scripts/sync-trials.mjs "${COMMON[@]}" --changes "$run/changes.csv" --apply
    } 2>&1 | tee -a "$run/apply.log"
    ;;
  *)
    echo "usage: trials-desk.sh prepare notices|sweep  |  trials-desk.sh finish <run dir>" >&2
    exit 2
    ;;
esac
