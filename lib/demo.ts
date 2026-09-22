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
export const DEMO_DB_URL = `postgres://postgres@127.0.0.1:${DEMO_DB_PORT}/postgres`;

export function isDemo(): boolean {
  if (process.env.PITCH_DEMO !== '1') return false;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PITCH_DEMO is set in a production build — refusing to start');
  }
  return true;
}
