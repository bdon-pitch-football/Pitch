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
import { StateChip } from './chip';
import { dismissClubRequest } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clubs', robots: { index: false, follow: false } };

type Row = { id: string; name: string; suburb: string | null; state: string | null; club_state: string; public_slug: string | null; notices_live: number };

export default async function OpsClubs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  const q = String((await searchParams).q ?? '').trim().slice(0, 80);
  const op = await requireOperator();
  const rows = (await db.query(`select * from fn_ops_clubs($1)`, [q])).rows as Row[];
  // 0159: clubs a club person asked us to add. The club's details only.
  const asks = (await db.query(`select * from fn_ops_club_requests($1, $2)`, [op.personId, op.email])).rows as
    { id: string; name: string; suburb: string; state: string; contact_email: string; created_at: string }[];

  return (
    <OpsConsole active="clubs">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        {/* Green marks the work (I-P1a, BUZ 1 Oct): "Add a club" is the primary
            only when no club is asking; while one is, its own "Add" is. */}
        <OpsHeader title="Clubs"
          action={<Link href="/ops/clubs/new" className={asks.length > 0 ? 'console-btn' : 'console-btn console-btn-primary'}>Add a club</Link>} />
        {asks.length > 0 && (
          <div className="card card-amber" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800 }}>Clubs asking to be added</h2>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.secondary, lineHeight: 1.55 }}>
              Check the email address is on the club&rsquo;s own website before you add it. The claim code goes there.
            </div>
            {asks.map((a) => {
              const add = `/ops/clubs/new?request=${a.id}&name=${encodeURIComponent(a.name)}&suburb=${encodeURIComponent(a.suburb)}&state=${a.state}&contact=${encodeURIComponent(a.contact_email)}`;
              return (
                <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{a.name}</div>
                    <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, overflowWrap: 'anywhere' }}>{a.suburb} {a.state} · {a.contact_email}</div>
                  </div>
                  <Link href={add} className="console-btn console-btn-primary">Add</Link>
                  <form action={dismissClubRequest}><input type="hidden" name="request" value={a.id} />
                    <button type="submit" className="console-btn">Dismiss</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        <form role="search" className="ops-search">
          <input name="q" aria-label="Club name or suburb" defaultValue={q} placeholder="Club name or suburb" className="ops-input" />
          <button type="submit" className="console-btn">Search</button>
        </form>
        {rows.length === 0 ? (
          <div className="empty-tile is-compact"><div className="empty-t">Nothing matches that.</div></div>
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
