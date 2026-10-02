// PostATrial.dc.html — copy verbatim. Naming positions is what gets the
// right players in front of you; leaving them blank is an open trial.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { postTrial } from './actions';
import TrialRow from '@/components/floodlit/TrialRow';
import { isUuid } from '@/lib/ids';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Post a trial', robots: { index: false, follow: false } };


export default async function PostATrial({ searchParams }: { searchParams: Promise<{ posted?: string; updated?: string; error?: string; edit?: string; trial?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { posted, updated, error, edit, trial } = await searchParams;
  const { rows } = await db.query(
    `select c.id, c.name, c.contact_email, c.club_state, c.public_slug from club c join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     where c.club_state = 'verified' limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];

  // A trial names every age group it is for (D-68 as amended 16 Sep). The
  // club's own squads' groups come first; the rest of the lookup sits behind
  // one tap, so a club with no squads entered yet can still post.
  const ages = (await db.query(
    `select a.code, a.label,
       exists(select 1 from squad s join membership m on m.club_id = s.club_id
               where s.age_group = a.code and m.person_id = $1
                 and m.role in ('technical_director','club_admin') and m.ended_at is null) as ours
     from age_group a order by a.sort`,
    [me],
  )).rows as { code: string; label: string; ours: boolean }[];
  const ours = ages.filter((a) => a.ours);

  // The club's own upcoming trials — the ones it can change here.
  type Mine = { id: string; title: string; trial_on: string; date: string; day: string; mon: string; time_venue: string; position_needs: string[];
                competition_gender: string | null; how_to_register: string | null; cv_email: string | null;
                age_groups: string[]; registered: boolean };
  const mine = (await db.query(
    `select t.id, t.title, to_char(t.trial_on, 'YYYY-MM-DD') as trial_on, to_char(t.trial_on, 'Dy FMDD Mon') as date,
       to_char(t.trial_on, 'FMDD') as day, upper(to_char(t.trial_on, 'Mon')) as mon,
       t.time_venue, t.position_needs, t.competition_gender, t.how_to_register, t.cv_email,
       array(select ta.age_group from trial_notice_age_group ta join age_group ag on ag.code = ta.age_group
             where ta.trial_notice_id = t.id order by ag.sort) as age_groups,
       exists(select 1 from registration r where r.trial_notice_id = t.id and r.withdrawn_at is null) as registered
     from trial_notice t
     where t.club_id = $1 and t.source = 'club'
       and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
     order by t.trial_on`,
    [c.id],
  )).rows as Mine[];
  const editing = edit ? mine.find((m) => m.id === edit) ?? null : null;
  const [editTime, ...editGround] = (editing?.time_venue ?? '').split(' · ');
  const hasAge = (code: string) => Boolean(editing?.age_groups.includes(code));
  const rest = ours.length ? ages.filter((a) => !a.ours) : ages;

  // Checkbox and radio chips: native inputs, so the form posts with no
  // JavaScript, styled by globals.css .pick.
  const Pick = ({ type, name, value, children, title, on }: { type: 'checkbox' | 'radio'; name: string; value: string; children: React.ReactNode; title?: string; on?: boolean }) => (
    <label className="chip pick" title={title}>
      <input type={type} name={name} value={value} defaultChecked={on ?? (type === 'radio' && value === '')} />
      {children}
    </label>
  );

  if (posted || updated) {
    // P3 (BUZ, 1 Oct): "Posted" shows the notice as the board will show it —
    // the board's own row, read the board's way (fn_trial_notices_advertised),
    // and only this club's own notice. Its button is inert and secondary.
    const shown = posted && trial && isUuid(trial) ? (await db.query(
      `select t.id, t.title, t.time_venue, upper(to_char(t.trial_on, 'Mon')) as mon, to_char(t.trial_on, 'FMDD') as day,
         upper(to_char(t.trial_on, 'Dy')) as wd,
         to_char(t.added_on, 'FMDD Mon') as listed, to_char(t.last_checked, 'FMDD Mon') as checked
       from fn_trial_notices_advertised() t where t.id = $1 and t.club_id = $2 and t.source = 'club'`,
      [trial, c.id],
    )).rows[0] as { id: string; title: string; time_venue: string; mon: string; day: string; wd: string; listed: string; checked: string } | undefined : undefined;
    return (
      <ClubConsole active="post-trial">
        <div className="console cc-page">
          <HeaderMark back={{ href: '/home' }} />
          <div className="door">
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 'var(--ls-title)', lineHeight: 1.2 }}>{updated ? 'Saved. The change shows everywhere the trial does.' : 'Posted. It’s on your club page and the trials board now.'}</h1>
            {shown && (
              <div className="pt-posted">
                <TrialRow wd={shown.wd} day={shown.day} mon={shown.mon} club={c.name}
                  lines={[{ id: shown.id, title: shown.title.replace(' trials', ''), timeVenue: shown.time_venue,
                    listed: shown.listed, checked: shown.checked, notice: null }]}
                  clubState={c.club_state} slug={c.public_slug} inert />
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>It comes down by itself the day after the trial, so nobody turns up to something that already happened.</div>
          </div>
        </div>
      </ClubConsole>
    );
  }

  return (
    <ClubConsole active="post-trial">
      <div className="console cc-page pt-page">
        <HeaderMark back={{ href: '/home' }} />
        {/* A form is a door (A part 20). From 1024 "Your trials" sits beside
            it as a sticky column — the same DOM order, after the form — so a
            TD sees what is already up while writing the next (F, .cc-split). */}
        <div className="cc-split">
          <div className="door">
            <div className="pg-titles">
              <h1 className="pg-title">{editing ? 'Change a trial' : 'Post a trial'}</h1>
              <div className="pg-sub" style={{ fontSize: 13.5 }}>Goes on your club page and on the trials board the same minute. {c.name}.</div>
            </div>
            <form action={postTrial} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {editing && <input type="hidden" name="trial_id" value={editing.id} />}
              {error && (
                <div role="alert" className="cc-said cc-said-warn">
                  {error === 'ages' ? 'Pick at least one age group, so families can find it.' : 'Fill in the title, date, time and ground.'}
                </div>
              )}
              {/* The notice's title stands on its own; "Which squad" heads the
                  squad pickers it names (audit ruling 20), not the title. */}
              <label className="field"><div className="field-label">Notice title</div><input name="title" aria-label="Notice title" placeholder="U14 & U15 Boys trials" defaultValue={editing?.title} required /></label>
              <div className="pt-sec">
                <div className="panel-h">Which squad</div>
                <fieldset className="field pt-fieldset">
                  <legend className="field-label">Age groups — pick every one it&rsquo;s for</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, clear: 'both' }}>
                    {(ours.length ? ours : rest).map((a) => <Pick key={a.code} type="checkbox" name="ages" value={a.code} title={a.label} on={hasAge(a.code)}>{a.code}</Pick>)}
                  </div>
                  {ours.length > 0 && rest.length > 0 && (
                    <details className="pt-more" open={Boolean(editing && rest.some((a) => hasAge(a.code)))}>
                      <summary>More age groups</summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {rest.map((a) => <Pick key={a.code} type="checkbox" name="ages" value={a.code} title={a.label} on={hasAge(a.code)}>{a.code}</Pick>)}
                      </div>
                    </details>
                  )}
                </fieldset>
                <fieldset className="field pt-fieldset">
                  <legend className="field-label">Competition</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, clear: 'both' }}>
                    {[['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women'], ['', 'Open to all']].map(([v, t]) => (
                      <Pick key={v || 'open'} type="radio" name="gender" value={v} on={editing ? (editing.competition_gender ?? '') === v : undefined}>{t}</Pick>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="pt-sec">
                <div className="panel-h">When and where</div>
                <div className="pt-pair">
                  <label className="field"><div className="field-label">Date</div><input name="trial_on" aria-label="Date" type="date" defaultValue={editing?.trial_on} readOnly={editing?.registered} required /></label>
                  <label className="field"><div className="field-label">Time</div><input name="time" aria-label="Time" placeholder="9:00 AM" defaultValue={editing ? editTime : undefined} required /></label>
                </div>
                {editing?.registered && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.5 }}>People have registered for this date, so it stays as it is.</div>}
                <label className="field"><div className="field-label">Ground</div><input name="ground" aria-label="Ground" placeholder="Riverside Park, Pitch 2" defaultValue={editing ? editGround.join(' · ') : undefined} required /></label>
              </div>
              <div className="pt-sec">
                <div className="panel-h">Positions you&rsquo;re short of</div>
                <fieldset className="field pt-fieldset">
                  <legend className="field-label" style={{ marginBottom: 9 }}>Pick any — none for an open trial</legend>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 7, clear: 'both' }}>
                    {(Object.keys(POSITIONS) as PositionCode[]).map((code) => (
                      <Pick key={code} type="checkbox" name="positions" value={code} title={POSITIONS[code].label} on={Boolean(editing?.position_needs.includes(code))}>{code}</Pick>
                    ))}
                  </div>
                </fieldset>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.5 }}>Leave it blank for an open trial. Naming positions is what gets the right players in front of you — a keeper scanning the board sees your notice first.</div>
              </div>
              <div className="pt-sec">
                <div className="panel-h">How to register</div>
                <label className="field"><textarea name="how" aria-label="How to register" rows={2} defaultValue={editing?.how_to_register ?? undefined} placeholder="Turn up 15 minutes early. Boots, shin pads, water. Registration at the clubhouse." style={{ fontSize: 13.5 }} /></label>
                <label className="field"><div className="field-label">Where CVs should go</div><input style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, fontWeight: 500 }} name="cv_email" aria-label="Where CVs should go" type="email" defaultValue={editing ? editing.cv_email ?? '' : c.contact_email ?? ''} placeholder="football@yourclub.com.au" /></label>
              </div>
              <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>It comes down by itself the day after the trial, so nobody turns up to something that already happened. Players who want to be seen beforehand send their CV to the address above — it arrives as an ordinary email with a link.</div>
              </div>
              {/* The door's one primary, so the one glow. */}
              <button type="submit" className="btn btn-primary fl-glow">{editing ? 'Save changes' : 'Post it'}</button>
              {editing && <a href="/club/post-trial" className="btn btn-ghost">Cancel</a>}
            </form>
          </div>

          {mine.length > 0 && (
            <aside>
              <div className="panel-h">Your trials</div>
              <div className="card rows pt-trials">
                {mine.map((m) => (
                  <div key={m.id} className="pt-trial">
                    <div className="fl-trial-date">
                      <div className="numeral fl-trial-day">{m.day}</div>
                      <div className="fl-trial-mon">{m.mon}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{m.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{m.date} · {m.age_groups.join(' · ') || 'No age group yet'}</div>
                    </div>
                    {editing?.id === m.id
                      ? <div className="pt-editing">Editing</div>
                      : <a href={`/club/post-trial?edit=${m.id}`} className="console-btn" style={{ flexShrink: 0 }}>Change</a>}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </ClubConsole>
  );
}
