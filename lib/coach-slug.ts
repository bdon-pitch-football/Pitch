// The address a coach's page lives at: pitchfootball.com.au/c/<slug> (D-100).
// Made from the name the coach already shows on the page, so it tells a
// reader nothing the page does not. Plain a-z, 0-9 and hyphens, so it
// survives being pasted into a text message, an email or a club's website.

// Letters that NFKD does not take apart into a base letter and an accent.
const SPECIAL: Record<string, string> = {
  ı: 'i', ø: 'o', ß: 'ss', æ: 'ae', œ: 'oe', đ: 'd', ð: 'd', ł: 'l', þ: 'th',
};

export function coachSlugBase(first: string, last: string): string {
  const s = `${first} ${last}`
    .toLowerCase()
    .replace(/[ıøßæœđðłþ]/g, (ch) => SPECIAL[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s || 'coach';
}

/** base, then base-2, base-3 … — the order they are tried in. */
export function coachSlugCandidates(base: string, count = 50): string[] {
  return [base, ...Array.from({ length: count - 1 }, (_, i) => `${base}-${i + 2}`)];
}
