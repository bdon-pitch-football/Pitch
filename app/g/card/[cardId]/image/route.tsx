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
import {
  POSITIONS, PROVENANCE_LABELS, STAT_LABELS, provenanceLabel, sharedProvenance,
  type PositionCode, type StatKey,
} from '@/lib/football';
import { T } from '@/lib/palette';

const font = (w: number) => readFileSync(join(process.cwd(), 'assets/fonts', `Archivo-${w}.ttf`));
const FONTS = [
  { name: 'Archivo', data: font(700), weight: 700 as const },
  { name: 'Archivo', data: font(900), weight: 900 as const },
];

// One stat as the card reads it: the number and where it came from (D-62).
interface Stat { key: StatKey; value: number; provenance: string }

const SIZES: Record<string, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
};

export async function GET(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // What the card draws is what a club may see of the page (fn_cv_held,
  // 0174; John, 3 Oct, N-5: "link-holders, clubs and cards see the last
  // version a guardian approved"): the approved snapshot while the page is
  // held — under 16, and from 16 until the player's own first write — and
  // the live record otherwise. A held page with nothing approved has nothing
  // to draw.
  const { rows } = await db.query(
    `select sca.card_kind, p.first_name, coalesce(p.last_name,'') as last_name, h.held, pv.id is not null as approved,
       case when h.held then array(select jsonb_array_elements_text(coalesce(pv.content -> 'positions', '[]'::jsonb)))
            else dr.positions end as positions,
       case when h.held then (pv.content ->> 'squadNumber')::int else dr.squad_number end as squad_number,
       case when h.held then array(select jsonb_array_elements_text(coalesce(pv.content -> 'surfacedStats', '[]'::jsonb)))
            else dr.surfaced_stats end as surfaced_stats,
       case when h.held then
         (select coalesce(json_agg(json_build_object('key', e ->> 'key', 'value', (e ->> 'value')::int, 'provenance', e ->> 'provenance')), '[]'::json)
          from jsonb_array_elements(coalesce(pv.content -> 'stats', '[]'::jsonb)) e where (e ->> 'value')::int > 0)
       else
         (select coalesce(json_agg(json_build_object('key', stat_key, 'value', value, 'provenance', provenance)), '[]'::json)
          from player_stat where record_id = dr.id and value > 0)
       end as stats
     from share_card_approval sca
     join development_record dr on dr.id = sca.record_id
     join person p on p.id = dr.person_id
     cross join lateral (select fn_cv_held(dr.id) as held) h
     left join profile_version pv on pv.record_id = dr.id and pv.status = 'approved'
     -- The person themself, or a guardian who acts for them (0177: never an
     -- adult's parent).
     where sca.id = $1 and (p.id = $2 or fn_guardian_controls($2, p.id))`,
    [cardId, me],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  if (c.held && !c.approved) notFound();

  const size = SIZES[c.card_kind] ?? SIZES.story;
  const name = `${c.first_name}${c.last_name ? ` ${c.last_name[0]}.` : ''}`;
  const positions = (c.positions as PositionCode[]) ?? [];
  const stats = (c.stats as Stat[]) ?? [];
  const tiles = ((c.surfaced_stats as StatKey[]) ?? [])
    .map((k) => stats.find((s) => s.key === k))
    .filter((s): s is Stat => s !== undefined && typeof s.value === 'number')
    .slice(0, 3);
  const big = Math.round(size.width / 11);
  // Padding comes off the SHORTER side. It was width/14 everywhere, which on
  // the 1200x630 card is 86px top and bottom out of 630: the composition only
  // just fitted (the badge already touched the numbers) and the source line
  // beside each number pushed the wordmark into the name. Square and story are
  // taller than wide, so for them this is exactly the value it was.
  const pad = Math.min(size.width, size.height) / 14;
  // D-62: never a number without its source — and on this artefact it matters
  // more than anywhere else, because the guardian approves it BECAUSE it
  // cannot be recalled (D-101) and every platform that meets it caches it for
  // good (D-89). The tag is a fact about the number, not about the child, so
  // it is the only thing D-89 lets us add beside them. One caption while the
  // numbers share a source; each number carries its own when they differ.
  const shared = sharedProvenance(tiles);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: 'Archivo', background: 'radial-gradient(ellipse 120% 80% at 50% -15%, #1a4a34 0%, #123326 38%, #0c1d14 72%, #0a1510 100%)' }}>
        <div style={{ display: 'flex', fontSize: big * 0.32, fontWeight: 700, letterSpacing: big * 0.09, color: T.accent }}>PITCH</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: big * 0.22 }}>
          <div style={{ display: 'flex', fontSize: big * 1.5, fontWeight: 900, color: T.ink, letterSpacing: -big * 0.06, lineHeight: 1 }}>{name}</div>
          <div style={{ display: 'flex', gap: big * 0.18, alignItems: 'center' }}>
            {c.squad_number ? (
              <div style={{ display: 'flex', fontSize: big * 0.45, fontWeight: 900, color: T.onAccent, background: T.accent, borderRadius: big * 0.18, padding: `${big * 0.08}px ${big * 0.24}px` }}>#{c.squad_number}</div>
            ) : null}
            <div style={{ display: 'flex', fontSize: big * 0.42, fontWeight: 700, color: T.secondary }}>{positions.join('  ·  ')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: big * 0.22 }}>
          {/* ABOVE the numbers, as the CV heads its block: drawn underneath, the
              one caption sat directly below the first tile's label and read as
              that tile's own tag — "only the appearances are verified". */}
          {shared ? (
            <div style={{ display: 'flex', fontSize: big * 0.24, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: big * 0.05 }}>{PROVENANCE_LABELS[shared]}</div>
          ) : null}
          <div style={{ display: 'flex', gap: big * 0.7 }}>
            {tiles.map((t) => (
              <div key={t.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: big, fontWeight: 900, lineHeight: 1, letterSpacing: -big * 0.04, color: t.key === 'goals' || t.key === 'clean_sheets' ? T.accent : T.ink }}>{String(t.value)}</div>
                <div style={{ display: 'flex', fontSize: big * 0.26, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: big * 0.05, marginTop: big * 0.1 }}>{STAT_LABELS[t.key]}</div>
                {shared ? null : (
                  <div style={{ display: 'flex', fontSize: big * 0.22, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: big * 0.04, marginTop: big * 0.06 }}>{provenanceLabel(t.provenance)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: FONTS },
  );
}
