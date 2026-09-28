// ClaimClub.dc.html — copy verbatim. The role split is stated where the
// claimant chooses it: an administrator NEVER reads a player's development
// record, by any route (D-93). Verified status is separate and human (D-126).
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { claimClub, requestClaimCode } from './actions';
import { T } from '@/lib/palette';
import { card, sectionLabel as label } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Claim your club', robots: { index: false, follow: false } };

export default async function ClaimClub({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ claimed?: string; taken?: string; sent?: string; bad?: string; noaddress?: string }>;
}) {
  const { slug } = await params;
  const { claimed, taken, sent, bad, noaddress } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select name, suburb, state, club_state, contact_email,
       (select count(*)::int from squad s where s.club_id = club.id) as teams
     from club where public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];

  // A club that is not unclaimed is done, whether or not the caller arrived
  // with ?taken=1. This used to depend on the query string, so opening the
  // claim page for an already-claimed club fell through to the forms below
  // and offered to claim it again.
  if (claimed || c.club_state !== 'unclaimed') {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>{claimed ? `${c.name} is yours to run.` : 'This page has already been claimed.'}</div>
          {claimed && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>You can post trials and edit the page now. Verification — the phone call that unlocks anything to do with players — happens separately, and we&rsquo;ll be in touch.</div>}
        </div>
      </div>
    );
  }

  // No published address means no code, and saying so beats a form that
  // cannot work. The verification call is the way in for these clubs.
  if (noaddress || !c.contact_email) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>We need to ring {c.name}.</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            There is no contact address on this club&rsquo;s public listing, so there is nowhere for us to send a code that proves anything. Email <b style={{ color: T.ink }}>help@pitchfootball.com.au</b> and we will call the club instead — it is the same check either way, and it is free.
          </div>
        </div>
      </div>
    );
  }

  // Step two: the code has gone to the club's published address.
  if (sent) {
    const verify = claimClub;
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Check the club&rsquo;s inbox</h1>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              We sent a six-digit code to <b style={{ color: T.ink }}>{c.contact_email}</b> — the address on {c.name}&rsquo;s own public listing. It works once and expires in 30 minutes.
            </div>
          </div>
          {bad && (
            <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>
              That code didn&rsquo;t work. Check the newest email — an older code stops working as soon as a new one is sent.
            </div>
          )}
          <form action={verify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="slug" value={slug} />
            {/* The role is NOT a choice on this form. Claiming makes you the
                club's administrator; Technical Director — the one role that
                reads a player's development record — is granted by the club
                and confirmed on the verification call (D-93, doc 14 H10,
                BUZ's decision 9). It was self-declared here, which is how an
                unverified club's claimant gave themselves that read. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>What claiming makes you</div>
              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Club administrator</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted, lineHeight: 1.5 }}>
                  You run the page, the teams, the trial notices and the billing. <b style={{ color: T.secondary }}>An administrator never reads a player&rsquo;s development record, by any route.</b> Technical Director is confirmed on the verification call, never chosen on a form.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>Your code</div>
              <div style={card}>
                <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000"
                  style={{ background: 'transparent', border: 'none', color: T.ink, fontSize: 22, fontWeight: 900, letterSpacing: '0.14em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 0, width: '100%' }} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Claim {c.name}</button>
          </form>
          <form action={requestClaimCode}><input type="hidden" name="slug" value={slug} />
            <button type="submit" style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: 'transparent', color: T.muted, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send it again</button>
          </form>
        </div>
      </div>
    );
  }

  const act = requestClaimCode;
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Claim {c.name}</h1>
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

        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="slug" value={slug} />
          {/* The role is chosen on the NEXT screen, with the code. There is
              nothing to decide until the reader has proved they can open the
              club's inbox, and asking first implies the answer matters. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Prove it&rsquo;s your club</div>
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>We&rsquo;ll send a code to</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', marginTop: 3 }}>{c.contact_email}</div>
            </div>
            {/* You do not get to choose where the proof goes. A code sent to
                an address of the reader's choosing proves the reader can read
                their own email, which is not a fact about the club. */}
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>That is the address on {c.name}&rsquo;s own public listing — the one we built this page from. We can&rsquo;t send it anywhere else. If you can&rsquo;t get to that inbox, email help@pitchfootball.com.au and we&rsquo;ll ring the club instead.</div>
          </div>
          <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Claiming gets you the page and trial notices. <b style={{ color: T.ink }}>Verified status is separate</b> — a person here checks your club against Football Victoria&rsquo;s register, and it&rsquo;s what unlocks anything to do with players.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary">Send me the code</button>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 500, color: T.muted, textAlign: 'center', lineHeight: 1.5 }}>Claiming can&rsquo;t make a club verified. Only the phone call does that.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
