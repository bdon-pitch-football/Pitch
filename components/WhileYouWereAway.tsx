// The return (0064). Rendered on arrival when the last session was sixty days
// or more ago, and rendered nowhere else: it is never emailed, texted or
// pushed, because the moment it becomes a send it is a re-engagement prompt
// (D-65 as amended by D-81).
//
// Facts, dated, with no verb aimed at the reader. Nothing here says update,
// renew, check or complete; the renewal control stays where it has always
// been, on the child's own card below. Two of the three lines are reassurance
// and the third is a calendar fact.
//
// Every fact comes from fn_return_facts, which applies doc 34 rule 6's gate
// through fn_register_readers and refuses an under-16 outright — so this
// component never decides who may see what, and a line it is not given simply
// does not render (L23, L2).
//
// Sunken, because you read it. The raised card below it is the one you act on.
import { db } from '@/lib/db';
import { T } from '@/lib/palette';
import { sectionLabel } from '@/lib/ui';

type Fact = {
  kind: 'read' | 'link_expiry' | 'trials';
  on_label: string;
  subject: string | null;      // null = the viewer themselves
  club_name: string | null;
  reader_name: string | null;
  reader_role: string | null;
  surface: 'cv' | 'list' | null;
  checked_label: string | null;
};

export default async function WhileYouWereAway({ viewerId, since }: {
  viewerId: string; since: string;
}) {
  // Dates are formatted in Postgres, in Melbourne, as every other date on
  // this page is: to_char gives 'Sep', never en-AU's 'Sept' (LESSONS L18).
  const facts = (await db.query(
    `select kind, to_char(fact_on, 'FMDD Mon') as on_label, subject, club_name,
       reader_name, reader_role, surface, to_char(checked_on, 'FMDD Mon') as checked_label
     from fn_return_facts($1, $2::timestamptz)`,
    [viewerId, since],
  )).rows as Fact[];
  if (facts.length === 0) return null;

  const line = (f: Fact): { said: string; quiet: string | null } => {
    const whose = f.subject ? `${f.subject}’s` : 'your';
    const who = f.subject ?? 'you';
    if (f.kind === 'read') {
      const at = [f.reader_name, f.reader_role].filter(Boolean).join(', ');
      return f.surface === 'cv'
        ? { said: `${at} at ${f.club_name}, opened ${whose} CV.`, quiet: null }
        : { said: `${at} at ${f.club_name}, saw ${who} on their register.`, quiet: null };
    }
    if (f.kind === 'link_expiry') {
      return {
        said: `${whose[0].toUpperCase()}${whose.slice(1)} link expires.`,
        quiet: 'Clubs holding it stop being able to open the page that day.',
      };
    }
    return {
      said: 'The next trial we hold a notice for.',
      quiet: f.checked_label ? `Last checked ${f.checked_label}.` : null,
    };
  };

  return (
    <div className="card-sunken" style={{ padding: '17px 16px', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ ...sectionLabel, marginBottom: 13 }}>While you were away</h2>
      {facts.map((f, i) => {
        const { said, quiet } = line(f);
        return (
          <div key={f.kind} style={{
            display: 'flex', gap: 12, alignItems: 'baseline',
            padding: i === 0 ? '0 0 10px 0' : '10px 0',
            borderTop: i === 0 ? undefined : `1px solid ${T.line}`,
          }}>
            {/* 74px at every width: the type scale does not change at a
                breakpoint (D-147), and 'FMDD Mon' at 11.5px fits it. */}
            <div className="tnum" style={{
              width: 74, flexShrink: 0, fontSize: 11.5, fontWeight: 800,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted,
            }}>{f.on_label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}>
              {said}{quiet && <> <span style={{ fontWeight: 500, color: T.secondary }}>{quiet}</span></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
