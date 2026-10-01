// ShareCV.dc.html — the child makes a card to post. Copy verbatim. Nothing
// is generated here: the shapes are drawn, not rendered from the record.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { requestCard } from './actions';
import { requireRecordActor } from '@/lib/record-guard';
import { T } from '@/lib/palette';
import { sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Share card', robots: { index: false, follow: false } };

const label = sectionLabel;
const SHAPES: [string, string, number, number][] = [['story', 'Story', 34, 60], ['square', 'Square', 52, 52], ['landscape', 'Landscape', 64, 34]];

const Row = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
    {ok
      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{children}</div>
  </div>
);

export default async function ShareCard({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ asked?: string }>;
}) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { asked } = await searchParams;
  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  // C-P9 (BUZ, 1 Oct): an adult has no parent on the record, so a page that
  // tells them to ask one is untrue. /home links here only for under-18s with
  // a confirmed parent; reached by URL, an adult goes home, as /send does.
  if (rows[0].band === '18plus') redirect('/home');

  if (asked) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark back={{ href: '/home' }} />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>Asked. Nothing has been made yet.</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Your parent sees the exact card and says yes. Then it&rsquo;s yours to post wherever you want.</div>
        </div>
      </div>
    );
  }

  const act = requestCard;
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Share my CV</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Pitch makes you a card. You post it wherever you like — Instagram, Snap, a group chat, anywhere.</div>
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="recordId" value={recordId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>Pick a shape</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SHAPES.map(([value, text, w, h], i) => (
                <label key={value} style={{ flex: 1, cursor: 'pointer' }}>
                  <input type="radio" name="shape" value={value} defaultChecked={i === 0} style={{ position: 'absolute', opacity: 0 }} />
                  <div style={{ background: T.surface, border: `${i === 0 ? '1.5px' : '1px'} solid ${i === 0 ? T.accent : T.line}`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: w, height: h, borderRadius: 6, background: 'var(--hero)', border: `1px solid ${i === 0 ? T.accent : '#2c3a33'}` }} />
                    <div style={{ fontSize: 12, fontWeight: i === 0 ? 900 : 700, color: i === 0 ? T.accent : T.secondary }}>{text}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={label}>What&rsquo;s on it</div>
            <Row ok>Your first name and the letter your surname starts with. Nothing more of your name.</Row>
            <Row ok>Your positions, your number and the numbers you chose to show.</Row>
            <Row ok={false}>Not your club, not your age group, not where you live, not your face.</Row>
            <Row ok={false}>No link back to your page. Someone who likes it has to come and find Pitch themselves.</Row>
          </div>
          <div style={{ borderRadius: 16, background: 'var(--hero)', border: `1px solid ${T.line}`, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900 }}>Your parent sees it first</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>They look at the actual card and say yes. Then it&rsquo;s yours to post wherever you want.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary">Ask my parent to approve it</button>
            {/* C-P5 (BUZ, 1 Oct): Cancel goes home, as it does on /send. It was a
                div that went nowhere. */}
            <Link href="/home" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted, textDecoration: 'none' }}>Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
