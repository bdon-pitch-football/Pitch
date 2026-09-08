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
import { POSITIONS } from '@/lib/football';
import { setStatus } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100', blue: '#3987e5',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: 'rgba(61,220,132,.14)', fg: T.accent, label: 'New' },
  shortlisted: { bg: 'rgba(237,161,0,.14)', fg: T.amber, label: 'Shortlisted' },
  invited: { bg: 'rgba(57,135,229,.16)', fg: T.blue, label: 'Invited' },
};

const GENDER_LABEL: Record<string, string> = {
  boys: 'Boys', girls: 'Girls', mixed: 'Mixed', open: 'Open', men: 'Men', women: 'Women',
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
    `select c.id, c.name, c.club_state from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');
  const c = club.rows[0];

  const all = (await db.query(`select * from fn_register_rows($1, $2)`, [me, c.id])).rows as Row[];
  const held = all.length === 0 ? (await db.query(`select fn_register_count($1,$2) as n`, [me, c.id])).rows[0].n : 0;

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

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
  // The chip primitive carries hover and pressed; aria-pressed is both the
  // state and the style hook, so a screen reader and the stylesheet agree.

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        {/* The header is the hero of this screen. It used to render the whole
            shape of the register as 13.5px body text; a club with ninety-nine
            families waiting should see ninety-nine. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 'var(--ls-title)' }}>Interest register</div>
            <div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500 }}>{c.name}</div>
          </div>
          {c.club_state === 'verified' && all.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap' }}>
              <div>
                <div className="numeral numeral-l" style={{ color: 'var(--ink)' }}>{all.length}</div>
                <div className="kicker" style={{ marginTop: 6 }}>Players</div>
              </div>
              <div>
                <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{counts.new}</div>
                <div className="kicker" style={{ marginTop: 6 }}>New</div>
              </div>
              <div>
                <div className="numeral numeral-m" style={{ color: 'var(--amber)' }}>{counts.shortlisted}</div>
                <div className="kicker" style={{ marginTop: 6 }}>Shortlisted</div>
              </div>
              <div>
                <div className="numeral numeral-m" style={{ color: T.blue }}>{counts.invited}</div>
                <div className="kicker" style={{ marginTop: 6 }}>Invited</div>
              </div>
            </div>
          )}
        </div>

        {c.club_state !== 'verified' ? (
          <div style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.amber }}>{held} waiting</div>
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Registrations are held until your club is verified — a short phone call with us. You&rsquo;ll see the list, and nothing about anyone under 18 reaches any club before that call. Paying doesn&rsquo;t change it and can&rsquo;t.</div>
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(61,220,132,.07)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>Every under-16 here was put on this register by a parent.</div>
            </div>

            {/* Filters. A link, not a control — the filtered view has its own
                URL. Sticky on desktop: scrolling ninety-nine rows should not
                cost you the controls that narrowed them. */}
            <div className="console-filters" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Which age group</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  <Link href={qs({ age: null })} className="chip" aria-pressed={!ageOk}>All ages · {all.length}</Link>
                  {ageGroups.map((g) => (
                    <Link key={g.code} href={qs({ age: g.code })} className="chip" aria-pressed={ageOk === g.code}>
                      {g.label} · {g.n}
                    </Link>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Where they play</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  <Link href={qs({ pos: null })} className="chip" aria-pressed={!posOk}>Any position</Link>
                  {usedPositions.map((p) => (
                    <Link key={p} href={qs({ pos: p })} className="chip" aria-pressed={posOk === p}
                      title={POSITIONS[p as keyof typeof POSITIONS].label}>
                      {p}
                    </Link>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Where you&rsquo;re up to</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  <Link href={qs({ status: null })} className="chip" aria-pressed={!statusOk}>Everyone</Link>
                  {(['new', 'shortlisted', 'invited'] as const).map((s) => (
                    <Link key={s} href={qs({ status: s })} className="chip" aria-pressed={statusOk === s}>
                      {STATUS_CHIP[s].label} · {counts[s]}
                    </Link>
                  ))}
                </div>
              </div>
              {(posOk || statusOk || ageOk) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>
                    {rows.length} of {all.length} shown
                  </div>
                  <Link href="/club/register" style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none' }}>Clear</Link>
                </div>
              )}
            </div>

            {buckets.length === 0 && (
              <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                Nobody matches that yet. <Link href="/club/register" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Show everyone</Link> — the list is the same list, just narrowed.
              </div>
            )}

            {buckets.map((b) => (
              <div key={b.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.015em' }}>{b.title}</div>
                    {b.sub && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{b.sub}</div>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, whiteSpace: 'nowrap' }}>{b.rows.length}</div>
                </div>

                {/* desktop console table (D-147) */}
                <div className="d-only" style={{ ...card, padding: '6px 16px', flexDirection: 'column' }}>
                  <div className="console-row console-head d-only" style={{ borderBottom: `1px solid ${T.line}`, padding: '9px 0' }}>
                    {['Player', 'Their line', 'Status', '', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{h}</div>
                    ))}
                  </div>
                  {b.rows.map((r) => {
                    const chip = STATUS_CHIP[r.club_status];
                    return (
                      <div key={r.registration_id} className="console-row console-row-hover d-only" style={{ borderTop: `1px solid ${T.surface2}` }}>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.player_first_name}</div>
                          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
                            {r.positions.join(' · ')}{r.has_clips && <span style={{ color: T.secondary }}> · clips</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontStyle: r.note ? 'italic' : 'normal', color: r.note ? T.secondary : T.muted, fontWeight: 500, lineHeight: 1.4 }}>{r.note ? `“${r.note}”` : '—'}</div>
                        <div><span style={{ background: chip.bg, color: chip.fg, borderRadius: 7, padding: '4px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{chip.label}</span></div>
                        <Link href={`/club/register/cv/${r.registration_id}`} style={{ background: T.surface2, borderRadius: 12, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Open the CV</Link>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {r.club_status === 'new' && (
                            <form action={setStatus.bind(null, r.registration_id, 'shortlisted')}>
                              <button type="submit" style={{ height: 38, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, fontSize: 12.5, fontWeight: 700, padding: '0 16px', cursor: 'pointer', fontFamily: 'inherit' }}>Shortlist</button>
                            </form>
                          )}
                          {r.club_status === 'shortlisted' && (
                            <Link href={`/club/invite/${r.registration_id}`} style={{ height: 42, borderRadius: 12, background: T.accent, color: T.onAccent, fontSize: 13.5, fontWeight: 800, padding: '0 18px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>Invite to trial</Link>
                          )}
                          {r.club_status === 'invited' && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>Invitation sent</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {b.rows.map((r) => {
                  const chip = STATUS_CHIP[r.club_status];
                  return (
                    <div key={r.registration_id} className="m-only" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>{r.player_first_name}</div>
                          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                            {r.positions.join(' · ')}{r.has_clips && ' · clips'}
                          </div>
                        </div>
                        <div style={{ background: chip.bg, color: chip.fg, borderRadius: 7, padding: '4px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{chip.label}</div>
                      </div>
                      {r.note && (
                        <div style={{ background: T.surface2, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/club/register/cv/${r.registration_id}`} style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Open the CV</Link>
                        {r.club_status === 'new' && (
                          <form action={setStatus.bind(null, r.registration_id, 'shortlisted')} style={{ display: 'flex' }}>
                            <button type="submit" style={{ height: 40, alignSelf: 'center', borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Shortlist</button>
                          </form>
                        )}
                        {r.club_status === 'shortlisted' && (
                          <Link href={`/club/invite/${r.registration_id}`} style={{ flex: 1, height: 50, borderRadius: 14, background: T.accent, color: T.onAccent, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Invite to trial</Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              <b style={{ color: T.ink }}>There is no download.</b> The register lives here, and a family who switches their link off disappears from it the same minute. A spreadsheet on someone&rsquo;s laptop could not do that.
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>New, shortlisted, invited — and nothing else</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Those three are yours. No player sees them, no parent sees them, and there is no button here that turns anyone away — a register isn&rsquo;t a queue you clear.</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The keeper you haven&rsquo;t got room for in September is still on this list in March, when someone tears a hamstring.</div>
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, textAlign: 'center' }}>A family can take themselves off at any time. The entry goes, and so does the CV link.</div>
          </>
        )}
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </div>
  );
}
