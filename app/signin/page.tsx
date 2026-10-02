// SignIn.dc.html — copy verbatim. One door, four seats. In development the
// password path is inert and the email match signs in directly; production
// swaps in Supabase Auth behind the same form. Responses are identical
// whether or not an account exists (D-94 §2 — no enumeration).
//
// Floodlit (BUZ, 1 Oct: floodlit-join-signin-claim.html #s-default,
// #s-refused, #s-joined, #c-signin). The logo-only top bar (spec A part 5,
// P2: the logo links home), then the door panel (part 20). The fields sit on
// the one field well sign-up uses; Sign in is the one primary and glows.
// "New to Pitch? Create an account" follows the content: it was pinned to the
// foot of the screen with ~590px of nothing above it (audit, 2 Oct).
import OpenInBrowser from '@/components/OpenInBrowser';
import SiteNav from '@/components/floodlit/SiteNav';
import { ClubRow } from '@/components/doors/ClubRow';
import { signIn } from './actions';
import { FAILURE_COPY } from '@/components/FailureState';
import { db } from '@/lib/db';
import { claimQuery, claimSlug } from '@/lib/claim-return';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ out?: string; reset?: string; joined?: string; confirmed?: string; refused?: string; claim?: string }> }) {
  const { out, reset, joined, confirmed, refused, claim: claimParam } = await searchParams;
  // F7 (BUZ, 1 Oct): someone who pressed Claim on a club while signed out.
  // The door names that club and brings them back to it; a slug that is no
  // club's is simply the ordinary door. The row under the heading is the
  // claim step's own (#c-signin): the club's public name and place, and the
  // Unclaimed pill while it is — nothing that is not on its public page.
  const claim = claimSlug(claimParam);
  const row = claim
    ? ((await db.query('select name, suburb, state, club_state from club where public_slug = $1', [claim])).rows[0] as
      { name: string; suburb: string | null; state: string | null; club_state: string } | undefined) ?? null
    : null;
  const club = row?.name ?? null;
  const carry = club ? claimQuery(claim) : '';
  const invalid = refused ? true : undefined;

  return (
    <div className="floodlight has-topbar door-page">
      {/* .signin-door: this page's own rise, on the door's children. */}
      <style>{`@keyframes doorRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .signin-door > * { animation: doorRise .5s cubic-bezier(.22,1,.36,1) both; }
        .signin-door > *:nth-child(2) { animation-delay: .05s } .signin-door > *:nth-child(3) { animation-delay: .1s }
        .signin-door > *:nth-child(4) { animation-delay: .15s } .signin-door > *:nth-child(5) { animation-delay: .2s }
        @media (prefers-reduced-motion: reduce) { .signin-door > * { animation: none } }`}</style>
      <SiteNav links={[]} signIn={false} />
      <main className="fl-wide door-flow">
        <div className="door signin-door">
          <OpenInBrowser path="/signin" />
          <div className="door-hd">
            <h1 className="pg-title">{club ? `Sign in to claim ${club}` : 'Welcome back'}</h1>
            <div className="pg-sub">
              {/* "You're set up" was true before 0056 and is not now: the
                  account exists and signs in nowhere until the link we emailed
                  is opened (L21, L25 — copy that describes behaviour goes stale
                  silently). The line is the same whether the address was free
                  or already had an account, because the answer must be (D-94
                  §2). */}
              {out ? 'Signed out on this device.' : reset ? 'Password saved. Sign in with it.'
                : confirmed ? 'Address confirmed. Sign in with the password you chose.'
                : joined ? 'Check your email. There’s a link in it that confirms the address is yours — open it and you can sign in. If it isn’t in your inbox, look in spam or junk — we’re new, and some inboxes don’t know us yet.'
                : club ? `New here? Make an account and we’ll bring you back to ${club}.`
                : 'One account, whichever seat you hold.'}
            </div>
          </div>
          {row && <ClubRow name={row.name} where={[row.suburb, row.state].filter(Boolean).join(' ')} unclaimed={row.club_state === 'unclaimed'} />}
          {/* Every refusal lands here with this one line, whatever caused it
              (app/signin/actions.ts). role=alert, because a person who has just
              pressed Sign in and been sent back needs telling, and a screen
              reader was previously told nothing at all. Both fields take the
              amber edge, because the line names both — the same for every
              cause (D-94 §2). */}
          {refused && (
            <div role="alert" className="card card-amber door-note-l">
              {FAILURE_COPY.signInRefused}
            </div>
          )}
          <form action={signIn} className="door-form" style={{ gap: 20 }}>
            {club && <input type="hidden" name="claim" value={claim!} />}
            <div className="door-stack">
              {/* The visible label is a LABEL, not a div beside the input. It
                  looked identical and read as "edit text, blank" to anyone
                  using a screen reader — on the product's front door. Wrapping
                  associates them implicitly, so no id/htmlFor pair to keep in
                  sync, and it widens the tap target onto the label text. */}
              <label className="field"><div className="field-label">Email</div><input name="email" type="email" placeholder="you@example.com" required aria-invalid={invalid} /></label>
              <label className="field"><div className="field-label">Password</div><input name="password" type="password" placeholder="••••••••" aria-invalid={invalid} /></label>
            </div>
            <div className="door-stack">
              <button type="submit" className="btn btn-primary fl-glow">Sign in</button>
              {/* This was a second submit button on the password form, and no
                  emailed sign-in link exists (doc 15 has no such message), so in
                  production it signed nobody in. The emailed link that does
                  exist is §10's: choose a password. */}
              <a href="/reset" className="btn btn-secondary" style={{ color: 'var(--secondary)' }}>No password yet? Email me a link</a>
            </div>
          </form>
          <div className="orline">Forgotten your password? <a href="/reset">Reset it</a></div>
          <hr className="door-rule" />
          <div className="card-sunken door-info">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill="currentColor" /></svg>
            <div>A parent, a player, a coach and a club all sign in here. What you see afterwards depends on the seat, not the door.</div>
          </div>
          <div className="orline">New to Pitch? <a href={`/join${carry}`}>Create an account</a></div>
        </div>
      </main>
    </div>
  );
}
