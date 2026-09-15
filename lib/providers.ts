// The provider adapters. One file, two functions, no SDKs.
//
// Both providers are plain HTTPS with an auth header, and a dependency that
// wraps that is a dependency that can go unmaintained, pull in transitive
// packages, or start phoning home. fetch is enough.
//
// NOTHING here decides whether to send. The catalogue check, the SMS caps,
// the kill switch and the opt-out list all live in lib/messaging, and this
// file is only reached once that layer has said yes. Keeping the policy and
// the transport apart is what stops a future adapter quietly acquiring the
// power to send something doc 15 never approved.
import 'server-only';

export type Dispatch =
  | { ok: true; providerId: string }
  | { ok: false; reason: string; permanent: boolean };

/** Resend. Transactional mail from the send. subdomain, never the apex (D-81). */
export async function sendEmail(to: string, subject: string, body: string, replyTo?: string): Promise<Dispatch> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, reason: 'not_configured', permanent: false };

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        // Doc 15 is written as plain text and every line of it was chosen.
        // Sending it as text/plain is not a limitation — an HTML wrapper is
        // one more thing to get wrong in a message a parent has to trust.
        text: body,
        // The Reply-To is decided by lib/reply-policy — per message, and absent
        // entirely on the CV email to a club (John, U-11). This file used to
        // read one global address itself, which is how that email came to
        // carry one.
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch {
    return { ok: false, reason: 'network', permanent: false };
  }

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, providerId: json.id ?? '' };
  }
  // 4xx is our fault and will not fix itself; 5xx and 429 are worth retrying.
  const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
  return { ok: false, reason: `http_${res.status}`, permanent };
}

/**
 * SMS over Twilio's REST API.
 *
 * The sender is an Australian long number so STOP and HELP can come back to
 * it (D-81) — an alphanumeric sender ID cannot receive, which would leave the
 * opt-out reply in doc 15 §15 promising something the channel cannot do.
 */
export async function sendSms(to: string, body: string): Promise<Dispatch> {
  const sid = process.env.SMS_ACCOUNT_SID;
  const key = process.env.SMS_API_KEY;
  const from = process.env.SMS_LONG_NUMBER;
  if (!sid || !key || !from) return { ok: false, reason: 'not_configured', permanent: false };

  let res: Response;
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${key}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
  } catch {
    return { ok: false, reason: 'network', permanent: false };
  }

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as { sid?: string };
    return { ok: true, providerId: json.sid ?? '' };
  }
  const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
  return { ok: false, reason: `http_${res.status}`, permanent };
}
