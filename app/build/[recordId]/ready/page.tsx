// The moment (BUZ, 16 Sep). Finishing a page is the emotional high point of
// this product and it used to pass in silence: a green button, then the same
// form again with a small "Saved." card on top.
//
// What this screen may honestly say is narrower than it looks. A live link
// exists only once a page has been SENT — the token is minted at dispatch and
// stored hashed (D-80), so this screen can show the display HINT and never a
// working URL, and it says "ready" until there is a token to call live.
// For an under-16 whose change is waiting on a guardian (D-119), the page has
// not gone anywhere and the screen says so instead of celebrating.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { PlayerFrame } from '@/components/player-shell';
import { requireRecordActor } from '@/lib/record-guard';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your page', robots: { index: false, follow: false } };

export default async function Ready({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { rows } = await db.query(
    `select p.first_name, dr.positions, dr.squad_number,
       (select count(*)::int from highlight h where h.record_id = dr.id) as clips,
       exists(select 1 from profile_version where record_id = dr.id and status = 'pending') as has_pending,
       (select st.token_hint from share_token st
         where st.record_id = dr.id and st.revoked_at is null and st.paused = false
           and (st.expires_at is null or st.expires_at > now())
         order by st.issued_at desc limit 1) as hint
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  const r = rows[0];
  if (!r) redirect('/home');
  const live = Boolean(r.hint);
  const waiting = Boolean(r.has_pending);
  const line = [
    (r.positions as string[]).join(' · ') || null,
    r.squad_number ? `#${r.squad_number}` : null,
    r.clips ? `${r.clips} clip${r.clips === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <PlayerFrame active="cv">
      <div className="reading h-rise" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', paddingTop: 10 }}>
          <div aria-hidden style={{ width: 62, height: 62, borderRadius: 999, background: waiting ? 'rgba(237,161,0,.14)' : 'rgba(61,220,132,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {waiting ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7" /></svg>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.05, margin: 0 }}>
              {waiting ? 'Sent to your parent' : live ? 'Your page is live' : 'Your page is ready'}
            </h1>
            <div style={{ fontSize: 14.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>
              {waiting
                ? 'They see the change before it goes out. Nothing has moved until they say yes.'
                : 'Your page goes to a club as a link, so it shows what is on it today.'}
            </div>
          </div>
          {line && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: '9px 15px', fontSize: 13, fontWeight: 800, color: T.ink }}>
              {r.first_name} · {line}
            </div>
          )}
        </div>

        {live && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Your link</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/p/{r.hint}</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>Switch it off any time and the club&rsquo;s copy stops working.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {!waiting && <Link href={`/send/${recordId}`} className="btn btn-primary">Send it to a club</Link>}
          <Link href="/trials" className="btn btn-secondary">Find a trial</Link>
          <Link href={`/build/${recordId}`} className="btn btn-ghost">Keep building</Link>
        </div>
      </div>
    </PlayerFrame>
  );
}
