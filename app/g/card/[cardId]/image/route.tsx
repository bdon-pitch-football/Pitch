// The card image — rendered ONLY behind sign-in, and only for a guardian on
// this child (D-101). No public URL exists before approval, and this route
// authorises every request rather than trusting the id.
//
// The card carries a minor's pride and never locator data (D-89): first name
// and surname initial, positions, number, chosen stats. No club, no age, no
// region — and no URL or QR that resolves back to the record.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { POSITIONS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';

const font = (w: number) => readFileSync(join(process.cwd(), 'assets/fonts', `Archivo-${w}.ttf`));
const FONTS = [
  { name: 'Archivo', data: font(700), weight: 700 as const },
  { name: 'Archivo', data: font(900), weight: 900 as const },
];

const SIZES: Record<string, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
};

export async function GET(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select sca.card_kind, p.first_name, coalesce(p.last_name,'') as last_name,
       dr.positions, dr.squad_number, dr.surfaced_stats,
       (select coalesce(json_agg(json_build_object('key', stat_key, 'value', value)), '[]'::json)
        from player_stat where record_id = dr.id and value > 0) as stats
     from share_card_approval sca
     join development_record dr on dr.id = sca.record_id
     join person p on p.id = dr.person_id
     left join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where sca.id = $1 and (g.id is not null or p.id = $2)`,
    [cardId, me],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];

  const size = SIZES[c.card_kind] ?? SIZES.story;
  const name = `${c.first_name}${c.last_name ? ` ${c.last_name[0]}.` : ''}`;
  const positions = (c.positions as PositionCode[]) ?? [];
  const stats = (c.stats as { key: StatKey; value: number }[]) ?? [];
  const tiles = ((c.surfaced_stats as StatKey[]) ?? [])
    .map((k) => ({ key: k, value: stats.find((s) => s.key === k)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number')
    .slice(0, 3);
  const big = Math.round(size.width / 11);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: size.width / 14, fontFamily: 'Archivo', background: 'radial-gradient(ellipse 120% 80% at 50% -15%, #1a4a34 0%, #123326 38%, #0c1d14 72%, #0a1510 100%)' }}>
        <div style={{ display: 'flex', fontSize: big * 0.32, fontWeight: 700, letterSpacing: big * 0.09, color: '#3ddc84' }}>PITCH</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: big * 0.22 }}>
          <div style={{ display: 'flex', fontSize: big * 1.5, fontWeight: 900, color: '#eef5f0', letterSpacing: -big * 0.06, lineHeight: 1 }}>{name}</div>
          <div style={{ display: 'flex', gap: big * 0.18, alignItems: 'center' }}>
            {c.squad_number ? (
              <div style={{ display: 'flex', fontSize: big * 0.45, fontWeight: 900, color: '#06130c', background: '#3ddc84', borderRadius: big * 0.18, padding: `${big * 0.08}px ${big * 0.24}px` }}>#{c.squad_number}</div>
            ) : null}
            <div style={{ display: 'flex', fontSize: big * 0.42, fontWeight: 700, color: '#b9c8bf' }}>{positions.join('  ·  ')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: big * 0.7 }}>
          {tiles.map((t) => (
            <div key={t.key} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: big, fontWeight: 900, lineHeight: 1, letterSpacing: -big * 0.04, color: t.key === 'goals' || t.key === 'clean_sheets' ? '#3ddc84' : '#eef5f0' }}>{String(t.value)}</div>
              <div style={{ display: 'flex', fontSize: big * 0.26, fontWeight: 700, color: '#7d8f85', textTransform: 'uppercase', letterSpacing: big * 0.05, marginTop: big * 0.1 }}>{STAT_LABELS[t.key]}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: FONTS },
  );
}
