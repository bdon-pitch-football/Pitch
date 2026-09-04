// ClaimClub.dc.html — copy verbatim. The role split is stated where the
// claimant chooses it: an administrator NEVER reads a player's development
// record, by any route (D-93). Verified status is separate and human (D-126).
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { claimClub } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };

const ROLES: [string, string, React.ReactNode][] = [
  ['technical_director', 'Technical Director', 'Runs the football side. From December, the only role that reads a player’s development record.'],
  ['club_admin', 'Club administrator', <>Runs the page, the teams and the trial notices. <b style={{ color: '#b9c8bf' }}>Never reads a player&rsquo;s development record, by any route.</b></>],
  ['committee', 'Committee or president', 'Same as an administrator. You can hand the football side to your TD once you’re in.'],
];

export default async function ClaimClub({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ claimed?: string; taken?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound(); // until email codes land
  const { slug } = await params;
  const { claimed, taken } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select name, suburb, state, club_state,
       (select count(*)::int from squad s where s.club_id = club.id) as teams
     from club where public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];

  if (claimed || (taken && c.club_state !== 'unclaimed')) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>{claimed ? `${c.name} is yours to run.` : 'This page has already been claimed.'}</div>
          {claimed && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>You can post trials and edit the page now. Verification — the phone call that unlocks anything to do with players — happens separately, and we&rsquo;ll be in touch.</div>}
        </div>
      </div>
    );
  }

  const act = claimClub.bind(null, slug);
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Claim {c.name}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>This page already exists — we built it from your public notices. Claiming it means you control what&rsquo;s on it and you can post trials.</div>
        </div>

        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{c.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{c.name}</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[c.suburb, c.state].filter(Boolean).join(' ')}{c.teams ? ` · ${c.teams} teams listed` : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(237,161,0,.14)', borderRadius: 999, padding: '5px 10px' }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: T.amber }} />
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.amber }}>Unclaimed</div>
          </div>
        </div>

        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Who are you at the club</div>
            {ROLES.map(([value, title, desc], i) => (
              <label key={value} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="radio" name="role" value={value} defaultChecked={i === 0} style={{ width: 20, height: 20, accentColor: T.accent, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.muted, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Prove it&rsquo;s your club</div>
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your club email address</div>
              <input name="email" type="email" placeholder="you@yourclub.com.au" style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 0, width: '100%' }} />
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>We send a code to the address on your club&rsquo;s own public listing. If you don&rsquo;t have access to it, we&rsquo;ll call the club instead — tell us below and we&rsquo;ll sort it out.</div>
          </div>
          <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Claiming gets you the page and trial notices. <b style={{ color: T.ink }}>Verified status is separate</b> — a person here checks your club against Football Victoria&rsquo;s register, and it&rsquo;s what unlocks anything to do with players.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Send me the code</button>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: T.muted }}>I can&rsquo;t get to that address</div>
          </div>
        </form>
      </div>
    </div>
  );
}
