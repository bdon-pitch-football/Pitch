// One trial, as a family sees it on the board (Floodlit, D-173 as extended
// 1 Oct). Drawn as the club page's trial row (app/fc/[slug]): the date leads
// with the same 28px numeral and month, the title and the time and place
// follow, and the stamps sit under them. "Listed" is the board's alone, so it
// is a prop.
//
// The row's one action is on the charter's two buttons: "I'm interested" is
// the primary, "Send my CV" the secondary — never a third, pill-shaped one.
// The club's own notice is the club's link (John, 30 Sep): its words are the
// link's only content, so the render suite reads it as it reads the club
// page's (link-n1, link-n2), and the external mark is drawn by the stylesheet.
import Link from 'next/link';

export type TrialRowProps = {
  id: string;
  day: string;
  mon: string;
  title: string;
  timeVenue: string;
  listed?: string;
  checked: string;
  notice: string | null;
  // The club's state: verified and claimed clubs have a register (D-90,
  // D-126); a claimed club carries no label, as its own page carries none
  // (doc 14 M9).
  clubState: 'verified' | 'claimed' | 'unclaimed' | string;
  slug: string | null;
};

export default function TrialRow({ id, day, mon, title, timeVenue, listed, checked, notice, clubState, slug }: TrialRowProps) {
  const verified = clubState === 'verified';
  const onPitch = verified || clubState === 'claimed';
  const label = verified ? 'On Pitch — verified club' : !onPitch ? 'Unclaimed listing · register via club' : null;
  return (
    <article className="fl-card fl-trial">
      <div className="fl-trial-date">
        <div className="numeral fl-trial-day">{day}</div>
        <div className="fl-trial-mon">{mon}</div>
      </div>
      <div className="fl-trial-main">
        <div className="fl-trial-title">{title}</div>
        <div className="fl-trial-meta">{timeVenue}</div>
        <div className="fl-trial-stamp">
          <span>{listed ? `Listed ${listed} · checked ${checked}` : `checked ${checked}`}</span>
          {notice && <a href={notice} target="_blank" rel="noopener noreferrer" className="fl-own">The club&rsquo;s own notice</a>}
        </div>
      </div>
      {(label || slug) && (
        <div className={label ? 'fl-trial-foot' : 'fl-trial-foot solo'}>
          {label && <div className={verified ? 'fl-trial-state' : 'fl-trial-state un'}>{label}</div>}
          {/* They open the club's page at its door: the register of a club on
              Pitch, carrying this trial so the club can invite to it (D-153),
              or an unclaimed club's "send my CV". */}
          {slug && (onPitch
            ? <Link href={`/fc/${slug}?trial=${id}#play`} className="btn btn-primary fl-glow">I&rsquo;m interested</Link>
            : <Link href={`/fc/${slug}#play`} className="btn btn-secondary">Send my CV</Link>)}
        </div>
      )}
    </article>
  );
}
