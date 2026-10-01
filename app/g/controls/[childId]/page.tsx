// GuardianControls.dc.html — the parent's cockpit. Copy verbatim where the
// data exists; the who-has-it section arrives with the send flows. The
// full link is shown ONCE at issue/replace (?link=) — at rest only a hint
// survives, because tokens live hashed (D-94 §4). Every control writes the
// consent log.
import { notFound, redirect } from 'next/navigation';
import { GuardianFrame } from '@/components/player-shell';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { deleteEverything, renewLink, replaceLink, setPause, setSendSwitch, switchOffOne } from './actions';
import { T } from '@/lib/palette';
import RegisterReaders from '@/components/RegisterReaders';
import SquadCard from '@/components/SquadCard';
import WhoLooked from '@/components/WhoLooked';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Controls', robots: { index: false, follow: false } };


export default async function Controls({ params, searchParams }: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ link?: string; off?: string; taken?: string; squad?: string }>;
}) {
  const { childId } = await params;
  const { link, off, taken, squad } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // A malformed id reaches Postgres as a uuid cast and throws, which is a
  // 500 on a screen a guardian opens from an SMS. Same answer as a row
  // that is not there.
  if (!isUuid(childId)) notFound();

  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band,
       (select id from development_record where person_id = p.id) as record_id,
       (select coalesce((select profile_paused from guardian_setting where child_id = p.id), false)) as paused,
       (select coalesce((select send_disabled from guardian_setting where child_id = p.id), false)) as send_off,
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
           'at', to_char(e.at at time zone 'Australia/Melbourne', 'DD Mon YYYY'), 'event', e.event, 'kind', e.detail->>'kind')
           order by e.at desc, e.id desc), '[]'::json)
       --
       -- 0077: the rows come from fn_consent_timeline — the child's own, plus
       -- an under-16's early funnel lines ("We emailed you", "That email
       -- reached your inbox", "You opened the permission page"), which were
       -- written before the child existed and are attached at approval.
        from fn_consent_timeline($2, p.id) e) as timeline,
       -- L57: the guardian sees EVERY send, with the recipient address in
       -- full. fn_send_log has answered this correctly since 0025 and the
       -- suite has been green on it — and NOTHING IN THE APP EVER CALLED IT.
       -- The promise was implemented in the database and unreachable from
       -- the product, which is the one place a parent would look for it.
       (select coalesce(json_agg(json_build_object(
           'at', to_char(s.at at time zone 'Australia/Melbourne', 'DD Mon YYYY'),
           'club', s.club_name, 'recipient', s.recipient, 'tokenId', s.token_id, 'live', s.live) order by s.at desc), '[]'::json)
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
  //
  // No pronoun is derived for a child anywhere on this screen: the product
  // holds no gender (D-25), so every line uses the name or "their". Eight of
  // these said "his" and "He" for every child — Georgia included.
  const EVENT_LINES: Record<string, string> = {
    invite_created: 'We were asked to set up their profile',
    email_sent: 'We emailed you to ask permission',
    email_delivered: 'That email reached your inbox',
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
    share_request_created: `${name} asked you to send their CV`,
    share_dispatched: `${theirs} CV was sent to a club`,
    card_requested: `${name} asked for a share card`,
    card_approved: 'You approved a share card',
    outside_contact_logged: `Someone outside ${theirs} club asked to reach them`,
    squad_joined: `${name} went into a club squad`,
    squad_left: `${name} came out of a club squad`,
    squad_record_opened: `${theirs} club opened their record`,
    age_transition: `${theirs} age band changed`,
    registration_created: `${name} went onto a club register`,
    registration_withdrawn: `${name} came off a club register`,
    invitation_created: `A club invited ${name}`,
    invitation_replied: 'You replied to a club',
    deletion_requested: 'You asked us to delete everything',
    deletion_completed: 'Everything was deleted',
    report_filed: 'A page was reported',
    send_switch_changed: `You changed whether ${name} can send their own CV`,
  };

  return (
    <GuardianFrame active={`child:${childId}`}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        {off && (
          <div role="status" className="card card-accent" style={{ fontSize: 13, fontWeight: 700, color: T.secondary }}>
            Switched off. That club&rsquo;s link stopped working just now.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="who-tile" style={{ width: 48, height: 48, borderRadius: 15, fontSize: 17 }}>{name[0]}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>{name}</h1>
          </div>
          {c.record_id && <a href={`/build/${c.record_id}/preview`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 999, background: T.surface2, border: `1px solid ${T.line}`, color: T.ink, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em', textDecoration: 'none', flexShrink: 0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>Preview page</a>}
        </div>

        <SquadCard personId={childId} firstName={name} back={`/g/controls/${childId}`} mine={false} said={squad} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 className="sec-h">{theirs} link</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Not a link you can press: ink, mono (spec D). */}
            {link ? (
              <div className="pd-link pd-mono">pitchfootball.com.au/p/{link}</div>
            ) : c.token ? (
              <div className="pd-link pd-mono">pitchfootball.com.au/p/{c.token.token_hint ?? '····'}</div>
            ) : (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.muted }}>No live link right now.</div>
            )}
            {c.token && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Expires {c.token.expires?.trim()} · 90 days from when you made it</div>
              </div>
            )}
            {/* The charter secondary pair, not a hand-built third button. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <form action={renewLink} style={{ display: 'flex' }}><input type="hidden" name="childId" value={childId} /><input type="hidden" name="recordId" value={c.record_id} /><button type="submit" className="btn btn-secondary">Renew</button></form>
              <form action={replaceLink} style={{ display: 'flex' }}><input type="hidden" name="childId" value={childId} /><input type="hidden" name="recordId" value={c.record_id} /><button type="submit" className="btn btn-secondary">Replace</button></form>
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Replacing it kills the old one immediately. Anyone holding it stops being able to open the page.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 className="sec-h">Pause it</h2>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{name}&rsquo;s page is {c.paused ? 'paused' : 'live'}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Switch it off and every link stops working until you switch it back on. Nothing is deleted.</div>
            </div>
            <form action={setPause}><input type="hidden" name="childId" value={childId} /><input type="hidden" name="paused" value={String(!c.paused)} />
              <button type="submit" aria-label="Pause toggle" className="pd-switch">
                <div style={{ width: 46, height: 27, borderRadius: 999, background: c.paused ? T.surface2 : T.accent, display: 'flex', alignItems: 'center', justifyContent: c.paused ? 'flex-start' : 'flex-end', padding: 3, boxSizing: 'border-box' }}>
                  <div style={{ width: 21, height: 21, borderRadius: 999, background: c.paused ? T.muted : T.onAccent }} />
                </div>
              </button>
            </form>
          </div>
        </div>

        {/* L6/L7, and doc 15 §22's "the switch is yours". A 16-17 sends their
            own CV; this is the parent's control over that, and it existed
            only as a database column until now. Under 16 there is nothing to
            switch — the guardian is already the one who sends. */}
        {c.band === '16_17' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 className="sec-h">Sending</h2>
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{c.send_off ? 'Sending is off' : `${name} can send their own CV`}</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
                  {c.send_off
                    ? `${name} sees that sending is off on their account, and nothing about who switched it.`
                    : `You’re told every time they send. Switch it off and they can’t send from their own account until you switch it back on.`}
                </div>
              </div>
              <form action={setSendSwitch}><input type="hidden" name="childId" value={childId} /><input type="hidden" name="sendOff" value={String(!c.send_off)} />
                <button type="submit" aria-label="Sending toggle" className="pd-switch">
                  <div style={{ width: 46, height: 27, borderRadius: 999, background: c.send_off ? T.surface2 : T.accent, display: 'flex', alignItems: 'center', justifyContent: c.send_off ? 'flex-start' : 'flex-end', padding: 3, boxSizing: 'border-box' }}>
                    <div style={{ width: 21, height: 21, borderRadius: 999, background: c.send_off ? T.muted : T.onAccent }} />
                  </div>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Doc 14 L57 in the product, not only in the database: every send,
            recipient address in full. A parent's first question is "who has
            my child's page?", and until now this screen could not answer it
            — the timeline said "You sent his CV to a club" and never which
            club or to what address. */}
        {(c.sends as { at: string; club: string | null; recipient: string }[]).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 className="sec-h">Where {theirs} CV has been sent</h2>
            <div className="card" style={{ padding: '4px 14px' }}>
              {(c.sends as { at: string; club: string | null; recipient: string; tokenId: string | null; live: boolean }[]).map((sd, i) => (
                <div key={`${sd.at}-${sd.recipient}-${i}`} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.surface2}`, alignItems: 'center' }}>
                  <div style={{ width: 78, fontSize: 11.5, fontWeight: 700, color: T.muted, flexShrink: 0 }}>{sd.at}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {sd.club && <div style={{ fontSize: 13.5, fontWeight: 800 }}>{sd.club}</div>}
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, wordBreak: 'break-all' }}>{sd.recipient}</div>
                  </div>
                  {/* Take one off: that club's link stops opening the page;
                      every other club's keeps working. */}
                  {sd.live && sd.tokenId ? (
                    <form action={switchOffOne} style={{ flexShrink: 0 }}>
                      <input type="hidden" name="childId" value={childId} /><input type="hidden" name="tokenId" value={sd.tokenId} />
                      <button type="submit" className="console-btn">Switch off</button>
                    </form>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, flexShrink: 0 }}>Off</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
              The full address, every time, for as long as the record exists. Switch one off and that club&rsquo;s link stops working straight away; the others keep working. Replacing {theirs} link stops all of them.
            </div>
          </div>
        )}

        {/* doc 34 rule 6 (0047): who at each club has read the registration. */}
        <RegisterReaders viewerId={me as string} personId={childId} name={name} back={`/g/controls/${childId}`} taken={Boolean(taken)} />

        {/* doc 31 U-6 (4): who at Pitch has looked — fn_who_looked's answer, rendered by the component. */}
        <WhoLooked viewerId={me as string} personId={childId} name={name} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 className="sec-h">Everything that&rsquo;s happened</h2>
          <div className="card" style={{ padding: '6px 14px' }}>
            {(c.timeline as { at: string; event: string }[]).length === 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.muted, padding: '4px 0' }}>
                Nothing yet beyond your approval. Anything you do here — renewing their link, pausing their page, replying to a club — is written down and shows up in this list.
              </div>
            )}
            {(c.timeline as { at: string; event: string; kind: string | null }[]).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.surface2}` }}>
                <div style={{ width: 78, fontSize: 11.5, fontWeight: 700, color: T.muted, flexShrink: 0 }}>{e.at}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary }}>{e.event === 'share_revoked' && e.kind === 'one' ? 'One club\u2019s link was switched off' : e.event === 'share_revoked' && e.kind === 'pitch' ? 'Pitch switched off every link, to keep families safe. A new link you send works as normal.' : EVENT_LINES[e.event] ?? 'Something was recorded'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-red" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: T.red }}>Delete everything</div>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{theirs} page, photo, clips and stats. Gone, and not recoverable. No reason needed and nobody will ask you for one.</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>We keep one thing: a record that you gave permission and then withdrew it. No football, no photo, no page — just the fact it happened, because we have to be able to show it did.</div>
          <form action={deleteEverything}><input type="hidden" name="childId" value={childId} />
            {/* One tap, as D-26 requires: the secondary in the red state. */}
            <button type="submit" className="btn btn-secondary is-danger">Delete {name}&rsquo;s profile</button>
          </form>
        </div>
      </div>
    </GuardianFrame>
  );
}
