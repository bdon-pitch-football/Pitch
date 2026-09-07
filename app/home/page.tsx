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
        <Link href="/signin" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Sign in</Link>
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
           'registers', (select count(*)::int from registration r5 where r5.player_id = c.id and r5.withdrawn_at is null),
           'hasPending', exists(select 1 from profile_version pv
              join development_record dr2 on dr2.id = pv.record_id
              where dr2.person_id = c.id and pv.status = 'pending'),
           'invitation', (select row_to_json(q3) from (
              select i.id, cl2.name as club from invitation i
              join registration r2 on r2.id = i.registration_id
              join club cl2 on cl2.id = i.club_id
              where r2.player_id = c.id
                and not exists (select 1 from invitation_reply ir where ir.invitation_id = i.id)
              order by i.created_at desc limit 1) q3),
           'sendRequest', (select row_to_json(q) from (
              select sr.id, sr.destination from share_request sr
              join development_record dr3 on dr3.id = sr.record_id
              where dr3.person_id = c.id and sr.dispatched_at is null
              order by sr.created_at desc limit 1) q),
           'interestRequest', (select row_to_json(q2) from (
              select rr.id, cl.name as club from registration_request rr
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
    linkExpiry: string | null; registers: number; hasPending: boolean;
    invitation: { id: string; club: string } | null;
    sendRequest: { id: string; destination: string } | null;
    interestRequest: { id: string; club: string } | null;
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
          <Link href="/club/register" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Interest register</Link>
          <Link href="/club/squads" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Squads &amp; age groups</Link>
          <Link href="/club/page-edit" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Crest &amp; club page</Link>
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
          <Link href="/coach/edit" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Edit my coach CV</Link>
          {coachSeat.public_slug && (
            <Link href={`/c/${coachSeat.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>See my public page</Link>
          )}
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
          <Link href={`/build/${me.record_id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Build your CV</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/build/${me.record_id}/clips`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Highlights</Link>
            <Link href={`/build/${me.record_id}/more`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Achievements</Link>
          </div>
          <Link href={`/send/${me.record_id}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Send my CV to a club</Link>
        </div>
      </Shell>
    );
  }

  if (children.length === 0) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome, {me.first_name}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Your account is set up. There is nothing on it yet.</div>
        </div>
      </Shell>
    );
  }

  // Guardian seat.
  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</div>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything about your children on Pitch, and every control over it, is here.</div>
      </div>

      {children.filter((c) => c.invitation).map((c) => (
        <div key={c.invitation!.id} className="sheen" style={{ background: T.surface, border: `1px solid ${T.purple}`, borderRadius: 18, padding: 17, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: T.purple }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>Waiting on you</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{c.invitation!.club} would like {c.firstName} at a trial</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{c.firstName} has not been told. Nothing happens until you decide.</div>
          <Link href={`/g/invite/${c.invitation!.id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Review it</Link>
        </div>
      ))}

      {children.filter((c) => c.sendRequest).map((c) => {
        const m = /^(.*) </.exec(c.sendRequest!.destination ?? '');
        const club = m?.[1] ?? 'a club';
        return (
          <div key={c.sendRequest!.id} className="sheen" style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.accent}`, padding: 17, display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent }} />
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Waiting on you</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900 }}>{c.firstName} wants to send {c.firstName === 'Georgia' ? 'her' : 'his'} CV to {club}</div>
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>Nothing has been sent. Check the address and it goes; do nothing and the request disappears on its own.</div>
            <Link href={`/g/send/${c.sendRequest!.id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Review it</Link>
          </div>
        );
      })}

      {children.filter((c) => c.interestRequest).map((c) => (
        <div key={c.interestRequest!.id} className="lift" style={{ ...card, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: T.purple }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>Also waiting on you</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{c.firstName} wants to go on {c.interestRequest!.club}&rsquo;s register</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{c.firstName === 'Georgia' ? 'She' : 'He'}&rsquo;s written a line about {c.firstName === 'Georgia' ? 'herself' : 'himself'}. Read it before it goes — you can change it.</div>
          <Link href={`/g/interest/${c.interestRequest!.id}`} style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Read it</Link>
        </div>
      ))}

      {children.some((c) => c.hasPending) && (
        <div className="sheen" style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.accent}`, padding: 17, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Waiting on you</div>
          </div>
          {children.filter((c) => c.hasPending).map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{c.firstName} changed {c.firstName === 'Georgia' ? 'her' : 'his'} page</div>
              <Link href={`/g/pending/${c.recordId}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Review it</Link>
            </div>
          ))}
        </div>
      )}

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
