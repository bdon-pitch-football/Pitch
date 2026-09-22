// How old somebody is — the same answer the database gives, and nothing else
// in the product is allowed a second one.
//
// QA F5 (22 Sep): `/join` refused a coach or a club person ON THEIR EIGHTEENTH
// BIRTHDAY. Four places worked an age out as
// `Math.floor((Date.now() - dob) / (365.25 * 24 * 3600 * 1000))`, and 365.25
// days is not a year: across eighteen years the quarter-day rounding is out by
// most of a day, so on the birthday itself the division lands just short and
// says seventeen. `fn_age_band` (0003) says 18plus the moment the calendar
// date arrives, in Australia/Melbourne — and the database is the answer that
// counts, because every permission is computed from it (D-80). A screen that
// disagrees with it either refuses somebody the database would let through
// (what happened) or lets somebody through the database will refuse.
//
// A birthday is a calendar fact, not an elapsed number of milliseconds, and
// the calendar it happens on is Australia/Melbourne — never the server's,
// never the browser's (doc 14 G9).

const MELBOURNE = 'Australia/Melbourne';

/** Today in Australia/Melbourne as [year, month, day] — the date the database sees. */
function todayInMelbourne(now: Date): [number, number, number] {
  // en-CA renders as YYYY-MM-DD, which is the shape we want to read back.
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).split('-').map(Number);
  return [y, m, d];
}

/** A date of birth as [year, month, day], from a `YYYY-MM-DD` string or a pg `date`. */
function birthDate(dob: string | Date): [number, number, number] | null {
  if (dob instanceof Date) {
    if (Number.isNaN(dob.getTime())) return null;
    // pg hands back a `date` column as local midnight, so the local parts are
    // the stored date. Reading it in another zone shifts it by a day.
    return [dob.getFullYear(), dob.getMonth() + 1, dob.getDate()];
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Whole years old today, or null when there is no usable date of birth.
 *
 * On the birthday itself this returns the new age, which is what
 * `fn_age_band` does and what every person in Australia does.
 */
export function ageOn(dob: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const born = birthDate(dob);
  if (!born) return null;
  const [by, bm, bd] = born;
  const [ty, tm, td] = todayInMelbourne(now);
  const beforeBirthday = tm < bm || (tm === bm && td < bd);
  const years = ty - by - (beforeBirthday ? 1 : 0);
  return years;
}

/** The band, in the database's words. Mirrors fn_age_band (0003) exactly. */
export function ageBand(dob: string | Date | null | undefined, now: Date = new Date()): 'u16' | '16_17' | '18plus' {
  const age = ageOn(dob, now);
  // No date of birth is a child, as fn_age_band has it: the restrictive answer.
  if (age === null) return 'u16';
  if (age >= 18) return '18plus';
  if (age >= 16) return '16_17';
  return 'u16';
}
