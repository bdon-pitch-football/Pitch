// Every club, in every state (brief I; D-74, D-90). The operator's directory:
// unclaimed listings Pitch compiled, clubs that have claimed their page, the
// verified and the suspended, with a search by name or suburb. Each row is the
// club's name, suburb and state, its state as the queue's chip, the trials it
// has live on the board, and the doors to its public page and — once somebody
// has claimed it, so there is a call to make — its call sheet.
//
// NO PERSON'S DATA. The one function this page asks (fn_ops_clubs, 0130)
// returns club facts and a count; a club's administrator and TD are on the
// call sheet and nowhere here. The permission suite reads the query below and
// the function's result columns (cur-s*).
//
// Laid out as round G laid out the queue: from 768px the signed table, and
// below it each club on two lines — the details full width, then the count,
// the chip and the doors — so nothing is squeezed to one word a line.
//
// Held with its words (lib/ops-policy): a 404 in production until BUZ
// approves them.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';
import { StateChip } from './chip';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clubs', robots: { index: false, follow: false } };

type Row = { id: string; name: string; suburb: string | null; state: string | null; club_state: string; public_slug: string | null; notices_live: number };

export default async function OpsClubs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  const q = String((await searchParams).q ?? '').trim().slice(0, 80);
  const rows = (await db.query(`select * from fn_ops_clubs($1)`, [q])).rows as Row[];

  return (
    <OpsConsole active="clubs">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Clubs"
          action={<Link href="/ops/clubs/new" className="console-btn console-btn-primary">Add a club</Link>} />
        <form role="search" style={{ ...card, display: 'flex', gap: 10 }}>
          <input name="q" aria-label="Club name or suburb" defaultValue={q} placeholder="Club name or suburb"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }} />
          <button type="submit" className="console-btn">Search</button>
        </form>
        {rows.length === 0 ? (
          <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500 }}>Nothing matches that.</div>
        ) : (
          <div className="ops-table">
            <div className="ops-head ops-clubrow" aria-hidden>
              <div>Club</div><div>Trials live</div><div /><div />
            </div>
            {rows.map((r) => (
              <div key={r.id} className="ops-clubrow console-row-hover" data-club-row={r.club_state}>
                <div className="ops-club">
                  <Link href={`/ops/clubs/${r.id}`} style={{ fontSize: 14, fontWeight: 800, color: T.ink, textDecoration: 'none', overflowWrap: 'anywhere' }}>{r.name}</Link>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 2 }}>{[r.suburb, r.state].filter(Boolean).join(' ')}</div>
                </div>
                {/* Never a zero (D-162): a club with nothing live shows a
                    dash, as the queue's held column does. */}
                <div className="ops-live" style={{ fontSize: 13, fontWeight: 800, color: r.notices_live > 0 ? T.accent : T.muted, whiteSpace: 'nowrap' }}>
                  {r.notices_live > 0 ? <>{r.notices_live}<span className="ops-held-word"> live</span></> : '—'}
                </div>
                <div className="ops-status"><StateChip state={r.club_state} /></div>
                <div className="ops-doors">
                  {r.public_slug && <Link href={`/fc/${r.public_slug}`} className="console-btn">Club page</Link>}
                  {r.club_state !== 'unclaimed' && <Link href={`/ops/call/${r.id}`} className="console-btn">Open call sheet</Link>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OpsConsole>
  );
}
