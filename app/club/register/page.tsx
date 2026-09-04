// InterestRegister.dc.html — the club's register, copy verbatim. Rows come
// exclusively from fn_register_rows (verified + subscribed + authorised, or
// nothing); an unverified club renders the held state: a count and not one
// name (D-126). No download exists anywhere on this surface (D-122).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { setStatus } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100', blue: '#3987e5',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: 'rgba(61,220,132,.14)', fg: T.accent, label: 'New' },
  shortlisted: { bg: 'rgba(237,161,0,.14)', fg: T.amber, label: 'Shortlisted' },
  invited: { bg: 'rgba(57,135,229,.16)', fg: T.blue, label: 'Invited' },
};

export default async function Register() {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const club = await db.query(
    `select c.id, c.name, c.club_state from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');
  const c = club.rows[0];

  const rows = (await db.query(`select * from fn_register_rows($1, $2)`, [me, c.id])).rows as {
    registration_id: string; player_first_name: string; positions: string[];
    trial_tag: string | null; note: string | null; club_status: string; created_at: string;
  }[];
  const held = rows.length === 0 ? (await db.query(`select fn_register_count($1,$2) as n`, [me, c.id])).rows[0].n : 0;

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Interest register</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>{c.name} · <b style={{ color: T.ink }}>{rows.length || held} players</b></div>
        </div>

        {c.club_state !== 'verified' ? (
          <>
            <div style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.amber }}>{held} waiting</div>
              <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Registrations are held until your club is verified — a short phone call with us. You&rsquo;ll see the list, and nothing about anyone under 18 reaches any club before that call. Paying doesn&rsquo;t change it and can&rsquo;t.</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: 'rgba(61,220,132,.07)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>Every under-16 here was put on this register by a parent.</div>
            </div>
            {/* desktop console table (D-147) */}
            <div className="d-only" style={{ ...card, padding: '6px 16px', flexDirection: 'column' }}>
              <div className="console-row d-only" style={{ borderBottom: `1px solid ${T.line}`, padding: '9px 0' }}>
                {['Player', 'Their line', 'Status', '', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{h}</div>
                ))}
              </div>
              {rows.map((r) => {
                const chip = STATUS_CHIP[r.club_status];
                return (
                  <div key={r.registration_id} className="console-row d-only" style={{ borderTop: `1px solid ${T.surface2}` }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.player_first_name}</div>
                      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{r.positions.join(' · ')}</div>
                    </div>
                    <div style={{ fontSize: 12, fontStyle: r.note ? 'italic' : 'normal', color: r.note ? T.secondary : T.muted, fontWeight: 500, lineHeight: 1.4 }}>{r.note ? `“${r.note}”` : '—'}</div>
                    <div><span style={{ background: chip.bg, color: chip.fg, borderRadius: 7, padding: '4px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{chip.label}</span></div>
                    <Link href={`/club/register/cv/${r.registration_id}`} style={{ background: T.surface2, borderRadius: 12, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Open the CV</Link>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {r.club_status === 'new' && (
                        <form action={setStatus.bind(null, r.registration_id, 'shortlisted')}>
                          <button type="submit" style={{ height: 38, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, fontSize: 12.5, fontWeight: 700, padding: '0 16px', cursor: 'pointer', fontFamily: 'inherit' }}>Shortlist</button>
                        </form>
                      )}
                      {r.club_status === 'shortlisted' && (
                        <form action={setStatus.bind(null, r.registration_id, 'invited')}>
                          <button type="submit" style={{ height: 42, borderRadius: 12, border: 'none', background: T.accent, color: T.onAccent, fontSize: 13.5, fontWeight: 800, padding: '0 18px', cursor: 'pointer', fontFamily: 'inherit' }}>Invite to trial</button>
                        </form>
                      )}
                      {r.club_status === 'invited' && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>Invitation sent</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {rows.map((r) => {
              const chip = STATUS_CHIP[r.club_status];
              return (
                <div key={r.registration_id} className="m-only" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{r.player_first_name}</div>
                      <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{r.positions.join(' · ')}</div>
                    </div>
                    <div style={{ background: chip.bg, color: chip.fg, borderRadius: 7, padding: '4px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{chip.label}</div>
                  </div>
                  {r.note && (
                    <div style={{ background: T.surface2, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href={`/club/register/cv/${r.registration_id}`} style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Open the CV</Link>
                    {r.club_status === 'new' && (
                      <form action={setStatus.bind(null, r.registration_id, 'shortlisted')} style={{ display: 'flex' }}>
                        <button type="submit" style={{ height: 40, alignSelf: 'center', borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Shortlist</button>
                      </form>
                    )}
                    {r.club_status === 'shortlisted' && (
                      <Link href={`/club/invite/${r.registration_id}`} style={{ flex: 1, height: 50, borderRadius: 14, background: T.accent, color: T.onAccent, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Invite to trial</Link>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              <b style={{ color: T.ink }}>There is no download.</b> The register lives here, and a family who switches their link off disappears from it the same minute. A spreadsheet on someone&rsquo;s laptop could not do that.
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>New, shortlisted, invited — and nothing else</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Those three are yours. No player sees them, no parent sees them, and there is no button here that turns anyone away — a register isn&rsquo;t a queue you clear.</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The keeper you haven&rsquo;t got room for in September is still on this list in March, when someone tears a hamstring.</div>
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, textAlign: 'center' }}>A family can take themselves off at any time. The entry goes, and so does the CV link.</div>
          </>
        )}
        <Link href="/home" style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: T.muted, textDecoration: 'none', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Back</Link>
      </div>
    </div>
  );
}
