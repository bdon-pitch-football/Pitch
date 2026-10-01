// The public coach CV — CoachCV.dc.html, copy verbatim where data exists.
// Floodlit (spec E, BUZ 1 Oct): the player card's sibling, built from THE
// PLAYER CARD's parts and THE COACH CARD's in globals.css. E1: from 1024 the
// card is the sticky left column, as on the player CV. The card is the
// player card's own green, never a club's colours (not cleared for a coach
// page: a coach can hold two clubs).
// Reached by the STABLE public slug (D-100): no token, no expiry, separate
// resolver from /p. WWCC shows as a chip only when a club has attested it —
// never a number (D-98). An unknown slug is a plain 404: coaches are public
// adults; there is no existence oracle to protect here.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import ClipCard from '@/components/cv/ClipCard';
import CopyLink from '@/components/cv/CopyLink';
import { getSessionPersonId } from '@/lib/session';
import SiteNav from '@/components/floodlit/SiteNav';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';

// The coach's link is public, stable and indexable — it is the recruiting
// engine (D-100), so it needs a real title and a canonical that points at
// ITSELF. It inherited a root-level canonical of "/", which tells a search
// engine this page is a duplicate of the homepage and to index that instead;
// the one page built to be found was quietly asking not to be.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select p.first_name, coalesce(p.last_name,'') as last_name, cp.region
       from coach_profile cp join person p on p.id = cp.person_id
      where cp.public_slug = $1 and fn_coach_page_public(cp.id)`, [slug]);
  const c = rows[0];
  if (!c) return { title: 'Coach CV' };
  const name = `${c.first_name} ${c.last_name}`.trim();
  return {
    title: `${name} — Coach CV`,
    description: `${name}'s coaching record on Pitch${c.region ? ` — ${c.region}` : ''}.`,
    alternates: { canonical: `/c/${slug}` },
    openGraph: { title: `${name} — Coach CV`, url: `/c/${slug}` },
  };
}

export default async function CoachCv({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select cp.id, cp.region, cp.philosophy, cp.public_slug, cp.public_contact, cp.banner_path,
       p.first_name, coalesce(p.last_name,'') as last_name, p.photo_path,
       -- The crest comes from MEMBERSHIP, never from coach_role.org_name:
       -- a role is free text that grants nothing (0006, the same discipline
       -- as D-72), so a coach could type any club's name. A badge is a claim
       -- Pitch stands behind, so it only renders for a club they actually
       -- hold a live membership at: a coach's, or a Technical Director's —
       -- the role confirmed on the club's verification call (0058, D-93),
       -- which is a stronger claim than a coach's and was the one left as
       -- plain text. Every such club, not the first: a TD at one club who
       -- coaches at another holds both.
       (select coalesce(json_agg(json_build_object('name', c2.name, 'crest', c2.crest_path)), '[]'::json)
        from membership m join club c2 on c2.id = m.club_id
        where m.person_id = p.id and m.role in ('coach', 'technical_director') and m.ended_at is null) as held_clubs,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select coalesce(json_agg(json_build_object('title', title, 'org', org_name,
           'from', started_year, 'to', ended_year)
           -- Current role first (no end year), then most recently ended. Was
           -- ordered by the sort column, i.e. insertion order, so a coach
           -- who added an older job second got their history upside down.
           order by ended_year desc nulls first, started_year desc nulls last), '[]'::json)
        from coach_role where coach_profile_id = cp.id) as roles,
       (select coalesce(json_agg(json_build_object('url', cc.url, 'title', cc.title) order by cc.sort, cc.created_at), '[]'::json)
        from coach_clip cc where cc.coach_profile_id = cp.id) as clips,
       (select coalesce(json_agg(json_build_object('title', l.title, 'issuer', l.issuer, 'year', l.year)
           -- Most recent licence first; undated ones last. Insertion order put
           -- an AFC C above an AFC B purely because it was typed first.
           order by l.year desc nulls last, l.sort), '[]'::json)
        from coach_licence l where l.coach_profile_id = cp.id) as licences,
       (select coalesce(json_agg(json_build_object('title', a.title, 'detail', a.detail) order by a.sort), '[]'::json)
        from coach_achievement a where a.coach_profile_id = cp.id) as wins
     from coach_profile cp join person p on p.id = cp.person_id
     where cp.public_slug = $1 and fn_coach_page_public(cp.id)`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name = `${c.first_name} ${c.last_name}`.trim();
  const initials = `${c.first_name[0]}${c.last_name[0] ?? ''}`;
  const roles: { title: string; org: string; from: string | null; to: string | null }[] = c.roles;
  const current = roles.find((r) => !r.to);
  const past = roles.filter((r) => r.to);
  // Years coaching, from the earliest role on the record. A number a club
  // actually cares about, and one we already hold.
  const firstYear = roles.map((r) => Number(r.from)).filter((n) => Number.isFinite(n) && n > 1900).sort()[0];
  const yearsCoaching = firstYear ? new Date().getFullYear() - firstYear : 0;
  const clips: { url: string; title: string }[] = c.clips;
  const licences: { title: string; issuer: string | null; year: string | null }[] = c.licences;
  const wins: { title: string; detail: string | null }[] = c.wins;
  const hasBanner = Boolean(c.banner_path);
  const heldClubs: { name: string; crest: string | null }[] = c.held_clubs;
  // Distinct clubs across the whole record — a number a club weighs, and one
  // we already hold. Free-text org names, so compared as the coach wrote them.
  const clubCount = new Set(roles.map((r) => r.org).filter(Boolean)).size;
  // The crest only belongs next to the club line when the club named there is
  // one we hold the membership at. Otherwise it is a badge on a claim — a
  // typed "Technical Director, <another club>" included.
  const held = heldClubs.find((h) => h.crest && h.name === current?.org);
  const showCrest = Boolean(held);

  // L48-L51. The contact route is rendered for anonymous visitors and for
  // signed-in adults, and is ABSENT FROM THE RESPONSE BODY for a signed-in
  // minor — not hidden, not disabled, absent. For an anonymous visitor we
  // cannot know whether they are a child and we deliberately do not guess:
  // no age heuristic, no signal collection. Decided in Postgres so a future
  // surface cannot forget.
  const viewer = await getSessionPersonId();
  const showContact = Boolean(c.public_contact) && (await db.query(
    'select fn_coach_contact_visible($1) as v', [viewer],
  )).rows[0].v;

  // The name is sized by its longest word and the card's own width, as on
  // the player card (the --name-len rule), so a long surname fits.
  const longestWord = Math.max(...name.split(/[\s-]+/).map((w) => w.length), 4);
  const where = [current?.org, c.region].filter(Boolean).join(' · ');
  // Licences and accomplishments are BOTH self-declared, and the page says
  // so once, plainly, at the foot of the pair — rather than hedging every
  // line or letting them sit beside the WWCC looking equally checked.
  const ownAccount = (
    <div className="quiet" style={{ marginTop: 14, maxWidth: '60ch' }}>
      Licences and results above are {c.first_name}&rsquo;s own account. The Working With Children Check is the one thing on this page a club confirmed.
    </div>
  );

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', flexDirection: 'column' }}>
      {/* E4 (BUZ, 1 Oct): signed out, the public links and a logo that goes
          home, as on the club page. Signed in, the bar is the logo alone, and
          it links to / too (Head of Product Design ruling 1, 1 Oct). */}
      {viewer
        ? <SiteNav links={[]} signIn={false} />
        : <SiteNav links={[{ href: '/claim', label: 'Find your club' }, { href: '/trials', label: 'Trials' }]} />}
      <div className="cv-root coach-root"><div className="fl-wide cv-grid">
        {/* ---- the coach card --------------------------------------------- */}
        <div className="cv-cardcol">
          <section className="cv-hero cv-hero-coach cv-rise" aria-labelledby="cv-name">
            {/* The photo over the banner, the picture darkened where the photo
                and the name sit; the plain card for the coach who has not
                uploaded one, which is most of them on day one. */}
            {hasBanner && (
              <div className="cv-banner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.banner_path} alt="" />
              </div>
            )}
            <div className="cv-top">
              {c.photo_path ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.photo_path} alt="" width={92} height={92} className="cv-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="cv-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32 }}>{initials}</div>
              )}
              <span className="cv-kind">Coach</span>
            </div>
            <h1 id="cv-name" className="cv-name" style={{ ['--name-len' as string]: longestWord } as React.CSSProperties}>{name}</h1>
            {current && <div className="cv-line">{current.title}</div>}
            {(showCrest || where) && (
              <div className="cv-where">
                {showCrest && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={held!.crest!} alt="" width={28} height={28} />
                )}
                <span>{where}</span>
              </div>
            )}
            {/* Years coaching — the single number a club hires on — and the
                clubs on the record, as one band. Both come off the record
                already; neither renders as a zero (Clubs only above one). */}
            {(yearsCoaching > 0 || clubCount > 1) && (
              <div className="cv-stats">
                <div className="cv-tiles">
                  {yearsCoaching > 0 && (
                    <div className="cv-tile">
                      <div className="cv-tile-num">{yearsCoaching}</div>
                      <div className="cv-tile-l">Years coaching</div>
                    </div>
                  )}
                  {clubCount > 1 && (
                    <div className="cv-tile">
                      <div className="cv-tile-num">{clubCount}</div>
                      <div className="cv-tile-l">Clubs</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* The WWCC keeps the card: the one thing on this page a club
                attested (D-98) — a state, never a number. Licences get a
                section of their own that can say who issued them and when. */}
            {c.wwcc && (
              <div className="cv-foot">
                <span className="cv-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                  <span>WWCC verified</span>
                </span>
              </div>
            )}
          </section>
        </div>

        {/* ---- the story -------------------------------------------------- */}
        {/* An EMPTY SECTION IS OMITTED, never rendered as a bare heading. */}
        <div className="cv-story">
          {c.philosophy && (
            <section>
              <h2 className="cv-h2">Coaching philosophy</h2>
              <div className="cv-about">{c.philosophy}</div>
            </section>
          )}

          {/* The current role leads one line; everything before it is quiet
              context on the same line, with its years at the end. */}
          <section>
            <h2 className="cv-h2">Coaching now</h2>
            {!current && (
              <div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: past.length > 0 ? 18 : 0 }}>
                Not currently attached to a club.
              </div>
            )}
            {(current || past.length > 0) && (
              <div className="cv-timeline">
                {current && (
                  <div className="cv-stop cv-stop-now">
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{current.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 700 }}>{current.org}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>Since {current.from}</div>
                  </div>
                )}
                {past.length > 0 && <h2 className="cv-tl-h">Before that</h2>}
                {past.map((r) => (
                  <div key={r.title + r.org + r.from} className="cv-stop">
                    <div className="cv-stop-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--secondary)' }}>{r.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{r.org}</div>
                      </div>
                      <div className="row-yr">{r.from} — {r.to}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {licences.length > 0 && (
            <section>
              <h2 className="cv-h2">Licences &amp; qualifications</h2>
              <div className="card rows">
                {licences.map((l) => (
                  <div key={l.title + (l.year ?? '')} className="row">
                    <span className="row-ic">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 L14.6 8.6 L20.5 9.3 L16.2 13.4 L17.4 19.3 L12 16.3 L6.6 19.3 L7.8 13.4 L3.5 9.3 L9.4 8.6 Z" /></svg>
                    </span>
                    <div className="row-main">
                      <div className="row-t">{l.title}</div>
                      {l.issuer && <div className="row-s">{l.issuer}</div>}
                    </div>
                    {l.year && <div className="row-yr">{l.year}</div>}
                  </div>
                ))}
              </div>
              {wins.length === 0 && ownAccount}
            </section>
          )}

          {wins.length > 0 && (
            <section>
              <h2 className="cv-h2">As a coach</h2>
              <div className="fl-grid-2">
                {wins.map((a, i) => (
                  <div key={a.title} className="card win">
                    <span className="win-ic">
                      {i === 0
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 21 H16 M12 17 V21 M7 4 H17 V8 A5 5 0 0 1 7 8 Z M7 5 H4 V7 A3 3 0 0 0 7 9 M17 5 H20 V7 A3 3 0 0 1 17 9" /></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 17 L9 11 L13 15 L21 7" /><path d="M15 7 h6 v6" /></svg>}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{a.title}</div>
                      {a.detail && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{a.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {ownAccount}
            </section>
          )}

          {/* The clips are the closest thing to watching this coach work.
              Click-to-play façades (D-97); the reassurance on the first card
              only — repeated under every card it is wallpaper. */}
          {clips.length > 0 && (
            <section>
              <h2 className="cv-h2">Sessions &amp; clips</h2>
              <div className="fl-grid-2">
                {clips.map((v, i) => (
                  <ClipCard key={v.url} title={v.title} url={v.url} gradientAlt={i % 2 === 1}
                    sub={i === 0 ? 'Nothing loads until you press play' : undefined} />
                ))}
              </div>
            </section>
          )}

          {/* A footnote about something that has not happened yet: the dashed
              "not yet" ring, not the amber dot (amber is a state). */}
          <div className="soon">
            <span className="notyet-dot" aria-hidden />
            Players developed and improvement delivered arrive here in December.
          </div>

          {showContact && (
            <section>
              <h2 className="cv-h2">Getting in touch</h2>
              <div className="card stack8">
                <a href={`mailto:${c.public_contact}`} style={{ fontSize: 14.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', margin: '-10px 0', overflowWrap: 'anywhere' }}>{c.public_contact}</a>
                <div className="quiet">
                  For clubs and other adults. {name} published this themselves — it is their own address, not one we handed over.
                </div>
              </div>
            </section>
          )}

          {/* Copied by the coach, never sent by Pitch (D-100, L44/L45/L54). */}
          <div className="share">
            <CopyLink url={`https://pitchfootball.com.au/c/${c.public_slug}`} label="Copy this link" />
            <a href={`/c/${c.public_slug}/print`} className="btn btn-secondary">Print or save as PDF</a>
          </div>

          <a href={`/report?kind=coach_cv&page=${encodeURIComponent(slug)}`} className="report-link" style={{ marginTop: -22 }}>Report this page</a>
        </div>
      </div></div>
    </div>
  );
}
