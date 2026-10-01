// Who at Pitch has looked at this child's record, and why (doc 31 U-6,
// condition four; doc 14 L60; 0025's fn_who_looked).
//
// John's ruling puts four conditions on a complaints investigator's access —
// purpose-bound, time-boxed, logged, and DISCLOSED — and says of the fourth:
// "a guardian may ask who at Pitch has looked at their child's record and why,
// and get a straight answer. That is the condition that makes the other three
// real." 0025 built fn_who_looked to answer it and nothing in the app ever
// called it: the same defect as fn_send_log on this same screen, whose comment
// records that one being found — "NOTHING IN THE APP EVER CALLED IT."
//
// The answer comes from the function and is never assembled here (L23).
// fn_who_looked returns nothing to anyone who is not the person or an approved
// guardian, so who may ask is decided in Postgres, and nothing on this card
// reads investigation_grant or investigation_access. Every value rendered from
// a row — who, what, when, which report — is the function's, not ours.
//
// It is mounted on the guardian's controls screen only. Whether a player of 16
// or over should see the same card about themselves on their own home is a
// doc 34 / doc 31 question (doc 34 rule 6 gates register read receipts at 16+)
// and it is not decided here.
import { db } from '@/lib/db';
import { T } from '@/lib/palette';
import { SUPPORT_EMAIL } from '@/lib/support';
import { card } from '@/lib/ui';

// EVERY USER-VISIBLE STRING ON THIS CARD, IN ONE PLACE.
//
// APPROVED by BUZ, 28 Sep (docs/team/APPROVALS-28-SEP.md, "Who looked"), as
// proposed in docs/team/reports/2026-09-28-builder-unwired-promises.md, with
// his two defaults: the row shows a SHORT report reference, never the uuid,
// and the footer's contact is his direct address (lib/support), not help@.
// The flag stays so that un-approving is still one line; while it is true the
// card renders in production.
//
// The suites find the card by its data-who-looked marker and read the
// function's values, never these words, so BUZ changing one breaks nothing
// (L32).
export const WHO_LOOKED_APPROVED = true;
export const WHO_LOOKED_COPY = {
  heading: (whose: string) => `Who at Pitch has looked at ${whose} record`,
  nobody: (whose: string) => `Nobody at Pitch has opened ${whose} record.`,
  someone: 'Someone at Pitch',
  why: (what: string) => `Looking into a report · ${what}`,
  when: (day: string, reportRef: string) => `${day} · report ${reportRef}`,
  footer: `Somebody at Pitch can open a child’s record only while a report about it is open, and only for as long as that report is open. Every time one of us does, it is written down here and it cannot be edited or removed. Ask us why at ${SUPPORT_EMAIL} and we will tell you.`,
};

// BUZ's default: a short reference a parent can read out or type into an
// email, never the report's uuid. Its first eight hex digits, in capitals —
// enough to find one report among a small queue, and not an identifier that
// means anything anywhere else. The full id never reaches the page, not even
// in an attribute.
export const reportRef = (reportId: string) => reportId.replace(/-/g, '').slice(0, 8).toUpperCase();

type Look = { at: string; investigator: string | null; report_id: string; what: string };

// 'Sep', as every other date on this screen writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

export default async function WhoLooked({ viewerId, personId, name }: {
  viewerId: string; personId: string; name: string | null;
}) {
  if (!WHO_LOOKED_APPROVED && process.env.NODE_ENV === 'production') return null;
  const rows = (await db.query('select * from fn_who_looked($1, $2)', [viewerId, personId])).rows as Look[];
  const whose = name ? `${name}’s` : 'your';
  const C = WHO_LOOKED_COPY;

  return (
    <div id="who-looked" data-who-looked={rows.length === 0 ? 'nobody' : 'answered'} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <h2 className="sec-h">{C.heading(whose)}</h2>
      {rows.length === 0 ? (
        // The answer almost every family will get. A card that rendered
        // nothing would leave a parent unable to tell "nobody has" from "we
        // do not keep that".
        <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{C.nobody(whose)}</div>
      ) : rows.map((r, i) => (
        <div key={i} data-look={reportRef(r.report_id)} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div data-investigator style={{ fontSize: 14.5, fontWeight: 800 }}>{r.investigator ?? C.someone}</div>
          <div data-what style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{C.why(r.what)}</div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{C.when(day(r.at), reportRef(r.report_id))}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>{C.footer}</div>
    </div>
  );
}
