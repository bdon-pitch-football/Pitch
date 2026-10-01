// The secrets a deploy cannot go live without, asked when it is BUILT
// (safety review of John's batch, S-3, 2 Oct; D-81, D-156, D-168).
//
// NUMBER_HASH_KEY keys every phone-number fingerprint (lib/number-hash). In
// production with no key, or a key too short to be one, the runtime fails
// closed — no fingerprint, so no SMS is queued, sent or matched — and that is
// right, but it was SILENT: every under-16 and 16–17 sign-up made while the
// key was missing could never be approved (the text channel never existed,
// and approval needs both, D-156), they died at 14 days, and the screens in
// between implied a text had gone. One GO-LIVE row was all that stood
// between a forgotten variable and that.
//
// So a deploy build without it fails, naming the variable and never a value
// (nor its length). The runtime stays fail-closed behind this: a key removed
// after the build still sends nothing.
//
// A deploy is Vercel's production or preview build (VERCEL_ENV), the two
// environments GO-LIVE sets the key in. Development and the suites — `next
// dev`, and the local production build the suites check (`next build` with
// NEXT_DIST_DIR=.next-check, then test:csp-prod) — keep the fixed dev key and
// are not deploys.
//
// Plain JavaScript so next.config.mjs can import it with no build step.

/** Shorter than this is a typo or a placeholder, not a secret (lib/number-hash MIN_KEY_LENGTH). */
export const NUMBER_HASH_KEY_MIN_LENGTH = 32;

/** True when this build is one that will serve the public. */
export function isDeployBuild(env = process.env) {
  return env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview';
}

/** The names of the secrets this deploy build lacks — names only, never a value. */
export function missingDeploySecrets(env = process.env) {
  if (!isDeployBuild(env)) return [];
  const missing = [];
  if ((env.NUMBER_HASH_KEY ?? '').trim().length < NUMBER_HASH_KEY_MIN_LENGTH) missing.push('NUMBER_HASH_KEY');
  return missing;
}

/** The build's refusal, naming each variable and saying nothing about any value. */
export function deploySecretsMessage(missing) {
  return `Refusing to build a deploy: ${missing.join(', ')} is not set, or is too short to be the real key ` +
    `(at least ${NUMBER_HASH_KEY_MIN_LENGTH} characters). Without it production sends no SMS, so no under-16 ` +
    'could be approved. Set it in this Vercel environment (docs/team/GO-LIVE.md) and build again.';
}
