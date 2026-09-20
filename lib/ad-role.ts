// Which role an ad click arrived for (/join, 20 Sep). Paid clicks land on a
// short page whose words are already about the person who clicked, so the ad's
// own tag chooses them: `utm_content` carries the creative's slug, and the
// creative slugs are named after the persona they were cut for.
//
//   players-*   → player      parents-*   → parent
//   clubs-*     → club        coaches-*   → coach
//   k0*         → coach       (the coach reels are keyed k01, k02, k03)
//
// Pure, and it decides nothing else: a bad or missing tag is a player, which
// is the widest audience and the cheapest thing to be wrong about. `role=` is
// accepted as well so a link can be aimed by hand without minting a creative.
//
// Nothing here is stored or sent. The utm tags that reach the API are the
// ones the site already keeps (lib/waitlist-source.ts decides what counts).
import { ROLES, type Role } from '@/lib/consent';

export const DEFAULT_ROLE: Role = 'player';

export function roleFromAd(params: {
  utm_content?: string | string[] | null;
  role?: string | string[] | null;
}): Role {
  const first = (v: string | string[] | null | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim().toLowerCase() ?? '';

  // An explicit role= wins: it is the deliberate one.
  const asked = first(params.role);
  if ((ROLES as readonly string[]).includes(asked)) return asked as Role;

  const content = first(params.utm_content);
  if (!content) return DEFAULT_ROLE;
  if (content.startsWith('players')) return 'player';
  if (content.startsWith('parents')) return 'parent';
  if (content.startsWith('clubs')) return 'club';
  if (content.startsWith('coaches') || /^k0/.test(content)) return 'coach';
  return DEFAULT_ROLE;
}
