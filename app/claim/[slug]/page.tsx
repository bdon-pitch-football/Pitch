// ClaimClub.dc.html — copy verbatim. The role split is stated where the
// claimant chooses it: an administrator NEVER reads a player's development
// record, by any route (D-93). Verified status is separate and human (D-126).
//
// Floodlit (BUZ, 1 Oct: floodlit-join-signin-claim.html #c-step1 … #c-noaddr,
// P2). Every step is a form or the end of one, so each sits in the door panel
// (part 20) under the logo-only top bar (part 5). The club's tile is the
// unclaimed club page's dashed initials tile (D-172: never a crest, logo or
// photo); claimed, it is the solid tile with the tick and nothing says
// verified. One glow per step, on its one action.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { claimQuery } from '@/lib/claim-return';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { SHARED_ADDRESS_WARNING } from '@/lib/to-confirm';
import SiteNav from '@/components/floodlit/SiteNav';
import { GlyphTile } from '@/components/FailureState';
import { ClubRow, initials } from '@/components/doors/ClubRow';
import { claimClub, requestClaimCode } from './actions';
import { SUPPORT_EMAIL } from '@/lib/support';

// The shell every step shares: the logo-only bar, the door.
function Door({ children }: { children: ReactNode }) {
  return (
    <div className="floodlight has-topbar door-page">
      <SiteNav links={[]} signIn={false} />
      <main className="fl-wide door-flow">
        <div className="door">{children}</div>
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';

// The club's address is held to send the code, not shown in full to whoever
// opens this page (John, D-172): enough to recognise it, not to copy it.
const masked = (email: string) => {
  const [local, domain] = String(email).split('@');
  if (!domain) return '••';
  return `${local.slice(0, local.length > 2 ? 2 : 1)}••@${domain}`;
};
export const metadata = { title: 'Claim your club', robots: { index: false, follow: false } };

export default async function ClaimClub({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ claimed?: string; taken?: string; sent?: string; bad?: string; noaddress?: string }>;
}) {
  const { slug } = await params;
  const { claimed, taken, sent, bad, noaddress } = await searchParams;
  const me = await getSessionPersonId();
  // F7: the sign-in door names this club and brings them back here.
  if (!me) redirect(`/signin${claimQuery(slug)}`);

  const { rows } = await db.query(
    `select name, suburb, state, club_state, contact_email,
       (select count(*)::int from squad s where s.club_id = club.id) as teams
     from club where public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) {
    const now = (await db.query('select fn_club_slug_now($1) as s', [slug])).rows[0]?.s;
    if (now) permanentRedirect(`/claim/${now}`);
    notFound();
  }
  const c = rows[0];
  // B2 (BUZ, 1 Oct): someone who claimed while signed in with the club's own
  // shared (published) address is told the register needs the TD's own
  // account. Compared case-insensitively; nothing is shown otherwise.
  const myEmail = (await db.query('select email from person where id = $1', [me])).rows[0]?.email as string | undefined;
  const shared = Boolean(myEmail && c.contact_email && myEmail.trim().toLowerCase() === String(c.contact_email).trim().toLowerCase());

  // A club that is not unclaimed is done, whether or not the caller arrived
  // with ?taken=1. This used to depend on the query string, so opening the
  // claim page for an already-claimed club fell through to the forms below
  // and offered to claim it again.
  if (claimed || c.club_state !== 'unclaimed') {
    return (
      <Door>
        {claimed && (
          <GlyphTile state="done"><span style={{ fontSize: 22, fontWeight: 900 }}>{initials(c.name).slice(0, 1)}</span></GlyphTile>
        )}
        <h1 className="door-h24">{claimed ? `${c.name} is yours to run.` : 'This page has already been claimed.'}</h1>
        {claimed && <div className="pg-sub" style={{ fontSize: 13 }}>You can edit the page now. Posting trials, and anything to do with players, waits for verification — a phone call from us. We ring {c.name} on a number we find ourselves, so let the club know to expect us.</div>}
        {claimed && shared && <div className="card-sunken door-info is-sec">{SHARED_ADDRESS_WARNING}</div>}
        {/* The claimed screen was a dead end (30 Sep preview). */}
        {claimed && <Link href="/home" className="btn btn-primary fl-glow">Go to your club</Link>}
      </Door>
    );
  }

  // No published address means no code, and saying so beats a form that
  // cannot work. The verification call is the way in for these clubs. The
  // phone sits in the dashed tile: nothing to act on here.
  if (noaddress || !c.contact_email) {
    return (
      <Door>
        <GlyphTile state="dead">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4 h3.5 l1.5 4 -2 1.5 c1 2.2 2.8 4 5 5 l1.5 -2 4 1.5 V17.5 a1.5 1.5 0 0 1 -1.5 1.5 C10 19 5 14 5 5.5 A1.5 1.5 0 0 1 5 4 Z" /></svg>
        </GlyphTile>
        <h1 className="door-h24">We need to ring {c.name}.</h1>
        <div className="pg-sub" style={{ fontSize: 13.5 }}>
          There is no contact address on this club&rsquo;s public listing, so there is nowhere for us to send a code that proves anything. Email <b style={{ color: 'var(--ink)' }}>{SUPPORT_EMAIL}</b> and we will call the club instead — it is the same check either way, and it is free.
        </div>
      </Door>
    );
  }

  // Step two: the code has gone to the club's published address.
  if (sent) {
    const verify = claimClub;
    return (
      <Door>
        <div className="door-hd">
          <h1 className="pg-title">Check the club&rsquo;s inbox</h1>
          <div className="pg-sub">
            We sent a six-digit code to <b style={{ color: 'var(--ink)' }}>{masked(c.contact_email)}</b> — the address on {c.name}&rsquo;s own public listing. It works once and expires in 30 minutes.
          </div>
        </div>
        {bad && (
          <div role="alert" className="card card-amber door-note-l" style={{ fontSize: 13 }}>
            That code didn&rsquo;t work. Check the newest email — an older code stops working as soon as a new one is sent.
          </div>
        )}
        <form action={verify} className="door-form"><input type="hidden" name="slug" value={slug} />
          {/* The role is NOT a choice on this form. Claiming makes you the
              club's administrator; Technical Director — the one role that
              reads a player's development record — is granted by the club
              and confirmed on the verification call (D-93, doc 14 H10,
              BUZ's decision 9). It was self-declared here, which is how an
              unverified club's claimant gave themselves that read. */}
          <div className="stack8">
            <div className="panel-h">What claiming makes you</div>
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 800 }}>Club administrator</div>
              <div className="door-small" style={{ marginTop: 2 }}>
                You run the page and the teams, and the trial notices once your club is verified. <b>An administrator never reads a player&rsquo;s development record, by any route.</b> Technical Director is confirmed on the verification call, never chosen on a form.
              </div>
            </div>
          </div>
          <div className="stack8">
            <div className="panel-h" id="claim-code-l">Your code</div>
            <label className="field is-code">
              <input className="claim-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000" aria-labelledby="claim-code-l" aria-invalid={bad ? true : undefined} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary fl-glow">Claim {c.name}</button>
        </form>
        <form action={requestClaimCode}><input type="hidden" name="slug" value={slug} />
          <button type="submit" className="textbtn textbtn-wide">Send it again</button>
        </form>
      </Door>
    );
  }

  const act = requestClaimCode;
  return (
    <Door>
      <div className="door-hd">
        <h1 className="pg-title">Claim {c.name}</h1>
        <div className="pg-sub">Pitch made this page from public information. Claiming it means you control what&rsquo;s on it.</div>
      </div>

      <ClubRow name={c.name} where={`${[c.suburb, c.state].filter(Boolean).join(' ')}${c.teams ? ` · ${c.teams} teams listed` : ''}`} unclaimed />

      <form action={act} className="door-form"><input type="hidden" name="slug" value={slug} />
        {/* The role is chosen on the NEXT screen, with the code. There is
            nothing to decide until the reader has proved they can open the
            club's inbox, and asking first implies the answer matters. */}
        <div className="stack8">
          <div className="panel-h">Prove it&rsquo;s your club</div>
          <div className="card">
            <div className="field-label">We&rsquo;ll send a code to</div>
            <div className="club-addr">{masked(c.contact_email)}</div>
          </div>
          {/* You do not get to choose where the proof goes. A code sent to
              an address of the reader's choosing proves the reader can read
              their own email, which is not a fact about the club. */}
          <div className="door-small">That is the address on {c.name}&rsquo;s own public listing — the one we built this page from. We can&rsquo;t send it anywhere else. If you can&rsquo;t get to that inbox, email {SUPPORT_EMAIL} and we&rsquo;ll ring the club instead.</div>
        </div>
        <div className="card-sunken door-info is-sec">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
          <div>Claiming gets you the page and your squads. <b>Verified status is separate:</b> we ring {c.name} on a number we find ourselves, and that call is what unlocks trial notices and anything to do with players.</div>
        </div>
        {/* B2 (BUZ, 1 Oct; #c-shared): signed in with the club's own shared,
            published address, the code and the account share one inbox. The
            approved line says so where the address is chosen, directly above
            the button; the claim goes ahead and the button still glows. It is
            said again on the claimed screen, as before. */}
        {shared && <div role="status" className="card card-amber door-note-l" style={{ fontSize: 13 }}>{SHARED_ADDRESS_WARNING}</div>}
        <button type="submit" className="btn btn-primary fl-glow">Send me the code</button>
      </form>
    </Door>
  );
}
