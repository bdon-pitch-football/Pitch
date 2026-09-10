// The signed-in landing — elevated pass (v3 discipline). Guardian seat:
// GuardianHome.dc.html with real status rows (approved date, live-link
// expiry, register count) and the priority ladder of waiting cards.
// Player seat: their page as it stands today, then the build actions.
// Signed-out: one quiet prompt. Copy stays verbatim to the signed screens.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
    <style>{`
      @keyframes homeRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .h-rise > * { animation: homeRise .55s cubic-bezier(.22,1,.36,1) both; }
      .h-rise > *:nth-child(2) { animation-delay: .06s } .h-rise > *:nth-child(3) { animation-delay: .12s }
      .h-rise > *:nth-child(4) { animation-delay: .18s } .h-rise > *:nth-child(5) { animation-delay: .24s }
      @media (prefers-reduced-motion: reduce) { .h-rise > * { animation: none } }
    `}</style>
    <div className="h-rise" style={{ width: '100%', maxWidth: 560, minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark />
      {children}
    </div>
  </div>
);

const StatusRow = ({ color, path, children }: { color: string; path: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>{children}</div>
  </div>
);

export default async function Home() {
  const personId = await getSessionPersonId();
  if (!personId) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>One account, whichever seat you hold.</div>
        </div>
        <Link href="/signin" className="btn btn-primary">Sign in</Link>
      </Shell>
    );
  }

  const { rows } = await db.query(
    `select p.first_name, p.photo_path,
       (select id from development_record where person_id = p.id) as record_id,
       (select row_to_json(rec) from (
          select dr.positions, dr.squad_number,
            (select count(*)::int from highlight h where h.record_id = dr.id) as clips
          from development_record dr where dr.person_id = p.id) rec) as my_page,
       (select row_to_json(cl) from (
          select c2.id, c2.name, c2.club_state, c2.public_slug, m.role,
            (select count(*)::int from registration r6 where r6.club_id = c2.id and r6.withdrawn_at is null) as register_count
          from membership m join club c2 on c2.id = m.club_id
          where m.person_id = p.id and m.role in ('technical_director','club_admin') and m.ended_at is null
          limit 1) cl) as club_seat,
       (select row_to_json(co) from (
          select cp.public_slug,
            (select c3.name from membership m2 join club c3 on c3.id = m2.club_id
             where m2.person_id = p.id and m2.role = 'coach' and m2.ended_at is null limit 1) as club
          from coach_profile cp where cp.person_id = p.id) co) as coach_seat,
       (select coalesce(json_agg(json_build_object(
           'id', c.id, 'firstName', c.first_name, 'photo', c.photo_path,
           'recordId', (select id from development_record where person_id = c.id),
           'approvedOn', to_char(g.approved_at at time zone 'Australia/Melbourne', 'DD Month'),
           'linkExpiry', (select to_char(st.expires_at at time zone 'Australia/Melbourne', 'DD Month')
              from share_token st join development_record dr5 on dr5.id = st.record_id
              where dr5.person_id = c.id and st.revoked_at is null and st.paused = false
                and (st.expires_at is null or st.expires_at > now())
              order by st.issued_at desc limit 1),
           -- Days rather than a date, because "expiring in 11 days" is the
           -- figure a parent acts on and "08 December" is the one they have
           -- to work out.
           'expiresInDays', (select (st.expires_at::date - (now() at time zone 'Australia/Melbourne')::date)
              from share_token st join development_record dr7 on dr7.id = st.record_id
              where dr7.person_id = c.id and st.revoked_at is null and st.paused = false
                and st.expires_at is not null and st.expires_at > now()
              order by st.issued_at desc limit 1),
           'pendingAt', (select max(pv.created_at) from profile_version pv
              join development_record dr6 on dr6.id = pv.record_id
              where dr6.person_id = c.id and pv.status = 'pending'),
           'registers', (select count(*)::int from registration r5 where r5.player_id = c.id and r5.withdrawn_at is null),
           'hasPending', exists(select 1 from profile_version pv
              join development_record dr2 on dr2.id = pv.record_id
              where dr2.person_id = c.id and pv.status = 'pending'),
           'invitation', (select row_to_json(q3) from (
              select i.id, i.created_at as at, cl2.name as club from invitation i
              join registration r2 on r2.id = i.registration_id
              join club cl2 on cl2.id = i.club_id
              where r2.player_id = c.id
                and not exists (select 1 from invitation_reply ir where ir.invitation_id = i.id)
              order by i.created_at desc limit 1) q3),
           'sendRequest', (select row_to_json(q) from (
              select sr.id, sr.created_at as at, sr.destination from share_request sr
              join development_record dr3 on dr3.id = sr.record_id
              where dr3.person_id = c.id and sr.dispatched_at is null
              order by sr.created_at desc limit 1) q),
           'interestRequest', (select row_to_json(q2) from (
              select rr.id, rr.created_at as at, cl.name as club from registration_request rr
              join development_record dr4 on dr4.id = rr.record_id
              join club cl on cl.id = rr.club_id
              where dr4.person_id = c.id and rr.dispatched_at is null
              order by rr.created_at desc limit 1) q2)
         )), '[]'::json)
        from guardianship_link g join person c on c.id = g.child_id
        where g.guardian_id = p.id and g.approved_at is not null and g.revoked_at is null) as children
     from person p where p.id = $1`,
    [personId],
  );
  const me = rows[0];
  if (!me) return <Shell><div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Signed out.</div></Shell>;
  const children: {
    id: string; firstName: string; photo: string | null; recordId: string | null; approvedOn: string;
    linkExpiry: string | null; expiresInDays: number | null; registers: number;
    hasPending: boolean; pendingAt: string | null;
    invitation: { id: string; at: string; club: string } | null;
    sendRequest: { id: string; at: string; destination: string } | null;
    interestRequest: { id: string; at: string; club: string } | null;
  }[] = me.children;

  const clubSeat = me.club_seat as { id: string; name: string; club_state: string; public_slug: string | null; role: string; register_count: number } | null;
  const coachSeat = me.coach_seat as { public_slug: string | null; club: string | null } | null;

  // Club seat: TD or administrator. The register is the working surface.
  if (clubSeat) {
    const verified = clubSeat.club_state === 'verified';
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{clubSeat.name}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>
            {me.first_name} · {clubSeat.role === 'technical_director' ? 'Technical Director' : 'Club administrator'}
          </div>
        </div>
        <div className="sheen" style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>{clubSeat.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>{clubSeat.register_count} on your register</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: verified ? T.accent : T.amber }} />
              <div style={{ fontSize: 11.5, fontWeight: 800, color: verified ? T.accent : T.amber }}>
                {verified ? 'Verified club' : 'Awaiting verification — registrations are held'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href="/club/register" className="btn btn-primary">Interest register</Link>
          <Link href="/club/squads" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Squads &amp; age groups</Link>
          <Link href="/club/page-edit" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Crest &amp; club page</Link>
          <Link href="/club/roles" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Coaching roles</Link>
          {verified && (
            <Link href="/club/post-trial" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Post a trial</Link>
          )}
          {clubSeat.public_slug && (
            <Link href={`/fc/${clubSeat.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Your club page</Link>
          )}
          <Link href="/club/billing" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Plan &amp; billing</Link>
        </div>
      </Shell>
    );
  }

  // Coach seat.
  if (coachSeat) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your coach CV</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>{me.first_name}{coachSeat.club ? ` · ${coachSeat.club}` : ''}</div>
        </div>
        {coachSeat.public_slug && (
          <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your public link</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/{coachSeat.public_slug}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href="/coach/edit" className="btn btn-primary">Edit my coach CV</Link>
          {coachSeat.public_slug && (
            <Link href={`/c/${coachSeat.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>See my public page</Link>
          )}
          <Link href="/jobs" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Coaching roles at clubs</Link>
        </div>
      </Shell>
    );
  }

  // Player seat: their page today, then the build surface.
  if (children.length === 0 && me.record_id) {
    const pg = me.my_page as { positions: string[]; squad_number: number | null; clips: number } | null;
    return (
      <Shell>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your CV</div>
        <div className="sheen" style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {me.photo_path ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={me.photo_path} alt="" width={58} height={58} className="avatar-ring" style={{ borderRadius: 18, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 58, height: 58, borderRadius: 18, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>{me.first_name[0]}</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>{me.first_name}{pg?.squad_number ? ` · #${pg.squad_number}` : ''}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>
              {(pg?.positions ?? []).map((c) => POSITIONS[c as PositionCode]?.label ?? c).join(' · ') || 'No positions picked yet'}
              {typeof pg?.clips === 'number' ? ` · ${pg.clips} clip${pg.clips === 1 ? '' : 's'}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href={`/build/${me.record_id}`} className="btn btn-primary">Build your CV</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/build/${me.record_id}/clips`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Highlights</Link>
            <Link href={`/build/${me.record_id}/more`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Achievements</Link>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Link href="/trials" className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Trials near you</Link>
          </div>
          <Link href={`/send/${me.record_id}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Send my CV to a club</Link>
        </div>
      </Shell>
    );
  }

  // THE FIRST SCREEN A REAL USER SEES, and it used to be a title, one
  // sentence and NOTHING ELSE — no link, no next step, a complete dead end
  // at the exact moment somebody has just decided to trust us. Every fixture
  // person already had something, so nobody had ever rendered it.
  //
  // These are the doors that actually work for an account with nothing on
  // it. Nothing here is aspirational: each one is a page that exists.
  if (children.length === 0) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome, {me.first_name}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Your account is set up. Here is what you can do with it.</div>
        </div>

        <Link href="/coach/edit" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Build a coach CV</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Your roles, your licences, one link to send</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Start</div>
        </Link>

        <Link href="/trials" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Trials near you</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Every notice we hold, by date</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
        </Link>

        <Link href="/jobs" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Coaching roles at clubs</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Nothing here is ranked or recommended</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
        </Link>

        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
          Adding a child, claiming a club page and building a player CV are not on this screen yet — tell us which you came for and we will point you at it.
        </div>
        <Link href="/signout" className="btn btn-ghost">Sign out</Link>
      </Shell>
    );
  }

  // How long something has been sitting there. A parent scanning this page is
  // asking "what have I left?" and a date makes them work it out.
  const waitedFor = (iso: string): string => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  // Every waiting item in ONE list, OLDEST FIRST — the thing that has been
  // waiting longest is the thing to do next, and that is the only ordering
  // here anybody can defend. Before this the cards came out grouped by type
  // and three of the four carried a full-width accent button, so nothing led
  // and the quiet one was quiet for no reason.
  type Waiting = { key: string; kind: 'invite' | 'send' | 'interest' | 'edit';
                   at: string; href: string; tone: string; title: string; body?: string; cta: string };
  const waiting: Waiting[] = [
    ...children.filter((c) => c.invitation).map((c) => ({
      key: c.invitation!.id, kind: 'invite' as const, at: c.invitation!.at,
      href: `/g/invite/${c.invitation!.id}`, tone: T.purple,
      title: `${c.invitation!.club} would like ${c.firstName} at a trial`,
      body: `${c.firstName} has not been told. Nothing happens until you decide.`,
      cta: 'Review it',
    })),
    ...children.filter((c) => c.sendRequest).map((c) => ({
      key: c.sendRequest!.id, kind: 'send' as const, at: c.sendRequest!.at,
      href: `/g/send/${c.sendRequest!.id}`, tone: T.accent,
      title: `${c.firstName} wants to send a CV to ${/^(.*) </.exec(c.sendRequest!.destination ?? '')?.[1] ?? 'a club'}`,
      body: 'Nothing has been sent. Check the address and it goes; do nothing and the request disappears on its own.',
      cta: 'Review it',
    })),
    ...children.filter((c) => c.interestRequest).map((c) => ({
      key: c.interestRequest!.id, kind: 'interest' as const, at: c.interestRequest!.at,
      href: `/g/interest/${c.interestRequest!.id}`, tone: T.purple,
      title: `${c.firstName} wants to go on ${c.interestRequest!.club}\u2019s register`,
      body: `There\u2019s a line about ${c.firstName}, in ${c.firstName}\u2019s own words. Read it before it goes — you can change it.`,
      cta: 'Read it',
    })),
    ...children.filter((c) => c.hasPending && c.pendingAt).map((c) => ({
      key: `edit-${c.id}`, kind: 'edit' as const, at: c.pendingAt!,
      href: `/g/pending/${c.recordId}`, tone: T.accent,
      title: `${c.firstName} changed the page`,
      body: 'Until you approve it, every club holding the link still reads the old version.',
      cta: 'Review it',
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // The three figures a parent actually wants, and we hold all of them. This
  // page had no hero and no numbers at all — the club page gets a crest and
  // numerals, and the person we most need to reassure got a title.
  const linksActive = children.filter((c) => c.linkExpiry).length;
  const expiringSoon = children.filter((c) => c.expiresInDays !== null && c.expiresInDays <= 30).length;
  const clubsHolding = children.reduce((n, c) => n + c.registers, 0);

  // Guardian seat.
  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</div>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything about your children on Pitch, and every control over it, is here.</div>
      </div>

      {/* The state of things, in three numbers. Nothing here is new data —
          it is what the child cards below already say, added up, which is
          the form a parent can take in at a glance. */}
      <div style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '20px 20px 18px 20px', display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap' }}>
        <div>
          <div className="numeral numeral-m" style={{ color: '#eef5f0' }}>{linksActive}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>{linksActive === 1 ? 'Link active' : 'Links active'}</div>
        </div>
        <div>
          <div className="numeral numeral-m" style={{ color: expiringSoon > 0 ? T.amber : 'rgba(255,255,255,.45)' }}>{expiringSoon}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Expiring in 30 days</div>
        </div>
        <div>
          <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{clubsHolding}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>{clubsHolding === 1 ? 'Club register' : 'Club registers'}</div>
        </div>
      </div>

      {/* Oldest first, and only the top one carries the accent button. Three
          primary buttons in a row is the same as none. */}
      {waiting.map((w, i) => (
        <div key={w.key} className={i === 0 ? 'sheen' : 'lift'} style={{
          borderRadius: 18, padding: 17, display: 'flex', flexDirection: 'column', gap: 12,
          background: i === 0 ? 'linear-gradient(160deg, #123326, #0c1d14)' : T.surface,
          border: `1px solid ${i === 0 ? w.tone : T.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: w.tone }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: w.tone }}>Waiting on you</div>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: T.muted }}>{waitedFor(w.at)}</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>{w.title}</div>
          {w.body && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{w.body}</div>}
          <Link href={w.href} className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}>{w.cta}</Link>
        </div>
      ))}

      {/* The public trials board shipped in launch scope (D-74, D-90) and
          NOTHING IN THE PRODUCT LINKED TO IT — it existed and no user could
          find it. This is a parent's entry point; the player seat has the
          same link below its build cards. */}
      <Link href="/trials" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Trials near you</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Every notice we hold, newest first</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={label}>Your children</div>
        {children.map((c) => (
          <div key={c.id} className="lift" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {c.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.photo} alt="" width={52} height={52} className="avatar-ring" style={{ borderRadius: 16, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{c.firstName[0]}</div>
              )}
              <div style={{ fontSize: 16, fontWeight: 800 }}>{c.firstName}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatusRow color={T.accent} path="M5 12.5 l4.5 4.5 L19 7">Approved by you on {c.approvedOn?.trim()}</StatusRow>
              {c.linkExpiry && <StatusRow color={T.accent} path="M10 13 a4 4 0 0 1 0-6 l3-3 a4 4 0 0 1 6 6 l-1.5 1.5 M14 11 a4 4 0 0 1 0 6 l-3 3 a4 4 0 0 1-6-6 l1.5-1.5">Link active · expires {c.linkExpiry.trim()}</StatusRow>}
              {c.registers > 0 && <StatusRow color={T.muted} path="M4 6 h16 M4 12 h16 M4 18 h10">On {c.registers} club register{c.registers === 1 ? '' : 's'}</StatusRow>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/g/controls/${c.id}`} style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Manage</Link>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
