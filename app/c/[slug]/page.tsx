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

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';

export default async function CoachCv({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select cp.id, cp.region, cp.philosophy, cp.badges, cp.public_slug, cp.public_contact,
       p.first_name, coalesce(p.last_name,'') as last_name,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select coalesce(json_agg(json_build_object('title', title, 'org', org_name,
           'from', started_year, 'to', ended_year) order by sort), '[]'::json)
        from coach_role where coach_profile_id = cp.id) as roles,
       (select coalesce(json_agg(json_build_object('url', cc.url, 'title', cc.title) order by cc.sort, cc.created_at), '[]'::json)
        from coach_clip cc where cc.coach_profile_id = cp.id) as clips
     from coach_profile cp join person p on p.id = cp.person_id
     where cp.public_slug = $1`,
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

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>

        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '24px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: 66, height: 66, borderRadius: 20, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24 }}>{initials}</div>
            <div style={{ border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '4px 11px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>Coach</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{name}</div>
            {current && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{current.title}</div>}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{[current?.org, c.region].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(c.badges as string[]).map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 L14.6 8.6 L20.5 9.3 L16.2 13.4 L17.4 19.3 L12 16.3 L6.6 19.3 L7.8 13.4 L3.5 9.3 L9.4 8.6 Z" /></svg>
                <span>{b}</span>
              </div>
            ))}
            {c.wwcc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                <span>WWCC</span>
              </div>
            )}
          </div>
        </div>

        {c.philosophy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Coaching philosophy</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500 }}>{c.philosophy}</div>
          </div>
        )}

        {/* The history was six identical boxes: a role Sam left in 2021 looked
            exactly like the one he holds now. The current role is promoted to
            a card of its own; everything before it becomes a quiet timeline
            with a rule down the side, because it is context rather than
            headline. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="kicker">Coaching now</div>
          {current ? (
            <div className="card card-accent" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: 'var(--ls-title)' }}>{current.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 700 }}>{current.org}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                Since {current.from}{yearsCoaching ? ` · ${yearsCoaching} years coaching` : ''}
              </div>
            </div>
          ) : (
            <div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              Not currently attached to a club.
            </div>
          )}

          {past.length > 0 && (
            <>
              <div className="kicker" style={{ marginTop: 4 }}>Before that</div>
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

        {/* Was a card competing with the history. It is a footnote about
            something that has not happened yet, so it reads as one. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--amber)', flexShrink: 0 }} />
          Players developed and improvement delivered arrive here in December.
        </div>

        <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Public coaching CV link</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/{c.public_slug}</div>
        </div>

        {clips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={label}>Sessions &amp; clips</div>
            {clips.map((v, i) => (
              <ClipCard key={v.url} title={v.title} url={v.url} gradientAlt={i % 2 === 1} sub="Nothing loads until you press play" />
            ))}
          </div>
        )}

        {showContact && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Getting in touch</div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={`mailto:${c.public_contact}`} style={{ fontSize: 14.5, fontWeight: 800, color: T.accent, textDecoration: 'none' }}>{c.public_contact}</a>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
                For clubs and other adults. {name} published this themselves — it is their own address, not one we handed over.
              </div>
            </div>
          </div>
        )}

        <CopyLink url={`https://pitchfootball.com.au/${c.public_slug}`} label="Copy this link" />

        <a href={`/c/${c.public_slug}/print`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Print or save as PDF</a>

        <a href={`/report?kind=coach_cv`} style={{ fontSize: 11, color: '#3a4a42', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
      </div>
    </div>
  );
}
