// Ids arrive from URLs and from server-action arguments, and both are
// hostile. Postgres does not politely decline a uuid column handed the word
// "bogus" — it raises `invalid input syntax for type uuid`, which surfaces
// as a 500 carrying a database error message.
//
// That is a bug twice over. It is a crash where the product has a calm
// answer for every dead link, and it is a distinguishable one: a malformed
// id 500s while a well-formed unknown id returns the neutral page, so the
// shape of an id leaks from the difference. D-77's whole point is that the
// answer to a wrong link never varies.
//
// It matters most on /a/[id] — the approval link a guardian receives by SMS.
// Messaging apps truncate and decorate links routinely, and a parent whose
// link arrived mangled met a server error rather than "this link is not
// valid".
import 'server-only';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the string is shaped like a uuid and is safe to hand Postgres. */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}
