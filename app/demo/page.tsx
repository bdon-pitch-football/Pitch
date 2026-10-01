// The demo's front door (BUZ, 19 Sep): pick a seat, one tap, no password.
// Exists only when the app was started by `npm run demo` (lib/demo).
//
// Floodlit (J, BUZ 1 Oct): the seat list is the sign-up role card — a stroke
// glyph, the seat in muted caps (it was green, and green is an action), the
// name, what they do — two-up from 640px in the 390 reading order. The head
// carries the club's crest tile (J-P2): a claimed club's own crest, or for
// --unclaimed the dashed initials tile and never an image (D-172). There is no
// primary on this page: every seat is a choice and none is the next step, so
// nothing glows. The words are the 23 Sep approved ones, unchanged.
import { notFound } from 'next/navigation';
import SiteNav from '@/components/floodlit/SiteNav';
import { ICONS } from '@/components/console-shell';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';
import { takeSeat } from './actions';
import { SEATS } from './seats';

export const metadata = { title: 'Demo', robots: { index: false, follow: false } };

// One stroke glyph per seat, from the frames' own set (console-shell ICONS).
// The club we haven't rung yet is a lock: its register is held (D-126). The
// set has no lock, so it is drawn here in the same stroke.
const LOCK = <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>;
const GLYPH: Record<(typeof SEATS)[number]['key'], React.ReactNode> = {
  td: ICONS.register, admin: ICONS.crest, coach: ICONS.roles, held: LOCK,
  parent: ICONS.children, teen: ICONS.cv, adult: ICONS.cv,
};

const Chevron = () => (
  <span className="ch">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6 l6 6 -6 6" /></svg>
  </span>
);

// "Riverside FC" → "RF": the unclaimed club page's tile carries letters, never a picture.
const initials = (s: string) =>
  s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0].toUpperCase()).join('').slice(0, 3);

export default async function Demo() {
  if (!isDemo()) notFound();
  const club = (await db.query(
    `select name, public_slug, club_state, crest_path from club where crest_path like '/dev-uploads/demo-crest-%' limit 1`,
  )).rows[0] as { name: string; public_slug: string; club_state: string; crest_path: string | null } | undefined;
  const name = club?.name ?? 'Your club';
  // npm run demo -- … --unclaimed: nobody has claimed the page yet, so there
  // are no club seats to sit in. The story is the claim itself.
  const unclaimed = club?.club_state === 'unclaimed';
  const seats = unclaimed ? SEATS.filter((s) => s.key === 'parent' || s.key === 'teen' || s.key === 'adult') : SEATS;
  // D-172: an unclaimed club shows nothing that is an image, whatever is
  // stored — the demo layer still writes a crest_path for it, which is how
  // this page finds the demo's club at all.
  const crest = !unclaimed && club?.crest_path ? club.crest_path : null;

  const open: [string, string, string][] = unclaimed
    ? [
      [`/fc/${club?.public_slug ?? ''}`, `${name}’s page`, 'The listing we built from their public notices. Nobody at the club has claimed it.'],
      [`/claim/${club?.public_slug ?? ''}`, `Claim ${name}`, 'Prove it is your club with a code to the club’s own address, then the page is yours.'],
      ['/trials', 'The trials board', 'Every trial, filtered by age group, gender and position.'],
      ['/dev/outbox', 'The club’s inbox', 'Every email and text Pitch sends, word for word — including the claim code.'],
    ]
    : [
      [`/fc/${club?.public_slug ?? ''}`, `${name}’s page`, 'What families see before they register interest.'],
      ['/trials', 'The trials board', 'Every trial, filtered by age group, gender and position.'],
      ['/p/dev-deniz', 'A player’s CV', 'What reaches the club when a family sends it.'],
      ['/dev/outbox', 'What families receive', 'The texts and emails Pitch sends, word for word.'],
    ];

  const linkCard = ([href, title, what]: [string, string, string]) => (
    <a key={href} href={href} className="choice">
      <span className="main">
        <span className="t">{title}</span>
        <span className="s">{what}</span>
      </span>
      <Chevron />
    </a>
  );

  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)' }}>
      {/* The top bar, logo only and not a link — as HeaderMark was here. */}
      <SiteNav links={[]} signIn={false} homeLink={false} />
      <main className="fl-wide demo-flow">
        <div className="reading demo-col">
          <div className="demo-head">
            {crest
              ? <div className="demo-tile demo-tile-crest"><img src={crest} alt="" width={52} height={52} /></div>
              : <div className="demo-tile empty-tile" aria-hidden="true">{initials(name)}</div>}
            <div className="pg-titles" style={{ minWidth: 0 }}>
              <h1 className="pg-title" style={{ textWrap: 'balance' }}>Pitch for {name}</h1>
              <div className="pg-sub">
                {unclaimed
                  ? `Nobody at ${name} has claimed the page yet. Start at the top — the club seats appear once it is claimed.`
                  : 'Choose a seat. You can switch at any time from the bar at the top.'}
              </div>
            </div>
          </div>

          {unclaimed && (
            <section className="demo-sec">
              <h2 className="sec-h">Start here</h2>
              <div className="choices">{open.slice(0, 2).map(linkCard)}</div>
            </section>
          )}

          <section className="demo-sec">
            <h2 className="sec-h">Sign in as</h2>
            <div className="choices two">
              {seats.map((s) => (
                <form key={s.key} action={takeSeat}>
                  <input type="hidden" name="seat" value={s.key} />
                  <button type="submit" className="choice">
                    <span className="ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH[s.key]}</svg>
                    </span>
                    <span className="main">
                      <span className="k">{s.who}</span>
                      <span className="t">{s.name}</span>
                      <span className="s">{s.what}</span>
                    </span>
                    <Chevron />
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="demo-sec">
            <h2 className="sec-h">Open without signing in</h2>
            <div className="choices two">{(unclaimed ? open.slice(2) : open).map(linkCard)}</div>
          </section>

          <p className="demo-foot">
            Every player, parent and coach here is made up. Nothing in this demo sends an email or a text, or takes a payment.
          </p>
        </div>
      </main>
    </div>
  );
}
