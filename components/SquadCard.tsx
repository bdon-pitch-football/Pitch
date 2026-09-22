// Where a player plays, on the family's own screens (0052, D-158).
//
// Four states, one card: nothing yet, asked and waiting on the club, in a
// squad, and a club has asked them. A club appears on a public CV only from
// the middle one — a confirmed membership — which is why this card exists at
// all: a player cannot type a club in, and nothing else could write it.
import { db } from '@/lib/db';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';
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
  const ghost: React.CSSProperties = { height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={sectionLabel}>{mine ? 'Where you play' : `Where ${firstName} plays`}</div>

      {/* Nothing is reported as done unless it was done (N3). A club can be
          suspended between the ask and the answer, and the answer then does
          not go through. */}
      {said === 'error' && (
        <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 12.5, fontWeight: 700, color: T.secondary, lineHeight: 1.5 }}>
          That didn&rsquo;t go through. Nothing changed &mdash; try again, and if it keeps happening the club may no longer be on Pitch.
        </div>
      )}

      {invites.map((i) => (
        <div key={i.id} style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{i.club} would like {they === 'you' ? 'you' : they} in {i.squad}</div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
              Saying yes puts {i.squad} on {mine ? 'your' : `${firstName}’s`} page and lets that club’s coaches for this team read {mine ? 'your' : 'their'} record. Doing nothing is a complete answer.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <form action={answerSquadInvitation} style={{ flex: 1, display: 'flex' }}>
              <input type="hidden" name="invitationId" value={i.id} /><input type="hidden" name="answer" value="yes" /><input type="hidden" name="back" value={back} />
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Yes, {mine ? 'I play' : `${firstName} plays`} there</button>
            </form>
            <form action={answerSquadInvitation} style={{ display: 'flex' }}>
              <input type="hidden" name="invitationId" value={i.id} /><input type="hidden" name="answer" value="no" /><input type="hidden" name="back" value={back} />
              <button type="submit" style={ghost}>Not this one</button>
            </form>
          </div>
        </div>
      ))}

      {now ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{now.club}</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[now.squad, now.season].filter(Boolean).join(' · ')} · on {mine ? 'your' : 'their'} page</div>
          </div>
          <form action={leaveSquad}>
            <input type="hidden" name="personId" value={personId} /><input type="hidden" name="back" value={back} />
            <button type="submit" style={ghost}>Leave</button>
          </form>
        </div>
      ) : claim ? (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Waiting on {claim.club}</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>{claim.squad} · it shows on the page once they confirm it</div>
          </div>
          <form action={withdrawClaim}>
            <input type="hidden" name="personId" value={personId} /><input type="hidden" name="claimId" value={claim.id} /><input type="hidden" name="back" value={back} />
            <button type="submit" style={ghost}>Cancel</button>
          </form>
        </div>
      ) : (
        <a href={`/squad/${personId}${back.startsWith('/g/') ? '?back=controls' : ''}`} className="lift"
          style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none', color: T.ink, minHeight: 56 }}>
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>Add {mine ? 'your' : 'their'} club</span>
            <span style={{ display: 'block', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Pick the club and team {they === 'you' ? 'you play' : `${firstName} plays`} for. They confirm it, and the page shows it.</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6 l6 6 -6 6" /></svg>
        </a>
      )}
    </div>
  );
}
