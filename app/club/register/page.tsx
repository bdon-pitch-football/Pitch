// InterestRegister — the club's register. Rows come exclusively from
// fn_register_rows (verified + subscribed + authorised, or nothing); an
// unverified club renders the held state: a count and not one name (D-126).
// No download exists anywhere on this surface (D-122).
//
// ORGANISATION (BUZ, 7 Sep). A flat list works at three registrations and
// falls over at two hundred. Rows are grouped by the squad the FAMILY named
// when they registered, which is what makes the grouping both age-banded and
// gendered without us holding either fact about a child: a squad carries
// age_group and competition_gender (D-68), a person carries neither and must
// not (D-25). Registrations with no squad named get their own bucket at the
// bottom — a to-do for the club, never a guess by us.
//
// Filtering is by URL, server-rendered. No client state, no JavaScript
// required, and a filtered view is a link a TD can send to their coach.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { POSITIONS } from '@/lib/football';
import RegisterPaused from '@/components/RegisterPaused';
import { setStatus } from './actions';
import { carryBack } from '@/lib/register-back';
import { SUPPORT_EMAIL } from '@/lib/support';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Interest register', robots: { index: false, follow: false } };

const STATUS_CHIP: Record<string, { pill: string; label: string }> = {
  // Three states, three of A's pills (spec A part 12, F). "New" stays green:
  // green marks where work waits (Head of Product Design ruling 3). Invited
  // is purple, a charter state token, never a colour of its own.
  new: { pill: 'pill pill-live', label: 'New' },
  shortlisted: { pill: 'pill pill-wait', label: 'Shortlisted' },
  invited: { pill: 'pill pill-guard', label: 'Invited' },
};

const GENDER_LABEL: Record<string, string> = {
  boys: 'Boys', girls: 'Girls', men: 'Men', women: 'Women',
};

type Row = {
  registration_id: string; player_first_name: string; positions: string[];
  trial_tag: string | null; note: string | null; club_status: string; created_at: string;
  squad_id: string | null; squad_name: string | null;
  squad_age_group: string | null; squad_gender: string | null; has_clips: boolean;
};

// The stand-in code for "they named no squad". Not a real age group, so it
// gets a value that cannot collide with one.
const UNFILED = '\u2014none\u2014';

// An age group sorts by its number, with seniors after the juniors and the
// unfiled group last of all. Sorting the codes as text puts 'SEN' first,
// which reads as a bug to any junior club.
const AGE_SORT = (code: string) => {
  if (code === UNFILED) return 1000;
  const n = code.replace(/\D/g, '');
  return n ? Number(n) : 999;
};
const AGE_LABEL = (code: string) =>
  code === UNFILED ? 'No squad named' : code === 'SEN' ? 'Seniors' : code;

export default async function Register({ searchParams }: {
  searchParams: Promise<{ pos?: string; status?: string; age?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { pos, status, age } = await searchParams;

  const club = await db.query(
    `select c.id, c.name, c.club_state, m.role from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');
  const c = club.rows[0];
  // D-154: at a verified club the register is read by a named person — the
  // TD. An administrator reaches this page only while the club is unverified,
  // where it holds nothing but the waiting count D-126 promises (N17e).
  if (c.role !== 'technical_director' && c.club_state === 'verified') redirect('/home');

  const all = (await db.query(`select * from fn_register_rows($1, $2)`, [me, c.id])).rows as Row[];
  // D-153: a verified club with no subscription still invites — the people
  // who registered interest in a trial it posted, and nobody else.
  const active = c.club_state === 'verified'
    && Boolean((await db.query('select fn_register_active($1) as a', [c.id])).rows[0]?.a);
  // D-135 / O4: a club whose payment failed dropped to the free tier's own
  // heading here with nothing about payment anywhere near it — the register it
  // pays for gone, and the one screen that would have said so was
  // /club/billing. fn_register_payment_state is the same answer that screen
  // reads, so the two cannot disagree (0063, LESSONS L23). A club that never
  // subscribed is 'unsubscribed' and its free-tier copy is untouched.
  const payState = (await db.query('select fn_register_payment_state($1, $2) as s', [me, c.id])).rows[0].s as
    'unsubscribed' | 'active' | 'grace' | 'suspended' | 'cancelled' | null;
  type TrialRow = { registration_id: string; player_first_name: string; positions: string[]; note: string | null;
                    club_status: string; trial_title: string; trial_on: string; has_clips: boolean };
  const trialRows = c.club_state === 'verified' && !active
    ? (await db.query(`select registration_id, player_first_name, positions, note, club_status, trial_title,
         to_char(trial_on, 'Dy FMDD Mon') as trial_on, has_clips from fn_trial_interest_rows($1, $2)`, [me, c.id])).rows as TrialRow[]
    : [];
  const held = all.length === 0 ? (await db.query(`select fn_register_count($1,$2) as n`, [me, c.id])).rows[0].n : 0;
  // D-154 / doc 32 C4a: every registration this page is handed is a read by
  // a named person, logged — filters narrow what is drawn, not what was read.
  const readIds = [...all.map((r) => r.registration_id), ...trialRows.map((t) => t.registration_id)];
  if (readIds.length > 0) {
    await db.query(
      `insert into register_read_log (person_id, registration_id, surface) select $1, unnest($2::uuid[]), 'list'`,
      [me, readIds],
    );
  }
  // Doc 14 P19: a row carries its CV and invite links only when fn_can_invite
  // says yes — the same answer the CV page, the invite page and the write
  // trigger give. A paused profile or an under-16 with no approved guardian
  // stays on the list with no way in, which looks exactly like a row that
  // never had one.
  const invitable = new Set((await db.query(
    `select r.id from registration r where r.club_id = $2 and fn_can_invite($1, r.id)`, [me, c.id],
  )).rows.map((x: { id: string }) => x.id));

  // Filters are applied AFTER the permission function, never inside the query
  // that decides what this person may see. Narrowing a list is a different
  // question from being allowed to read it.
  const posOk = pos && pos in POSITIONS ? pos : null;
  const statusOk = status && status in STATUS_CHIP ? status : null;

  // Age groups present on THIS register, with a count each. Built from every
  // row, not the filtered ones, so the counts do not move around underneath
  // the person clicking them.
  const ageOf = (r: Row) => r.squad_age_group ?? UNFILED;
  const ageGroups = [...new Set(all.map(ageOf))]
    .sort((a, b) => AGE_SORT(a) - AGE_SORT(b))
    .map((code) => ({ code, label: AGE_LABEL(code), n: all.filter((r) => ageOf(r) === code).length }));
  const ageOk = age && ageGroups.some((g) => g.code === age) ? age : null;

  const rows = all.filter(
    (r) => (!posOk || r.positions.includes(posOk))
      && (!statusOk || r.club_status === statusOk)
      && (!ageOk || ageOf(r) === ageOk),
  );

  // Bucket by squad, preserving the order fn_register_rows already applied
  // (age group, then squad name, unfiled last).
  const buckets: { key: string; title: string; sub: string | null; rows: Row[] }[] = [];
  for (const r of rows) {
    const key = r.squad_id ?? 'unfiled';
    let b = buckets.find((x) => x.key === key);
    if (!b) {
      b = {
        key,
        title: r.squad_name ?? 'No squad named',
        sub: r.squad_name
          ? [r.squad_age_group, r.squad_gender ? GENDER_LABEL[r.squad_gender] : null].filter(Boolean).join(' · ')
          : 'They registered with the club, not a squad',
        rows: [],
      };
      buckets.push(b);
    }
    b.rows.push(r);
  }

  const counts = {
    new: all.filter((r) => r.club_status === 'new').length,
    shortlisted: all.filter((r) => r.club_status === 'shortlisted').length,
    invited: all.filter((r) => r.club_status === 'invited').length,
  };
  const usedPositions = [...new Set(all.flatMap((r) => r.positions))]
    .filter((p) => p in POSITIONS)
    .sort((a, b) => Object.keys(POSITIONS).indexOf(a) - Object.keys(POSITIONS).indexOf(b));

  const qs = (next: { pos?: string | null; status?: string | null; age?: string | null }) => {
    const p = new URLSearchParams();
    const np = next.pos === undefined ? posOk : next.pos;
    const ns = next.status === undefined ? statusOk : next.status;
    const na = next.age === undefined ? ageOk : next.age;
    if (np) p.set('pos', np);
    if (ns) p.set('status', ns);
    if (na) p.set('age', na);
    const s = p.toString();
    return s ? `/club/register?${s}` : '/club/register';
  };

  // The chip primitive carries hover and pressed; aria-pressed is both the
  // state and the style hook, so a screen reader and the stylesheet agree.

  // P1 (BUZ, 1 Oct): a row's CV and invite links carry the filters, so their
  // way back lands on this same filtered list, at the row (lib/register-back).
  const carry = carryBack({ age: ageOk, pos: posOk, status: statusOk });
  const shield = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
  );
  // An empty line, set in the trials board's dashed "not yet" tile.
  const emptyTile = (children: React.ReactNode) => (
    <div className="card tb-empty">
      <div className="tb-art" aria-hidden><span className="fl-dash" /><span className="fl-dash" /><span className="fl-dash" /></div>
      <p>{children}</p>
    </div>
  );

  return (
    <ClubConsole active="register">
      <div className="console cc-page">
        <HeaderMark />
        {/* The header is the hero of this screen: the title and, at a laptop,
            the stat row on the same line with the numbers to the right (A's
            stat row). D-162 / P2: a zero is omitted, never printed. */}
        <div className="reg-head">
          <div className="pg-titles" style={{ gap: 2 }}>
            <h1 className="pg-title">Interest register</h1>
            <div className="pg-sub" style={{ fontSize: 13.5 }}>{c.name}</div>
          </div>
          {c.club_state === 'verified' && all.length > 0 && (
            <div className="stat-row">
              <div>
                <div className="numeral numeral-l" style={{ color: 'var(--ink)' }}>{all.length}</div>
                <div className="stat-l" style={{ marginTop: 6 }}>Players</div>
              </div>
              {counts.new > 0 && (
                <div>
                  <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{counts.new}</div>
                  <div className="stat-l" style={{ marginTop: 6 }}>New</div>
                </div>
              )}
              {counts.shortlisted > 0 && (
                <div>
                  <div className="numeral numeral-m" style={{ color: 'var(--amber)' }}>{counts.shortlisted}</div>
                  <div className="stat-l" style={{ marginTop: 6 }}>Shortlisted</div>
                </div>
              )}
              {counts.invited > 0 && (
                <div>
                  <div className="numeral numeral-m" style={{ color: 'var(--purple)' }}>{counts.invited}</div>
                  <div className="stat-l" style={{ marginTop: 6 }}>Invited</div>
                </div>
              )}
            </div>
          )}
        </div>

        {c.club_state !== 'verified' ? (
          // D-126: held means a count and nothing else. The count is one text
          // node (r33-r35, free-r5); with nobody waiting, the sentence stands
          // alone rather than printing "0 waiting" (P2).
          <div className="card card-amber" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {held > 0 && <div className="reg-held-n">{`${held} waiting`}</div>}
            <div style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>Registrations are held until your club is verified — a short phone call with us. You&rsquo;ll see the list, and nothing about anyone under 18 reaches any club before that call.</div>
            {/* A-P7 (BUZ, 1 Oct, option A): the same door as the home's, quieter here. */}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`A good time to ring ${c.name}`)}`} className="btn btn-secondary">Email us a good time to ring</a>
          </div>
        ) : !active ? (
          <>
            {payState === 'suspended' && <RegisterPaused state="suspended" billingLink />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 className="reg-bucket-t">Interest in your trials</h2>
              <div style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>Players who registered interest in a trial you posted. Invite any of them — it&rsquo;s free.</div>
            </div>
            {trialRows.length === 0 ? emptyTile(
              <>Nobody has registered interest in your trials yet. <Link href="/club/post-trial" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Post a trial</Link> and families register from it.</>,
            ) : (
              <div className="card reg-panel">
                {trialRows.map((t) => (
                  <div key={t.registration_id} id={`r-${t.registration_id}`} className="reg-item">
                    <div className="reg-row">
                      <div style={{ minWidth: 0 }}>
                        <div className="reg-row-n">{t.player_first_name}</div>
                        <div className="reg-row-s">{t.positions.join(' · ')}{t.has_clips && ' · clips'}</div>
                        <div style={{ fontSize: 12, color: 'var(--secondary)', fontWeight: 700, marginTop: 2 }}>{t.trial_title} · {t.trial_on}</div>
                      </div>
                      <div />
                      {t.note && <div className="reg-row-note">&ldquo;{t.note}&rdquo;</div>}
                      {invitable.has(t.registration_id) && <div className="reg-row-act">
                        <Link href={`/club/register/cv/${t.registration_id}`} className="btn btn-secondary">Open the CV</Link>
                        {t.club_status === 'invited' ? (
                          <Link href={`/club/invite/${t.registration_id}`} className="btn btn-secondary reg-sent">Invitation sent</Link>
                        ) : (
                          <Link href={`/club/invite/${t.registration_id}`} className="btn btn-primary">Invite to trial</Link>
                        )}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>The whole register is a plan</div>
              <div style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>Everyone who registers interest in your club, all year — not only for a trial — with squads, filters and a shortlist.</div>
              <Link href="/club/billing" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start' }}>See the Interest Register</Link>
            </div>
          </>
        ) : (
          <>
            <div className="card-sunken reg-shield">
              {shield}
              <div>Every under-16 here was put on this register by a parent.</div>
            </div>

            {/* Filters. A link, not a control — the filtered view has its own
                URL. Sticky from 768: scrolling ninety-nine rows should not
                cost you the controls that narrowed them. P2 (BUZ, 1 Oct): an
                empty register shows no filter card at all, and no chip says
                "· 0". */}
            {all.length > 0 && (
              <div className="card console-filters reg-filters">
                <div className="reg-fgroup">
                  <div className="field-label">Which age group</div>
                  <div className="reg-chips">
                    <Link href={qs({ age: null })} className="chip" aria-pressed={!ageOk}>All ages · {all.length}</Link>
                    {ageGroups.map((g) => (
                      <Link key={g.code} href={qs({ age: g.code })} className="chip" aria-pressed={ageOk === g.code}>
                        {g.label} · {g.n}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="reg-fgroup">
                  <div className="field-label">Where they play</div>
                  <div className="reg-chips">
                    <Link href={qs({ pos: null })} className="chip" aria-pressed={!posOk}>Any position</Link>
                    {usedPositions.map((p) => (
                      <Link key={p} href={qs({ pos: p })} className="chip" aria-pressed={posOk === p}
                        title={POSITIONS[p as keyof typeof POSITIONS].label}>
                        {p}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="reg-fgroup">
                  <div className="field-label">Where you&rsquo;re up to</div>
                  <div className="reg-chips">
                    <Link href={qs({ status: null })} className="chip" aria-pressed={!statusOk}>Everyone</Link>
                    {(['new', 'shortlisted', 'invited'] as const).filter((s) => counts[s] > 0 || statusOk === s).map((s) => (
                      <Link key={s} href={qs({ status: s })} className="chip" aria-pressed={statusOk === s}>
                        {counts[s] > 0 ? <>{STATUS_CHIP[s].label} · {counts[s]}</> : STATUS_CHIP[s].label}
                      </Link>
                    ))}
                  </div>
                </div>
                {(posOk || statusOk || ageOk) && (
                  <div className="reg-shown">
                    <div>{rows.length} of {all.length} shown</div>
                    <Link href="/club/register">Clear</Link>
                  </div>
                )}
              </div>
            )}

            {/* F-N1 (BUZ, 1 Oct): with nobody on the register at all, nothing
                was narrowed, so it says the trials branch's approved line
                instead. "Just narrowed" is kept for a filter that empties it. */}
            {all.length === 0 && emptyTile(
              <>Nobody has registered interest in your trials yet. <Link href="/club/post-trial" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Post a trial</Link> and families register from it.</>,
            )}
            {all.length > 0 && buckets.length === 0 && emptyTile(
              <>Nobody matches that yet. <Link href="/club/register" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Show everyone</Link> — the list is the same list, just narrowed.</>,
            )}

            {/* One panel per bucket. The two renders stay two renders — the
                table (.d-only) from 768 and the phone row (.m-only) below it —
                side by side inside each row's own wrapper, which carries the
                row's anchor for P1's return. */}
            {buckets.map((b) => (
              <div key={b.key} className="reg-bucket-wrap">
                <div className="reg-bucket">
                  <div>
                    <div className="reg-bucket-t">{b.title}</div>
                    {b.sub && <div className="reg-bucket-s">{b.sub}</div>}
                  </div>
                  <div className="reg-bucket-n">{b.rows.length}</div>
                </div>

                <div className="card reg-panel">
                  <div className="console-row console-head d-only">
                    {['Player', 'Their line', 'Status', '', ''].map((h, i) => (
                      <div key={i}>{h}</div>
                    ))}
                  </div>
                  {b.rows.map((r) => {
                    const chip = STATUS_CHIP[r.club_status];
                    const may = invitable.has(r.registration_id);
                    return (
                      <div key={r.registration_id} id={`r-${r.registration_id}`} className="reg-item">
                        {/* the table (D-147) */}
                        <div className="console-row console-row-hover d-only">
                          <div>
                            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.player_first_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                              {r.positions.join(' · ')}{r.has_clips && <span style={{ color: 'var(--secondary)' }}> · clips</span>}
                            </div>
                          </div>
                          <div className={r.note ? 'reg-line has' : 'reg-line'}>{r.note ? `“${r.note}”` : '—'}</div>
                          <div><span className={chip.pill}>{chip.label}</span></div>
                          {may ? <Link href={`/club/register/cv/${r.registration_id}${carry}`} className="console-btn">Open the CV</Link> : <div />}
                          {/* The last column starts where it is (justify-self: start,
                              follow-up audit #4), one gap after Open the CV. */}
                          <div style={{ display: 'flex' }}>
                            {r.club_status === 'new' && (
                              <form action={setStatus}><input type="hidden" name="registrationId" value={r.registration_id} /><input type="hidden" name="status" value="shortlisted" />
                                <button type="submit" className="console-btn">Shortlist</button>
                              </form>
                            )}
                            {r.club_status === 'shortlisted' && may && (
                              <Link href={`/club/invite/${r.registration_id}${carry}`} className="console-btn console-btn-primary">Invite to trial</Link>
                            )}
                            {r.club_status === 'invited' && may && (
                              <Link href={`/club/invite/${r.registration_id}${carry}`} className="reg-sent-link">Invitation sent</Link>
                            )}
                          </div>
                        </div>

                        {/* the phone row */}
                        <div className="reg-row m-only">
                          <div style={{ minWidth: 0 }}>
                            <div className="reg-row-n">{r.player_first_name}</div>
                            <div className="reg-row-s">
                              {r.positions.join(' · ')}{r.has_clips && ' · clips'}
                            </div>
                          </div>
                          <div><span className={chip.pill}>{chip.label}</span></div>
                          {r.note && (
                            <div className="reg-row-note">&ldquo;{r.note}&rdquo;</div>
                          )}
                          {(may || r.club_status === 'new') && (
                            <div className="reg-row-act">
                              {may && <Link href={`/club/register/cv/${r.registration_id}${carry}`} className="btn btn-secondary">Open the CV</Link>}
                              {r.club_status === 'new' && (
                                <form action={setStatus}><input type="hidden" name="registrationId" value={r.registration_id} /><input type="hidden" name="status" value="shortlisted" />
                                  <button type="submit" className="btn btn-secondary">Shortlist</button>
                                </form>
                              )}
                              {r.club_status === 'shortlisted' && may && (
                                <Link href={`/club/invite/${r.registration_id}${carry}`} className="btn btn-primary">Invite to trial</Link>
                              )}
                              {r.club_status === 'invited' && may && (
                                <Link href={`/club/invite/${r.registration_id}${carry}`} className="btn btn-secondary reg-sent">Invitation sent</Link>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="reg-foot">
              <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                <b style={{ color: 'var(--ink)' }}>There is no download.</b> The register lives here, and a family who switches their link off disappears from it the same minute. A spreadsheet on someone&rsquo;s laptop could not do that.
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>New, shortlisted, invited — and nothing else</div>
                <div style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>Those three are yours. No player sees them, no parent sees them, and there is no button here that turns anyone away — a register isn&rsquo;t a queue you clear.</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>The keeper you haven&rsquo;t got room for in September is still on this list in March, when someone tears a hamstring.</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, textAlign: 'center' }}>A family can take themselves off at any time. The entry goes, and so does the CV link.</div>
          </>
        )}
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </ClubConsole>
  );
}
