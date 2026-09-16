// The public coach CV — CoachCV.dc.html, copy verbatim where data exists.
// Reached by the STABLE public slug (D-100): no token, no expiry, separate
// resolver from /p. WWCC shows as a chip only when a club has attested it —
// never a number (D-98). An unknown slug is a plain 404: coaches are public
// adults; there is no existence oracle to protect here.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import ClipCard from '@/components/cv/ClipCard';
import CopyLink from '@/components/cv/CopyLink';
import { getSessionPersonId } from '@/lib/session';
import Wordmark from '@/components/Wordmark';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

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
       -- Pitch stands behind, so it only renders for the club we actually
       -- hold a live coaching membership at.
       (select json_build_object('name', c2.name, 'crest', c2.crest_path)
        from membership m join club c2 on c2.id = m.club_id
        where m.person_id = p.id and m.role = 'coach' and m.ended_at is null limit 1) as held_club,
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
  const held: { name: string; crest: string | null } | null = c.held_club;
  // Distinct clubs across the whole record — a number a club weighs, and one
  // we already hold. Free-text org names, so compared as the coach wrote them.
  const clubCount = new Set(roles.map((r) => r.org).filter(Boolean)).size;
  // The crest only belongs next to the club line when the club named there is
  // the one we hold the membership at. Otherwise it is a badge on a claim.
  const showCrest = Boolean(held?.crest && held.name === current?.org);

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

  const label = sectionLabel;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>

        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', display: 'flex', flexDirection: 'column' }}>
          {/* Same composition as the club page: photo over the banner, the
              picture darkened where the photo and the name sit, and the whole
              thing degrading to the plain gradient for the coach who has not
              uploaded one — which is most of them on day one. */}
          {hasBanner && (
            <div style={{ position: 'relative', lineHeight: 0 }}>
              <img src={c.banner_path} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,21,16,0) 42%, rgba(10,21,16,.78) 100%)' }} />
            </div>
          )}
          <div style={{ padding: hasBanner ? '0 20px 22px 20px' : '24px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* position:relative is load-bearing — the banner scrim is
              absolutely positioned and would otherwise paint over the photo. */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: hasBanner ? 'flex-end' : 'flex-start', marginTop: hasBanner ? -42 : 0 }}>
            {c.photo_path ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.photo_path} alt="" width={84} height={84} style={{ width: 84, height: 84, borderRadius: 22, objectFit: 'cover', border: hasBanner ? '3px solid #0e1b14' : '1.5px solid rgba(255,255,255,.2)', boxShadow: hasBanner ? '0 0 0 1px rgba(238,245,240,.18), 0 10px 26px rgba(0,0,0,.5)' : 'none' }} />
            ) : (
              <div style={{ width: 84, height: 84, borderRadius: 22, background: hasBanner ? '#1b2b22' : 'rgba(255,255,255,.12)', border: hasBanner ? '3px solid #0e1b14' : 'none', boxShadow: hasBanner ? '0 0 0 1px rgba(238,245,240,.18), 0 10px 26px rgba(0,0,0,.5)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 30 }}>{initials}</div>
            )}
            <div style={{ border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '4px 11px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', background: hasBanner ? 'rgba(6,19,12,.5)' : 'transparent', marginBottom: hasBanner ? 8 : 0 }}>Coach</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{name}</h1>
            {current && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{current.title}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {showCrest && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={held!.crest!} alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{[current?.org, c.region].filter(Boolean).join(' · ')}</div>
            </div>
            {/* Years coaching was 12px muted text at the foot of a card below
                the fold — the single number a club hires on. The hero had the
                room and was doing the least with it of the three profile
                types. Both figures come off the record already. */}
            {(yearsCoaching > 0 || clubCount > 1) && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, marginTop: 12, flexWrap: 'wrap' }}>
                {yearsCoaching > 0 && (
                  <div>
                    <div className="numeral numeral-m" style={{ color: T.ink }}>{yearsCoaching}</div>
                    <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Years coaching</div>
                  </div>
                )}
                {clubCount > 1 && (
                  <div>
                    <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{clubCount}</div>
                    <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Clubs</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* The hero used to carry a chip per licence, which was fine at one
              and a cram at five — and it put a self-declared credential
              shoulder to shoulder with the WWCC, the one thing on this page
              a club actually attested. The WWCC keeps the hero. Licences get
              a section of their own that can say who issued them and when. */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {c.wwcc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                <span>WWCC</span>
              </div>
            )}
          </div>
          </div>
        </div>

        {c.philosophy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={label}>Coaching philosophy</h2>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500 }}>{c.philosophy}</div>
          </div>
        )}

        {/* The history was six identical boxes: a role Sam left in 2021 looked
            exactly like the one he holds now. The current role is promoted to
            a card of its own; everything before it becomes a quiet timeline
            with a rule down the side, because it is context rather than
            headline. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="kicker">Coaching now</h2>
          {current ? (
            <div className="card card-accent" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: 'var(--ls-title)' }}>{current.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 700 }}>{current.org}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Since {current.from}</div>
            </div>
          ) : (
            <div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              Not currently attached to a club.
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="kicker" style={{ marginTop: 4 }}>Before that</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingLeft: 14, borderLeft: '2px solid var(--line)' }}>
                {past.map((r) => (
                  <div key={r.title + r.org + r.from} style={{ padding: '9px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--secondary)' }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{r.org}</div>
                    </div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {r.from} — {r.to}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Licences and accomplishments are BOTH self-declared, and the page
            says so once, plainly, at the foot of the pair — rather than
            hedging every line or, worse, letting them sit next to the WWCC
            in the hero looking equally checked. Same discipline as
            "self-reported" on a player's stats. */}
        {licences.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 className="kicker">Licences &amp; qualifications</h2>
            <div className="card" style={{ padding: '4px 15px' }}>
              {licences.map((l, i) => (
                <div key={l.title + (l.year ?? '')} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 3 L14.6 8.6 L20.5 9.3 L16.2 13.4 L17.4 19.3 L12 16.3 L6.6 19.3 L7.8 13.4 L3.5 9.3 L9.4 8.6 Z" /></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{l.title}</div>
                    {l.issuer && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{l.issuer}</div>}
                  </div>
                  {l.year && (
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{l.year}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {wins.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 className="kicker">As a coach</h2>
            {wins.map((a, i) => (
              <div key={a.title} className="lift card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 14px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(61,220,132,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {i === 0
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21 H16 M12 17 V21 M7 4 H17 V8 A5 5 0 0 1 7 8 Z M7 5 H4 V7 A3 3 0 0 0 7 9 M17 5 H20 V7 A3 3 0 0 1 17 9" /></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17 L9 11 L13 15 L21 7" /><path d="M15 7 h6 v6" /></svg>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{a.title}</div>
                  {a.detail && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{a.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {(licences.length > 0 || wins.length > 0) && (
          <div style={{ fontSize: 11.5, color: T.placeholder, fontWeight: 500, lineHeight: 1.5 }}>
            Licences and results above are {c.first_name}&rsquo;s own account. The Working With Children Check is the one thing on this page a club confirmed.
          </div>
        )}

        {/* The clips are the closest thing to watching this coach work, and
            they sat UNDER an address card the coach already has in their own
            editor. Content first; the roadmap footnote after it, not before. */}
        {clips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={label}>Sessions &amp; clips</h2>
            {/* The reassurance belongs on the first card. Repeated under every
                card it stops being reassurance and starts being wallpaper —
                the same thing the player CV was doing with its clips. */}
            {clips.map((v, i) => (
              <ClipCard key={v.url} title={v.title} url={v.url} gradientAlt={i % 2 === 1}
                sub={i === 0 ? 'Nothing loads until you press play' : undefined} />
            ))}
          </div>
        )}

        {/* Was a card competing with the history. It is a footnote about
            something that has not happened yet, so it reads as one. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--amber)', flexShrink: 0 }} />
          Players developed and improvement delivered arrive here in December.
        </div>

        {showContact && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={label}>Getting in touch</h2>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={`mailto:${c.public_contact}`} style={{ fontSize: 14.5, fontWeight: 800, color: T.accent, textDecoration: 'none' }}>{c.public_contact}</a>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
                For clubs and other adults. {name} published this themselves — it is their own address, not one we handed over.
              </div>
            </div>
          </div>
        )}

        <CopyLink url={`https://pitchfootball.com.au/c/${c.public_slug}`} label="Copy this link" />

        <a href={`/c/${c.public_slug}/print`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Print or save as PDF</a>

        <a href={`/report?kind=coach_cv`} style={{ display: 'block', padding: '16px 12px', margin: '-16px -12px', fontSize: 11, color: '#3a4a42', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
      </div>
    </div>
  );
}
