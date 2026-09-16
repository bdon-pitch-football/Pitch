// TrialsIndex.dc.html — the public trials board (D-74, D-90). One
// chronological noticeboard: no recommender, no personalisation, ever.
// Every listing carries its stamps; anything past its date never renders.
// Verified clubs get the in-Pitch route; unclaimed listings say plainly
// they were compiled and route via the club.
import Link from 'next/link';
import { PlayerFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import Wordmark from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', placeholder: '#6b7d73',
};

export const dynamic = 'force-dynamic';

// Public and indexable — the noticeboard is a reason for a parent to find us.
export const metadata = {
  title: 'Trials',
  description: 'Open football trials in Victoria and New South Wales, by age group, region and position.',
  alternates: { canonical: '/trials' },
};

export default async function TrialsBoard({ searchParams }: {
  searchParams: Promise<{ age?: string; gender?: string }>;
}) {
  const { age, gender } = await searchParams;
  // Chronological and filtered only by what the family chose. No recommender,
  // no personalisation, ever (D-74).
  const { rows } = await db.query(
    `select t.id, t.title, t.time_venue, t.source, t.age_group, t.competition_gender,
       upper(to_char(t.trial_on, 'Mon')) as mon, to_char(t.trial_on, 'FMDD') as day,
       to_char(t.added_on, 'DD Mon') as listed, to_char(t.last_checked, 'DD Mon') as checked,
       c.name as club_name, c.club_state, c.public_slug
     from trial_notice t join club c on c.id = t.club_id
     where t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
       and ($1::text is null or t.age_group = $1)
       and ($2::text is null or t.competition_gender = $2)
     order by t.trial_on`,
    [age || null, gender || null],
  );
  const listings = rows as {
    title: string; time_venue: string; source: string; mon: string; day: string;
    id: string; listed: string; checked: string; club_name: string; club_state: string; public_slug: string | null;
  }[];
  const lastChecked = listings.length ? listings[listings.length - 1].checked : null;

  const pill = (on: boolean): React.CSSProperties => ({
    // D-147: >=44px at every width. These were 29px — and they are the day-one
    // filters (D-74), the only way anybody narrows this board on a phone.
    borderRadius: 999, minHeight: 44, padding: '0 16px', fontSize: 12, fontWeight: on ? 900 : 700,
    background: on ? T.accent : T.surface, color: on ? T.onAccent : T.secondary,
    border: on ? '1px solid transparent' : `1px solid ${T.line}`, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
  });
  const href = (next: { age?: string | null; gender?: string | null }) => {
    const p = new URLSearchParams();
    const a = next.age === undefined ? age : next.age;
    const g = next.gender === undefined ? gender : next.gender;
    if (a) p.set('age', a);
    if (g) p.set('gender', g);
    const qs = p.toString();
    return qs ? `/trials?${qs}` : '/trials';
  };

  return (
    <PlayerFrame active="trials">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Trials board</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Club trials listed below, by trial date.</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Link href={href({ age: null })} style={pill(!age)}>All ages</Link>
          {['U13', 'U14', 'U15', 'U16', 'U18'].map((a) => (
            <Link key={a} href={href({ age: age === a ? null : a })} style={pill(age === a)}>{a}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: -4 }}>
          <Link href={href({ gender: null })} style={pill(!gender)}>All</Link>
          {[['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women']].map(([v, t]) => (
            <Link key={v} href={href({ gender: gender === v ? null : v })} style={pill(gender === v)}>{t}</Link>
          ))}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.5 }}>Some clubs take your interest inside Pitch. The rest read a CV in their inbox like they always have — the button on each listing tells you which.{lastChecked ? ` Last checked ${lastChecked}.` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {listings.length === 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              No trials listed for that yet. An empty week is honest — we only list what a club has posted or published itself.
            </div>
          )}
          {listings.map((l) => {
            const verified = l.club_state === 'verified';
            return (
              <div key={l.club_name + l.title} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ background: verified ? 'rgba(61,220,132,.12)' : T.surface2, borderRadius: verified ? 11 : 12, padding: '7px 10px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: verified ? T.accent : T.muted }}>{l.mon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{l.day}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{l.club_name} · {l.title.replace(' trials', '')}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{l.time_venue}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>Listed {l.listed} · checked {l.checked}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: verified ? T.accent : T.placeholder }} />
                      <div style={{ fontSize: 10.5, fontWeight: verified ? 800 : 700, color: verified ? T.accent : T.muted }}>
                        {verified ? 'On Pitch — verified club' : 'Unclaimed listing · register via club'}
                      </div>
                    </div>
                    {/* These were two styled boxes that did nothing when pressed — the
                        board's only call to action, dead for every family. They
                        open the club's page at its door now: a verified club's
                        register, carrying this trial so the club can invite to
                        it (D-153), or an unclaimed club's "send my CV". */}
                    {l.public_slug && (verified ? (
                      <Link href={`/fc/${l.public_slug}?trial=${l.id}#play`} style={{ background: T.accent, color: T.onAccent, borderRadius: 999, padding: '0 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 900, textDecoration: 'none', flexShrink: 0 }}>I&rsquo;m interested</Link>
                    ) : (
                      <Link href={`/fc/${l.public_slug}#play`} style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 999, padding: '0 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>Send my CV</Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PlayerFrame>
  );
}
