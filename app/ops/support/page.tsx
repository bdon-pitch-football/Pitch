// The support console (D-79). Elly can see INVITATION STATE and resend —
// nothing else. Support tooling can never read a child's record, by any
// path, and there is deliberately no lookup here that returns one. Every
// action is logged.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { resendApproval } from './actions';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', amber: '#eda100', red: '#e34948',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function Support({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound(); // operator auth pending
  const { q } = await searchParams;

  // Invitation state ONLY: first name, when it was created, whether it was
  // approved, and which channels were tried. No record, no stats, no club.
  const rows = q
    ? (await db.query(
        `select pi.id, pi.first_name, pi.guardian_name,
           to_char(pi.created_at at time zone 'Australia/Melbourne', 'DD Mon HH24:MI') as created,
           pi.approved_at is not null as approved,
           (select count(*)::int from message_outbox mo where mo.body like '%' || pi.id || '%') as messages
         from pending_invitation pi
         where pi.id::text = $1 or lower(pi.guardian_email) = lower($1) or pi.guardian_phone = $1
         order by pi.created_at desc limit 10`,
        [q.trim()],
      )).rows
    : [];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Support</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Invitation state and resend. That is the whole console.</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.red}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 3 L22 20 H2 Z" /><path d="M12 9.5 v4.5" /><circle cx="12" cy="16.8" r="0.6" fill={T.red} /></svg>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>You cannot read a child&rsquo;s record from here, and there is no screen that lets you.</b> No impersonation, no record access. Every action you take is logged with your name.
          </div>
        </div>
        <form style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 10 }}>
          <input name="q" defaultValue={q ?? ''} placeholder="Invitation id, guardian email or mobile" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }} />
          <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 11, height: 38, padding: '0 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Look up</button>
        </form>
        {q && rows.length === 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 13, color: T.muted, fontWeight: 500 }}>Nothing matches that.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="lift" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{r.first_name}</div>
              <div style={{ background: r.approved ? 'rgba(61,220,132,.14)' : 'rgba(237,161,0,.14)', color: r.approved ? T.accent : T.amber, borderRadius: 7, padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {r.approved ? 'Approved' : 'Waiting on the guardian'}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Asked {r.guardian_name ?? 'a guardian'} · created {r.created} · {r.messages} message{r.messages === 1 ? '' : 's'} queued</div>
            {!r.approved && (
              <form action={resendApproval.bind(null, r.id)}>
                <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 42, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Resend the approval request</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
