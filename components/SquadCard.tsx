// Where a player plays, on the family's own screens (0052, D-158).
//
// Four states, one card: nothing yet, asked and waiting on the club, in a
// squad, and a club has asked them. A club appears on a public CV only from
// the middle one — a confirmed membership — which is why this card exists at
// all: a player cannot type a club in, and nothing else could write it.
import { db } from '@/lib/db';
import { answerSquadInvitation, leaveSquad, withdrawClaim } from '@/app/squad/actions';

type Row = { club: string; squad: string; age_group: string | null; season: string | null };

export default async function SquadCard({ personId, firstName, back, mine, said }: {
  personId: string; firstName: string; back: string; mine: boolean; said?: string;
}) {
  const now = (await db.query(
    `select c.name as club, s.name as squad, s.age_group, s.season
     from membership m join club c on c.id = m.club_id join squad s on s.id = m.squad_id
     where m.person_id = $1 and m.role = 'player' and m.ended_at is null limit 1`,
    [personId],
  )).rows[0] as Row | undefined;

  const claim = (await db.query(
    `select sc.id, c.name as club, s.name as squad
     from squad_claim sc join club c on c.id = sc.club_id join squad s on s.id = sc.squad_id
     where sc.person_id = $1 and sc.answered_at is null order by sc.created_at limit 1`,
    [personId],
  )).rows[0] as { id: string; club: string; squad: string } | undefined;

  // An invitation the club has taken back, or one that has lapsed at thirty
  // days, is not something to answer (0054).
  const invites = (await db.query(
    `select si.id, c.name as club, s.name as squad
     from squad_invitation si join club c on c.id = si.club_id join squad s on s.id = si.squad_id
     where si.person_id = $1 and si.answered_at is null
       and si.withdrawn_at is null and si.lapsed_at is null
     order by si.created_at`,
    [personId],
  )).rows as { id: string; club: string; squad: string }[];

  const they = mine ? 'you' : firstName;

  return (
    <div className="c-gap">
      <h2 className="sec-h">{mine ? 'Where you play' : `Where ${firstName} plays`}</h2>

      {/* Nothing is reported as done unless it was done (N3). A club can be
          suspended between the ask and the answer, and the answer then does
          not go through. */}
      {said === 'error' && (
        <div role="alert" className="card card-amber c-say">
          That didn&rsquo;t go through. Nothing changed &mdash; try again, and if it keeps happening the club may no longer be on Pitch.
        </div>
      )}

      {invites.map((i) => (
        // A club's invitation is a question, not an action, so its panel has
        // no green edge (spec D, controls; mockup k-georgia).
        <div key={i.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="row-t" style={{ fontSize: 15 }}>{i.club} would like {they === 'you' ? 'you' : they} in {i.squad}</div>
            <div className="c-s2" style={{ marginTop: 3 }}>
              Saying yes puts {i.squad} on {mine ? 'your' : `${firstName}’s`} page and lets that club’s coaches for this team read {mine ? 'your' : 'their'} record. Doing nothing is a complete answer.
            </div>
          </div>
          {/* D-PD-0: putting a child in a squad gives something away, so Yes
              and No are the same secondary, the same size, and nothing glows.
              Both are the forms they always were, fields in the same order. */}
          <div className="fl-answer">
            <form action={answerSquadInvitation}>
              <input type="hidden" name="invitationId" value={i.id} /><input type="hidden" name="answer" value="yes" /><input type="hidden" name="back" value={back} />
              <button type="submit" className="btn btn-secondary">Yes, {mine ? 'I play' : `${firstName} plays`} there</button>
            </form>
            <form action={answerSquadInvitation}>
              <input type="hidden" name="invitationId" value={i.id} /><input type="hidden" name="answer" value="no" /><input type="hidden" name="back" value={back} />
              <button type="submit" className="btn btn-secondary">Not this one</button>
            </form>
          </div>
        </div>
      ))}

      {/* List rows (spec A part 13): "Leave" and "Cancel" are the table-row
          button, not a hand-built third button. */}
      {now ? (
        <div className="card row">
          <div className="row-main">
            <div className="row-t" style={{ fontSize: 15 }}>{now.club}</div>
            <div className="row-s">{[now.squad, now.season].filter(Boolean).join(' · ')} · on {mine ? 'your' : 'their'} page</div>
          </div>
          <form action={leaveSquad}>
            <input type="hidden" name="personId" value={personId} /><input type="hidden" name="back" value={back} />
            <button type="submit" className="console-btn">Leave</button>
          </form>
        </div>
      ) : claim ? (
        <div className="card row">
          <div className="row-main">
            <div className="row-t" style={{ fontSize: 15 }}>Waiting on {claim.club}</div>
            <div className="row-s">{claim.squad} · it shows on the page once they confirm it</div>
          </div>
          <form action={withdrawClaim}>
            <input type="hidden" name="personId" value={personId} /><input type="hidden" name="claimId" value={claim.id} /><input type="hidden" name="back" value={back} />
            <button type="submit" className="console-btn">Cancel</button>
          </form>
        </div>
      ) : (
        <a href={`/squad/${personId}${back.startsWith('/g/') ? '?back=controls' : ''}`} className="card row lift">
          <span className="row-main">
            <span className="row-t" style={{ fontSize: 15 }}>Add {mine ? 'your' : 'their'} club</span>
            <span className="row-s">Pick the club and team {they === 'you' ? 'you play' : `${firstName} plays`} for. They confirm it, and the page shows it.</span>
          </span>
          <span className="row-chev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6 l6 6 -6 6" /></svg></span>
        </a>
      )}
    </div>
  );
}
