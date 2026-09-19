// npm run demo -- "Albion Rovers FC" --suburb Cairnlea --state VIC [--crest path/to/crest.png] [--ground "Kevin Flint Reserve"]
//
// Starts Pitch on this laptop as the club BUZ is meeting (BUZ, 19 Sep):
// a fresh demo database on its own port (54323), the app on port 3030 with
// its own build folder, so a demo never touches the dev database, the dev
// server, or anything real. Every restart is a clean demo. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const club = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!club) {
  console.log('Usage: npm run demo -- "Club Name FC" --suburb Suburb --state VIC [--crest crest.png] [--ground "Ground name"]');
  process.exit(1);
}

const repo = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3030;

// Everything that could reach something real is blanked here as well as
// refused in code (lib/demo): a key in .env.local cannot fill an env var
// that is already set, even to empty.
const quiet = {
  SUPABASE_DB_URL: '', NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  RESEND_API_KEY: '', EMAIL_FROM: '', SMS_ACCOUNT_SID: '', SMS_API_KEY: '', SMS_LONG_NUMBER: '',
  STRIPE_SECRET_KEY: '', STRIPE_PRICE_MONTHLY: '', STRIPE_PRICE_ANNUAL: '', STRIPE_WEBHOOK_SECRET: '',
  WAITLIST_ENABLED: 'false',
};

const dbProc = spawn('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/dev-db.mts'], {
  cwd: repo,
  env: { ...process.env, ...quiet, DEMO_CLUB: club, DEMO_SUBURB: flag('suburb') ?? '', DEMO_STATE: flag('state') ?? '', DEMO_CREST: flag('crest') ?? '', DEMO_GROUND: flag('ground') ?? '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

let app;
console.log(`Setting up the demo for ${club}…`);
dbProc.stdout.on('data', (b) => {
  const text = String(b);
  if (!app && text.includes('demo db ready')) {
    app = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: repo,
      env: { ...process.env, ...quiet, PITCH_DEMO: '1', NEXT_DIST_DIR: '.next-demo' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    app.stdout.on('data', (d) => {
      if (String(d).includes('Ready')) {
        console.log(`\nDemo ready: http://localhost:${PORT}/demo\n(the first page takes a few seconds to build; Ctrl+C stops the demo)\n`);
        if (!process.env.DEMO_NO_OPEN) spawn('open', [`http://localhost:${PORT}/demo`], { stdio: 'ignore' });
      }
    });
    app.on('exit', () => { dbProc.kill(); process.exit(0); });
  }
});
dbProc.on('exit', (code) => {
  if (!app) { console.error('The demo database did not start.'); process.exit(code ?? 1); }
  // Without its database the demo can only show errors. Stop cleanly and say so.
  console.error('\nThe demo database stopped. Run the command again for a fresh demo.');
  app.kill();
});
const stop = () => { app?.kill(); dbProc.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
