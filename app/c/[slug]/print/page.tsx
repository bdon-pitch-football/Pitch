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
//
// Floodlit (spec E, BUZ 1 Oct): the sheet takes C's print tokens
// (--print-*), so the coach and player prints are one light surface; the
// own-account line moves to --print-muted (it was 3.2:1 on white); the
// sides are 18px on a phone.
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
      where cp.public_slug = $1 and fn_coach_page_public(cp.id)`, [slug]);
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
     where cp.public_slug = $1 and fn_coach_page_public(cp.id)`,
    [slug],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name = `${c.first_name} ${c.last_name}`.trim();
  const roles: { title: string; org: string; from: string | null; to: string | null }[] = c.roles;
  const clips: { title: string }[] = c.clips;
  const licences: { title: string; issuer: string | null; year: string | null }[] = c.licences ?? [];
  const wins: { title: string; detail: string | null }[] = c.wins ?? [];

  return (
    <div className="print-page">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <PrintButton />
      <div className="ps">
        <div className="ps-head">
          <h1 className="ps-name">{name}</h1>
          <div className="ps-line">
            {[roles.find((r) => !r.to)?.title, roles.find((r) => !r.to)?.org, c.region].filter(Boolean).join(' · ')}
          </div>
          <div className="ps-creds">
            {[...licences.map((l) => l.title), c.wwcc ? 'WWCC verified' : null].filter(Boolean).join(' · ')}
          </div>
        </div>

        {c.philosophy && (
          <div className="ps-sec">
            <div className="ps-k">Coaching philosophy</div>
            <div className="ps-p">{c.philosophy}</div>
          </div>
        )}

        {roles.length > 0 && (
          <div className="ps-sec">
            <div className="ps-k">Coaching history</div>
            {roles.map((r) => (
              <div key={`${r.title}-${r.org}-${r.from}`} className="ps-row">
                <div>
                  <div className="ps-t">{r.title}</div>
                  <div className="ps-s">{r.org}</div>
                </div>
                <div className="ps-yr">
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
          <div className="ps-sec">
            <div className="ps-k">Licences &amp; qualifications</div>
            {licences.map((l) => (
              <div key={l.title + (l.year ?? '')} className="ps-row q">
                <div className="ps-t7">{l.title}{l.issuer ? ` — ${l.issuer}` : ''}</div>
                {l.year && <div className="ps-yr" style={{ fontSize: 12.5 }}>{l.year}</div>}
              </div>
            ))}
          </div>
        )}

        {wins.length > 0 && (
          <div className="ps-sec">
            <div className="ps-k">As a coach</div>
            {wins.map((a) => (
              <div key={a.title} style={{ padding: '5px 0' }}>
                <div className="ps-t7">{a.title}</div>
                {a.detail && <div className="ps-s" style={{ fontSize: 12.5 }}>{a.detail}</div>}
              </div>
            ))}
          </div>
        )}

        {(licences.length > 0 || wins.length > 0) && (
          <div className="ps-note">
            Licences and results above are {c.first_name}&rsquo;s own account. The Working With Children Check is the one thing here a club confirmed.
          </div>
        )}

        {clips.length > 0 && (
          <div className="ps-sec">
            <div className="ps-k">Sessions &amp; clips</div>
            {clips.map((v) => (
              <div key={v.title} style={{ fontSize: 13, padding: '5px 0', fontWeight: 500 }}>{v.title}</div>
            ))}
            <div className="ps-s" style={{ fontSize: 11, marginTop: 6 }}>Watch these on the online version of this CV.</div>
          </div>
        )}

        <div className="ps-foot">
          pitchfootball.com.au/c/{c.public_slug}
        </div>
      </div>
    </div>
  );
}
