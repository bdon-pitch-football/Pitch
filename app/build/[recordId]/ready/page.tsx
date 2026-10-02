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
import { waitingRecords } from '@/lib/cv-build';
import { HeaderMark } from '@/components/Wordmark';
import { PlayerFrame } from '@/components/player-shell';
import { requireRecordActor } from '@/lib/record-guard';
import { sendState } from '@/lib/send-state';
import { G } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your page', robots: { index: false, follow: false } };

export default async function Ready({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const { personId } = await requireRecordActor(recordId);
  const { rows } = await db.query(
    `select p.first_name, dr.positions, dr.squad_number,
       (select count(*)::int from highlight h where h.record_id = dr.id) as clips,
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
  // Waiting is ONE answer everywhere (lib/cv-build waitingRecords, Leo 2 Oct).
  const waiting = (await waitingRecords([recordId])).has(recordId);
  // C-P7 (BUZ, 1 Oct): "Send it to a club" only where /send has a screen for
  // this viewer — the same gate /send and its action read. A 16–17 whose
  // parent has not confirmed was offered it and bounced to /home.
  const canSend = (await sendState(recordId, personId))?.mode !== 'none';
  const line = [
    (r.positions as string[]).join(' · ') || null,
    r.squad_number ? `#${r.squad_number}` : null,
    r.clips ? `${r.clips} clip${r.clips === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <PlayerFrame active="cv">
      <div className="reading h-rise" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        {/* A door (spec C): the moment, then what to do with it. */}
        <div className="door" style={{ gap: 20 }}>
          <div className="moment">
            {/* The card's ticket: the approved one-line summary on the card's
                own gradient, the squad number standing behind it. The badge
                says done, or waiting (D-119: nothing celebrated for a change
                a parent has not seen). Decorative: the heading says it. */}
            <div className="ticket">
              {r.squad_number ? <div className="cv-num" aria-hidden>{r.squad_number}</div> : null}
              <div className={waiting ? 'badge wait' : 'badge ok'} aria-hidden>{waiting ? G.clock() : G.tick(16)}</div>
              {line && <div className="ticket-line">{r.first_name} · {line}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h1 className="h-moment">
                {waiting ? 'Sent to your parent' : live ? 'Your page is live' : 'Your page is ready'}
              </h1>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--secondary)', lineHeight: 1.5 }}>
                {waiting
                  ? 'They see the change before it goes out. Nothing has moved until they say yes.'
                  : 'Your page goes to a club as a link, so it shows what is on it today.'}
              </div>
            </div>
          </div>

          {/* The display HINT, never a working URL (D-80): text to read, so
              ink, not a link's green. */}
          {live && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-h">Your link</div>
              <div className="link-v">pitchfootball.com.au/p/{r.hint}</div>
              <div className="c-s2">Switch your link off any time and the club&rsquo;s copy stops working.</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {!waiting && canSend && <Link href={`/send/${recordId}`} className="btn btn-primary fl-glow">Send it to a club</Link>}
            <Link href={`/build/${recordId}/preview`} className="btn btn-secondary">Preview my page</Link>
            <Link href="/trials" className="btn btn-secondary">Find a trial</Link>
            <Link href={`/build/${recordId}`} className="textbtn textbtn-block">Keep building</Link>
          </div>
        </div>
      </div>
    </PlayerFrame>
  );
}
