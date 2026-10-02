// The trials board, v2 (BUZ, 2 Oct: "yes"; docs/design/reports/
// 2026-10-02-proposal-trials-v2.md). Say each thing once: one row per club per
// day, and each listing's kind said once, by its section — the trials, then
// the expressions of interest. Pure functions over listings the page has
// already read the board's way (fn_trial_notices_advertised): nothing here
// reads the database, and nothing here reorders by anything but time.
//
// Every listing stays present. Grouping only puts a club's listings for one
// day in one row; the filters still match listing by listing, and the counts
// still count listings (D-162's chips, "N trials").

// An expression of interest is dated by its closing date, not a trial date.
// Today it is recognisable only by its time, which the desk writes as "EOI
// closes" (the design's interim, with no migration). The recommended column,
// trial_notice.kind, is the tech team's — see the build report.
export const isEoi = (timeVenue: string) => /^\s*EOI closes\b/i.test(timeVenue);

// Time and ground are stored joined by " · " (fn_ops_add_notice, and the
// club's own form). Split at the first one; with none, it is all the time.
export function splitTimeVenue(timeVenue: string): { time: string; venue: string | null } {
  const at = timeVenue.indexOf(' · ');
  if (at === -1) return { time: timeVenue.trim(), venue: null };
  return { time: timeVenue.slice(0, at).trim(), venue: timeVenue.slice(at + 3).trim() || null };
}

// The start time, in minutes after midnight, read from the front of the time:
// "6:45–7:45 pm" is 18:45, "Sun 9:00 AM" is 9:00 (a weekday in front is
// skipped). A time that does not parse is null, and sorts last in its day.
const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i;
export function startMinutes(time: string): number | null {
  const s = time.trim().replace(WEEKDAY, '');
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?m?\.?/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  // A range carries its am/pm once, at its end: "6:45–7:45 pm".
  let mer: string | undefined = m[3]?.toLowerCase() ?? /(?:\d|\s)([ap])\.?m\b/i.exec(s.slice(m[0].length))?.[1]?.toLowerCase();
  if (h > 12) mer = undefined;
  if (mer === 'p' && h < 12) h += 12;
  if (mer === 'a' && h === 12) h = 0;
  return h * 60 + min;
}

export type Groupable = { club_id: string; club_name: string; on_date: string; time_venue: string };

const byStart = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b;

// One row per club per day. Rows are ordered by date, then by each row's
// earliest start, then by club name; lines in a row by their start. The sort
// is stable, so equal times keep the order the board read them in. Grouping
// never orders by club (D-21, D-74).
export function groupByClubDay<T extends Groupable>(listings: T[]): T[][] {
  const rows = new Map<string, T[]>();
  for (const l of listings) {
    const key = `${l.on_date}|${l.club_id}`;
    const row = rows.get(key);
    if (row) row.push(l); else rows.set(key, [l]);
  }
  const start = (l: T) => startMinutes(splitTimeVenue(l.time_venue).time);
  const out = [...rows.values()].map((row) => [...row].sort((a, b) => byStart(start(a), start(b))));
  return out.sort((a, b) =>
    a[0].on_date < b[0].on_date ? -1 : a[0].on_date > b[0].on_date ? 1
      : byStart(start(a[0]), start(b[0])) || a[0].club_name.localeCompare(b[0].club_name, 'en-AU'));
}
