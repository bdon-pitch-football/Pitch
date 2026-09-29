// DEV ONLY — the outbox reader. Nothing sends in development; every message
// the product would have sent queues in message_outbox and is readable here.
// This route does not exist in production.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';
import { isDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outbox', robots: { index: false, follow: false } };

// A message written for a real inbox names the real domain, so on this laptop
// every link in one is unreachable — and the club claim story runs THROUGH a
// link in this page: the address-confirmation link, then the six-digit code.
// BUZ was left copying a 32-character token off a screen in a meeting.
//
// So each pitchfootball.com.au address in the body is also rendered as a link
// to the same path on whatever host this page is being served from. The text
// still reads exactly as the message was written — the words are doc 15's and
// are not changed — the link is simply followable here.
//
// Built by splitting the string into React children, never by writing HTML:
// a message body is user-adjacent text and nothing in this codebase renders
// text as markup (D-94 §6).
const LINK = /pitchfootball\.com\.au(\/[^\s)]*)?/g;
function openable(body: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(body.slice(last, at));
    out.push(
      <a key={at} href={m[1] ?? '/'} style={{ color: 'var(--accent)', fontWeight: 700 }}>{m[0]}</a>,
    );
    last = at + m[0].length;
  }
  out.push(body.slice(last));
  return out;
}

export default async function Outbox() {
  if (process.env.NODE_ENV === 'production') notFound();
  // This page is the inbox, so a text still waiting for SMS (D-168, 0120)
  // is not in it: it has not arrived anywhere. It appears the moment the
  // outbox job releases it (/api/jobs/outbox), dated when it was released —
  // which is when a parent's phone would have buzzed.
  const { rows } = await db.query(
    `select message_key, channel, to_address, subject, body,
       to_char(coalesce(released_at, created_at) at time zone 'Australia/Melbourne', 'DD Mon HH24:MI') as at
     from message_outbox
     where queued_for_sms_at is null or released_at is not null
     order by coalesce(released_at, created_at) desc limit 50`,
  );
  // In a club demo this page is shown to a club, so it speaks plainly and
  // hides the catalogue keys (lib/demo).
  const demo = isDemo();
  const msgs = rows as { message_key: string; channel: string; to_address: string; subject: string | null; body: string; at: string }[];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{demo ? 'What families receive' : 'Outbox'}</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>
            {demo
              ? 'The texts and emails Pitch sends, word for word. In this demo nothing is actually sent.'
              : 'Development only. Nothing has been sent — these are the messages the product would send, exactly as written in doc 15.'}
          </div>
        </div>
        {msgs.length === 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 13, color: T.muted, fontWeight: 500 }}>
            Nothing queued yet. Sign a child up, ask to send a CV, or invite a player, and the messages appear here.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="lift" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: m.channel === 'sms' ? 'rgba(237,161,0,.14)' : 'rgba(61,220,132,.14)', color: m.channel === 'sms' ? T.amber : T.accent, borderRadius: 7, padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.channel}</span>
              {!demo && <span style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{m.message_key}</span>}
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>→ {m.to_address}</span>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 500, marginLeft: 'auto' }}>{m.at}</span>
            </div>
            {m.subject && <div style={{ fontSize: 14, fontWeight: 800 }}>{m.subject}</div>}
            <pre style={{ background: T.surface2, borderRadius: 12, padding: '12px 13px', margin: 0, fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{openable(m.body)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
