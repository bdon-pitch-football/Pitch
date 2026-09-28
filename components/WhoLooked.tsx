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
import { card, sectionLabel } from '@/lib/ui';

// EVERY USER-VISIBLE STRING ON THIS CARD, IN ONE PLACE.
//
// ⚠ AWAITING BUZ. None of this is approved copy. It is listed verbatim in
// docs/team/reports/2026-09-28-builder-unwired-promises.md as a proposal, and
// it does not reach a user: the card renders in development only until
// WHO_LOOKED_APPROVED is true — the same rule lib/messaging applies to a draft
// message ("a flow that depends on one cannot ship until BUZ has approved the
// words"). Approving the words is changing them here and flipping one flag.
//
// The suites find the card by its data-who-looked marker and read the
// function's values, never these words, so BUZ changing one breaks nothing
// (L32).
export const WHO_LOOKED_APPROVED = false;
export const WHO_LOOKED_COPY = {
  heading: (whose: string) => `Who at Pitch has looked at ${whose} record`,
  nobody: (whose: string) => `Nobody at Pitch has opened ${whose} record.`,
  someone: 'Someone at Pitch',
  why: (what: string) => `Looking into a report · ${what}`,
  when: (day: string, reportId: string) => `${day} · report ${reportId}`,
  footer: 'Somebody at Pitch can open a child’s record only while a report about it is open, and only for as long as that report is open. Every time one of us does, it is written down here and it cannot be edited or removed. Ask us why at help@pitchfootball.com.au and we will tell you.',
};

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
      <h2 style={sectionLabel}>{C.heading(whose)}</h2>
      {rows.length === 0 ? (
        // The answer almost every family will get. A card that rendered
        // nothing would leave a parent unable to tell "nobody has" from "we
        // do not keep that".
        <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{C.nobody(whose)}</div>
      ) : rows.map((r, i) => (
        <div key={i} data-look={r.report_id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div data-investigator style={{ fontSize: 14.5, fontWeight: 800 }}>{r.investigator ?? C.someone}</div>
          <div data-what style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{C.why(r.what)}</div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{C.when(day(r.at), r.report_id)}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>{C.footer}</div>
    </div>
  );
}
