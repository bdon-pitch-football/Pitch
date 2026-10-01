// A trial notice compiled from the club's own public notice (D-90; brief I;
// 0130). Built on PostATrial.dc.html and the club's own post-trial form
// (app/club/post-trial): the same sections, the same fields and the same
// words — the notice title, every age group it is for, the competition, the
// date, the time and the ground, and the positions wanted — plus the one
// thing a compiled notice must carry, the address of the club's own notice it
// came from ("Where you found it", the call sheet's label).
//
// Two of the club's fields are not here, on purpose. "How to register" is the
// club's own instruction to families, and "Where CVs should go" would put an
// address Pitch compiled in front of a family's send (doc 14 J38): a family
// sends to an unclaimed club by typing the address from the club's own notice
// (app/send). The notice links to its club's page, whose button does that.
//
// It comes down by itself the day after its date, as a club's own notice
// does, and on the board it carries the unclaimed marker and "Send my CV",
// which every listing from a club that is not verified already gets.
// Held with its words (lib/ops-policy).
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import { isUuid } from '@/lib/ids';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { T } from '@/lib/palette';
import { saveNotice } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Post a trial', robots: { index: false, follow: false } };

type Notice = { id: string; title: string; trial_on: string; time_venue: string; competition_gender: string | null;
                position_needs: string[]; age_groups: string[]; source_url: string; registered: boolean };

export default async function OpsTrial({ params, searchParams }: {
  params: Promise<{ clubId: string }>; searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  const { clubId } = await params;
  const { edit, error } = await searchParams;
  if (!isUuid(clubId)) notFound();
  const c = (await db.query(`select id, name, club_state from fn_ops_club($1)`, [clubId])).rows[0] as
    { id: string; name: string; club_state: string } | undefined;
  // Only on a club that is unclaimed or claimed-and-unverified (D-90); the
  // database refuses the rest whatever this page does.
  if (!c || !['unclaimed', 'claimed'].includes(c.club_state)) notFound();
  const editing = edit && isUuid(edit)
    ? ((await db.query(
        `select id, title, to_char(trial_on, 'YYYY-MM-DD') as trial_on, time_venue, competition_gender, position_needs,
           age_groups, source_url, registered
         from fn_ops_club_notices($1) where id = $2`, [clubId, edit])).rows[0] as Notice | undefined) ?? null
    : null;
  const ages = (await db.query(`select code, label from age_group order by sort`)).rows as { code: string; label: string }[];
  const [editTime, ...editGround] = (editing?.time_venue ?? '').split(' · ');
  const hasAge = (code: string) => Boolean(editing?.age_groups.includes(code));

  // The club form's chips: native inputs, so the form posts with no
  // JavaScript, styled by globals.css .pick.
  const Pick = ({ type, name, value, children, title, on }: { type: 'checkbox' | 'radio'; name: string; value: string; children: React.ReactNode; title?: string; on?: boolean }) => (
    <label className="chip pick" title={title}>
      <input type={type} name={name} value={value} defaultChecked={on ?? (type === 'radio' && value === '')} />
      {children}
    </label>
  );

  // Floodlit (spec I, BUZ 1 Oct): one form panel in the reading width (a form
  // is a door), its sections divided by hairlines, every field the console's
  // labelled 44px well — the same field as the call sheet and the listing. The
  // names, values and chips are unchanged.
  const hint: React.CSSProperties = { fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 };

  return (
    <OpsConsole active="clubs">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title={editing ? 'Change a trial' : 'Post a trial'} sub={c.name} back={{ href: `/ops/clubs/${c.id}`, label: c.name }} />
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div role="alert" className="card card-amber" style={{ fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.5 }}>
              {error === 'ages' ? 'Pick at least one age group, so families can find it.'
                : error === 'source' ? 'Paste the address of the club’s own notice, starting https://'
                : error === 'refused' ? 'This club has claimed its page or been verified since, so that is the club’s to do now.'
                : 'Fill in the title, date, time and ground.'}
            </div>
          )}
          <form action={saveNotice} className="card ops-panel">
            <input type="hidden" name="clubId" value={c.id} />
            {editing && <input type="hidden" name="notice_id" value={editing.id} />}
            <div className="ops-sec">
              <label className="ops-field">
                <span className="panel-h">Where you found it</span>
                <input className="ops-input" style={{ fontWeight: 500 }} name="source_url" aria-label="Where you found it" type="url" required
                  placeholder="https://" defaultValue={editing?.source_url} />
              </label>
            </div>
            <div className="ops-sec">
              <div className="panel-h">Which squad</div>
              <label className="ops-field"><span className="panel-h">Notice title</span><input className="ops-input" name="title" aria-label="Notice title" placeholder="U14 & U15 Boys trials" defaultValue={editing?.title} required /></label>
              <fieldset className="ops-choice">
                <legend className="panel-h">Age groups — pick every one it&rsquo;s for</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {ages.map((a) => <Pick key={a.code} type="checkbox" name="ages" value={a.code} title={a.label} on={hasAge(a.code)}>{a.code}</Pick>)}
                </div>
              </fieldset>
              <fieldset className="ops-choice">
                <legend className="panel-h">Competition</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {[['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women'], ['', 'Open to all']].map(([v, t]) => (
                    <Pick key={v || 'open'} type="radio" name="gender" value={v} on={editing ? (editing.competition_gender ?? '') === v : undefined}>{t}</Pick>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="ops-sec">
              <div className="panel-h">When and where</div>
              <div className="ops-pair">
                <label className="ops-field"><span className="panel-h">Date</span><input className="ops-input" name="trial_on" aria-label="Date" type="date" defaultValue={editing?.trial_on} readOnly={editing?.registered} required /></label>
                <label className="ops-field"><span className="panel-h">Time</span><input className="ops-input" name="time" aria-label="Time" placeholder="9:00 AM" defaultValue={editing ? editTime : undefined} required /></label>
              </div>
              {editing?.registered && <div style={hint}>People have registered for this date, so it stays as it is.</div>}
              <label className="ops-field"><span className="panel-h">Ground</span><input className="ops-input" name="ground" aria-label="Ground" placeholder="Riverside Park, Pitch 2" defaultValue={editing ? editGround.join(' · ') : undefined} required /></label>
            </div>
            <div className="ops-sec">
              <div className="panel-h">Positions you&rsquo;re short of</div>
              <fieldset className="ops-choice">
                <legend style={hint}>Pick any — none for an open trial</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 7 }}>
                  {(Object.keys(POSITIONS) as PositionCode[]).map((code) => (
                    <Pick key={code} type="checkbox" name="positions" value={code} title={POSITIONS[code].label} on={Boolean(editing?.position_needs.includes(code))}>{code}</Pick>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="ops-sec" style={{ paddingBottom: 18 }}>
              <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>It comes down by itself the day after the trial, so nobody turns up to something that already happened.</div>
              </div>
              <button type="submit" className="btn btn-primary fl-glow">{editing ? 'Save changes' : 'Post it'}</button>
              {editing && <a href={`/ops/clubs/${c.id}`} className="btn btn-ghost">Cancel</a>}
            </div>
          </form>
        </div>
      </div>
    </OpsConsole>
  );
}
