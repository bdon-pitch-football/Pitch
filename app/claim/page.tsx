// Find your club (BUZ, 30 Sep). A club person searches by name or suburb,
// taps their club and claims it (/claim/[slug], unchanged: the code goes to
// the club's own public address, and verification is still a phone call,
// D-126). A club that is not listed can be asked for; BUZ adds it (0159).
//
// Floodlit (BUZ, 1 Oct: floodlit-join-signin-claim.html #c-start … #c-asked,
// P2). A list is a page, so this sits on the page in the reading column, not
// in a door panel. The bar is the public one (Find your club · Trials · Sign
// in, as on / and the club page), and the search is the front door's light
// field in the same words, so the club that typed on / lands on the same
// field. Search is the one glow; a Claim in a result row never glows.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import SiteNav from '@/components/floodlit/SiteNav';
import { askForClub } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find your club', robots: { index: false, follow: false } };

type Row = { name: string; suburb: string | null; state: string | null; public_slug: string; club_state: string };

export default async function FindYourClub({ searchParams }: {
  searchParams: Promise<{ q?: string; asked?: string; club?: string }>;
}) {
  const { q: rawQ, asked, club } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 80);
  const me = await getSessionPersonId();
  const rows: Row[] = q.length >= 2 ? (await db.query('select * from fn_club_search($1)', [q])).rows : [];
  const searched = q.length >= 2;

  return (
    <div className="floodlight has-topbar door-page">
      <SiteNav signIn={!me} links={[{ href: '/claim', label: 'Find your club', current: true }, { href: '/trials', label: 'Trials' }]} />
      <main className="fl-wide door-flow">
        <div className="door-col">
          <div className="door-hd">
            <h1 className="pg-title">Find your club</h1>
            <div className="pg-sub">
              Search for your club, then claim its page. We email a code to the club&rsquo;s own address to check it&rsquo;s you.
            </div>
          </div>

          {asked === 'ok' && (
            <div role="status" className="card card-accent door-note-l">
              Thanks. We&rsquo;ll add {club || 'your club'} within a day. Search for it here then, and press Claim.
            </div>
          )}

          <form method="get" action="/claim" role="search" className="fl-search">
            <label className="fl-search-field">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="6.5" /><path d="M20 20 L15.8 15.8" /></svg>
              <input id="club-q" name="q" aria-label="Club name or suburb" defaultValue={q} placeholder="Club name or suburb" autoComplete="off" minLength={2} maxLength={80} />
            </label>
            <button type="submit" className="btn btn-primary fl-glow">Search</button>
          </form>

          {searched && rows.length > 0 && (
            <div className="stack8" style={{ gap: 10 }}>
              {rows.map((c) => (
                <div key={c.public_slug} className="fl-card result">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="result-n">{c.name}</div>
                    <div className="result-w">{[c.suburb, c.state].filter(Boolean).join(' ')}</div>
                  </div>
                  {c.club_state === 'unclaimed'
                    ? <Link href={`/claim/${c.public_slug}`} className="btn btn-primary btn-auto">Claim</Link>
                    : <div className="result-taken">Already claimed</div>}
                </div>
              ))}
            </div>
          )}

          {searched && rows.length === 0 && (
            <div className="pg-sub">We couldn&rsquo;t find &ldquo;{q}&rdquo;.</div>
          )}

          {(searched || asked) && asked !== 'ok' && (
            <div className={me ? 'tellus' : 'stack8'} style={me ? undefined : { gap: 10 }}>
              <div className="panel-h">Not here? Tell us your club</div>
              {asked && asked !== 'ok' && (
                <div role="alert" className="card card-amber door-note-l" style={{ fontSize: 13 }}>
                  {asked === 'listed' ? 'That club is already listed. Search for it above.'
                    : asked === 'many' ? 'You’ve already asked for three clubs. We’ll get to them soon.'
                    : asked === 'account' ? 'Confirm your email address first, then ask again.'
                    : 'Check the club’s name, suburb and email address.'}
                </div>
              )}
              {me ? (
                <form action={askForClub} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label htmlFor="ask-name" className="field">
                    <span className="field-label">Club name</span>
                    <input id="ask-name" name="name" required minLength={2} maxLength={120} defaultValue={searched ? q : ''} />
                  </label>
                  <label htmlFor="ask-suburb" className="field">
                    <span className="field-label">Suburb</span>
                    <input id="ask-suburb" name="suburb" required minLength={2} maxLength={80} />
                  </label>
                  <label htmlFor="ask-state" className="field">
                    <span className="field-label">State</span>
                    <select id="ask-state" name="state" defaultValue="VIC">
                      <option value="VIC">Victoria</option>
                      <option value="NSW">New South Wales</option>
                    </select>
                  </label>
                  <label htmlFor="ask-email" className="field">
                    <span className="field-label">The club&rsquo;s email address</span>
                    <input id="ask-email" name="email" type="email" required maxLength={254} />
                    <span className="door-small" style={{ marginTop: 4 }}>The club&rsquo;s own address, the one on its website. We send the claim code there.</span>
                  </label>
                  <button type="submit" className="btn btn-primary">Send</button>
                </form>
              ) : (
                <Link href="/signin" className="btn btn-secondary">Sign in to tell us your club</Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
