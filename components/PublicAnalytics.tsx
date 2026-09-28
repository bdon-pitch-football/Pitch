// Vercel Web Analytics, on the four public marketing pages and nowhere else
// (lib/analytics-scope says which and why). Each of those pages renders this
// itself; the root layout does not, because a layout is every page.
//
// Signed out only. A visitor with a session may be a child we know is a
// child, and pillar zero 5 allows no analytics event on a minor; a visitor
// with none is a stranger on a public page, which is who these pages are for.
import { getSessionPersonId } from '@/lib/session';
import PublicAnalyticsScript from './PublicAnalyticsScript';

export default async function PublicAnalytics() {
  if (await getSessionPersonId()) return null;
  return <PublicAnalyticsScript />;
}
