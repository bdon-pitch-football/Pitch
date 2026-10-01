// P1, "the return" (F spec; BUZ, 1 Oct: approved). A TD working a hundred
// rows opens a CV or an invitation and comes back to the SAME filtered
// register, scrolled to the row they left — not to the top of an unfiltered
// list.
//
// The way back travels as one query parameter, `back`, on the two routes the
// register opens (/club/register/cv/[id] and /club/invite/[id]). It is never
// trusted: it is rebuilt here from the register's own three filter keys and
// nothing else, on the one path it may name. Anything else — another path, a
// fourth key, a value that is not a filter code — is dropped, and the link is
// the plain register. So `back` can only ever narrow the register's drawing;
// it cannot point anywhere, and it reads nothing (the register page checks
// the values against its own lists again on arrival).
const KEYS = ['age', 'pos', 'status'] as const;
// Filter codes: age groups (U14, SEN, the em-dashed "none" bucket), the ten
// position codes and the three statuses. Short, and nothing that can carry a
// path, a scheme or a second parameter.
const VALUE = /^[A-Za-z0-9—]{1,16}$/;

/** The register's own filters as a query string ('' when none are set). */
export function registerFilterQuery(f: { age?: string | null; pos?: string | null; status?: string | null }): string {
  const p = new URLSearchParams();
  for (const k of KEYS) { const v = f[k]; if (v && VALUE.test(v)) p.set(k, v); }
  return p.toString();
}

/** What a row's links carry: `?back=…` while the register is filtered, '' otherwise. */
export function carryBack(f: { age?: string | null; pos?: string | null; status?: string | null }): string {
  const q = registerFilterQuery(f);
  return q ? `?back=${encodeURIComponent(`/club/register?${q}`)}` : '';
}

/** Parse `back` the one way it may be read: the register's own filters, or none. */
function filtersOf(back: string | undefined): { age: string | null; pos: string | null; status: string | null } | null {
  if (typeof back !== 'string' || back.length > 120) return null;
  try {
    const u = new URL(back, 'http://x.invalid');
    const keys = [...u.searchParams.keys()];
    if (u.origin !== 'http://x.invalid' || u.pathname !== '/club/register' || u.hash
      || !keys.every((k) => (KEYS as readonly string[]).includes(k)) || new Set(keys).size !== keys.length) return null;
    return { age: u.searchParams.get('age'), pos: u.searchParams.get('pos'), status: u.searchParams.get('status') };
  } catch { return null; }
}

/** A page the register opened passes its way back on, rebuilt, never echoed. */
export function carryBackFrom(back: string | undefined): string {
  const f = filtersOf(back);
  return f ? carryBack(f) : '';
}

/**
 * The way back to the register for row `rowId`: the filters `back` named, if
 * it names /club/register and only its filter keys, and the row's anchor.
 */
export function registerBackHref(back: string | undefined, rowId: string): string {
  const f = filtersOf(back);
  const q = f ? registerFilterQuery(f) : '';
  return `/club/register${q ? `?${q}` : ''}#r-${rowId}`;
}
