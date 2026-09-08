// The coach CV's social card (doc 14 L53).
//
// It carries THE COACH ONLY. No player, no squad, no minor's name — a coach
// pasting their link into a parents' group chat must not unfurl a child into
// that chat. There is no player data reachable from this route at all: it
// selects from coach_profile and person, and nothing else.
//
// Unlike the player card this needs no token check — a coach link is stable
// and public by design (D-75, D-100), which is also why the coach route never
// touches the token resolver (L47).
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (w: string) => readFileSync(join(process.cwd(), 'assets', 'fonts', `Archivo-${w}.ttf`));

export default async function CoachCard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows } = await db.query(
    `select p.first_name, coalesce(p.last_name,'') as last_name, cp.region,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select cr.title from coach_role cr where cr.coach_profile_id = cp.id and cr.ended_year is null
        order by cr.sort limit 1) as current_title
     from coach_profile cp join person p on p.id = cp.person_id
     where cp.public_slug = $1`,
    [slug],
  );
  const c = rows[0];
  const name = c ? `${c.first_name} ${c.last_name}`.trim() : 'Pitch';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: 64, color: '#eef5f0' }}>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', color: '#7d8f85' }}>COACH</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1 }}>{name}</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>
            {[c?.current_title, c?.region].filter(Boolean).join(' · ')}
          </div>
          {c?.wwcc && (
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: '#3ddc84' }}>WWCC verified</div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: '#3ddc84' }}>PITCH</div>
      </div>
    ),
    { ...size, fonts: [
      { name: 'Archivo', data: font('700'), weight: 700 },
      { name: 'Archivo', data: font('900'), weight: 900 },
    ] },
  );
}
