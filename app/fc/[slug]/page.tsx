// The public club page — ClubCV.dc.html, copy verbatim where data exists,
// laid out Floodlit (D-173, 1 Oct): full-width hero, two columns from 1024px.
// Squads render as first-class rows including girls'/women's teams (D-68);
// trial notices auto-expire past their date (an open-now one seven days after
// the trials desk last saw its form open, 0173), and a suspended club's never
// show (0140); the alumni wall renders only
// when it has content and its footnote states the naming guardrail plainly.
// Unclaimed pages carry the D-64 disclaimer instead of the verified chip.
// (Design link reads pitchfootball.com.au/<slug>; root-level rewrites map
// that at deploy time — the route lives at /fc/<slug>.)
//
// Order of the page is deliberate: crest and record, then the dated thing
// (trials), then the door onto the register, then who the club is, then the
// squads as the way in, and the alumni wall last because it is the argument
// you want a parent holding when they stop reading.
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import ClipCard from '@/components/cv/ClipCard';
import SiteNav from '@/components/floodlit/SiteNav';
import { clubTheme } from '@/lib/club-colours';
import { T } from '@/lib/palette';
import { sectionLabel } from '@/lib/ui';
import { groupByClubDay, kindOf } from '@/lib/trials-board';
import PublicAnalytics from '@/components/PublicAnalytics';

export const dynamic = 'force-dynamic';

// Public and indexable, same reasoning as the coach link: a claimed club page
// is a thing a parent should be able to find. Canonical points at itself.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    'select name, suburb, state, club_state from club where public_slug = $1', [slug]);
  const c = rows[0];
  if (!c) return { title: 'Club' };
  // A listing Pitch compiled is not in search until the club claims it (30 Sep,
  // when the full Victorian list was loaded). The sitemap already leaves it out.
  const unclaimed = c.club_state === 'unclaimed';
  const where = [c.suburb, c.state].filter(Boolean).join(', ');
  return {
    title: c.name,
    // D-172: an unclaimed page never says the club is on Pitch, even in a meta tag.
    description: unclaimed
      ? `${c.name}${where ? ` — ${where}` : ''}. Pitch made this page from public information. ${c.name} has not claimed it.`
      : `${c.name}${where ? ` — ${where}` : ''}. Teams, trials and pathway on Pitch.`,
    alternates: { canonical: `/fc/${slug}` },
    openGraph: { title: c.name, url: `/fc/${slug}` },
    ...(unclaimed ? { robots: { index: false, follow: false } } : {}),
  };
}

const label = sectionLabel;

// Alumni lines arrive as one string carrying the club's own arrow — "Marco V.
// → NPL Victoria". Split so the destination can be given the accent; a line
// without an arrow renders whole rather than being mangled to fit.
function splitArrow(line: string): [string, string | null] {
  const i = line.indexOf('→');
  if (i === -1) return [line, null];
  return [line.slice(0, i).trim(), line.slice(i + 1).trim() || null];
}

export default async function ClubPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ squad?: string; trial?: string }>;
}) {
  const { slug } = await params;
  const { squad: squadParam, trial: trialParam } = await searchParams;
  const { rows } = await db.query(
    `select c.id, c.name, c.suburb, c.state, c.club_state, c.philosophy, c.established, c.pathway_line, c.public_slug, c.crest_path, c.banner_path, c.contact_email, c.colour_primary, c.colour_secondary,
       -- Squads sort by age NUMERICALLY, not by name. Sorting the name as
       -- text drops 'Seniors Women' between 'MiniRoos U9' and 'U13 Boys',
       -- which reads as a bug to any club that looks at its own page. Same
       -- rule the register uses (0016); seniors and unrecognised sort last.
       (select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'gender', s.competition_gender)
                                 order by coalesce(ag.sort, 999), s.name), '[]'::json)
        from squad s left join age_group ag on ag.code = s.age_group
        where s.club_id = c.id) as squads,
       -- Its notices are the database's answer (0140): still to come, and
       -- none at all while the club is suspended, of whatever class.
       (select coalesce(json_agg(json_build_object(
           'id', t.id, 'title', t.title, 'timeVenue', t.time_venue,
           'mon', upper(to_char(t.trial_on, 'Mon')), 'day', to_char(t.trial_on, 'FMDD'), 'wd', upper(to_char(t.trial_on, 'Dy')),
           'on', coalesce(to_char(t.trial_on, 'YYYY-MM-DD'), ''), 'open', t.trial_on is null,
           -- An open-now notice's "checked" is the day the desk last saw its
           -- form open (John, 3 Oct), never last_checked.
           'how', t.how_to_register,
           'checked', to_char(case when t.trial_on is null then (t.confirmed_open_at at time zone 'Australia/Melbourne')::date
                                   else t.last_checked end, 'FMDD Mon'),
           'notice', case when t.source <> 'club' then t.source_url end) order by t.trial_on), '[]'::json)
        from fn_trial_notices_advertised() t where t.club_id = c.id) as trials,
       (select coalesce(json_agg(json_build_object('title', w.title, 'detail', w.detail) order by w.created_at), '[]'::json)
        from fn_players_wanted_advertised() w where w.club_id = c.id) as wanted,
       (select coalesce(json_agg(json_build_object('line', a.line, 'detail', a.detail) order by a.sort), '[]'::json)
        from alumni_entry a where a.club_id = c.id) as alumni,
       (select coalesce(json_agg(json_build_object('url', v.url, 'title', v.title) order by v.sort, v.created_at), '[]'::json)
        from club_video v where v.club_id = c.id) as videos,
       (select count(*)::int from fn_coaching_roles_advertised() cr where cr.club_id = c.id) as open_roles
     from club c where c.public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) {
    // An address a listing used to have keeps working (0162): it moves for
    // good to the one the club has now.
    const now = (await db.query('select fn_club_slug_now($1) as s', [slug])).rows[0]?.s;
    if (now) permanentRedirect(`/fc/${now}`);
    notFound();
  }
  const c = rows[0];
  const squads: { id: string; name: string; gender: string }[] = c.squads;
  type Notice = { id: string; title: string; timeVenue: string; mon: string; day: string; wd: string; on: string; open: boolean; how: string | null; checked: string; notice: string | null };
  // Trials board v2, on the club page (Product Design, 2 Oct): the same
  // split and the same order as the board. Within a day, by start time, not
  // by the order they were written (lib/trials-board's one rule). An
  // expression of interest is told by lib/trials-board's kindOf — the board's
  // own test, so the two can never disagree — and leaves the trials for its
  // own block, by closing date. "Trials coming" counts trials only. Open now
  // (BUZ, 3 Oct): an expression of interest with no closing date follows the
  // dated ones in its own group, by title (the page has one club).
  const notices: Notice[] = groupByClubDay((c.trials as Notice[]).filter((t) => !t.open).map((t) => ({
    ...t, club_id: c.id as string, club_name: c.name as string, on_date: t.on, time_venue: t.timeVenue,
  }))).flat();
  const openNow: Notice[] = (c.trials as Notice[]).filter((t) => t.open)
    .sort((a, b) => a.title.localeCompare(b.title, 'en-AU', { sensitivity: 'base' }));
  const trials = notices.filter((t) => kindOf(t.open, t.timeVenue) === 'trial');
  const eois = notices.filter((t) => kindOf(t.open, t.timeVenue) === 'eoi');
  const wanted: { title: string; detail: string | null }[] = c.wanted;
  const alumni: { line: string; detail: string | null }[] = c.alumni;
  const videos: { url: string; title: string }[] = c.videos;

  // Who is looking. The club page is public, so this only ever ADDS a door —
  // nothing about the page is hidden from a signed-out visitor.
  const me = await getSessionPersonId();
  const viewer = me
    ? (await db.query(
        `select
           (select id from development_record where person_id = $1) as my_record,
           (select coalesce(json_agg(json_build_object(
               'name', ch.first_name, 'band', fn_age_band(ch.dob),
               'recordId', (select id from development_record where person_id = ch.id),
               'paused', coalesce((select profile_paused from guardian_setting where child_id = ch.id), false))), '[]'::json)
            from guardianship_link g join person ch on ch.id = g.child_id
            where g.guardian_id = $1 and g.approved_at is not null and g.revoked_at is null) as children`,
        [me],
      )).rows[0]
    : null;
  // A parent registers an UNDER-16. A 16-17 goes on a register themselves (doc
  // 14 N4), so offering the parent a button for them only led to a bounce.
  // Nor while the child's page is paused: Send and Register both answer
  // 'none' then, so the button was a dead end to /home (HoPD, 1 Oct).
  const children: { name: string; recordId: string | null; band: string }[] = (viewer?.children ?? []).filter(
    (k: { recordId: string | null; band: string; paused: boolean }) => k.recordId && k.band === 'u16' && !k.paused,
  );
  const myRecord: string | null = viewer?.my_record ?? null;

  // A squad chip is the front door of the thing the club pays for, so it
  // should open it. It cannot link straight to a registration, because who is
  // registering depends on the seat — a parent of three has three answers.
  // So the chip selects ON THIS PAGE and the register card below carries the
  // choice into whichever button that viewer gets. One mechanism, every seat,
  // signed in or not.
  const hasBanner = Boolean(c.banner_path);
  const picked = squads.find((s) => s.id === squadParam) ?? null;
  // D-153: a trial chosen on the board or below travels into the registration,
  // so the club can invite to it — and on the free tier, invite at all. Only
  // a dated one: an open-now notice is never a trial to be invited to.
  const pickedTrial = notices.find((t) => t.id === trialParam) ?? null;
  const squadQuery = `${picked ? `&squad=${picked.id}` : ''}${pickedTrial ? `&trial=${pickedTrial.id}` : ''}`;
  // An unclaimed listing has no register anybody reads. That family sends a CV.
  const onPitch = c.club_state === 'claimed' || c.club_state === 'verified';
  // A suspended club advertises nothing (0140, 0151), and that includes the
  // way in (brief L, 29 Sep). It was falling through to the unclaimed
  // branch: "isn't on Pitch yet", which is false, over a "Send my CV to
  // {club}" door that would route a child's CV to a club we had taken down.
  // The page keeps who the club is and the way to report it; it offers no
  // family a way to send, register or pick a squad. No new words — the panel
  // and the squad chips' door are simply not drawn.
  const suspended = c.club_state === 'suspended';

  const unclaimed = c.club_state === 'unclaimed';
  // One glow per screen, on the first primary in 390 reading order (spec A
  // part 18; Head of Product Design ruling 1). On an unclaimed page the claim
  // card leads at 390 (.fl-aside-first, first in the DOM), so it keeps the glow and the send
  // panel's primary is the same button without it.
  // Post-release audit #6 (ruled 2 Oct): one primary as well as one glow —
  // on an unclaimed page the send panel's door is the secondary.
  const playPrimary = unclaimed ? 'btn btn-secondary' : 'btn btn-primary fl-glow';
  const place = [c.suburb, c.state].filter(Boolean).join(' ');
  // A claimed club's own colours (0160, D-173). null for an unclaimed or
  // suspended club, or one that has not picked any: Pitch's hero then.
  const theme = clubTheme({ primary: c.colour_primary, secondary: c.colour_secondary }, c.club_state);

  // One notice on the page: the trials' rows and the expressions of
  // interest are drawn alike, each linking to itself on the page (D-153).
  const noticeRow = (t: Notice, i: number) => (
    <div key={t.id} style={{ padding: '14px 0 8px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
      <Link href={pickedTrial?.id === t.id ? `/fc/${slug}#play` : `/fc/${slug}?trial=${t.id}#play`} style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', color: 'inherit', minHeight: 44 }}>
        <div style={{ width: 54, textAlign: 'center', flexShrink: 0 }}>
          {/* The weekday over the numeral, as the board draws it (BUZ, 2 Oct). */}
          <div className="fl-trial-wd">{t.wd}</div>
          <div className="numeral numeral-s tnum" style={{ fontSize: 28, color: T.ink }}>{t.day}</div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', color: theme ? theme.trim : T.muted, marginTop: 3 }}>{t.mon}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, marginTop: 2 }}>{t.timeVenue}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pickedTrial?.id === t.id ? T.accent : T.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M9 6 l6 6 l-6 6" /></svg>
      </Link>
      {/* John, 30 Sep: "last checked" is visible to the reader, and a
          notice Pitch compiled links to the club's own notice —
          labelled as the club's, opening the club's own page, never
          styled as a Pitch action. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, paddingLeft: 70, fontSize: 11, fontWeight: 700, color: T.muted }}>
        <span>checked {t.checked}</span>
        {t.notice && (
          <a href={t.notice} target="_blank" rel="noopener noreferrer" style={{ color: T.secondary, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>The club&rsquo;s own notice</a>
        )}
      </div>
    </div>
  );
  // Open now (BUZ, 3 Oct; John's ruling the same day): no date, so the block
  // reads OPEN and NOW around a drawing of a form, as the board draws it. The
  // row is not a link onto the register: it is not a trial the club can be
  // asked to invite to, and the club's own notice — the page that links the
  // club's form — is its one action, ahead of the CV panel below (John).
  const openRow = (t: Notice, i: number) => (
    <div key={t.id} style={{ padding: '14px 0 8px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 44 }}>
        <div className="fl-trial-date open" style={{ width: 54, flexShrink: 0 }}>
          <div className="fl-trial-wd">OPEN</div>
          <div className="fl-trial-ic" aria-hidden="true">
            <svg width="24" height="26" viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="4" width="15" height="19.5" rx="2.5" /><path d="M9 2.5h6v3.5H9z" /><path d="M8.5 12h7" /><path d="M8.5 16.5h4.5" /></svg>
          </div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', color: theme ? theme.trim : T.muted, marginTop: 3 }}>NOW</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, marginTop: 2 }}>{t.timeVenue}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, paddingLeft: 70, fontSize: 11, fontWeight: 700, color: T.muted }}>
        <span>checked {t.checked}</span>
        {t.notice && (
          <a href={t.notice} target="_blank" rel="noopener noreferrer" style={{ color: T.secondary, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>The club&rsquo;s own notice</a>
        )}
      </div>
    </div>
  );
  const howToRegister = (
    <div style={{ borderTop: `1px solid ${T.line}`, padding: '12px 0 14px 0', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
      <b style={{ color: T.secondary }}>How to register:</b> go on {c.name}&rsquo;s register below and your CV goes with you. The club works one list all year — you do not have to catch a particular week.
    </div>
  );

  // Who the club is (the right column from 1024). On an unclaimed page it
  // leads, in the DOM as on a phone (audit #6); otherwise it follows the
  // dated things.
  const aside = (
    <aside className={`fl-aside${unclaimed ? ' fl-aside-first' : ''}`}>
      <div className="fl-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {unclaimed && (
          // What claiming turns on, said once, for the club's own people.
          // D-172: nothing here says the club is with us.
          <div className="fl-card fl-float" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.15 }}>Claim {c.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {['Your crest and your philosophy', 'Every squad you run'].map((t, i) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, border: '1.5px dashed rgba(255,255,255,.3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.secondary }}>{t}</span>
                </div>
              ))}
            </div>
            <Link href={`/claim/${slug}`} className="btn btn-primary fl-glow">This is our club — claim it</Link>
            {/* Only where it is true: a club with no public address gets a
                phone call instead (/claim/[slug]), so the line is not said. */}
            {c.contact_email && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>We email a code to the club&rsquo;s own address to check it&rsquo;s you.</div>}
          </div>
        )}

        {c.open_roles > 0 && (
          <Link href="/jobs" className="fl-card lift" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.ink }}>{c.name} is looking for coaches</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{c.open_roles} open {c.open_roles === 1 ? 'role' : 'roles'}</div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>See them</div>
          </Link>
        )}

      </div>
    </aside>
  );

  // Floodlit (D-173). The page uses the laptop: the hero runs the full width,
  // and from 1024px the dated things and the way in sit on the left with who
  // the club is on the right. Every word and every door is the one this page
  // already had; only the arrangement moved.
  //
  // An unclaimed page stays inside D-172 exactly: no image of any kind (the
  // pitch lines are drawn inline, not a file), no colours as its identity, no
  // tick, and the banner first. A claimed club's banner photograph, where it
  // uploaded one, runs behind the hero.
  // One of the four pages analytics may count (lib/analytics-scope).
  return (
    <>
    <div style={{ minHeight: '100dvh', color: T.ink, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <SiteNav signIn={!me} links={[{ href: '/claim', label: 'Find your club' }, { href: '/trials', label: 'Trials' }]} />

      {/* ---- the hero ---------------------------------------------------- */}
      <section style={{ position: 'relative', overflow: 'hidden', background: unclaimed ? 'linear-gradient(160deg, #1c3a2a 0%, #122419 60%, #0d1a13 100%)' : theme ? `linear-gradient(115deg, ${theme.hero} 0%, ${theme.heroDeep} 70%, var(--bg) 100%)` : 'var(--hero)', borderBottom: theme ? `5px solid ${theme.trim}` : `1px solid ${T.line}` }}>
        {unclaimed && (
          // Pitch markings, drawn — never a file (D-172 U1).
          <svg className="fl-pitch-lines" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2" aria-hidden>
            <rect x="-10" y="40" width="1220" height="340" /><line x1="600" y1="40" x2="600" y2="380" /><circle cx="600" cy="210" r="84" />
            <rect x="-10" y="120" width="160" height="180" /><rect x="1050" y="120" width="160" height="180" />
          </svg>
        )}
        {/* Never on an unclaimed page, whatever is stored (D-172 U1). */}
        {hasBanner && !unclaimed && (
          <>
            <img src={c.banner_path} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* The crest and the words sit on whatever photo the club chose,
                so the photo is darkened towards them rather than hoped about. */}
            <div style={{ position: 'absolute', inset: 0, background: theme
              ? `linear-gradient(90deg, ${theme.hero} 0%, ${theme.hero}cc 38%, ${theme.heroDeep}40 100%), linear-gradient(180deg, rgba(10,21,16,0) 40%, rgba(10,21,16,.8) 100%)`
              : 'linear-gradient(90deg, rgba(10,21,16,.92) 0%, rgba(10,21,16,.7) 45%, rgba(10,21,16,.25) 100%), linear-gradient(180deg, rgba(10,21,16,0) 40%, rgba(10,21,16,.85) 100%)' }} />
          </>
        )}
        <div className="fl-wide" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 18, paddingTop: 40, paddingBottom: 32, minHeight: hasBanner && !unclaimed ? 320 : undefined }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 22 }}>
            <div style={{
              width: 112, height: 112, borderRadius: 26, flexShrink: 0, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 40,
              background: unclaimed ? 'rgba(255,255,255,.06)' : theme && !c.crest_path ? theme.trim : '#1b2b22',
              color: theme && !c.crest_path ? theme.onTrim : undefined,
              border: unclaimed ? '1.5px dashed rgba(255,255,255,.3)' : '1px solid rgba(238,245,240,.16)',
              boxShadow: unclaimed ? 'none' : 'var(--shadow-float)',
            }}>
              {c.crest_path && !unclaimed
                ? <img src={c.crest_path} alt="" width={112} height={112} style={{ objectFit: 'contain' }} />
                : c.name[0]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: '1 1 320px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <div style={{ border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '4px 11px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>Club</div>
                {c.club_state === 'verified' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(61,220,132,.14)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                    <span>Verified club</span>
                  </div>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(32px, 5.4vw, 60px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.015em', margin: 0 }}>{c.name}</h1>
              <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>{[c.established ? `Est. ${c.established}` : null, place].filter(Boolean).join(' · ')}</div>
              {c.pathway_line && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.64)', fontWeight: 500 }}>{c.pathway_line}</div>}
            </div>
            {/* Facts a family actually weighs, and we hold them already. */}
            {(squads.length > 0 || trials.length > 0) && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
                {squads.length > 0 && (
                  <div>
                    <div className="numeral numeral-l" style={{ color: T.ink }}>{squads.length}</div>
                    <div className="kicker" style={{ marginTop: 6, color: 'rgba(255,255,255,.6)' }}>Squads</div>
                  </div>
                )}
                {trials.length > 0 && (
                  <div>
                    <div className="numeral numeral-l" style={{ color: T.ink }}>{trials.length}</div>
                    <div className="kicker" style={{ marginTop: 6, color: 'rgba(255,255,255,.6)' }}>Trials coming</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {unclaimed && (
            /* D-172 (John, 30 Sep): the banner is above the fold, in body
               text, and says who made the page. The removal door works with
               no account (it is /report). Wording: BUZ, option A. A claimed
               club that has not had the phone call yet shows neither this nor
               the verified chip. */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, maxWidth: 720 }}>
              <div data-unclaimed-banner="" style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}>
                Pitch made this page from public information. {c.name} has not claimed it.
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.secondary, lineHeight: 1.55 }}>
                Is this your club? Claim it to run the page yourself, or ask us to update or remove it.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px' }}>
                <Link href={`/claim/${slug}`} style={{ fontSize: 13, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Claim it</Link>
                <a href={`/report?kind=club_page&page=${encodeURIComponent(`/fc/${slug}`)}`} style={{ fontSize: 13, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Ask us to update or remove it</a>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="fl-wide fl-club-body">
        {unclaimed && aside}
        {/* ---- left: the dated things and the way in -------------------- */}
        <div className="fl-main">
          {/* Trials are the only dated thing on the page, so they lead. */}
          {trials.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={label}>Trials</h2>
              <div className="fl-card" style={{ padding: '4px 18px', display: 'flex', flexDirection: 'column' }}>
                {trials.map(noticeRow)}
                {/* Only where there is a register to go on (QA F13). */}
                {onPitch && howToRegister}
              </div>
            </section>
          )}
          {/* The expressions of interest, in the trials area, below the trials
              and by closing date (trials board v2, Product Design 2 Oct). */}
          {/* "By closing date." only over dated ones; the open-now group
              follows with its own heading and line (BUZ, 3 Oct). */}
          {(eois.length > 0 || openNow.length > 0) && (
            <section data-eoi-section="" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={label}>Expressions of interest</h2>
                {eois.length > 0 && <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>By closing date.</div>}
              </div>
              {eois.length > 0 && (
                <div className="fl-card" style={{ padding: '4px 18px', display: 'flex', flexDirection: 'column' }}>
                  {eois.map(noticeRow)}
                  {onPitch && trials.length === 0 && openNow.length === 0 && howToRegister}
                </div>
              )}
              {openNow.length > 0 && (
                <>
                  <div data-open-now="" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: eois.length > 0 ? 6 : 0 }}>
                    <h3 style={label}>Open now</h3>
                    {/* No "By club name.": on a club's own page every row is
                        that club's (BUZ, 3 Oct). /trials keeps it. */}
                    <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>No closing date given.</div>
                  </div>
                  <div className="fl-card" style={{ padding: '4px 18px', display: 'flex', flexDirection: 'column' }}>
                    {openNow.map(openRow)}
                    {onPitch && trials.length === 0 && howToRegister}
                  </div>
                </>
              )}
            </section>
          )}

          {/* The philosophy sits straight after the trials and before the way
              in (BUZ, 19 Sep). */}
          {c.philosophy && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={label}>Our philosophy</h2>
              <div style={{ fontSize: 16, lineHeight: 1.6, color: T.secondary, fontWeight: 500, maxWidth: '64ch' }}>{c.philosophy}</div>
            </section>
          )}

          {/* The way onto the club's register. Session-aware, and it only
              ever ADDS: a signed-out visitor sees the same page plus an
              invitation to sign in. Under 16 the child composes and it routes
              to their parent to send (D-91). */}
          {!suspended && (
          <div id="play" className="fl-card fl-float" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 84, borderColor: onPitch ? 'rgba(61,220,132,.35)' : T.line }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>Want to play here?</div>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55, maxWidth: '60ch' }}>
              {onPitch
                ? <>Go on {c.name}&rsquo;s register and your football goes with you. It is not a trial spot and it is not a decision — there is nothing here to be turned down from.</>
                : <>{c.name} hasn&rsquo;t claimed this page, so there is no register here. Send them your CV instead — it goes as a link, and you can switch it off.</>}
            </div>
            {/* Only a club with a register can invite anyone to a trial: on an
                unclaimed page the line would promise what cannot happen. */}
            {pickedTrial && onPitch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface2, borderRadius: 12, padding: '9px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>For <b style={{ color: T.ink }}>{pickedTrial.title}</b> — {c.name} can invite you to it.</div>
              </div>
            )}
            {picked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface2, borderRadius: 12, padding: '9px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>For <b style={{ color: T.ink }}>{picked.name}</b> — you can change it on the next screen.</div>
              </div>
            )}
            <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!onPitch ? (
              !me ? (
                <Link href="/signin" className={playPrimary}>Sign in to send your CV</Link>
              ) : myRecord ? (
                <Link href={`/send/${myRecord}?club=${c.public_slug}`} className={playPrimary}>Send my CV to {c.name}</Link>
              ) : children.length > 0 ? (
                // One glow per screen (spec A part 18): the first child's
                // button, in reading order. The others are the same primary.
                children.map((k, i) => (
                  <Link key={k.recordId} href={`/send/${k.recordId}?club=${c.public_slug}`} className={i === 0 || unclaimed ? playPrimary : 'btn btn-primary'}>Send {k.name}&rsquo;s CV to {c.name}</Link>
                ))
              ) : (
                <Link href="/join" className={playPrimary}>Build a CV first — it is what the club reads</Link>
              )
            ) : !me ? (
              <Link href="/signin" className="btn btn-primary fl-glow">Sign in to register your interest</Link>
            ) : myRecord ? (
              <Link href={`/register-interest/${myRecord}?club=${c.id}${squadQuery}`} className="btn btn-primary fl-glow">Register my interest</Link>
            ) : children.length > 0 ? (
              children.map((k, i) => (
                <Link key={k.recordId} href={`/register-interest/${k.recordId}?club=${c.id}${squadQuery}`} className={i === 0 ? 'btn btn-primary fl-glow' : 'btn btn-primary'}>
                  Register {k.name}&rsquo;s interest
                </Link>
              ))
            ) : (
              <Link href="/join" className="btn btn-secondary">Build a CV first — it is what the club reads</Link>
            )}
            </div>
          </div>
          )}

          {/* A squad is the bucket the club's own register sorts into, so
              tapping one starts that registration already filed. */}
          {squads.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={label}>Teams &amp; age groups</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {squads.map((s) => {
                  const on = picked?.id === s.id;
                  // Suspended: the team is named, and it is not a way onto
                  // anything (brief L).
                  if (suspended) {
                    return (
                      <span key={s.id} style={{
                        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px',
                        fontSize: 13, fontWeight: 700, color: T.secondary,
                      }}>{s.name}</span>
                    );
                  }
                  return (
                    <Link key={s.id} href={on ? `/fc/${slug}#play` : `/fc/${slug}?squad=${s.id}#play`} className="lift"
                      style={{
                        background: on ? 'rgba(61,220,132,.12)' : 'var(--fl-surface)',
                        border: `1px solid ${on ? T.accent : T.line}`,
                        boxShadow: on ? 'none' : 'var(--shadow-card)',
                        // D-147: >=44px at every width (D-68).
                        borderRadius: 999, display: 'inline-flex', alignItems: 'center',
                        minHeight: 44, padding: '0 18px', fontSize: 13, fontWeight: 700,
                        color: on ? T.accent : T.ink, textDecoration: 'none',
                      }}>{s.name}</Link>
                  );
                })}
              </div>
              {!suspended && (
                <div style={{ fontSize: 12, color: T.placeholder, fontWeight: 500 }}>
                  {picked ? `The register will say ${picked.name}. Tap it again to clear it.` : 'Tap a squad to go on the register for it.'}
                </div>
              )}
            </section>
          )}

          {wanted.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={label}>Players wanted</h2>
              {wanted.map((w) => (
                <div key={w.title} className="fl-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{w.title}</div>
                    {w.detail && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{w.detail}</div>}
                  </div>
                  {c.contact_email ? (
                    <a href={`mailto:${c.contact_email}`} style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0, textDecoration: 'none' }}>Email the club</a>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, flexShrink: 0 }}>Ask on the register</div>
                  )}
                </div>
              ))}
            </section>
          )}

          {videos.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={label}>Club video</h2>
              <div className="fl-grid-2">
                {videos.map((v, i) => (
                  <ClipCard key={v.url} title={v.title} url={v.url} gradientAlt={i % 2 === 1}
                    sub={i === 0 ? 'Nothing loads until you press play' : undefined} />
                ))}
              </div>
            </section>
          )}

          {/* The single most persuasive thing on this page for a parent. The
              destination gets the accent, because the destination is the
              argument. */}
          {alumni.length > 0 && (
            <section className="fl-card" style={{ background: 'var(--hero)', padding: '24px 22px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>The pathway is real</h2>
                <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, marginTop: 3 }}>Where {c.name} juniors went next.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {alumni.map((a, i) => {
                  const [from, to] = splitArrow(a.line);
                  return (
                    <div key={a.line} style={{ padding: '13px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{from}</span>
                        {to && (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M4 12 h15" /><path d="M13 6 l6 6 l-6 6" /></svg>
                            <span style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>{to}</span>
                          </>
                        )}
                      </div>
                      {a.detail && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 3 }}>{a.detail}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: T.placeholder, fontWeight: 500, lineHeight: 1.5 }}>Named players are 18+ and have given permission. Younger pathway stories stay unnamed.</div>
            </section>
          )}
        </div>

        {!unclaimed && aside}
      </div>
      {/* Say it once (post-release audit #13, ruled 2 Oct): ONE report link
          per club page. An unclaimed page's is the banner's "Ask us to update
          or remove it" (D-172 U6); every other club page carries this quiet
          one, with the page's path. The site footer leaves its "Report a
          page" off a club page for that reason (components/SiteFooter). */}
      {!unclaimed && (
        <div className="fl-wide" style={{ paddingBottom: 24 }}>
          <a href={`/report?kind=club_page&page=${encodeURIComponent(`/fc/${slug}`)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, fontSize: 11.5, color: T.muted, fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
        </div>
      )}
    </div>
    <PublicAnalytics />
    </>
  );
}
