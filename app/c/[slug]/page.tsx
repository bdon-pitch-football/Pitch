// The public coach CV — CoachCV.dc.html, copy verbatim where data exists.
// Reached by the STABLE public slug (D-100): no token, no expiry, separate
// resolver from /p. WWCC shows as a chip only when a club has attested it —
// never a number (D-98). An unknown slug is a plain 404: coaches are public
// adults; there is no existence oracle to protect here.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
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
    `select cp.id, cp.region, cp.philosophy, cp.badges, cp.public_slug,
       p.first_name, coalesce(p.last_name,'') as last_name,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select coalesce(json_agg(json_build_object('title', title, 'org', org_name,
           'from', started_year, 'to', ended_year) order by sort), '[]'::json)
        from coach_role where coach_profile_id = cp.id) as roles
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Coaching history</div>
          {roles.map((r) => (
            <div key={r.title + r.org} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{r.org} · {r.from} — {r.to ?? 'now'}</div>
              </div>
              {!r.to && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>Current</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(237,161,0,.12)', borderRadius: 999, padding: '4px 10px' }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: T.amber }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.amber }}>Coming December</div>
            </div>
          </div>
          <div style={{ background: T.surface, borderRadius: 13, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 700 }}>Players developed · improvement delivered</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: T.accent }}>DEC</div>
          </div>
        </div>

        <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Public coaching CV link</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/{c.public_slug}</div>
        </div>

        <a href={`/report?kind=coach_cv`} style={{ fontSize: 11, color: '#3a4a42', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
      </div>
    </div>
  );
}
