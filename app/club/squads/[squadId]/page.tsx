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
import { POSITIONS, PROVENANCE_LABELS, provenanceLabel, sharedProvenance, type PositionCode } from '@/lib/football';
import { answerClaim, cancelInvitation, inviteToSquad, removeFromSquad } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Squad', robots: { index: false, follow: false } };

type Player = {
  player_id: string; first_name: string; last_name: string | null;
  positions: string[] | null; position_group: string | null; squad_number: number | null;
  foot: string | null; record_id: string | null; joined_at: string;
  clips: number | null; apps: number | null; goals: number | null; assists: number | null;
  clean_sheets: number | null; on_register: boolean;
  // D-62: the source of each number, from the row the number came from (0069).
  apps_provenance: string | null; goals_provenance: string | null;
  assists_provenance: string | null; clean_sheets_provenance: string | null;
};

// Which sources this screen may name. Every number on it carries its source
// (D-62), read from lib/football like the CV's, never typed here. "Self-
// reported" is approved; "Coach-verified" and "Official import" are waiting
// on BUZ (28 Sep) and are not said here until he approves them. A number
// whose source this screen may not name is left off the list — never shown
// without it — and stays one tap away on the CV. Today every stat in the
// product is self-reported, so nothing is left off yet.
const SOURCES_SAID_HERE = new Set<string>([PROVENANCE_LABELS.self_reported]);

// A team sheet reads keepers first. The player's OWN order inside their
// positions is first choice, second, third (D-69) — the club is being shown
// what the player said, not a guess.
const GROUPS: [string, string, string][] = [
  ['GK', 'Goalkeepers', 'Goalkeeper'], ['DEF', 'Defenders', 'Defender'], ['MID', 'Midfielders', 'Midfielder'],
  ['FWD', 'Forwards', 'Forward'], ['UNSET', 'No position picked yet', 'No position picked yet'],
];
const CHOICE = ['1st', '2nd', '3rd'];
// The closed position list, in the order a team sheet runs (doc 16, D-92).
const ORDER = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const posLabel = (code: string) => (code in POSITIONS ? POSITIONS[code as PositionCode].label : code);

export default async function SquadPage({ params, searchParams }: {
  params: Promise<{ squadId: string }>;
  searchParams: Promise<{ done?: string; error?: string; pos?: string }>;
}) {
  const { squadId } = await params;
  const { done, error, pos } = await searchParams;
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

  // Who is waiting on the club. This was the one read on this page that was
  // not the database's answer — an inline query behind a page-level boolean,
  // which is a second answer to "who may see this child" (0059, L23). It now
  // asks fn_squad_claims, which applies verification (D-126), the consent
  // behind the ask (A17/A18) and the same refusals the confirm will apply,
  // per row — and gives a first name only, exactly as the register does.
  const claims = (await db.query(
    `select claim_id as id, first_name,
            to_char(created_at at time zone 'Australia/Melbourne', 'FMDD Mon') as asked
     from fn_squad_claims($1, $2)`, [me, squadId],
  )).rows as { id: string; first_name: string; asked: string }[];

  // The people the club has asked. A family that answered no sits here
  // exactly as one that has not answered at all, until the club takes it back
  // or the thirty days run out — the club must never be able to tell silence
  // from a no (D-138, 0054).
  const asked = (await db.query(
    `select invitation_id as id, first_name,
            to_char(created_at at time zone 'Australia/Melbourne', 'FMDD Mon') as sent
     from fn_squad_asked($1, $2)`, [me, squadId],
  )).rows as { id: string; first_name: string; sent: string }[];

  // Who the club may ask: the register's OWN answer, per row (0054). The page
  // does not decide this — fn_squad_askable applies verification (D-126), the
  // subscription and dunning state (D-135) and P19's refusals, and gives a
  // first name only, exactly as the register itself does.
  // The positions are the ones the FAMILY gave when they registered their
  // interest — the same field the register shows a club, not anything extra
  // out of the child's record.
  const wanted = pos && pos in POSITIONS ? pos : '';
  const everyAskable = squad.td ? (await db.query(
    `select player_id as id, first_name, positions, named_this from fn_squad_askable($1, $2)`,
    [me, squadId],
  )).rows as { id: string; first_name: string; positions: string[] | null; named_this: boolean }[] : [];
  const matching = wanted ? everyAskable.filter((a) => (a.positions ?? []).includes(wanted)) : everyAskable;
  // A long register is paged by the position chips, and the page says so
  // rather than stopping at sixty in silence (QA F7, 22 Sep).
  const CAP = 60;
  const askable = matching.slice(0, CAP);
  const overCap = matching.length - askable.length;

  // Which positions the club can actually filter by here: the ones the people
  // it may ask play, never the whole list with nine dead chips on it.
  const askablePositions = [...new Set(everyAskable.flatMap((a) => a.positions ?? []))]
    .filter((c) => c in POSITIONS)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  const label = fieldLabel;
  const name = (p: { first_name: string; last_name: string | null }) => `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`;
  // Whether this reader gets what is on the record: the database already
  // decided by answering with a record id, or not (0053).
  // The technical director reads records by definition (D-93), so the layout
  // does not depend on there being a readable row: a squad whose only player
  // is an under-16 with no approved guardian answers with no record id for
  // anybody (0054), and that is a gap in the data, not a different reader.
  const reads = squad.td || players.some((p) => p.record_id !== null) || (players.length === 0 && squad.works);
  const byGroup = (g: string) => players.filter((p) => (p.position_group ?? 'UNSET') === g);
  // 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
  // 44px, like every other tap target at every width (CLAUDE.md, QA F4).
  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999,
    background: on ? T.accent : T.surface2, color: on ? T.onAccent : T.secondary,
    border: `1px solid ${on ? T.accent : T.line}`, fontSize: 12.5, fontWeight: on ? 800 : 700, textDecoration: 'none',
  });
  const since = (iso: string) => new Date(iso)
    .toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Melbourne' })
    .replace('Sept', 'Sep');
  const ghost: React.CSSProperties = { height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };
  const said: Record<string, string> = {
    confirmed: 'Confirmed. They’re in the squad, and their CV says so.',
    no: 'Left as it was. Nobody is told they were turned down.',
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
            {[squad.age_group, squad.competition_gender, squad.season].filter(Boolean).join(' · ')}{players.length > 0 && <> · <b style={{ color: T.ink }}>{players.length} playing</b></>}
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
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{cl.first_name} says they play here</div>
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
                  {/* D-162 bars the DIGIT, not the fact. "0 GOALKEEPERS" is the first
                      thing a coach looks for — whether they have a keeper — so the
                      absence stays on the tile, said in words instead of a zero. */}
                  {GROUPS.filter(([g]) => g !== 'UNSET').map(([g, many, one]) => (
                    <div key={g}>
                      {byGroup(g).length > 0 ? (
                        <>
                          <div className="tnum" style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color: T.ink }}>{byGroup(g).length}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{byGroup(g).length === 1 ? one : many}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.muted, minHeight: 36, display: 'flex', alignItems: 'flex-end' }}>No {one.toLowerCase()} yet</div>
                      )}
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
                      const stats: { label: string; value: number; provenance: string | null }[] = [];
                      const stat = (label: string, v: number | null, provenance: string | null) => {
                        if ((v ?? 0) > 0 && SOURCES_SAID_HERE.has(provenanceLabel(provenance))) stats.push({ label, value: v as number, provenance });
                      };
                      stat('apps', p.apps, p.apps_provenance);
                      if (p.position_group === 'GK') stat('clean sheets', p.clean_sheets, p.clean_sheets_provenance);
                      else { stat('goals', p.goals, p.goals_provenance); stat('assists', p.assists, p.assists_provenance); }
                      // As on the CV: one caption while every number shares a
                      // source, and a source on each number once they differ.
                      const shared = sharedProvenance(stats);
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
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginLeft: 5 }}>{shared ? x.label : `${x.label} · ${provenanceLabel(x.provenance).toLowerCase()}`}</span>
                                </div>
                              ))}
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginLeft: 'auto' }}>{shared ? `2026 · ${PROVENANCE_LABELS[shared].toLowerCase()}` : '2026'}</span>
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
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>{a.first_name}</div>
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
          <div id="ask" style={{ display: 'flex', flexDirection: 'column', gap: 9, scrollMarginTop: 18 }}>
            <h2 style={label}>Ask someone from your register</h2>
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              For an under-16 it goes to their parent. From 16 the player answers, and their parent sees it too. Nothing reaches you unless they say yes.
            </div>
            {askablePositions.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <a href={`/club/squads/${squadId}#ask`} style={chip(!wanted)}>Any position</a>
                {askablePositions.map((code) => (
                  <a key={code} href={`/club/squads/${squadId}?pos=${code}#ask`} style={chip(wanted === code)}>
                    {POSITIONS[code as PositionCode].label}
                  </a>
                ))}
              </div>
            )}
            {askable.length === 0 ? (
              <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500 }}>
                {wanted
                  ? `Nobody on your register plays ${POSITIONS[wanted as PositionCode].label.toLowerCase()} and is free for this squad.`
                  : 'Nobody on your register is waiting for this squad.'}
              </div>
            ) : askable.map((a) => (
              <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>{a.first_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {(a.positions ?? []).length === 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>No positions given</span>
                    ) : (a.positions ?? []).map((code, i) => (
                      <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '3px 9px', background: i === 0 ? 'rgba(61,220,132,.14)' : T.surface2, border: `1px solid ${i === 0 ? T.accent : T.line}` }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: i === 0 ? T.accent : T.muted }}>{CHOICE[i]}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{posLabel(code)}</span>
                      </span>
                    ))}
                    {a.named_this && <span style={{ fontSize: 11.5, fontWeight: 700, color: T.secondary }}>· asked for this team</span>}
                  </div>
                </div>
                <form action={inviteToSquad}>
                  <input type="hidden" name="squadId" value={squadId} /><input type="hidden" name="personId" value={a.id} />
                  <button type="submit" style={{ ...ghost, color: T.accent, borderColor: T.accent }}>Ask them</button>
                </form>
              </div>
            ))}
            {overCap > 0 && (
              <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                Showing the first {CAP} of {matching.length}. Filter by a position to see the rest.
              </div>
            )}
          </div>
        )}
      </div>
    </ClubConsole>
  );
}
