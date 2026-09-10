// DEV ONLY — the outbox reader. Nothing sends in development; every message
// the product would have sent queues in message_outbox and is readable here.
// This route does not exist in production.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outbox', robots: { index: false, follow: false } };

export default async function Outbox() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { rows } = await db.query(
    `select message_key, channel, to_address, subject, body,
       to_char(created_at at time zone 'Australia/Melbourne', 'DD Mon HH24:MI') as at
     from message_outbox order by created_at desc limit 50`,
  );
  const msgs = rows as { message_key: string; channel: string; to_address: string; subject: string | null; body: string; at: string }[];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Outbox</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>
            Development only. Nothing has been sent — these are the messages the product would send, exactly as written in doc 15.
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
              <span style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{m.message_key}</span>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>→ {m.to_address}</span>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 500, marginLeft: 'auto' }}>{m.at}</span>
            </div>
            {m.subject && <div style={{ fontSize: 14, fontWeight: 800 }}>{m.subject}</div>}
            <pre style={{ background: T.surface2, borderRadius: 12, padding: '12px 13px', margin: 0, fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{m.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
