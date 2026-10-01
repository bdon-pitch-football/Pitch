// F7 (BUZ, 1 Oct): someone who presses Claim on a club while signed out is
// brought back to that club's claim page after signing in — or after making
// an account and confirming its address. What travels is the club's public
// slug and nothing else: never a URL, so the return path can't be pointed at
// another site (an open redirect), and never anything about the person.
export const claimSlug = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : null;

/** `?claim=slug` (or `&claim=slug`), or nothing for anything that isn't one. */
export const claimQuery = (v: unknown, sep: '?' | '&' = '?'): string => {
  const s = claimSlug(v);
  return s ? `${sep}claim=${s}` : '';
};
