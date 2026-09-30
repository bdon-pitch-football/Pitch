// D-172 U4 (John, 30 Sep): every unclaimed club page is noindex, and it flips
// only when club_state leaves 'unclaimed'. John asks for it twice — the meta
// tag, which app/fc/[slug]/page.tsx sets in generateMetadata, and the served
// header, which proxy.ts sets from this. Both read the same column, so a club
// that claims drops both at once.
//
// Fails closed: a slug with no club, or a query that failed, is answered
// noindex. An unclaimed page must never be served indexable because the
// database could not be asked.
import 'server-only';
import { db } from './db';

export async function clubPageNoindex(slug: string): Promise<boolean> {
  try {
    const { rows } = await db.query('select club_state from club where public_slug = $1', [slug]);
    return !rows[0] || rows[0].club_state === 'unclaimed';
  } catch {
    return true;
  }
}
