// The operator's report desk (doc 32 A1, A2, A4, A5, C1). Reports were being
// written and nothing showed them. This is where a person reads each one,
// hides a page while they look, closes it with an outcome, reviews an
// age-contradiction hold, and suppresses one parent's access.
//
// D-79 still holds: nothing here opens a child's record. A player page is
// identified by its link's fingerprint, a held record by its hold, and a
// family by a first name — enough to act on, nothing to read.
//
// Laid out to OpsReports.dc.html (brief G, 29 Sep): each report opens with
// its facts in labelled wells — Report, About, From — and what the reporter
// wrote under its own heading, then the actions. The signed screen is one
// report at a time and this is the desk of every open one; the words and the
// hierarchy are the signed screen's, the list is ours.
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';
import {
  closeReport, hideCoachPage, holdRecord, releaseHold, releaseSignupHold,
  removeGuardianPermanently, restoreGuardian, suppressGuardian,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports', robots: { index: false, follow: false } };

const CONCERN: Record<string, string> = {
  child_account: 'Says this account belongs to a child',
  own_child: 'A parent says their child is in this',
  family_safety: 'Family safety — another parent’s access',
  other: 'Something else',
};
const KIND: Record<string, string> = {
  player_cv: 'A player’s page', coach_cv: 'A coach page', club_page: 'A club page', trial_notice: 'A trial notice', other: 'Not stated',
};
// A fact in the signed report's wells: a 44px well, the value on one line.
const fact: React.CSSProperties = { background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, minHeight: 44, display: 'flex', alignItems: 'center', padding: '10px 13px', boxSizing: 'border-box', fontSize: 13.5, fontWeight: 700, color: T.ink, overflowWrap: 'anywhere' };
const when = (d: string) => new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');
const DONE: Record<string, string> = {
  held: 'The page is hidden. Nothing was deleted.', released: 'Released.', closed: 'Report closed.', coach: 'The coach page is down.',
  suppressed: 'That parent’s access is suppressed. It can be restored.', restored: 'Access restored.', removed: 'Recorded as a permanent removal under the court order.',
};
const ERR: Record<string, string> = {
  unresolved: 'That report doesn’t point at a page we can find.', outcome: 'Choose an outcome.', reason: 'Say why. It goes on the record.', order: 'Enter the court order reference.',
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ done?: string; error?: string; parent?: string }> }) {
  await requireOperator();
  const { done, error, parent } = await searchParams;

  const reports = (await db.query(
    `select r.id, r.created_at, r.concern, r.subject_kind, r.subject_ref, r.reason, r.reporter_email,
       (select st.record_id from share_token st
         where r.subject_kind = 'player_cv' and r.subject_ref ~ '^[0-9a-f]{64}$'
           and st.token_hash = decode(r.subject_ref, 'hex')) as record_id,
       exists (select 1 from content_hold h join share_token st on st.record_id = h.record_id
               where r.subject_ref ~ '^[0-9a-f]{64}$' and st.token_hash = decode(r.subject_ref, 'hex')
                 and h.released_at is null) as held
     from report r where r.actioned_at is null
     order by (r.concern in ('child_account','own_child','family_safety')) desc, r.created_at`,
  )).rows as { id: string; created_at: string; concern: string; subject_kind: string; subject_ref: string; reason: string | null; reporter_email: string | null; record_id: string | null; held: boolean }[];

  const holds = (await db.query(
    `select id, created_at, held_by, reason from content_hold where released_at is null order by created_at desc`,
  )).rows as { id: string; created_at: string; held_by: string | null; reason: string | null }[];

  const signupHolds = (await db.query(
    `select id, first_name, email, signup_hold_at from person where signup_hold order by signup_hold_at nulls last`,
  )).rows as { id: string; first_name: string; email: string | null; signup_hold_at: string | null }[];

  const email = (parent ?? '').trim().toLowerCase();
  const links = email ? (await db.query(
    `select g.guardian_id, g.child_id, c.first_name as child, g.revoked_at is not null as revoked,
       g.suppressed_at is not null as suppressed, g.suppressed_reason
     from guardianship_link g join person gp on gp.id = g.guardian_id join person c on c.id = g.child_id
     where lower(gp.email) = $1 and g.approved_at is not null
     order by c.first_name`, [email],
  )).rows as { guardian_id: string; child_id: string; child: string; revoked: boolean; suppressed: boolean; suppressed_reason: string | null }[] : [];

  // Every empty list is A's empty tile with its existing sentence (spec I).
  const Empty = ({ children }: { children: React.ReactNode }) => (
    <div className="card empty"><span className="empty-tile" aria-hidden /><div className="empty-t">{children}</div></div>
  );
  // A notice's words (spec I: done is the accent notice, an error the amber).
  const notice: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.5 };
  const small: React.CSSProperties = { fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 };

  return (
    <OpsConsole active="reports">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Reports" sub={<>A person reads every report. Nothing here opens a child&rsquo;s record, and nothing here deletes one.</>} />
        {done && DONE[done] && <div role="status" className="card card-accent" style={notice}>{DONE[done]}</div>}
        {error && ERR[error] && <div role="alert" className="card card-amber" style={notice}>{ERR[error]}</div>}

        <div className="player-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="sec-h">Open reports</h2>
            {reports.length === 0 && <Empty>No open reports.</Empty>}
            {/* The three safety concerns sort first and carry the amber edge: a
                state, read first. */}
            {reports.map((r) => (
              <div key={r.id} className={r.concern === 'other' ? 'card' : 'card card-amber'} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{CONCERN[r.concern] ?? r.concern}</div>
                <div className="ops-facts">
                  <div className="ops-fact"><div className="panel-h">Report</div><div style={fact}>received {when(r.created_at)}</div></div>
                  <div className="ops-fact"><div className="panel-h">About</div><div style={fact}>
                    {KIND[r.subject_kind] ?? r.subject_kind}
                    {r.subject_kind !== 'player_cv' && r.subject_ref !== 'unknown' ? ` · ${r.subject_ref}` : ''}
                    {r.subject_kind === 'player_cv' && !r.record_id ? ' · page not identified' : ''}
                  </div></div>
                  {r.reporter_email && <div className="ops-fact"><div className="panel-h">From</div><div style={fact}>{r.reporter_email}</div></div>}
                </div>
                {r.reason && (
                  <>
                    <div className="panel-h">What they wrote</div>
                    <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.reason}</div>
                  </>
                )}
                {r.concern === 'family_safety' && (
                  <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                    Suppress first; don&rsquo;t judge the dispute. Point the family to 1800RESPECT (1800 737 732). Permanent removal only on a court order. Use &ldquo;One parent&rsquo;s access&rdquo; below.
                  </div>
                )}
                {r.record_id && (r.held
                  ? <div style={{ fontSize: 12.5, color: T.accent, fontWeight: 700 }}>This page is hidden while you look.</div>
                  : (
                    <form action={holdRecord} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <label className="ops-field"><span className="panel-h">Why</span><input className="ops-input" name="reason" placeholder="Report under review" maxLength={300} /></label>
                      <button type="submit" className="btn btn-secondary">Hide this page while I look</button>
                    </form>
                  ))}
                {r.subject_kind === 'coach_cv' && r.subject_ref !== 'unknown' && (
                  <form action={hideCoachPage}><input type="hidden" name="reportId" value={r.id} />
                    <button type="submit" className="btn btn-secondary">Take the coach page down</button>
                  </form>
                )}
                <form action={closeReport} className="ops-search">
                  <input type="hidden" name="reportId" value={r.id} />
                  <select name="outcome" aria-label="Outcome" defaultValue="" required className="ops-input">
                    <option value="" disabled>Outcome…</option>
                    <option value="removed">Removed</option>
                    <option value="no_action">No action needed</option>
                    <option value="referred">Referred on</option>
                  </select>
                  <button type="submit" className="console-btn">Close report</button>
                </form>
              </div>
            ))}
          </div>

          <div className="ops-aside-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="sec-h">Hidden pages</h2>
            {holds.length === 0 ? <Empty>Nothing is hidden.</Empty> : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {holds.map((h, i) => (
                  <form key={h.id} action={releaseHold} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderTop: i > 0 ? `1px solid ${T.line}` : undefined }}>
                    <input type="hidden" name="holdId" value={h.id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>{h.reason ?? 'Report under review'}</div>
                      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Since {when(h.created_at)}{h.held_by ? ` · ${h.held_by}` : ''}</div>
                    </div>
                    <button type="submit" className="console-btn">Show it again</button>
                  </form>
                ))}
              </div>
            )}

            <h2 className="sec-h" style={{ marginTop: 8 }}>Age checks</h2>
            <div style={small}>An adult account that named a junior squad. Hidden from clubs until you look. A person always decides.</div>
            {signupHolds.length === 0 && <Empty>Nobody is held.</Empty>}
            {signupHolds.map((p) => (
              <form key={p.id} action={releaseSignupHold} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="hidden" name="personId" value={p.id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{p.first_name}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, overflowWrap: 'anywhere' }}>{p.email ?? 'No email'}{p.signup_hold_at ? ` · held ${when(p.signup_hold_at)}` : ''}</div>
                </div>
                <button type="submit" className="console-btn">Checked — release</button>
              </form>
            ))}

            <h2 className="sec-h" style={{ marginTop: 8 }}>One parent&rsquo;s access</h2>
            <div style={small}>
              For a family safety matter. Suppress first: it stops that parent seeing or doing anything, and deletes nothing. Point the family to 1800RESPECT (1800 737 732). Remove permanently only on a court order.
            </div>
            <form className="ops-search">
              <input name="parent" aria-label="Parent's email" defaultValue={parent ?? ''} placeholder="The parent's email" className="ops-input" />
              <button type="submit" className="console-btn">Find</button>
            </form>
            {email && links.length === 0 && <Empty>No parent account with that email.</Empty>}
            {/* Each child link is a panel with its state as a pill (spec I):
                active, suppressed or removed. */}
            {links.map((l) => (
              <div key={l.child_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>Parent of {l.child}</div>
                  <span className={l.suppressed ? 'pill pill-wait' : l.revoked ? 'pill' : 'pill pill-live'}>{l.suppressed ? 'suppressed' : l.revoked ? 'removed' : 'active'}</span>
                </div>
                {l.suppressed_reason && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, overflowWrap: 'anywhere' }}>{l.suppressed_reason}</div>}
                {!l.revoked && (
                  <form action={suppressGuardian} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="hidden" name="guardianId" value={l.guardian_id} />
                    <input type="hidden" name="childId" value={l.child_id} />
                    <label className="ops-field"><span className="panel-h">Why</span><input className="ops-input" name="reason" required minLength={3} maxLength={300} /></label>
                    <button type="submit" className="btn btn-secondary">Suppress this parent&rsquo;s access</button>
                  </form>
                )}
                {l.suppressed && (
                  <>
                    <form action={restoreGuardian}>
                      <input type="hidden" name="guardianId" value={l.guardian_id} />
                      <input type="hidden" name="childId" value={l.child_id} />
                      <button type="submit" className="btn btn-secondary">Restore access</button>
                    </form>
                    {/* Irreversible is what red means: the page's only red panel. */}
                    <form action={removeGuardianPermanently} className="card card-red" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="hidden" name="guardianId" value={l.guardian_id} />
                      <input type="hidden" name="childId" value={l.child_id} />
                      <label className="ops-field"><span className="panel-h">Court order reference</span><input className="ops-input" name="courtOrder" required minLength={4} maxLength={120} /></label>
                      <button type="submit" className="btn btn-secondary" style={{ borderColor: T.red, color: T.red }}>Remove permanently</button>
                    </form>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </OpsConsole>
  );
}
