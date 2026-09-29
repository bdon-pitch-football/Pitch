// One club, from the operator's side (brief I; D-64, D-74, D-90; 0130).
//
// While the club is UNCLAIMED its listing is Pitch's, so it is edited and
// removed here, the change logged with the operator's name. Once somebody has
// claimed the page it is the club's to run, and this screen offers its public
// page and its call sheet instead — nothing about who claimed it: that is on
// the call sheet (brief I: no person's data here).
//
// The notices Pitch compiled from the club's own public notices are listed
// with their stamps (added on, by whom, last checked) and the link to the
// notice they came from; each is changed, re-stamped or taken down from here.
// New ones only while the club is unclaimed or claimed-and-unverified: a
// verified club posts its own (D-90). The database decides every one of those
// (fn_ops_*, 0130); this page only offers what it would accept.
//
// Held with its words (lib/ops-policy).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import { isUuid } from '@/lib/ids';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';
import { checkNotice, editClub, removeClub, removeNotice } from '../actions';
import { StateChip } from '../chip';
import { ListingFields, type Listing } from '../listing-fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Club', robots: { index: false, follow: false } };

type Club = Listing & { id: string; club_state: string; public_slug: string | null; listed_by_email: string | null; listed: string | null };
type Notice = { id: string; title: string; date: string; time_venue: string; age_groups: string[]; source_url: string; added: string; added_by_email: string | null; checked: string };

const ERRORS: Record<string, string> = {
  dup: 'A club with that name and suburb is already listed.',
  fields: 'Fill in the name, suburb, state and where you found it.',
  remove: 'This listing has more on it than Pitch added, so it cannot be removed here.',
  refused: 'This club has claimed its page or been verified since, so that is the club’s to do now.',
};

export default async function OpsClub({ params, searchParams }: {
  params: Promise<{ clubId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  const { clubId } = await params;
  const { error } = await searchParams;
  if (!isUuid(clubId)) notFound();
  const c = (await db.query(
    `select *, to_char(listed_at at time zone 'Australia/Melbourne', 'FMDD Mon YYYY') as listed from fn_ops_club($1)`,
    [clubId])).rows[0] as Club | undefined;
  if (!c) notFound();
  const notices = (await db.query(
    `select id, title, to_char(trial_on, 'Dy FMDD Mon') as date, time_venue, age_groups, source_url,
       to_char(added_on, 'FMDD Mon') as added, added_by_email, to_char(last_checked, 'FMDD Mon') as checked
     from fn_ops_club_notices($1)`,
    [clubId])).rows as Notice[];
  const unclaimed = c.club_state === 'unclaimed';
  const curatable = unclaimed || c.club_state === 'claimed';

  return (
    <OpsConsole active="clubs">
      <div className="console ops-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title={c.name} back={{ href: '/ops/clubs', label: 'Clubs' }}
          sub={[c.suburb, c.state].filter(Boolean).join(' ')} action={<StateChip state={c.club_state} />} />
        {error && ERRORS[error] && (
          <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>{ERRORS[error]}</div>
        )}

        <div className="ops-doors" style={{ justifyContent: 'flex-start' }}>
          {c.public_slug && <Link href={`/fc/${c.public_slug}`} className="console-btn">Club page</Link>}
          {!unclaimed && <Link href={`/ops/call/${c.id}`} className="console-btn">Open call sheet</Link>}
        </div>

        {unclaimed && (
          <form action={editClub} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="hidden" name="clubId" value={c.id} />
            <ListingFields c={c} />
            {c.listed_by_email && c.listed && (
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.55, overflowWrap: 'anywhere' }}>Listed {c.listed} by {c.listed_by_email}</div>
            )}
            <button type="submit" className="btn btn-secondary">Save changes</button>
          </form>
        )}

        {/* Never an empty section (D-162): a verified club with no notice
            of Pitch's shows no Trials heading at all. */}
        {(curatable || notices.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={sectionLabel}>Trials</h2>
            {curatable && <Link href={`/ops/clubs/${c.id}/trial`} className="console-btn console-btn-primary">Post a trial</Link>}
          </div>
          {notices.map((n) => (
            <div key={n.id} data-notice={n.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{n.title}</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>{[n.date, n.age_groups.join(' · '), n.time_venue].filter(Boolean).join(' · ')}</div>
              <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                Listed {n.added}{n.added_by_email ? ` by ${n.added_by_email}` : ''} · checked {n.checked}
              </div>
              <a href={n.source_url} rel="noreferrer" style={{ fontSize: 12, color: T.accent, fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{n.source_url}</a>
              <div className="ops-doors">
                {curatable && <Link href={`/ops/clubs/${c.id}/trial?edit=${n.id}`} className="console-btn">Change</Link>}
                {curatable && (
                  <form action={checkNotice}>
                    <input type="hidden" name="clubId" value={c.id} />
                    <input type="hidden" name="notice_id" value={n.id} />
                    <button type="submit" className="console-btn">Checked today</button>
                  </form>
                )}
                <form action={removeNotice}>
                  <input type="hidden" name="clubId" value={c.id} />
                  <input type="hidden" name="notice_id" value={n.id} />
                  <button type="submit" className="console-btn">Remove</button>
                </form>
              </div>
            </div>
          ))}
        </div>
        )}

        {unclaimed && (
          <details style={card}>
            <summary style={{ fontSize: 13, fontWeight: 800, color: T.secondary, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Remove this listing</summary>
            <form action={removeClub} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              <input type="hidden" name="clubId" value={c.id} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>Its page and its trials come down now.</div>
              <button type="submit" className="btn btn-secondary" style={{ borderColor: T.red, color: T.red }}>Remove</button>
            </form>
          </details>
        )}
      </div>
    </OpsConsole>
  );
}
