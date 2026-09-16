// Secret scanning (D-94 §1, §9). Looks for live credentials in every tracked
// file and, with --history, in every commit ever made — a key deleted in a
// later commit is still a leaked key, and the rule is rotate first,
// investigate second.
//
// High-signal patterns only: the shapes real providers issue. A scanner that
// cries wolf on every long string gets switched off, which is worse than a
// narrower one that is believed.
//
//   node scripts/secret-scan.mjs            tracked files at HEAD
//   node scripts/secret-scan.mjs --history  every commit on every branch
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Stripe live key', /\b(?:sk|rk)_live_[0-9a-zA-Z]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[0-9a-zA-Z]{24,}/],
  ['Resend API key', /\bre_[0-9a-zA-Z]{8,}_[0-9a-zA-Z]{16,}/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Twilio API key', /\bSK[0-9a-f]{32}\b/],
  ['GitHub token', /\bgh[pousr]_[0-9A-Za-z]{36,}\b/],
  ['Slack token', /\bxox[abpors]-[0-9A-Za-z-]{10,}/],
  ['JWT (a Supabase key is one)', /\beyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}/],
  ['database URL with a password', /\bpostgres(?:ql)?:\/\/[^\s:/@'"`]+:[^\s@'"`$]{6,}@(?!localhost|127\.0\.0\.1)/],
  ['secret assigned in an env file', /^(?:SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET|STRIPE_SECRET_KEY|RESEND_API_KEY|SMS_API_KEY|EMAIL_WEBHOOK_SECRET|SMS_WEBHOOK_SECRET|STRIPE_WEBHOOK_SECRET|CRON_SECRET)=\S{8,}/m],
];

const BINARY = /\.(png|jpe?g|webp|gif|ico|pdf|mp4|mov|woff2?|ttf|otf|zip|gz)$/i;
const findings = [];
const scan = (where, text) => {
  for (const [name, re] of PATTERNS) {
    const m = re.exec(text);
    if (m) findings.push(`${where}: ${name} (${m[0].slice(0, 12)}…)`);
  }
};

// --self-test: every pattern must catch a made-up key of its shape, and the
// dev values that ARE in the repo on purpose must pass. Run by CI first, so a
// broken pattern cannot quietly turn the scan into a no-op.
if (process.argv.includes('--self-test')) {
  const fake = (...parts) => parts.join('');
  const mustCatch = [
    fake('-----BEGIN ', 'PRIVATE KEY-----'),
    fake('sk_', 'live_', 'a1B2c3D4e5F6g7H8i9J0'),
    fake('whsec_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3'),
    fake('re_', 'a1B2c3D4_', 'e5F6g7H8i9J0k1L2m3'),
    fake('AKIA', 'ABCDEFGHIJKLMNOP'),
    fake('SK', '0123456789abcdef0123456789abcdef'),
    fake('ghp_', 'a'.repeat(36)),
    fake('xoxb-', '1234567890-abc'),
    fake('eyJ', 'hbGciOiJIUzI1NiJ9', '.eyJ', 'yb2xlIjoic2VydmljZV9yb2xlIn0', '.', 'abcdefghijklmnopqrstuvwxyz'),
    fake('postgres://', 'admin:', 's3cretpass@db.example.com/postgres'),
    fake('SESSION_', 'SECRET=', 'abcdefgh12345678'),
  ];
  const mustPass = [
    'postgres://postgres@127.0.0.1:54322/postgres',
    "createHmac('sha256', 'dev-only-secret-not-for-production')",
    'SUPABASE_SERVICE_ROLE_KEY=      # used in ONE server route only',
    'sk_test_notalivekeyatall1234',
  ];
  const hit = (t) => PATTERNS.some(([, re]) => re.test(t));
  const missed = mustCatch.filter((t) => !hit(t));
  const wrong = mustPass.filter(hit);
  if (missed.length || wrong.length) {
    console.error('Secret scan self-test failed.', { missed, wrong });
    process.exit(1);
  }
  console.log(`Self-test passed: ${mustCatch.length} caught, ${mustPass.length} left alone.`);
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });

if (process.argv.includes('--history')) {
  // One pass over every patch ever committed. Only ADDED lines matter.
  const log = git('log', '--all', '-p', '--no-color', '--no-ext-diff', '--format=@@commit %H');
  let commit = '', file = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('@@commit ')) { commit = line.slice(9, 17); continue; }
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    if (line.startsWith('+') && !line.startsWith('+++') && !BINARY.test(file)) scan(`${commit} ${file}`, line.slice(1));
  }
} else {
  for (const f of git('ls-files', '-z').split('\0').filter(Boolean)) {
    if (BINARY.test(f)) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    scan(f, text);
  }
}

const unique = [...new Set(findings)];
if (unique.length) {
  console.error(`Possible secrets found (${unique.length}). Rotate first, then remove:`);
  for (const f of unique) console.error('  ' + f);
  process.exit(1);
}
console.log('No secrets found.');
