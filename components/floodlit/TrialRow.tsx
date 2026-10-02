// One club, one day, as a family sees it on the board (trials board v2, BUZ
// 2 Oct: "yes"; Floodlit, D-173). The date leads — the weekday over the same
// 28px numeral and month — then the club, once, with its state beside its
// name, then a line per listing. A venue every line shares moves up under the
// club; so do the stamps and the club's own notice, into the foot, when every
// line shares them. Otherwise each line keeps its own. "Listed" is the
// board's alone, so it is a prop.
//
// Every listing is still its own <li data-listing>, so the board filters,
// counts and links listing by listing (D-162, D-153).
//
// The state, said once (John, 2 Oct): an unclaimed club's row carries one
// quiet "Unclaimed" in the grey state style, and its markup carries
// data-unclaimed on the row and on every line (D-64: the listing metadata).
// The sentence lives once, in the board's note. A verified club keeps "On
// Pitch — verified club" in green, its primary and no notice link — the two
// never look alike. A claimed club carries no label, as its own page carries
// none (doc 14 M9).
//
// The row's action is on the charter's two buttons, never a third. An
// unclaimed club's row has one "Send my CV", because every line's door is the
// same /fc/<slug>#play. A club on Pitch has a register, and each line's
// "I'm interested" carries its own trial (D-153); a one-line row carries it in
// the foot. The club's own notice is the club's link (John, 30 Sep): its words
// are the link's only content, and the external mark is the stylesheet's.
import Link from 'next/link';
import { splitTimeVenue } from '@/lib/trials-board';

export type TrialLine = {
  id: string;
  title: string;
  timeVenue: string;
  listed?: string;
  checked: string;
  notice: string | null;
};

export type TrialRowProps = {
  wd: string;
  day: string;
  mon: string;
  club: string;
  lines: TrialLine[];
  // verified and claimed clubs have a register (D-90, D-126).
  clubState: 'verified' | 'claimed' | 'unclaimed' | string;
  slug: string | null;
  // The club's own preview of its notice (/club/post-trial, P3, BUZ 1 Oct):
  // the row exactly as the board draws it, with the button inert and drawn
  // secondary, so the confirmation keeps no second primary and no new door.
  inert?: boolean;
  // With a distance set on the board (filters package, BUZ 2 Oct), how far
  // the club's suburb is, in whole km, worked out on the family's device. On
  // screen only: the stylesheet hides it in print (John, 2 Oct, Q2).
  about?: number;
};

const stampOf = (l: TrialLine) => (l.listed ? `Listed ${l.listed} · checked ${l.checked}` : `checked ${l.checked}`);
const flag = (on: boolean) => (on ? '' : undefined);

export default function TrialRow({ wd, day, mon, club, lines, clubState, slug, inert, about }: TrialRowProps) {
  const verified = clubState === 'verified';
  const onPitch = verified || clubState === 'claimed';
  const unclaimed = !onPitch;
  const parts = lines.map((l) => splitTimeVenue(l.timeVenue));
  const venue = parts.every((p) => p.venue !== null && p.venue === parts[0].venue) ? parts[0].venue : null;
  const sharedStamp = lines.every((l) => stampOf(l) === stampOf(lines[0]) && l.notice === lines[0].notice);
  // One door for the row, or one per line.
  const perLine = Boolean(slug) && onPitch && lines.length > 1;

  const stamp = (l: TrialLine) => (
    <div className="fl-trial-stamp">
      <span>{stampOf(l)}</span>
      {l.notice && <a href={l.notice} target="_blank" rel="noopener noreferrer" className="fl-own">The club&rsquo;s own notice</a>}
    </div>
  );
  // They open the club's page at its door: the register of a club on Pitch,
  // carrying this trial so the club can invite to it (D-153), or an
  // unclaimed club's "send my CV". The solid primary with no glow: the glow
  // is the screen's one primary action, never a button inside a list row
  // (Head of Product Design ruling 1, 1 Oct), so rows never compete.
  const door = (l: TrialLine) => {
    if (!slug) return null;
    if (inert) return <span className="btn btn-secondary" aria-hidden="true">{onPitch ? <>I&rsquo;m interested</> : 'Send my CV'}</span>;
    return onPitch
      ? <Link href={`/fc/${slug}?trial=${l.id}#play`} className="btn btn-primary">I&rsquo;m interested</Link>
      : <Link href={`/fc/${slug}#play`} className="btn btn-secondary">Send my CV</Link>;
  };
  const footDoor = perLine ? null : door(lines[0]);

  return (
    <article className="fl-card fl-trial" data-unclaimed={flag(unclaimed)}>
      <div className="fl-trial-date">
        <div className="fl-trial-wd">{wd}</div>
        <div className="numeral fl-trial-day">{day}</div>
        <div className="fl-trial-mon">{mon}</div>
      </div>
      <div className="fl-trial-main">
        <div className="fl-trial-club">
          <span className="fl-trial-cn">{club}</span>
          {verified && <span className="fl-trial-state">On Pitch — verified club</span>}
          {unclaimed && <span className="fl-trial-state un">Unclaimed</span>}
        </div>
        {venue && <div className="fl-trial-venue">{venue}</div>}
        <ul className={lines.length > 1 ? 'fl-trial-lines multi' : 'fl-trial-lines'}>
          {lines.map((l, i) => (
            <li key={l.id} className="fl-trial-line" data-listing="" data-unclaimed={flag(unclaimed)}>
              <div className="fl-trial-lx">
                <div className="fl-trial-lt">{l.title}</div>
                <div className="fl-trial-lm">{venue ? parts[i].time : l.timeVenue}</div>
                {!sharedStamp && stamp(l)}
              </div>
              {perLine && door(l)}
            </li>
          ))}
        </ul>
      </div>
      {(sharedStamp || footDoor || about) && (
        <div className={sharedStamp || about ? 'fl-trial-foot' : 'fl-trial-foot solo'}>
          {(sharedStamp || about) && (
            <div className="fl-trial-foot-l">
              {about && <span className="fl-trial-km">about {about} km</span>}
              {sharedStamp && stamp(lines[0])}
            </div>
          )}
          {footDoor}
        </div>
      )}
    </article>
  );
}
