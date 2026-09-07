// RegisterInterest.dc.html — u16 variant, copy verbatim. The child picks
// the squad, adjusts positions pre-filled from their CV, writes one line
// (the parent reads it before it goes anywhere), and asks their parent to
// send it. Being on a register is not a trial spot and not a decision —
// there is nothing here to be turned down from.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import InterestForm from './InterestForm';
import { requireRecordActor } from '@/lib/record-guard';

const T = {
  bg: '#0b120e', surface: '#121b16', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function RegisterInterest({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ club?: string; asked?: string; error?: string }>;
}) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { club: clubParam, asked } = await searchParams;

  const rec = await db.query(
    `select dr.positions, p.first_name from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rec.rows.length === 0) notFound();

  const club = await db.query(
    clubParam
      ? `select id, name, suburb from club where id = $1`
      : `select id, name, suburb from club where club_state = 'verified' order by created_at limit 1`,
    clubParam ? [clubParam] : [],
  );
  if (club.rows.length === 0) notFound();
  const c = club.rows[0];
  const squads = (await db.query(`select id, name from squad where club_id = $1 order by name`, [c.id])).rows as { id: string; name: string }[];

  if (asked) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.line}`, padding: 17, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: T.amber }} />
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>Waiting on your parent</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>Asked. Nothing has gone to {c.name} yet.</div>
            <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Your parent reads it and presses send. It&rsquo;s the same for every club.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <InterestForm
      recordId={recordId}
      club={{ id: c.id, name: c.name, suburb: c.suburb ?? '' }}
      squads={squads}
      cvPositions={rec.rows[0].positions ?? []}
    />
  );
}
