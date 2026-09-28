// What the SMS spend cap is — the decision, with no framework around it so
// the suite can run it. Same shape as ops-policy, cron-policy, reply-policy.
//
// Release seat R4 (22 Sep): `Number(process.env.SMS_MONTHLY_CAP_CENTS ?? 0)`
// followed by `if (cap > 0)` read an unset variable as NO CAP — the one
// reading D-81 cannot survive. An unset variable is the state of every deploy
// until somebody remembers, and D-81 says the controls are in place BEFORE the
// first verification message, because SMS pumping against an unrated OTP
// endpoint is one of the most common ways a small launch loses real money in
// week one.
//
// So the rule is the same one cron-policy makes for a missing secret: nothing
// configured admits nothing. "Nobody set a cap" means "nobody has authorised
// any spend", never "spend anything".
//
// BUZ's decision 5, 23 Sep: the cap is mandatory.

/**
 * The configured cap in cents, or null when there is no usable cap — unset,
 * blank, zero, negative, or not a number. Null is a refusal, never a licence.
 */
export function smsCapCents(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const cents = Number(String(raw).trim());
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

// The switch on /ops/switches (0070). The environment is the ceiling and the
// database can only make things stricter: SMS is off if either says so, and
// the cap in force is the lower of the two. Nothing an operator presses can
// raise the spend above SMS_MONTHLY_CAP_CENTS or switch on what
// SMS_KILL_SWITCH switched off.

/** Is SMS switched off, by the environment or by an operator? */
export function smsSwitchedOff(envKill: string | undefined | null, dbOff: boolean | null | undefined): boolean {
  return envKill === 'true' || dbOff === true;
}

/**
 * The monthly cap in force, in cents: the lower of the environment's cap and
 * the operator's, or whichever one exists. Null when neither exists — and in
 * production that case never reaches here, because no environment cap
 * already refuses every SMS (smsCapCents, BUZ decision 5).
 */
export function effectiveSmsCapCents(envCap: number | null, dbCap: number | null | undefined): number | null {
  const caps = [envCap, dbCap ?? null].filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0);
  return caps.length ? Math.min(...caps) : null;
}

/**
 * Read an operator's cap from the form: dollars, as typed, into cents. Null
 * for anything that is not a positive amount, or that is ABOVE the
 * environment's cap — the database may lower the ceiling, never raise it.
 */
export function operatorCapCents(dollars: string, envCap: number | null): number | null {
  const t = String(dollars ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  if (envCap !== null && cents > envCap) return null;
  return cents;
}
