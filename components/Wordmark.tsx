import { T } from '@/lib/palette';

// The Pitch emblem — identical to the coming-soon site's wordmark (BUZ,
// 4 Sep: the new emblem is THE emblem). "P" + the pitch glyph as the I +
// "TCH". Placement rule unchanged: top right corner on every screen.
export default function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: size, letterSpacing: '-.035em', color: T.ink, lineHeight: 1 }}>
      P
      <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none">
        <line x1="37" y1="6.5" x2="37" y2="90.5" stroke={T.accent} strokeWidth="13" strokeLinecap="round" />
        <circle cx="37" cy="48.5" r="32" fill="none" stroke={T.accent} strokeWidth="10" />
      </svg>
      TCH
    </div>
  );
}

// The header row every app screen renders. On a phone the wordmark stays hard
// right (BUZ, 24 Aug); from 1024px D-173 (3) moves the logo top left — into
// the rail on a framed page, into the top bar on an unframed one — and the
// left of this row is where a way out belongs, at every width.
//
// WHY IT IS HERE AND NOT AT THE BOTTOM OF EACH PAGE. Twenty signed-in screens
// had no link out at all: the whole build flow, all six guardian screens, the
// club's billing and trial screens, the coach editor and the operator
// console. On the web the browser's back button hides that. This is an
// INSTALLABLE app — manifest, icons, iOS meta — and in standalone mode there
// is no browser chrome, so a parent who opened Manage was simply stuck.
//
// Top-left, because someone looking for the exit does not scroll to the foot
// of a long form to find it.
export function HeaderMark({ back }: { back?: { href: string; label?: string } }) {
  // The page header (spec A part 6): the values that were inline here are
  // .pg-head and .pg-back now, unchanged. Two things the classes add: inside
  // a seat frame the rail carries the mark from 1024px (D-173 (3)), so the
  // column's copy goes there; and under a top bar (.has-topbar) it goes at
  // every width. A header with no back link and no mark has nothing left to
  // show, so it goes too. On a phone nothing moves: back left, logo right.
  return (
    <div className="pg-head">
      {back ? (
        <a href={back.href} className="pg-back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
          {back.label ?? 'Back'}
        </a>
      ) : <span />}
      <span className="pg-head-mark"><Wordmark size={20} /></span>
    </div>
  );
}
