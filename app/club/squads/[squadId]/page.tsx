// One squad, and who is in it (0052, D-158 — free on every tier).
//
// Three lists, in the order a club works them: who is waiting on the club,
// who is in the squad, and who the club has asked. The read is the database's
// answer (fn_squad_roster): the technical director sees every squad, a coach
// sees the squads the club granted them, and an administrator sees the names
// and no way through to a record (D-93).
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ClubConsole } from '@/components/console-shell';
import { HeaderMark } from '@/components/Wordmark';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { T } from '@/lib/palette';
import { card, fieldLabel } from '@/lib/ui';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { answerClaim, cancelInvitation, inviteToSquad, removeFromSquad } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Squad', robots: { index: false, follow: false } };

type Player = {
  player_id: string; first_name: string; last_name: string | null;
  positions: string[] | null; position_group: string | null; squad_number: number | null;
  foot: string | null; record_id: string | null; joined_at: string;
  clips: number | null; apps: number | null; goals: number | null; assists: number | null;
  clean_sheets: number | null; on_register: boolean;
};

// A team sheet reads keepers first. The player's OWN order inside their
// positions is first choice, second, third (D-69) — the club is being shown
// what the player said, not a guess.
const GROUPS: [string, string, string][] = [
  ['GK', 'Goalkeepers', 'Goalkeeper'], ['DEF', 'Defenders', 'Defender'], ['MID', 'Midfielders', 'Midfielder'],
  ['FWD', 'Forwards', 'Forward'], ['UNSET', 'No position picked yet', 'No position picked yet'],
];
const CHOICE = ['1st', '2nd', '3rd'];
const posLabel = (code: string) => (code in POSITIONS ? POSITIONS[code as PositionCode].label : code);

export default async function SquadPage({ params, searchParams }: {
  params: Promise<{ squadId: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { squadId } = await params;
  const { done, error } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(squadId)) notFound();

  const squad = (await db.query(
    `select s.id, s.name, s.age_group, s.competition_gender, s.season, s.club_id, c.name as club_name,
            fn_can_work_squads($2, s.club_id) as works, fn_can_work_register($2, s.club_id) as td
     from squad s join club c on c.id = s.club_id where s.id = $1`,
    [squadId, me],
  )).rows[0] as {
    id: string; name: string; age_group: string | null; competition_gender: string | null; season: string;
    club_id: string; club_name: string; works: boolean; td: boolean;
  } | undefined;
  if (!squad) notFound();

  const players = (await db.query(`select * from fn_squad_roster($1, $2)`, [me, squadId])).rows as Player[];
  // Nobody may read this squad at all: the same answer as a squad that is not
  // there (D-77 applied to a club surface).
  const canRead = squad.works || squad.td || players.length > 0;
  if (!canRead) {
    const granted = await db.query(`select 1 from fn_register_grant_squads($1, $2) g where g = $3`, [me, squad.club_id, squadId]);
    if (granted.rows.length === 0) notFound();
  }

  const claims = squad.works ? (await db.query(
    `select sc.id, p.first_name, p.last_name, to_char(sc.created_at at time zone 'Australia/Melbourne', 'FMDD Mon') as asked
     from squad_claim sc join person p on p.id = sc.person_id
     where sc.squad_id = $1 and sc.answered_at is null and not fn_person_hidden(p.id)
     order by sc.created_at`, [squadId],
  )).rows as { id: string; first_name: string; last_name: string | null; asked: string }[] : [];

  const asked = squad.works ? (await db.query(
    `select si.id, p.first_name, p.last_name, to_char(si.created_at at time zone 'Australia/Melbourne', 'FMDD Mon') as sent
     from squad_invitation si join person p on p.id = si.person_id
     where si.squad_id = $1 and si.answered_at is null and not fn_person_hidden(p.id)
     order by si.created_at`, [squadId],
  )).rows as { id: string; first_name: string; last_name: string | null; sent: string }[] : [];

  // Who the club may ask: its own register, minus anyone already in this
  // squad or already asked. A club can never reach a child it has not been
  // shown (D-100), so the register is the only source.
  const askable = squad.td ? (await db.query(
    `select r.player_id as id, p.first_name, p.last_name
     from registration r join person p on p.id = r.player_id
     where r.club_id = $1 and r.withdrawn_at is null and not fn_person_hidden(p.id)
       and not exists (select 1 from membership m where m.person_id = r.player_id and m.squad_id = $2
                         and m.role = 'player' and m.ended_at is null)
       and not exists (select 1 from squad_invitation si where si.person_id = r.player_id and si.squad_id = $2 and si.answered_at is null)
     -- whoever named this squad first, then the rest of the register: a club
     -- puts a player where it needs them, not where the form guessed.
     order by (r.squad_target = $2) desc, p.first_name limit 60`, [squad.club_id, squadId],
  )).rows as { id: string; first_name: string; last_name: string | null }[] : [];

  const label = fieldLabel;
  const name = (p: { first_name: string; last_name: string | null }) => `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`;
  // Whether this reader gets what is on the record: the database already
  // decided by answering with a record id, or not (0053).
  const reads = players.some((p) => p.record_id !== null) || (players.length === 0 && (squad.td || squad.works));
  const byGroup = (g: string) => players.filter((p) => (p.position_group ?? 'UNSET') === g);
  // 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
  const since = (iso: string) => new Date(iso)
    .toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Melbourne' })
    .replace('Sept', 'Sep');
  const ghost: React.CSSProperties = { height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };
  const said: Record<string, string> = {
    confirmed: 'Confirmed. They’re in the squad, and their CV says so.',
    declined: 'Left as it was. Nobody is told they were turned down.',
    asked: 'Asked. It’s waiting in their account — we told them nothing by email.',
    cancelled: 'Taken back.',
    removed: 'Out of this squad. Their record is theirs and nothing was deleted.',
  };

  return (
    <ClubConsole active="squads">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/club/squads', label: 'Squads' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{squad.name}</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>
            {[squad.age_group, squad.competition_gender, squad.season].filter(Boolean).join(' · ')} · <b style={{ color: T.ink }}>{players.length} playing</b>
          </div>
        </div>

        {done && said[done] && <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>{said[done]}</div>}
        {error && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That didn’t go through. They may already be in this squad.</div>}

        {claims.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 style={label}>Waiting on you</h2>
            {claims.map((cl) => (
              <div key={cl.id} style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{name(cl)} says they play here</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Asked {cl.asked} · their family sent this</div>
                </div>
                <div style={{ display: 'flex', gap: 9 }}>
                  <form action={answerClaim} style={{ flex: 1, display: 'flex' }}>
                    <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="claimId" value={cl.id} /><input type="hidden" name="answer" value="yes" />
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Yes, they play here</button>
                  </form>
                  <form action={answerClaim} style={{ display: 'flex' }}>
                    <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="claimId" value={cl.id} /><input type="hidden" name="answer" value="no" />
                    <button type="submit" style={ghost}>Not this squad</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 style={label}>In this squad</h2>
          {players.length === 0 ? (
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              Nobody yet. Families ask to join from their own page, and you can ask anyone on your register below.
            </div>
          ) : (
            <>
              {/* The shape of the squad, before the names: what a coach looks
                  for first is whether they have a keeper. */}
              {reads && (
                <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {GROUPS.filter(([g]) => g !== 'UNSET').map(([g, many, one]) => (
                    <div key={g}>
                      <div className="tnum" style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: byGroup(g).length ? T.ink : T.muted }}>{byGroup(g).length}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{byGroup(g).length === 1 ? one : many}</div>
                    </div>
                  ))}
                  {byGroup('UNSET').length > 0 && (
                    <div>
                      <div className="tnum" style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: T.amber }}>{byGroup('UNSET').length}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>No position yet</div>
                    </div>
                  )}
                </div>
              )}

              {(reads ? GROUPS : [['UNSET', '', ''] as [string, string, string]]).map(([g, title]) => {
                const inGroup = reads ? byGroup(g) : players;
                if (inGroup.length === 0) return null;
                return (
                  <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {reads && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.secondary, marginTop: 4 }}>{title}</div>}
                    {inGroup.map((p) => {
                      // The never-zero rule, on the club's list as on the page
                      // (D-70): a stat nobody has is left out, never shown as 0.
                      const stats: { label: string; value: number }[] = [];
                      const stat = (label: string, v: number | null) => { if ((v ?? 0) > 0) stats.push({ label, value: v as number }); };
                      stat('apps', p.apps);
                      if (p.position_group === 'GK') stat('clean sheets', p.clean_sheets);
                      else { stat('goals', p.goals); stat('assists', p.assists); }
                      return (
                        <div key={p.player_id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {reads && (
                              <div aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: T.surface2, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="tnum" style={{ fontSize: 15, fontWeight: 900, color: p.squad_number ? T.ink : T.muted, letterSpacing: '-0.04em' }}>{p.squad_number ?? '—'}</span>
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800 }}>{name(p)}</div>
                              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
                                {[reads && p.foot ? `${p.foot} footed` : null,
                                  `In the squad since ${since(p.joined_at)}`,
                                  p.on_register ? 'On your register' : null].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            {p.record_id && (
                              <Link href={`/club/squads/${squadId}/cv/${p.player_id}`} style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center' }}>Open the CV</Link>
                            )}
                            {squad.works && (
                              <form action={removeFromSquad}>
                                <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="personId" value={p.player_id} />
                                <button type="submit" style={ghost}>Remove</button>
                              </form>
                            )}
                          </div>

                          {reads && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                              {(p.positions ?? []).length === 0 ? (
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>No positions picked yet</span>
                              ) : (p.positions ?? []).map((code, i) => (
                                <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px', background: i === 0 ? 'rgba(61,220,132,.14)' : T.surface2, border: `1px solid ${i === 0 ? T.accent : T.line}` }}>
                                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: i === 0 ? T.accent : T.muted }}>{CHOICE[i]}</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{posLabel(code)}</span>
                                </span>
                              ))}
                              {(p.clips ?? 0) > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: T.secondary }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 7.5 L17 12 L9 16.5 Z" /><rect x="3" y="4" width="18" height="16" rx="3" /></svg>
                                  {p.clips} {p.clips === 1 ? 'clip' : 'clips'}
                                </span>
                              )}
                            </div>
                          )}

                          {reads && stats.length > 0 && (
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: `1px solid ${T.line}`, paddingTop: 9 }}>
                              {stats.map((x) => (
                                <div key={x.label}>
                                  <span className="tnum" style={{ fontSize: 15, fontWeight: 900, color: T.ink, letterSpacing: '-0.04em' }}>{x.value}</span>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginLeft: 5 }}>{x.label}</span>
                                </div>
                              ))}
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginLeft: 'auto' }}>2026 · self-reported</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
          {!reads && players.length > 0 && (
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              You run the club page, the squads and the notices. What a player put in their record is for the technical director and that squad&rsquo;s own coaches.
            </div>
          )}
          {reads && !squad.works && players.length > 0 && (
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              Your club gave you this squad. Every CV you open here is recorded, and the family can see who read it.
            </div>
          )}
        </div>

        {asked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 style={label}>Asked, waiting on them</h2>
            {asked.map((a) => (
              <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>{name(a)}</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Asked {a.sent} · nothing happens unless they say yes</div>
                </div>
                <form action={cancelInvitation}>
                  <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="invitationId" value={a.id} />
                  <button type="submit" style={ghost}>Take it back</button>
                </form>
              </div>
            ))}
          </div>
        )}

        {squad.td && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 style={label}>Ask someone from your register</h2>
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              For an under-16 it goes to their parent. From 16 the player answers, and their parent sees it too. Nothing reaches you unless they say yes.
            </div>
            {askable.length === 0 ? (
              <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500 }}>Nobody on your register is waiting for this squad.</div>
            ) : askable.map((a) => (
              <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{name(a)}</div>
                <form action={inviteToSquad}>
                  <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="personId" value={a.id} />
                  <button type="submit" style={{ ...ghost, color: T.accent, borderColor: T.accent }}>Ask them</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClubConsole>
  );
}
