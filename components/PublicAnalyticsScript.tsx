'use client';
// The one place @vercel/analytics is mounted. Cookieless aggregate counts,
// served same-origin, inert until switched on in the Vercel dashboard (doc 29
// §9). beforeSend drops any page off the allowlist and trims the rest to their
// path, because the script outlives the page it was mounted on when someone
// navigates inside the tab (lib/analytics-scope).
import { Analytics } from '@vercel/analytics/next';
import { analyticsBeforeSend } from '@/lib/analytics-scope';

export default function PublicAnalyticsScript() {
  return <Analytics beforeSend={analyticsBeforeSend} />;
}
