// The club, named on the claim's first step and on the sign-in door that
// carries a claim (F7): the club page's initials tile and, while nobody has
// claimed it, the dashed "not yet" edge and the Unclaimed pill. Never a crest,
// a photo or a colour (D-172) — this takes the name and the place and nothing
// else, so it cannot draw one.
export const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

export function ClubRow({ name, where, unclaimed }: { name: string; where: string; unclaimed: boolean }) {
  return (
    <div className="card clubrow">
      <div className={unclaimed ? 'club-tile empty-tile' : 'club-tile'} aria-hidden="true">{initials(name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clubrow-n">{name}</div>
        {where && <div className="clubrow-w">{where}</div>}
      </div>
      {unclaimed && <span className="pill pill-wait">Unclaimed</span>}
    </div>
  );
}
