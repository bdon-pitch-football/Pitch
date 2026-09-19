// Demo mode (BUZ, 19 Sep): the app on BUZ's laptop, renamed to the club he is
// meeting, filled with fictional people. Started only by `npm run demo`.
//
// Three locks, so a demo can never touch anything real:
//   1. it refuses to run in a production build at all;
//   2. it talks ONLY to the local demo database on its own port — whatever
//      SUPABASE_DB_URL says, including a real one in .env.local;
//   3. nothing leaves: no email, no SMS, no Stripe, no waitlist writes
//      (lib/providers, lib/billing, lib/waitlist-db each ask isDemo()).
export const DEMO_DB_PORT = 54323;
export const DEMO_DB_URL = `postgres://postgres@127.0.0.1:${DEMO_DB_PORT}/postgres`;

export function isDemo(): boolean {
  if (process.env.PITCH_DEMO !== '1') return false;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PITCH_DEMO is set in a production build — refusing to start');
  }
  return true;
}
