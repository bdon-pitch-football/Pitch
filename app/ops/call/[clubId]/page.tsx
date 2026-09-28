// The call sheet — doc 27's thirteen log fields, built as written. The
// operator is named, every time; a blank number_source invalidates the
// call. (OpsCall.dc.html styling pass to follow; the fields and their
// notes are doc 27 verbatim.)
//
// It now also records the club's Technical Director (BUZ, 23 Sep): D-93 says
// the role is granted by the club and confirmed at club verification, and
// since 0054 closed the self-declared TD at claim, this call is the only
// place it can be confirmed. The role attaches to the person at that address
// when they have proved it (0058, 0056) — never to the address alone.
// HANDOVER is deliberately absent, here and everywhere: it is BUZ's
// fast-follow. This screen records a TD; nothing yet replaces or removes one.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { OpsConsole } from '@/components/console-shell';
import { logCall } from './actions';
import { requireOperator } from '@/lib/ops-guard';
import { isUuid } from '@/lib/ids';
import { T } from '@/lib/palette';
import { fieldLabel as label } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verification call', robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 4 };
const input: React.CSSProperties = { background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };
const select: React.CSSProperties = { ...input, appearance: 'none' as const };
// 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

export default async function CallSheet({ params }: { params: Promise<{ clubId: string }> }) {
  await requireOperator();
  const { clubId } = await params;
  // A malformed id is a 404, not a 500: it reaches Postgres as a uuid cast.
  if (!isUuid(clubId)) notFound();
  const { rows } = await db.query(`select name, suburb, state, contact_email from club where id = $1`, [clubId]);
  if (rows.length === 0) notFound();
  const c = rows[0];
  const act = logCall;
  // Who this club's Technical Director is, and whether the role is live —
  // the database's own answer (fn_club_td, 0058), never assembled here (L23).
  // Since 0060 it also answers who that address actually belongs to: the
  // account's own name, whether that is the name the operator typed, and
  // whether the club's own published address was recorded as a person's. The
  // screen renders the answer; it does not work any of it out (L23).
  const td = (await db.query(`select * from fn_club_td($1)`, [clubId])).rows[0] as
    { td_name: string; td_email: string; recorded_at: string; recorded_by: string; active: boolean;
      account_name: string | null; account_email: string | null;
      name_matches: boolean | null; club_mailbox: boolean } | undefined;

  return (
    <OpsConsole active="verification">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/ops/verification', label: 'The queue' }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>Call sheet — {c.name}</h1>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[c.suburb, c.state].filter(Boolean).join(' ')}{c.contact_email ? ` · ${c.contact_email}` : ''}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={label}>Technical Director</div>
          {td ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{td.td_name}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{td.td_email}</div>
              {/* The account the address belongs to, beside the name that was
                  typed. Before 0060 this card read "Jane Doe · active" while
                  the role sat on somebody else's account, and no screen in the
                  product named the person who held it. */}
              {td.account_name ? (
                <>
                  <div style={{ ...label, marginTop: 6 }}>The account holding that address</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{td.account_name}</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{td.account_email}</div>
                  {td.name_matches === false ? (
                    <div style={{ fontSize: 12.5, color: T.amber, fontWeight: 700, lineHeight: 1.5 }}>
                      This is not the name recorded on the call. The role goes to this account, not to the name above.
                    </div>
                  ) : null}
                </>
              ) : null}
              <div style={{ fontSize: 12.5, color: td.club_mailbox ? T.red : td.active ? T.accent : T.amber, fontWeight: 700, lineHeight: 1.5, marginTop: 6 }}>
                {td.club_mailbox
                  ? `This is the club's own contact address, not a person's, so nobody holds the role. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}. Ring the club back and record the Technical Director's own address.`
                  : td.active
                    ? `Active. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}.`
                    : `Waiting on their account. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}. The role switches on the moment that address is confirmed on Pitch.`}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              None recorded. Until this call records one, nobody at this club can open its register.
            </div>
          )}
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><input type="hidden" name="clubId" value={clubId} />
          <label style={card}><div style={label}>Operator — the human. Named, every time. Never &ldquo;system&rdquo;, never &ldquo;admin&rdquo;.</div><input style={input} name="operator" placeholder="Your name" required /></label>
          <label style={card}><div style={label}>Number called — the actual number dialled</div><input style={input} name="number_called" required /></label>
          <label style={card}><div style={label}>Number source — where you found it. A blank here invalidates the call.</div><input style={input} name="number_source" placeholder={'e.g. club website /contact, FV club directory'} required /></label>
          <label style={card}><div style={label}>Answered by — name and role as they gave it</div><input style={input} name="answered_by" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={card}><div style={label}>Club confirmed — is this the club</div><select style={select} name="club_confirmed"><option value="yes">yes</option><option value="no">no</option></select></label>
            <label style={card}><div style={label}>Person confirmed — did they independently name the claimant</div><select style={select} name="person_confirmed"><option value="yes">yes</option><option value="no">no</option></select></label>
            <label style={card}><div style={label}>Incorporated — as answered</div><select style={select} name="incorporated"><option>unknown</option><option>yes</option><option>no</option></select></label>
            <label style={card}><div style={label}>Authority confirmed — as answered</div><select style={select} name="authority_confirmed"><option>unknown</option><option>yes</option><option>no</option></select></label>
          </div>
          <label style={card}>
            <div style={label}>Outcome</div>
            <select style={select} name="outcome" required>
              <option value="">Choose one</option>
              <option value="verified">verified</option>
              <option value="not_verified">not verified</option>
              <option value="suspended">suspended</option>
              <option value="takedown">takedown</option>
            </select>
          </label>
          {/* doc 31 M11/L29, doc 15 §37, 0066. The class of the suspension is
              recorded on the call, and it is what decides whether families
              holding a live link to this club are told at all. The operator
              records it; nothing on this page works out what it means — the
              database does (fn_guardians_to_notify_on_suspension). None
              chosen records nothing and tells nobody, and the suspension
              still happens: a safety action must not fail on a form field.

              The label, the three options and the note are BUZ's, approved
              28 Sep (docs/team/APPROVALS-28-SEP.md, "Ops call sheet") as
              proposed in docs/team/reports/2026-09-28-builder-unwired-promises.md.
              The values posted are still 0025's closed list; only the words a
              tired operator reads changed. */}
          <label style={card}>
            <div style={label}>Why — recorded only when the outcome is suspended or takedown. It decides whether families are told.</div>
            <select style={select} name="suspension_reason">
              <option value="">Choose one</option>
              <option value="child_safety">A child-safety reason — families are told</option>
              <option value="administrative">Administrative — paperwork, officials, a claim nobody recognised</option>
              <option value="non_payment">Non-payment</option>
            </select>
          </label>
          <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            Choose the child-safety reason only for a child-safety reason. Every family holding a live link they sent to this club is emailed once: that the club is no longer verified, nothing about why, and a button that switches their own link off. We do not switch it off for them. The other two reasons end this club&rsquo;s access and tell nobody.
          </div>
          <label style={card}><div style={label}>Technical Director — the name they gave you on the call. Recorded only when the outcome is verified.</div><input style={input} name="td_name" placeholder="Full name" /></label>
          <label style={card}><div style={label}>Technical Director — their email address, as the club gave it</div><input style={input} type="email" name="td_email" placeholder="name@club.example.au" /></label>
          <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            This is the only way a club gets a Technical Director — never a form, never a claim, never someone saying so. The role switches on when that person confirms the address on their own Pitch account, and not before. Ask for that person&rsquo;s own address: a club inbox belongs to whoever reads it, and the role cannot attach to one.
          </div>
          <label style={card}><div style={label}>Notes — anything that felt off belongs here even if you verified anyway</div><textarea style={{ ...input, resize: 'vertical' }} rows={3} name="notes" /></label>
          <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            &ldquo;Incorporated&rdquo; and &ldquo;authority&rdquo; answered no or unknown do not fail verification — they flag the subscription, not the safety check. Verifying releases every held registration to this club.
          </div>
          <button type="submit" className="btn btn-primary">Log the call</button>
        </form>
      </div>
    </OpsConsole>
  );
}
