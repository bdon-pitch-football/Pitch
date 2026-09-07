// The public club page — ClubCV.dc.html, copy verbatim where data exists.
// Squads render as first-class rows including girls'/women's teams (D-68);
// trial notices auto-expire past their date; the alumni wall renders only
// when it has content and its footnote states the naming guardrail plainly.
// Unclaimed pages carry the D-64 disclaimer instead of the verified chip.
// (Design link reads pitchfootball.com.au/<slug>; root-level rewrites map
// that at deploy time — the route lives at /fc/<slug>.)
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

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select c.id, c.name, c.suburb, c.state, c.club_state, c.philosophy, c.established, c.pathway_line, c.public_slug, c.crest_path, c.banner_path, c.contact_email,
       (select coalesce(json_agg(json_build_object('name', s.name, 'gender', s.competition_gender) order by s.name), '[]'::json)
        from squad s where s.club_id = c.id) as squads,
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
  const squads: { name: string; gender: string }[] = c.squads;
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

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>

        {c.banner_path && (
          <img src={c.banner_path} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 22, display: 'block' }} />
        )}

        <div style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '24px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: 66, height: 66, borderRadius: 16, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, overflow: 'hidden' }}>
              {c.crest_path
                ? <img src={c.crest_path} alt="" width={66} height={66} style={{ objectFit: 'contain' }} />
                : c.name[0]}
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '4px 11px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>Club</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{c.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{[c.established ? `Est. ${c.established}` : null, [c.suburb, c.state].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</div>
            {c.pathway_line && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{c.pathway_line}</div>}
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

        {/* The way onto the club's register. The club pays for this list and
            their own page had no door into it — the trials copy sent families
            around us to contact the club directly, which is the version of
            this product that does not work.

            Session-aware, and it only ever ADDS: a signed-out visitor sees
            the same page plus an invitation to sign in. Under 16 the child
            composes and it routes to their parent to send (D-91), which is
            what /register-interest already does — this is just the door. */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, letterSpacing: '-0.015em' }}>Want to play here?</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            Go on {c.name}&rsquo;s register and your football goes with you. It is not a trial spot and it is not a decision — there is nothing here to be turned down from.
          </div>
          {!me ? (
            <Link href="/signin" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Sign in to register your interest</Link>
          ) : myRecord ? (
            <Link href={`/register-interest/${myRecord}?club=${c.id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Register my interest</Link>
          ) : children.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {children.map((k) => (
                <Link key={k.recordId} href={`/register-interest/${k.recordId}?club=${c.id}`}
                  style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
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

        {squads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Teams &amp; age groups</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {squads.map((s) => (
                <div key={s.name} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, color: T.secondary }}>{s.name}</div>
              ))}
            </div>
          </div>
        )}

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

        {alumni.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>The pathway is real</div>
            <div style={{ ...card, padding: '5px 15px' }}>
              {alumni.map((a, i) => (
                <div key={a.line} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M3 17 L9 11 L13 15 L21 7" /><path d="M15 7 h6 v6" /></svg>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>{a.line}</div>
                    {a.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{a.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.placeholder, fontWeight: 500 }}>Named players are 18+ and have given permission. Younger pathway stories stay unnamed.</div>
          </div>
        )}

        <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Club page link</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/{c.public_slug}</div>
        </div>

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
