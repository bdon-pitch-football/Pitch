import type { ReactNode } from 'react';
import SiteNav from '@/components/floodlit/SiteNav';
import { T } from '@/lib/palette';

// ---------------------------------------------------------------------------
// The failure path — one shell for every screen a person reaches by accident.
//
// WHY IT EXISTS. There was no app/not-found.tsx and no app/error.tsx, so 52
// notFound() call sites across 33 route files and every uncaught render error
// served Next's stock page, whose inline style is literally
// `body{color:#000;background:#fff}`. On a dark-only product (Night Match is
// the brand, BUZ 24 Aug) that is a white screen with black system text, no
// Pitch mark — the placement rule has no exceptions — no way back, and the
// site title still reading "every season on the record."
//
// The standard this is built to is already in the product: LinkState, the
// D-77 dead-link page. A mark, a plain heading, the reason, a sunken card
// explaining why we will not say more, one action, and a lot of space.
//
// THE PROPERTY THAT MATTERS MORE THAN THE LOOK. A 404 must not become an
// enumeration oracle. A dead club slug and a registrant whose guardian has
// just paused them both end in notFound(), and doc 14's rule is that a denial
// answers "as if it does not exist", never "forbidden" — a 403 that differs
// from a 404 is an existence oracle, and an existence oracle on a child is a
// leak. Next hands not-found.tsx NO PROPS (see node_modules/next/dist/docs
// /01-app/03-api-reference/03-file-conventions/not-found.md), so the page has
// nothing to distinguish causes WITH — the same argument that makes E10 true
// of LinkState. Nothing below may reintroduce a branch.
//
// data-failure is the machine-readable marker. The suites and the layout
// check identify these screens by it, never by their words, because every
// word on them is a proposal awaiting BUZ and the checks must survive him
// changing one (L32: a suite that reads a page is reading a fixture).
// ---------------------------------------------------------------------------

// EVERY USER-VISIBLE STRING ON THE FAILURE PATH, IN ONE PLACE.
//
// ⚠ AWAITING BUZ. None of this is approved copy. It is listed verbatim in
// docs/team/reports/2026-09-28-builder-failure-path.md as a proposal. The
// mechanism ships first so that approving the words is a five-minute
// conversation; changing a string here changes it everywhere it renders.
//
// Two of them are the design seat's own proposals and are used as it wrote
// them: signInRefused, and the report page's heading-above-the-thanks order.

// One label for "out of here", on all three screens, because a person meeting
// a second failure should not be learning a second word for the same door.
//
// It goes to /home, not /. Before launch / is the waitlist page, which has no
// door into the product at all — a signed-in parent sent there from a 404
// would have had no way back and no way to sign out. /home is the seat's own
// home, where the console shell carries sign-out for every seat (rail on a
// laptop, the More sheet on a phone); signed out, it is the sign-in prompt.
const WAY_BACK = 'Go to the start';

export const FAILURE_COPY = {
  notFound: {
    title: 'Page not found',
    heading: 'This page isn’t here',
    reason: 'The address may be wrong, or what was here may have been taken down.',
    // The same reason LinkState gives, for the same reason: this page is
    // reached by typing as well as by clicking.
    why: 'We don’t say whether something was here and has gone, or was never here at all. The answer is the same either way, so a wrong address can’t be used to find out who is on Pitch.',
    action: WAY_BACK,
  },
  error: {
    title: 'Something went wrong',
    heading: 'Something went wrong at our end',
    reason: 'This is a fault on Pitch, not something you did.',
    why: 'Trying again often works. If it keeps happening, there is a way to tell us at the foot of every screen.',
    action: 'Try again',
    home: WAY_BACK,
  },
  // D-94 §2 requires the response to be IDENTICAL whether or not the account
  // exists — not that it be silent. signIn() used to end in redirect('/home')
  // on every path, so a mistyped password landed on "Welcome back" and read
  // as an outage. One line, the same line for every cause, tells the truth
  // and leaks nothing. The design seat's words.
  signInRefused: 'That didn’t work. Check the email address and the password and try again.',
  // /coach/edit?needs=profile added zero words: an action ran before the
  // coach page existed and the screen came back looking as though the press
  // had done nothing.
  coachNeedsProfile: 'We couldn’t save that — there is no coach page to save it to yet. Put your name and region in below and save, then add it again.',
  reportDone: {
    title: 'Report received',
    // The words are the ones already on the screen. What changes is that the
    // heading is a heading (h1 was 0, so a screen reader announced nothing),
    // and the urgent line moves ABOVE the thanks out of the lowest-contrast
    // style on the page.
    heading: 'We’ve received your report',
    // HC3 (John, BUZ, 1 Oct): the form, this page and doc 25 say it word for
    // word the same — doc 25's sentence. "Your local police" is a research
    // task set at the moment somebody has least capacity for one; 000 is a
    // number. In an emergency people do the last thing a screen told them, so
    // there is one instruction, and no second number beside it (no 131 444).
    urgent: 'If you believe a child is in immediate danger, call 000. Pitch is not an emergency service.',
    thanks: 'Thanks — we have your report and a person will look at it. We aim to respond within one business day.',
    // The confirmation had no way off it at all: HeaderMark draws the mark and
    // nothing on the left, and the site footer offers Privacy, Terms and
    // Report a page. A person who had just reported a concern about a child was
    // stuck on the screen — found by the layout check, in a real browser.
    action: WAY_BACK,
  },
} as const;

/** The 56px glyph tile: the failure shell's, LinkState's, and the first object
 *  on every door reached from an email or a text (spec G, `.glyph-tile` in
 *  globals.css). Stroke SVG only — never emoji. At the charter's card radius:
 *  18 was not a charter value (spec A part 22).
 *
 *  Three states, and the state is the CALLER's, never derived here:
 *    ask  — solid: the link asks for something (and the failure shell);
 *    done — solid with the tick: what was asked is done;
 *    dead — dashed: the link is not live, nothing to act on here (Head of
 *           Product Design ruling 4).
 *  On a D-77 surface the caller passes one constant, so the tile cannot
 *  differ between kinds of dead link. */
export function GlyphTile({ state = 'ask', children }: { state?: 'ask' | 'done' | 'dead'; children: ReactNode }) {
  return (
    <div>
      <div className={state === 'dead' ? 'glyph-tile is-dashed' : 'glyph-tile'}>
        {children}
        {state === 'done' && (
          <span className="glyph-tick" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5 l4 4 L18 8" /></svg>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The failure shell: the top bar, then glyph, heading, reason, the sunken
 * card that says why there is no more, then the way out. `kind` is the marker
 * the checks read; it is NOT a reason, and nothing here branches on it.
 *
 * Floodlit (spec A part 22): the logo-only top bar (top right on a phone, top
 * left from 1024px, D-173 (3)), the page title and the well, and the way
 * out's primary carries the screen's one glow (set by the caller). The mark
 * links home (HD2, BUZ 1 Oct): a way off every accident page. It is the one
 * door the bar adds, and it is the same on every failure screen, so it can
 * say nothing about what was missing.
 */
export default function FailureState({ kind, glyph, heading, reason, why, children }: {
  kind: 'not-found' | 'error';
  glyph: ReactNode;
  heading: string;
  reason: string;
  why: string;
  children: ReactNode;
}) {
  return (
    <div data-failure={kind} className="floodlight has-topbar" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', flexDirection: 'column' }}>
      <SiteNav links={[]} signIn={false} />
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <GlyphTile>{glyph}</GlyphTile>
        <div className="pg-titles">
          <h1 className="pg-title">{heading}</h1>
          <div className="pg-sub">{reason}</div>
        </div>
        <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{why}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
      </div>
    </div>
  );
}

/** A circle with nothing in it: there is no page here. */
export const NOT_FOUND_GLYPH = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M8.5 12 h7" /></svg>
);

/** A loop that did not close: something broke on the way. */
export const ERROR_GLYPH = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12 a8 8 0 1 1 -2.4 -5.7" /><path d="M20 4 v3.4 h-3.4" /></svg>
);
