// The printable coaching CV (D-75, D-121). Free on every tier, for players
// and coaches alike, and never drawn as a paid feature.
//
// A coach applying for a job in September attaches this to an email, and a
// technical director prints it for a committee — so, like the player version,
// this is a LIGHT surface. A dark page drinks ink.
//
// The coach's link is public and untokenised by design (D-100), so unlike the
// player print view there is no token to check: if the profile is published,
// this renders. Clips are listed as titles rather than embeds — nothing
// third-party loads on a page meant for paper.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import PrintButton from '@/app/p/[token]/print/PrintButton';

export const dynamic = 'force-dynamic';

// Same reason as the player's print view: this title is the filename the
// browser offers when a club saves the PDF (D-121).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select p.first_name, coalesce(p.last_name,'') as last_name
       from coach_profile cp join person p on p.id = cp.person_id
      where cp.public_slug = $1`, [slug]);
  const c = rows[0];
  return {
    title: c ? `${`${c.first_name} ${c.last_name}`.trim()} — Coach CV` : 'Coach CV',
    robots: { index: false, follow: false },
  };
}

export default async function PrintCoachCv({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select cp.id, cp.region, cp.philosophy, cp.public_slug,
       p.first_name, coalesce(p.last_name,'') as last_name,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select coalesce(json_agg(json_build_object('title', title, 'org', org_name,
           'from', started_year, 'to', ended_year)
           -- Current role first (no end year), then most recently ended. Was
           -- ordered by the sort column, i.e. insertion order, so a coach
           -- who added an older job second got their history upside down.
           order by ended_year desc nulls first, started_year desc nulls last), '[]'::json)
        from coach_role where coach_profile_id = cp.id) as roles,
       (select coalesce(json_agg(json_build_object('title', cc.title) order by cc.sort), '[]'::json)
        from coach_clip cc where cc.coach_profile_id = cp.id) as clips,
       (select coalesce(json_agg(json_build_object('title', l.title, 'issuer', l.issuer, 'year', l.year)
           -- Most recent licence first; undated ones last. Insertion order put
           -- an AFC C above an AFC B purely because it was typed first.
           order by l.year desc nulls last, l.sort), '[]'::json)
        from coach_licence l where l.coach_profile_id = cp.id) as licences,
       (select coalesce(json_agg(json_build_object('title', a.title, 'detail', a.detail) order by a.sort), '[]'::json)
        from coach_achievement a where a.coach_profile_id = cp.id) as wins
     from coach_profile cp join person p on p.id = cp.person_id
     where cp.public_slug = $1`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name = `${c.first_name} ${c.last_name}`.trim();
  const roles: { title: string; org: string; from: string | null; to: string | null }[] = c.roles;
  const clips: { title: string }[] = c.clips;
  const licences: { title: string; issuer: string | null; year: string | null }[] = c.licences ?? [];
  const wins: { title: string; detail: string | null }[] = c.wins ?? [];

  const kicker: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
    color: '#5c6f65', marginBottom: 8,
  };

  return (
    <div style={{ background: '#ffffff', color: '#0b120e', minHeight: '100dvh', padding: '32px 28px' }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <PrintButton />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ borderBottom: '2px solid #0b120e', paddingBottom: 16, marginBottom: 22 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.05 }}>{name}</h1>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#3a4a42', marginTop: 4 }}>
            {[roles.find((r) => !r.to)?.title, roles.find((r) => !r.to)?.org, c.region].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5c6f65', marginTop: 6 }}>
            {[...licences.map((l) => l.title), c.wwcc ? 'WWCC verified' : null].filter(Boolean).join(' · ')}
          </div>
        </div>

        {c.philosophy && (
          <div style={{ marginBottom: 22 }}>
            <div style={kicker}>Coaching philosophy</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{c.philosophy}</div>
          </div>
        )}

        {roles.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={kicker}>Coaching history</div>
            {roles.map((r) => (
              <div key={`${r.title}-${r.org}-${r.from}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid #e6ece9' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#5c6f65', fontWeight: 500 }}>{r.org}</div>
                </div>
                <div style={{ fontSize: 12, color: '#5c6f65', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {r.from}{r.from && ' — '}{r.to ?? 'now'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* A printed CV that omits a coach's licences is not the same
            document as their page. Both new sections print, and so does the
            line that says which of them anybody checked. */}
        {licences.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={kicker}>Licences &amp; qualifications</div>
            {licences.map((l) => (
              <div key={l.title + (l.year ?? '')} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.title}{l.issuer ? ` — ${l.issuer}` : ''}</div>
                {l.year && <div style={{ fontSize: 12.5, color: '#5c6f65', fontWeight: 700, whiteSpace: 'nowrap' }}>{l.year}</div>}
              </div>
            ))}
          </div>
        )}

        {wins.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={kicker}>As a coach</div>
            {wins.map((a) => (
              <div key={a.title} style={{ padding: '5px 0' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.title}</div>
                {a.detail && <div style={{ fontSize: 12.5, color: '#5c6f65' }}>{a.detail}</div>}
              </div>
            ))}
          </div>
        )}

        {(licences.length > 0 || wins.length > 0) && (
          <div style={{ fontSize: 10.5, color: '#7d8f85', marginBottom: 22, lineHeight: 1.5 }}>
            Licences and results above are {c.first_name}&rsquo;s own account. The Working With Children Check is the one thing here a club confirmed.
          </div>
        )}

        {clips.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={kicker}>Sessions &amp; clips</div>
            {clips.map((v) => (
              <div key={v.title} style={{ fontSize: 13, padding: '5px 0', fontWeight: 500 }}>{v.title}</div>
            ))}
            <div style={{ fontSize: 11, color: '#5c6f65', marginTop: 6 }}>Watch these on the online version of this CV.</div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#5c6f65', borderTop: '1px solid #e6ece9', paddingTop: 12 }}>
          pitchfootball.com.au/c/{c.public_slug}
        </div>
      </div>
    </div>
  );
}
