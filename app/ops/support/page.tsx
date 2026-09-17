// The support console (D-79). Elly can see INVITATION STATE and resend —
// nothing else. Support tooling can never read a child's record, by any
// path, and there is deliberately no lookup here that returns one. Every
// action is logged.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { OpsConsole } from '@/components/console-shell';
import { resendApproval } from './actions';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Support', robots: { index: false, follow: false } };

export default async function Support({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOperator();
  const { q } = await searchParams;

  // Invitation state ONLY: first name, when it was created, whether it was
  // approved, and which channels were tried. No record, no stats, no club.
  const rows = q
    ? (await db.query(
        `select pi.id, pi.first_name, pi.guardian_name,
           to_char(pi.created_at at time zone 'Australia/Melbourne', 'DD Mon HH24:MI') as created,
           pi.approved_at is not null as approved,
           pi.held_at is not null as held,
           pi.sms_confirmed_at is not null as sms_ok, pi.email_confirmed_at is not null as email_ok,
           (select count(*)::int from message_outbox mo
            where mo.message_key in ('doc15.§1', 'doc15.§2')
              and mo.to_address in (pi.guardian_phone, pi.guardian_email)) as messages
         from pending_invitation pi
         where pi.id::text = $1 or lower(pi.guardian_email) = lower($1) or pi.guardian_phone = $1
         order by pi.created_at desc limit 10`,
        [q.trim()],
      )).rows
    : [];

  return (
    <OpsConsole active="support">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Support</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Invitation state and resend. That is the whole console.</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.red}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 3 L22 20 H2 Z" /><path d="M12 9.5 v4.5" /><circle cx="12" cy="16.8" r="0.6" fill={T.red} /></svg>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>You cannot read a child&rsquo;s record from here, and there is no screen that lets you.</b> No impersonation, no record access. Every action you take is logged with your name.
          </div>
        </div>
        <form style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 10 }}>
          <input name="q" aria-label="Invitation id, guardian email or mobile" defaultValue={q ?? ''} placeholder="Invitation id, guardian email or mobile" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }} />
          <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 11, height: 44, padding: '0 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Look up</button>
        </form>
        {q && rows.length === 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 13, color: T.muted, fontWeight: 500 }}>Nothing matches that.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="lift" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{r.first_name}</div>
              <div style={{ background: r.approved ? 'rgba(61,220,132,.14)' : r.held ? 'rgba(255,107,107,.14)' : 'rgba(237,161,0,.14)', color: r.approved ? T.accent : r.held ? T.red : T.amber, borderRadius: 7, padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {r.approved ? 'Approved' : r.held ? 'Held' : 'Waiting on the guardian'}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Asked {r.guardian_name ?? 'a guardian'} · created {r.created} · {r.messages} message{r.messages === 1 ? '' : 's'} queued</div>
            {!r.approved && !r.held && (
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Text {r.sms_ok ? 'confirmed' : 'not confirmed yet'} · Email {r.email_ok ? 'confirmed' : 'not confirmed yet'}</div>
            )}
            {r.held && (
              // D-155: the email named an account under 18. Nothing was linked and
              // nobody was told. It purges at 14 days like any unapproved invitation.
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>Held: the parent&rsquo;s email belongs to an account under 18, so nothing was linked. The family sees an ordinary approval. It deletes itself after 14 days.</div>
            )}
            {!r.approved && !r.held && (
              <form action={resendApproval}><input type="hidden" name="invitationId" value={r.id} />
                <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Resend the approval request</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </OpsConsole>
  );
}
