// The support console (D-79). Elly can see INVITATION STATE and resend —
// nothing else. Support tooling can never read a child's record, by any
// path, and there is deliberately no lookup here that returns one. Every
// action is logged.
//
// Brief G (29 Sep): the signed title row and pill, and the charter's console
// button in place of three hand-drawn outlines. Nothing it shows changed.
// Floodlit (spec I, BUZ 1 Oct): the rule a well, the search .ops-search, the
// results rows in one table card, the status A's pill. Nothing it shows changed.
//
// Called "Lookup" on screen, as in OpsLookup.dc.html (BUZ, 29 Sep, "yes to
// the four"), so the rail, this title and Today's "Open in lookup" agree. The
// address stays /ops/support: every link and bookmark to it keeps working.
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { resendApproval } from './actions';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lookup', robots: { index: false, follow: false } };

export default async function Support({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOperator();
  const { q } = await searchParams;

  // Invitation state ONLY: first name, when it was created, whether it was
  // approved, and which channels were tried. No record, no stats, no club.
  //
  // The messages are counted by the parent's address, and by the invitation
  // they were sent for. An address is kept 30 days after its message ended
  // and then blanked (lib/sent-bodies; John, 2 Oct, §3: "The try count
  // stays"), so past that a message is still counted by its invitation, and
  // a blanked address never matches anything.
  const rows = q
    ? (await db.query(
        `select pi.id, pi.first_name, pi.guardian_name,
           to_char(pi.created_at at time zone 'Australia/Melbourne', 'DD Mon HH24:MI') as created,
           pi.approved_at is not null as approved,
           pi.held_at is not null as held,
           pi.sms_confirmed_at is not null as sms_ok, pi.email_confirmed_at is not null as email_ok,
           (select count(*)::int from message_outbox mo
            where mo.message_key in ('doc15.§1', 'doc15.§2')
              and (mo.invitation_id = pi.id
                   or (mo.to_address <> '' and mo.to_address in (pi.guardian_phone, pi.guardian_email)))) as messages
         from pending_invitation pi
         where pi.id::text = $1 or lower(pi.guardian_email) = lower($1) or pi.guardian_phone = $1
         order by pi.created_at desc limit 10`,
        [q.trim()],
      )).rows
    : [];

  return (
    <OpsConsole active="support">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Lookup" sub="Invitation state and resend. That is the whole console." />
        {/* The standing rule is a well, not a state (I-P1b, BUZ 1 Oct): the lock
            glyph, the bold first sentence in ink, no red. */}
        <div className="card-sunken" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>You cannot read a child&rsquo;s record from here, and there is no screen that lets you.</b> No impersonation, no record access. Every action you take is logged with your name.
          </div>
        </div>
        <form className="ops-search">
          <input name="q" aria-label="Invitation id, guardian email or mobile" defaultValue={q ?? ''} placeholder="Invitation id, guardian email or mobile" className="ops-input" />
          <button type="submit" className="console-btn">Look up</button>
        </form>
        {q && rows.length === 0 && (
          <div className="empty-tile is-compact"><div className="empty-t">Nothing matches that.</div></div>
        )}
        {/* Results are rows in one table card (spec I), the status a pill:
            Approved live, Held stopped, Waiting on the guardian waiting. */}
        {rows.length > 0 && (
          <div className="ops-table">
            {rows.map((r) => (
              <div key={r.id} className="ops-inv">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{r.first_name}</div>
                  <span className={r.approved ? 'pill pill-live' : r.held ? 'pill pill-stop' : 'pill pill-wait'}>
                    {r.approved ? 'Approved' : r.held ? 'Held' : 'Waiting on the guardian'}
                  </span>
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
                    <button type="submit" className="console-btn">Resend the approval request</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </OpsConsole>
  );
}
