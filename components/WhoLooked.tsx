// Who at Pitch has looked at this child's record, and why (doc 31 U-6,
// condition four; doc 14 L60; 0025's fn_who_looked).
//
// John's ruling has four conditions on a complaints investigator's access —
// purpose-bound, time-boxed, logged, and DISCLOSED — and says of the fourth:
// "a guardian may ask who at Pitch has looked at their child's record and why,
// and get a straight answer. That is the condition that makes the other three
// real." 0025 built `fn_who_looked` to answer it and nothing in the app ever
// called it, which is the same defect as `fn_send_log` on this same screen —
// its comment records that one being found: "green on it — and NOTHING IN THE
// APP EVER CALLED IT."
//
// The answer comes from the function and is never assembled here (L23):
// fn_who_looked returns nothing at all to anyone who is not the person or an
// approved guardian, so who may ask is decided in Postgres. Nothing on this
// card reads investigation_grant or investigation_access directly.
import { db } from '@/lib/db';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

type Look = { at: string; investigator: string | null; report_id: string; what: string };

// 'Sep', as every other date on this screen writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

export default async function WhoLooked({ viewerId, personId, name }: {
  viewerId: string; personId: string; name: string | null;
}) {
  const rows = (await db.query('select * from fn_who_looked($1, $2)', [viewerId, personId])).rows as Look[];
  const whose = name ? `${name}’s` : 'your';

  return (
    <div id="who-looked" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <h2 style={sectionLabel}>{`Who at Pitch has looked at ${whose} record`}</h2>
      {rows.length === 0 ? (
        // The honest answer, and the one almost every family will get. An
        // empty card that renders nothing would leave a parent unable to tell
        // "nobody has" from "we do not keep that".
        <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
          {`Nobody at Pitch has opened ${whose} record.`}
        </div>
      ) : rows.map((r, i) => (
        <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.investigator ?? 'Someone at Pitch'}</div>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
            {`Looking into a report \u00b7 ${r.what}`}
          </div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{`${day(r.at)} \u00b7 report ${r.report_id}`}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
        Somebody at Pitch can open a child&rsquo;s record only while a report about it is open, and only for as long as that report is open. Every time one of us does, it is written down here and it cannot be edited or removed. Ask us why at help@pitchfootball.com.au and we will tell you.
      </div>
    </div>
  );
}
