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
