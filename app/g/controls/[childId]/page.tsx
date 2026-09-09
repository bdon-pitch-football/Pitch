// GuardianControls.dc.html — the parent's cockpit. Copy verbatim where the
// data exists; the who-has-it section arrives with the send flows. The
// full link is shown ONCE at issue/replace (?link=) — at rest only a hint
// survives, because tokens live hashed (D-94 §4). Every control writes the
// consent log.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { deleteEverything, renewLink, replaceLink, setPause } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const ghost: React.CSSProperties = { flex: 1, height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

export default async function Controls({ params, searchParams }: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ link?: string }>;
}) {
  const { childId } = await params;
  const { link } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band,
       (select id from development_record where person_id = p.id) as record_id,
       (select coalesce((select profile_paused from guardian_setting where child_id = p.id), false)) as paused,
       (select row_to_json(t) from (
          select token_hint, to_char(expires_at at time zone 'Australia/Melbourne', 'DD Month') as expires
          from share_token st join development_record dr on dr.id = st.record_id
          where dr.person_id = p.id and st.revoked_at is null and st.paused = false
            and (st.expires_at is null or st.expires_at > now())
          order by st.issued_at desc limit 1) t) as token,
       -- No LIMIT. It was capped at eight under a heading that says everything
       -- that has happened, so a parent could not reach the approval they
       -- gave once eight things had happened since. The screen's only job is
       -- to be complete, and a consent history is tens of rows over years,
       -- not thousands.
       --
       -- The tiebreak is load-bearing too: ordering by timestamp alone left
       -- events sharing a second in arbitrary order, and approving a profile
       -- writes several in one transaction — so a parent could read "terms
       -- accepted" above "you opened the permission page". Ordering by id
       -- after the timestamp restores insertion order within a second.
       (select coalesce(json_agg(json_build_object(
           'at', to_char(e.at at time zone 'Australia/Melbourne', 'DD Mon YYYY'), 'event', e.event)
           order by e.at desc, e.id desc), '[]'::json)
        from (select at, id, event from consent_event where subject_id = p.id) e) as timeline,
       -- L57: the guardian sees EVERY send, with the recipient address in
       -- full. fn_send_log has answered this correctly since 0025 and the
       -- suite has been green on it — and NOTHING IN THE APP EVER CALLED IT.
       -- The promise was implemented in the database and unreachable from
       -- the product, which is the one place a parent would look for it.
       (select coalesce(json_agg(json_build_object(
           'at', to_char(s.at at time zone 'Australia/Melbourne', 'DD Mon YYYY'),
           'club', s.club_name, 'recipient', s.recipient) order by s.at desc), '[]'::json)
        from fn_send_log($2, p.id) s) as sends
     from person p
     join guardianship_link g on g.child_id = p.id and g.guardian_id = $2 and g.approved_at is not null and g.revoked_at is null
     where p.id = $1`,
    [childId, me],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name: string = c.first_name;
  const theirs = `${name}\u2019s`;
  // EVERY event in the consent_event vocabulary needs a line here. A missing
  // one falls through to the raw database code, and a parent reading
  // "guardian_landed" on the screen whose entire job is to tell them plainly
  // what happened is worse than showing nothing. Found walking Deniz's
  // history: four of them were rendering as enum values.
  const EVENT_LINES: Record<string, string> = {
    invite_created: 'We were asked to set up his profile',
    email_sent: 'We emailed you to ask permission',
    email_delivered: 'That email reached your inbox',
    email_opened: 'You opened that email',
    sms_sent: 'We texted you as well',
    sms_delivered: 'That text reached your phone',
    guardian_landed: 'You opened the permission page',
    email_verified: 'You confirmed by email',
    sms_verified: 'You confirmed by text',
    approved: 'You approved the profile',
    nudge_sent: 'We reminded you it was waiting',
    purged: 'The unapproved request was deleted',
    tos_accepted: 'Terms accepted on their behalf',
    policy_accepted: 'Privacy Policy accepted on their behalf',
    edit_submitted: `${name} submitted a change`,
    edit_approved: 'You approved a change',
    share_issued: 'Link created',
    share_revoked: 'Link replaced — the old one stopped working',
    share_paused: 'You changed the pause switch',
    share_request_created: `${name} asked you to send his CV`,
    share_dispatched: 'You sent his CV to a club',
    card_requested: `${name} asked for a share card`,
    card_approved: 'You approved a share card',
    outside_contact_logged: 'Someone outside his club asked to reach him',
    age_transition: 'His age band changed',
    registration_created: 'He went onto a club register',
    registration_withdrawn: 'He came off a club register',
    invitation_created: 'A club invited him',
    invitation_replied: 'You replied to a club',
    deletion_requested: 'You asked us to delete everything',
    deletion_completed: 'Everything was deleted',
    report_filed: 'A page was reported',
  };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: T.secondary }}>{name[0]}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>{name}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>{theirs} link</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {link ? (
              <div style={{ fontSize: 14, fontWeight: 800, color: T.accent, wordBreak: 'break-all' }}>pitchfootball.com.au/p/{link}</div>
            ) : c.token ? (
              <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/p/{c.token.token_hint ?? '····'}</div>
            ) : (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.muted }}>No live link right now.</div>
            )}
            {c.token && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Expires {c.token.expires?.trim()} · 90 days from when you made it</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <form action={renewLink.bind(null, childId, c.record_id)} style={{ flex: 1, display: 'flex' }}><button type="submit" style={ghost}>Renew</button></form>
              <form action={replaceLink.bind(null, childId, c.record_id)} style={{ flex: 1, display: 'flex' }}><button type="submit" style={ghost}>Replace</button></form>
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Replacing it kills the old one immediately. Anyone holding it stops being able to open the page.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Pause it</div>
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{name}&rsquo;s page is {c.paused ? 'paused' : 'live'}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Switch it off and every link stops working until you switch it back on. Nothing is deleted.</div>
            </div>
            <form action={setPause.bind(null, childId, !c.paused)}>
              <button type="submit" aria-label="Pause toggle" style={{ width: 46, height: 27, borderRadius: 999, border: 'none', cursor: 'pointer', background: c.paused ? T.surface2 : T.accent, display: 'flex', alignItems: 'center', justifyContent: c.paused ? 'flex-start' : 'flex-end', padding: 3 }}>
                <div style={{ width: 21, height: 21, borderRadius: 999, background: c.paused ? T.muted : T.onAccent }} />
              </button>
            </form>
          </div>
        </div>

        {/* Doc 14 L57 in the product, not only in the database: every send,
            recipient address in full. A parent's first question is "who has
            my child's page?", and until now this screen could not answer it
            — the timeline said "You sent his CV to a club" and never which
            club or to what address. */}
        {(c.sends as { at: string; club: string | null; recipient: string }[]).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Where {theirs} CV has been sent</div>
            <div style={{ ...card, padding: '4px 14px' }}>
              {(c.sends as { at: string; club: string | null; recipient: string }[]).map((sd, i) => (
                <div key={`${sd.at}-${sd.recipient}`} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.surface2}`, alignItems: 'baseline' }}>
                  <div style={{ width: 78, fontSize: 11.5, fontWeight: 700, color: T.muted, flexShrink: 0 }}>{sd.at}</div>
                  <div style={{ minWidth: 0 }}>
                    {sd.club && <div style={{ fontSize: 13.5, fontWeight: 800 }}>{sd.club}</div>}
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, wordBreak: 'break-all' }}>{sd.recipient}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
              The full address, every time, for as long as the record exists. Replacing {theirs} link stops all of them opening the page.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Everything that&rsquo;s happened</div>
          <div style={{ ...card, padding: '6px 14px' }}>
            {(c.timeline as { at: string; event: string }[]).length === 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.muted, padding: '4px 0' }}>
                Nothing yet beyond your approval. Anything you do here — renewing his link, pausing his page, replying to a club — is written down and shows up in this list.
              </div>
            )}
            {(c.timeline as { at: string; event: string }[]).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.surface2}` }}>
                <div style={{ width: 78, fontSize: 11.5, fontWeight: 700, color: T.muted, flexShrink: 0 }}>{e.at}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary }}>{EVENT_LINES[e.event] ?? 'Something was recorded'}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.red}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: T.red }}>Delete everything</div>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{theirs} page, photo, clips and stats. Gone, and not recoverable. No reason needed and nobody will ask you for one.</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>We keep one thing: a record that you gave permission and then withdrew it. No football, no photo, no page — just the fact it happened, because we have to be able to show it did.</div>
          <form action={deleteEverything.bind(null, childId)}>
            <button type="submit" style={{ width: '100%', height: 46, borderRadius: 13, border: `1px solid ${T.red}`, background: 'transparent', color: T.red, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Delete {name}&rsquo;s profile</button>
          </form>
        </div>
      </div>
    </div>
  );
}
