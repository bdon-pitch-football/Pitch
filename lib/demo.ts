// Demo mode (BUZ, 19 Sep): the app on BUZ's laptop, renamed to the club he is
// meeting, filled with fictional people. Started only by `npm run demo`.
//
// Three locks, so a demo can never touch anything real:
//   1. it refuses to run in a production build at all;
//   2. it talks ONLY to the local demo database on its own port — whatever
//      SUPABASE_DB_URL says, including a real one in .env.local;
//   3. nothing leaves: no email, no SMS, no Stripe, no waitlist writes, and
//      no upload to a real bucket (lib/providers, lib/billing,
//      lib/waitlist-db and lib/storage each ask isDemo()).
//
// And one thing that is not a lock in code: `npm run demo` binds the app to
// 127.0.0.1, so a demo is served to the laptop it runs on and not to the
// room's Wi-Fi (safety review N4c).
export const DEMO_DB_PORT = 54323;

/**
 * The port a demo database binds (scripts/dev-db.mts with DEMO_CLUB) and a
 * demo app reads: 54323, BUZ's, unless a port is set explicitly — and then
 * that port, for both halves (brief K item 7). A seat running the demo layer
 * used to take BUZ's port whatever it set, and a demo app on a seat's own
 * database would have read his. `npm run demo` blanks PITCH_DEV_DB_PORT, so
 * the meeting demo is always 54323. Still 127.0.0.1 either way: lock 2 is
 * about never reaching a real database, and this cannot.
 */
export function demoDbPort(env: Record<string, string | undefined> = process.env): number {
  return Number(env.PITCH_DEV_DB_PORT || DEMO_DB_PORT);
}
export const DEMO_DB_URL = `postgres://postgres@127.0.0.1:${demoDbPort()}/postgres`;

export function isDemo(): boolean {
  if (process.env.PITCH_DEMO !== '1') return false;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PITCH_DEMO is set in a production build — refusing to start');
  }
  return true;
}
