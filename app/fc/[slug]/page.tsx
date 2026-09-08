// The public club page — ClubCV.dc.html, copy verbatim where data exists.
// Squads render as first-class rows including girls'/women's teams (D-68);
// trial notices auto-expire past their date; the alumni wall renders only
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
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import ClipCard from '@/components/cv/ClipCard';
import Wordmark from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', placeholder: '#6b7d73',
};

export const dynamic = 'force-dynamic';

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

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
  searchParams: Promise<{ squad?: string }>;
}) {
  const { slug } = await params;
  const { squad: squadParam } = await searchParams;
  const { rows } = await db.query(
    `select c.id, c.name, c.suburb, c.state, c.club_state, c.philosophy, c.established, c.pathway_line, c.public_slug, c.crest_path, c.banner_path, c.contact_email,
       -- Squads sort by age NUMERICALLY, not by name. Sorting the name as
       -- text drops 'Seniors Women' between 'MiniRoos U9' and 'U13 Boys',
       -- which reads as a bug to any club that looks at its own page. Same
       -- rule the register uses (0016); seniors and unrecognised sort last.
       (select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'gender', s.competition_gender)
                                 order by coalesce(ag.sort, 999), s.name), '[]'::json)
        from squad s left join age_group ag on ag.code = s.age_group
        where s.club_id = c.id) as squads,
       (select coalesce(json_agg(json_build_object(
           'title', t.title, 'timeVenue', t.time_venue,
           'mon', upper(to_char(t.trial_on, 'Mon')), 'day', to_char(t.trial_on, 'DD'),
           'how', t.how_to_register) order by t.trial_on), '[]'::json)
        from trial_notice t where t.club_id = c.id
          and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date) as trials,
       (select coalesce(json_agg(json_build_object('title', w.title, 'detail', w.detail) order by w.created_at), '[]'::json)
        from players_wanted_notice w where w.club_id = c.id) as wanted,
       (select coalesce(json_agg(json_build_object('line', a.line, 'detail', a.detail) order by a.sort), '[]'::json)
        from alumni_entry a where a.club_id = c.id) as alumni,
       (select coalesce(json_agg(json_build_object('url', v.url, 'title', v.title) order by v.sort, v.created_at), '[]'::json)
        from club_video v where v.club_id = c.id) as videos,
       (select count(*)::int from coaching_role cr where cr.club_id = c.id and cr.closed_at is null
          and (cr.closes_on is null or cr.closes_on >= (now() at time zone 'Australia/Melbourne')::date)) as open_roles
     from club c where c.public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const squads: { id: string; name: string; gender: string }[] = c.squads;
  const trials: { title: string; timeVenue: string; mon: string; day: string; how: string | null }[] = c.trials;
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
               'name', ch.first_name,
               'recordId', (select id from development_record where person_id = ch.id))), '[]'::json)
            from guardianship_link g join person ch on ch.id = g.child_id
            where g.guardian_id = $1 and g.approved_at is not null and g.revoked_at is null) as children`,
        [me],
      )).rows[0]
    : null;
  const children: { name: string; recordId: string | null }[] = (viewer?.children ?? []).filter(
    (k: { recordId: string | null }) => k.recordId,
  );
  const myRecord: string | null = viewer?.my_record ?? null;

  // A squad chip is the front door of the thing the club pays for, so it
  // should open it. It cannot link straight to a registration, because who is
  // registering depends on the seat — a parent of three has three answers.
  // So the chip selects ON THIS PAGE and the register card below carries the
  // choice into whichever button that viewer gets. One mechanism, every seat,
  // signed in or not.
  const picked = squads.find((s) => s.id === squadParam) ?? null;
  const squadQuery = picked ? `&squad=${picked.id}` : '';

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>

        {c.banner_path && (
          <img src={c.banner_path} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 22, display: 'block' }} />
        )}

        <div style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '24px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* The crest was 66px — the same size as a player's avatar, on the
                one page where the badge IS the identity. */}
            <div style={{ width: 96, height: 96, borderRadius: 20, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 36, overflow: 'hidden', flexShrink: 0 }}>
              {c.crest_path
                ? <img src={c.crest_path} alt="" width={96} height={96} style={{ objectFit: 'contain' }} />
                : c.name[0]}
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '4px 11px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>Club</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{c.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{[c.established ? `Est. ${c.established}` : null, [c.suburb, c.state].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</div>
            {c.pathway_line && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{c.pathway_line}</div>}
            {/* The hero had the most room on the page and did the least with
                it. These are facts a family actually weighs, and we hold them
                already. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, marginTop: 12, flexWrap: 'wrap' }}>
              {squads.length > 0 && (
                <div>
                  <div className="numeral numeral-m" style={{ color: '#eef5f0' }}>{squads.length}</div>
                  <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Squads</div>
                </div>
              )}
              {trials.length > 0 && (
                <div>
                  <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{trials.length}</div>
                  <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Trials coming</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            {c.club_state === 'verified' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                <span>Verified club</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>Compiled from public information — not affiliated until claimed</div>
            )}
          </div>
        </div>

        {/* Trials are the only dated thing on the page and they were fifth.
            A family visiting in September wants the date before they want the
            philosophy, and the hero has just promised a number. */}
        {trials.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Trials</div>
            <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {trials.map((t, i) => (
                <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                  <div style={{ background: 'rgba(61,220,132,.12)', borderRadius: 11, padding: '7px 10px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: T.accent }}>{t.mon}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{t.day}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{t.timeVenue}</div>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 11, fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
                <b style={{ color: T.secondary }}>How to register:</b> go on {c.name}&rsquo;s register below and your CV goes with you. The club works one list all year — you do not have to catch a particular week.
              </div>
            </div>
          </div>
        )}

        {/* The way onto the club's register. The club pays for this list and
            their own page had no door into it — the trials copy sent families
            around us to contact the club directly, which is the version of
            this product that does not work.

            Session-aware, and it only ever ADDS: a signed-out visitor sees
            the same page plus an invitation to sign in. Under 16 the child
            composes and it routes to their parent to send (D-91), which is
            what /register-interest already does — this is just the door. */}
        <div id="play" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11, scrollMarginTop: 18 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, letterSpacing: '-0.015em' }}>Want to play here?</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            Go on {c.name}&rsquo;s register and your football goes with you. It is not a trial spot and it is not a decision — there is nothing here to be turned down from.
          </div>
          {picked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface2, borderRadius: 12, padding: '9px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>For <b style={{ color: T.ink }}>{picked.name}</b> — you can change it on the next screen.</div>
            </div>
          )}
          {!me ? (
            <Link href="/signin" className="btn btn-primary">Sign in to register your interest</Link>
          ) : myRecord ? (
            <Link href={`/register-interest/${myRecord}?club=${c.id}${squadQuery}`} className="btn btn-primary">Register my interest</Link>
          ) : children.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {children.map((k) => (
                <Link key={k.recordId} href={`/register-interest/${k.recordId}?club=${c.id}${squadQuery}`}
                  className="btn btn-primary">
                  Register {k.name}&rsquo;s interest
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/join" style={{ background: T.surface2, color: T.ink, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textDecoration: 'none', border: `1px solid ${T.line}` }}>Build a CV first — it is what the club reads</Link>
          )}
        </div>

        {c.philosophy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Our philosophy</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500 }}>{c.philosophy}</div>
          </div>
        )}

        {/* The most-looked-at element on the page used to be eleven inert
            pills. A squad is the bucket the club's own register sorts into,
            so tapping one should start that registration already filed. */}
        {squads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Teams &amp; age groups</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {squads.map((s) => {
                const on = picked?.id === s.id;
                return (
                  <Link key={s.id} href={on ? `/fc/${slug}#play` : `/fc/${slug}?squad=${s.id}#play`} className="lift"
                    style={{
                      background: on ? 'rgba(61,220,132,.12)' : T.surface,
                      border: `1px solid ${on ? T.accent : T.line}`,
                      borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                      color: on ? T.accent : T.secondary, textDecoration: 'none',
                    }}>{s.name}</Link>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: T.placeholder, fontWeight: 500 }}>
              {picked ? `The register will say ${picked.name}. Tap it again to clear it.` : 'Tap a squad to go on the register for it.'}
            </div>
          </div>
        )}

        {wanted.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Players wanted</div>
            {wanted.map((w) => (
              <div key={w.title} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{w.title}</div>
                  {w.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{w.detail}</div>}
                </div>
                {c.contact_email ? (
                  <a href={`mailto:${c.contact_email}`} style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0, textDecoration: 'none' }}>Email the club</a>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, flexShrink: 0 }}>Ask on the register</div>
                )}
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={label}>Club video</div>
            {videos.map((v, i) => (
              <ClipCard key={v.url} title={v.title} url={v.url} gradientAlt={i % 2 === 1} sub="Nothing loads until you press play" />
            ))}
          </div>
        )}

        {/* The single most persuasive thing on this page for a parent, and it
            was three grey rows under an 11px label. It gets the panel and the
            headline; the destination gets the accent, because the destination
            is the argument. */}
        {alumni.length > 0 && (
          <div style={{ borderRadius: 20, background: 'linear-gradient(160deg, #16281f 0%, #0e1b15 72%)', border: `1px solid ${T.line}`, padding: '20px 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.015em' }}>The pathway is real</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, marginTop: 3 }}>Where {c.name} juniors went next.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {alumni.map((a, i) => {
                const [from, to] = splitArrow(a.line);
                return (
                  <div key={a.line} style={{ padding: '13px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{from}</span>
                      {to && (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M4 12 h15" /><path d="M13 6 l6 6 l-6 6" /></svg>
                          <span style={{ fontSize: 15, fontWeight: 900, color: T.accent }}>{to}</span>
                        </>
                      )}
                    </div>
                    {a.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 3 }}>{a.detail}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: T.placeholder, fontWeight: 500, lineHeight: 1.5 }}>Named players are 18+ and have given permission. Younger pathway stories stay unnamed.</div>
          </div>
        )}

        {c.open_roles > 0 && (
          <Link href="/jobs" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>{c.name} is looking for coaches</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{c.open_roles} open {c.open_roles === 1 ? 'role' : 'roles'}</div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>See them</div>
          </Link>
        )}

        <a href={`/report?kind=club_page`} style={{ fontSize: 11, color: '#3a4a42', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
      </div>
    </div>
  );
}
