// Find your club (BUZ, 30 Sep). A club person searches by name or suburb,
// taps their club and claims it (/claim/[slug], unchanged: the code goes to
// the club's own public address, and verification is still a phone call,
// D-126). A club that is not listed can be asked for; BUZ adds it (0159).
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';
import { card, sectionLabel as label } from '@/lib/ui';
import { askForClub } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find your club', robots: { index: false, follow: false } };

type Row = { name: string; suburb: string | null; state: string | null; public_slug: string; club_state: string };

const input = { background: 'transparent', border: 'none', color: T.ink, fontSize: 15, fontWeight: 600, padding: 0, width: '100%', minHeight: 44, fontFamily: 'inherit' } as const;

export default async function FindYourClub({ searchParams }: {
  searchParams: Promise<{ q?: string; asked?: string; club?: string }>;
}) {
  const { q: rawQ, asked, club } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 80);
  const me = await getSessionPersonId();
  const rows: Row[] = q.length >= 2 ? (await db.query('select * from fn_club_search($1)', [q])).rows : [];
  const searched = q.length >= 2;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Find your club</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            Search for your club, then claim its page. We email a code to the club&rsquo;s own address to check it&rsquo;s you.
          </div>
        </div>

        {asked === 'ok' && (
          <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13.5, fontWeight: 600, color: T.secondary, lineHeight: 1.5 }}>
            Thanks. We&rsquo;ll add {club || 'your club'} within a day. Search for it here then, and press Claim.
          </div>
        )}

        <form method="get" action="/claim" role="search" style={{ display: 'flex', gap: 10 }}>
          <div style={{ ...card, flex: 1, display: 'flex', alignItems: 'center' }}>
            <input id="club-q" name="q" aria-label="Club name or suburb" defaultValue={q} placeholder="Club name or suburb" autoComplete="off" minLength={2} maxLength={80} style={{ ...input, minHeight: 44 }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 20px' }}>Search</button>
        </form>

        {searched && rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((c) => (
              <div key={c.public_slug} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[c.suburb, c.state].filter(Boolean).join(' ')}</div>
                </div>
                {c.club_state === 'unclaimed'
                  ? <Link href={`/claim/${c.public_slug}`} className="btn btn-primary" style={{ width: 'auto', padding: '0 18px', height: 44, display: 'inline-flex', alignItems: 'center' }}>Claim</Link>
                  : <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>Already claimed</div>}
              </div>
            ))}
          </div>
        )}

        {searched && rows.length === 0 && (
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>We couldn&rsquo;t find &ldquo;{q}&rdquo;.</div>
        )}

        {(searched || asked) && asked !== 'ok' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={label}>Not here? Tell us your club</div>
            {asked && asked !== 'ok' && (
              <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>
                {asked === 'listed' ? 'That club is already on Pitch. Search for it above.'
                  : asked === 'many' ? 'You’ve already asked for three clubs. We’ll get to them soon.'
                  : asked === 'account' ? 'Confirm your email address first, then ask again.'
                  : 'Check the club’s name, suburb and email address.'}
              </div>
            )}
            {me ? (
              <form action={askForClub} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label htmlFor="ask-name" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={label}>Club name</span>
                  <input id="ask-name" name="name" required minLength={2} maxLength={120} defaultValue={searched ? q : ''} style={input} />
                </label>
                <label htmlFor="ask-suburb" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={label}>Suburb</span>
                  <input id="ask-suburb" name="suburb" required minLength={2} maxLength={80} style={input} />
                </label>
                <label htmlFor="ask-state" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={label}>State</span>
                  <select id="ask-state" name="state" defaultValue="VIC" style={{ ...input, appearance: 'auto' }}>
                    <option value="VIC">Victoria</option>
                    <option value="NSW">New South Wales</option>
                  </select>
                </label>
                <label htmlFor="ask-email" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={label}>The club&rsquo;s email address</span>
                  <input id="ask-email" name="email" type="email" required maxLength={254} style={input} />
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>The club&rsquo;s own address, the one on its website. We send the claim code there.</span>
                </label>
                <button type="submit" className="btn btn-primary">Send</button>
              </form>
            ) : (
              <Link href="/signin" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Sign in to tell us your club</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
