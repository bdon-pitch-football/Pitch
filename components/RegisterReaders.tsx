// Who has read a registration (doc 34 rule 6; doc 32 C4b; 0047). The answer
// comes from fn_register_readers, which returns nothing to anyone who may not
// ask. Names, roles, what they did and when — and nothing about the club's
// own statuses, which never reach a family (D-108, doc 14 N10).
import { db } from '@/lib/db';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

type Row = {
  registration_id: string; club_name: string; registered_at: string; withdrawn: boolean;
  reader_name: string | null; reader_role: string | null; surface: 'list' | 'cv' | null; last_read: string | null;
};

// 'Sep', as the timeline beside it writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

// One row per person, with each kind of read they made (CV first).
function groupByReader(reads: Row[]) {
  const by = new Map<string, { name: string | null; role: string | null; reads: Row[] }>();
  for (const r of reads) {
    const k = `${r.reader_name}|${r.reader_role}`;
    const g = by.get(k) ?? { name: r.reader_name, role: r.reader_role, reads: [] };
    g.reads.push(r);
    by.set(k, g);
  }
  for (const g of by.values()) g.reads.sort((a, b) => (a.surface === 'cv' ? -1 : 1) - (b.surface === 'cv' ? -1 : 1));
  return [...by.values()];
}

export default async function RegisterReaders({ viewerId, personId, name }: { viewerId: string; personId: string; name: string | null }) {
  const rows = (await db.query('select * from fn_register_readers($1, $2)', [viewerId, personId])).rows as Row[];
  const regs = new Map<string, { club: string; at: string; withdrawn: boolean; reads: Row[] }>();
  for (const r of rows) {
    const g = regs.get(r.registration_id) ?? { club: r.club_name, at: r.registered_at, withdrawn: r.withdrawn, reads: [] };
    if (r.surface && r.last_read) g.reads.push(r);
    regs.set(r.registration_id, g);
  }
  const whose = name ? `${name}’s` : 'your';

  return (
    <div id="readers" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <h2 style={sectionLabel}>Who has read {whose} registrations</h2>
      {regs.size === 0 ? (
        <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500 }}>
          {name ? `${name} isn’t on any club register.` : 'You’re not on any club register.'}
        </div>
      ) : [...regs.values()].map((g, i) => (
        <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{g.club}</div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
              Registered {day(g.at)}{g.withdrawn ? ' · taken off since' : ''}
            </div>
          </div>
          {g.reads.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Nobody at {g.club} has read it yet.</div>
          ) : groupByReader(g.reads).map((who, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderTop: `1px solid ${T.surface2}`, paddingTop: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{who.name ?? 'A club member'}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{who.role ?? 'Club staff'}</div>
              </div>
              <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {who.reads.map((r) => (
                  <div key={r.surface}>
                    {r.surface === 'cv' ? 'Opened the CV' : 'Saw it in the list'}<br />
                    <span style={{ color: T.muted }}>last {day(r.last_read as string)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
        Only people a club has named can read its register, and every time they do, it&rsquo;s recorded here.
      </div>
    </div>
  );
}
