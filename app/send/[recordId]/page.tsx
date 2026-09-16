// "Send my CV", in all three bands (D-99). Copy verbatim from the signed
// screens where they exist: SendCV.dc.html (the under-16 composer) and
// SendCVAdult.dc.html (18+). The 16–17 line and the "sending is off" and
// "sent" states are new and awaiting BUZ's sign-off.
//
// Which screen renders is decided by lib/send-state.ts — the SAME function the
// action reads — so the page can never offer a send the action will refuse.
import { notFound, redirect } from 'next/navigation';
import { requireRecordActor } from '@/lib/record-guard';
import { sendState } from '@/lib/send-state';
import { PlayerFrame } from '@/components/player-shell';
import { HeaderMark } from '@/components/Wordmark';
import { composeSend } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948', purple: '#a479e2', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send your CV', robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };
const hero: React.CSSProperties = { borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.line}`, padding: 17 };

const Row = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
    {ok
      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{children}</div>
  </div>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <PlayerFrame active="send">
    <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark back={{ href: '/home' }} />
      {children}
    </div>
  </PlayerFrame>
);

const Status = ({ dot, kicker, title, children }: { dot: string; kicker: string; title: string; children: React.ReactNode }) => (
  <div style={{ ...hero, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>{kicker}</div>
    </div>
    <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>{title}</h1>
    <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{children}</div>
  </div>
);

export default async function SendCv({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ asked?: string; sent?: string; error?: string }>;
}) {
  const { recordId } = await params;
  const { personId } = await requireRecordActor(recordId);
  const { asked, sent, error } = await searchParams;
  const state = await sendState(recordId, personId);
  if (!state) notFound();
  // L10/L11: no send surface at all, rather than one that goes nowhere.
  if (state.mode === 'none') redirect('/home');

  if (state.mode === 'ask' && asked) {
    return (
      <Shell>
        <Status dot={T.amber} kicker="Waiting on your parent" title="Asked. Nothing has been sent yet.">
          Your parent checks the address and presses send. It&rsquo;s the same for every club.
        </Status>
      </Shell>
    );
  }

  // L38: a limited send lands here too, so nothing on this screen may depend
  // on whether a send row was actually written — no club name, no link.
  if (state.mode === 'self' && sent) {
    return (
      <Shell>
        <Status dot={T.accent} kicker="Sent" title="Sent. It’s gone to the club as a link.">
          That&rsquo;s everything on your side. Switch your link off any time and the club&rsquo;s copy stops working.
        </Status>
      </Shell>
    );
  }

  // L6: told plainly that sending is off — about their own account, and
  // nothing about who switched it (doc 15 §22).
  if (state.mode === 'off') {
    return (
      <Shell>
        <Status dot={T.muted} kicker="Sending is off" title="Sending is off on your account">
          Your CV can&rsquo;t be sent from here at the moment. If you want it back on, talk to your parent.
        </Status>
      </Shell>
    );
  }

  const self = state.mode === 'self';
  const act = composeSend;
  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Send my CV</h1>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Pick who it goes to. Your CV goes as a link, so it always shows what&rsquo;s on your page today.</div>
      </div>
      {error && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 12.5, fontWeight: 700, color: T.secondary }}>Check the club name and the email address — a wrong address just goes nowhere.</div>}
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="recordId" value={recordId} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Sending to</div>
          <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Club</div>
            <input style={input} name="clubName" aria-label="Club" placeholder="e.g. Northern United SC" required maxLength={60} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Their email address</div>
          <div style={card}>
            <input style={{ ...input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} name="address" aria-label="Their email address" type="email" placeholder="football@theclub.com.au" required />
          </div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>From the club&rsquo;s own trial notice. Check it&rsquo;s right — a wrong address just goes nowhere.</div>
        </div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>What the club gets</div>
          <Row ok>A link to your CV — the same page you&rsquo;d send anyone.</Row>
          <Row ok={false}>If you switch your link off, it stops working for them.</Row>
          <Row ok={false}>Not your phone number, your email or your address. They never get those.</Row>
        </div>
        {self ? (
          <div style={{ ...hero, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(61,220,132,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3 L10 14" /><path d="M21 3 L14.5 21 L10 14 L3 9.5 Z" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900 }}>You send this yourself</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                {state.band === '16_17' ? 'Your parent is told each time you send. ' : ''}Switch the link off later and the club&rsquo;s copy stops working.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...hero, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900 }}>Your parent sends this one</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>You&rsquo;re under 16, so we ask your parent to check the address and press send. It&rsquo;s the same for every club.</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <button type="submit" className="btn btn-primary">{self ? 'Send it now' : 'Ask my parent to send it'}</button>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Cancel</div>
        </div>
      </form>
    </Shell>
  );
}
