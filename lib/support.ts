// The one contact address a person using Pitch ever sees (BUZ, 28 Sep:
// "as mentioned i want to use my direct email"; docs/team/APPROVALS-28-SEP.md).
//
// It replaces the old help@ address everywhere a person reads one — the
// screens, doc 15's email and SMS bodies (lib/messages HELP), and the
// who-looked card. ONE constant, so the next change of address is one line
// and cannot leave a stale copy on a screen nobody re-read (L25).
//
// A literal, not an environment variable, for the reason .env.example gives:
// the address is inside doc 15's message bodies, and copy that changes with
// the environment is copy nobody reviewed. It is imported by client pages
// (/join) as well as server ones, so it must stay free of server-only imports.
//
// What this is NOT: the Reply-To header on outgoing email. That is
// EMAIL_REPLY_TO (lib/reply-policy), and changing where replies land is a
// separate call — see the 28 Sep final-A report.
export const SUPPORT_EMAIL = 'burak.donmez@pitch-football.com';
