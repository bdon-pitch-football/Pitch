// The call sheet — doc 27's thirteen log fields. The operator is named, every
// time; a blank number_source invalidates the call.
//
// Laid out to OpsCall.dc.html (brief G, 29 Sep; BUZ: "fix it"). The guidance
// used to be written INTO each field label in tracked capitals ("OPERATOR —
// THE HUMAN. NAMED, EVERY TIME…"), and every yes/unknown answer sat in its own
// tall box. Now: short labels over 44px wells, the guidance in ordinary
// sentences under a short section head, and the four questions as one group of
// segmented choices (radios, no script, the same names and values as before).
// One column on a phone, pairs two-up from 640px. Every word is one that was
// already on this screen or is in the signed design; the posted fields, their
// values and the actions are unchanged.
//
// Floodlit, spec I (I-P2; BUZ: "Yes", 1 Oct): the six stacked cards are one
// form panel (.card.ops-panel) whose sections are .ops-sec, divided by
// hairlines. At a laptop (.call-grid, ≥1024) the claim and the Technical
// Director sit in a 320px aside beside the form, the claim pinned, so "Do not
// mention that number on the call" stays in view while the call goes on. The
// DOM order is claim → TD → form, and that is the phone's order. "Log the
// call" carries the screen's one glow. Markup only: no word, field, name or
// value moved.
//
// It now also records the club's Technical Director (BUZ, 23 Sep): D-93 says
// the role is granted by the club and confirmed at club verification, and
// since 0054 closed the self-declared TD at claim, this call is the only
// place it can be confirmed. The role attaches to the person at that address
// when they have proved it (0058, 0056) — never to the address alone.
// HANDOVER (0100): a verified call naming somebody else ends the live TD in
// the same transaction, and the TD card carries the operator's door for
// ending one outright (D-48, D-93). The club's administrator has the other
// door, on /club/roles. Naming a new TD is still this call and nothing else.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { confirmTdName, endTd, logCall } from './actions';
import { requireOperator } from '@/lib/ops-guard';
import { isUuid } from '@/lib/ids';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verification call', robots: { index: false, follow: false } };

// A panel in the column (the claim, the TD): the signed card, its parts stacked.
const stack = (gap: number): React.CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const guide: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 };
const hint: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.55 };
const star = <span style={{ color: T.red }}> *</span>;
// A labelled 44px well (OpsCall.dc.html): the label over the control, and
// any guidance in a sentence under it rather than in the label.
function Field({ name, label: text, required, placeholder, type, note }: {
  name: string; label: string; required?: boolean; placeholder?: string; type?: string; note?: string;
}) {
  return (
    <label className="ops-field">
      <span className="panel-h">{text}{required ? star : null}</span>
      <input className="ops-input" name={name} type={type} required={required} placeholder={placeholder} />
      {note ? <span style={hint}>{note}</span> : null}
    </label>
  );
}
// One of the four questions: a compact segmented choice. The first option is
// checked, exactly as the select it replaces defaulted to its first option.
// UNSET (BUZ, 29 Sep, "yes to the four"): the first two questions start with
// no answer at all, and must be answered — a pre-ticked "yes" is an answer
// nobody gave. The action refuses the call without them (logCall), so this
// `required` is the courtesy, not the check.
function Choice({ name, label: text, note, options, unset }: { name: string; label: string; note: string; options: string[]; unset?: boolean }) {
  return (
    <fieldset className="ops-choice">
      <legend className="panel-h">{text}</legend>
      <div className="ops-seg">
        {options.map((o, i) => (
          <label key={o}>
            <input type="radio" name={name} value={o} defaultChecked={!unset && i === 0} required={unset} />
            <span>{o[0].toUpperCase() + o.slice(1)}</span>
          </label>
        ))}
      </div>
      <span style={hint}>{note}</span>
    </fieldset>
  );
}
// A name mismatch is held for a human (BUZ's approved default 5, 0121). The
// held state's sentence and the confirm button's words were approved in
// advance by BUZ on 29 Sep, with the review delegated to Leo
// (docs/team/APPROVALS-28-SEP.md, "Approved in advance"): live, and listed in
// the round H report for that review.
const NAME_HELD_STATE = 'On hold. The role stays off until you confirm this is the person the club named, or record a new call with the right name.';
const NAME_HELD_CONFIRM = 'This is the person the club named';

// Whether doc 15 §39 will go, and to whom by first name (John, 1 Oct; BUZ's
// words, 1 Oct; 0168). Doc 27's close says "you'll get an email confirming it"
// only when it will, so the operator reads this directly above the button.
// The database answers: fn_verified_call_addressee is the person half of
// fn_verified_call_recipient — the function the press sends §39 to asks it —
// so this line and the send cannot disagree. The first name only, never the
// address: the ops console does not show it.
const s39Line = (first: string | null) => first
  ? `Logging this call as verified emails ${first} to confirm it.`
  : 'Logging this call sends no email, so don\u2019t promise one.';

// B2 (Head of Product Design, 1 Oct; BUZ: "Yes to all, hand to Leo"): after
// verification a club's Technical Director may never be told the register is
// theirs to read, because nothing is sent to a TD (doc 15 has no such
// message, and none is proposed). So the call asks for them, out loud, before
// the close — doc 27 step 5 — and the sheet prompts it beside the fields that
// record them. BUZ confirmed the words, 1 Oct.
const TD_ASK = 'Before we finish \u2014 who\u2019s your Technical Director? Ask them to sign up on Pitch with their own email address, not the club\u2019s shared one. That\u2019s the account that reads the register.';

// 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
const longDay = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' });
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

export default async function CallSheet({ params }: { params: Promise<{ clubId: string }> }) {
  await requireOperator();
  const { clubId } = await params;
  // A malformed id is a 404, not a 500: it reaches Postgres as a uuid cast.
  if (!isUuid(clubId)) notFound();
  // The claim, as the signed card states it: who claimed the club and when
  // (the claimant's seat began then, 0030), and while it waits, how many
  // registrations are held — a number the operator is told NOT to mention.
  const { rows } = await db.query(
    `select c.name, c.suburb, c.state, c.contact_email, c.club_state,
       (select p.first_name || coalesce(' ' || nullif(p.last_name, ''), '')
        from membership m join person p on p.id = m.person_id
        where m.club_id = c.id and m.role in ('technical_director','club_admin')
        order by m.started_at limit 1) as claimant,
       (select min(m.started_at) from membership m
        where m.club_id = c.id and m.role in ('technical_director','club_admin')) as claimed_at,
       (select count(*)::int from registration r where r.club_id = c.id and r.withdrawn_at is null) as held
     from club c where c.id = $1`, [clubId]);
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
      name_matches: boolean | null; club_mailbox: boolean; ended_at: string | null;
      name_confirmed: boolean } | undefined;
  // 0121: the account is proved and is not the name the club gave, and no
  // operator has confirmed it — so the role is held, not waiting on anybody.
  const heldForName = Boolean(td && td.name_matches === false && !td.name_confirmed
    && !td.active && !td.ended_at && !td.club_mailbox);
  const s39To = ((await db.query(`select first_name from fn_verified_call_addressee($1)`, [clubId])).rows[0]?.first_name ?? null) as string | null;

  return (
    <OpsConsole active="verification">
      <div className="console ops-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title={`Call sheet — ${c.name}`} back={{ href: '/ops/verification', label: 'The queue' }}
          sub={`${[c.suburb, c.state].filter(Boolean).join(' ')}${c.contact_email ? ` · ${c.contact_email}` : ''}`} />
        {/* I-P2: the grid places the three; the DOM keeps claim → TD → form,
            which is the order a phone reads them in. */}
        <div className="call-grid">
        {c.claimant && c.claimed_at ? (
          <div className="card ga-claim ops-aside-sticky" style={stack(11)}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{c.name}</div>
            <div style={guide}>
              Claimed {longDay(c.claimed_at)} by {c.claimant}.
              {c.club_state === 'claimed' && c.held > 0 ? (
                <> <b style={{ color: T.ink }}>{c.held} registration{c.held === 1 ? '' : 's'} held.</b> Do not mention that number on the call.</>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="card ga-td" style={stack(4)}>
          <div className="panel-h" style={{ marginBottom: 4 }}>Technical Director</div>
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
                  <div className="field-label" style={{ marginTop: 6 }}>The account holding that address</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{td.account_name}</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{td.account_email}</div>
                  {/* 0121: the role no longer goes to this account on the
                      address alone, so the approved sentence that said it
                      did ("The role goes to this account, not to the name
                      above.") is gone (L25). The first half stays true. */}
                  {td.name_matches === false ? (
                    <div style={{ fontSize: 12.5, color: T.amber, fontWeight: 700, lineHeight: 1.5 }}>
                      This is not the name recorded on the call.
                    </div>
                  ) : null}
                </>
              ) : null}
              {/* The state line keeps its colours: they are states (spec I). */}
              <div style={{ fontSize: 12.5, color: td.club_mailbox ? T.red : td.ended_at ? T.secondary : td.active ? T.accent : T.amber, fontWeight: 700, lineHeight: 1.5, marginTop: 6 }}>
                {td.club_mailbox
                  ? `This is the club's own contact address, not a person's, so nobody holds the role. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}. Ring the club back and record the Technical Director's own address.`
                  // 0100: their access was ended since this call named them.
                  // "Waiting on their account" would be false, and the call
                  // cannot bring them back — only a new one can. BUZ's words,
                  // approved 29 Sep (docs/team/APPROVALS-28-SEP.md).
                  : td.ended_at
                    ? `${td.account_name ?? td.td_name} no longer sees the register, the squads or any player's record at ${c.name}. What they wrote stays theirs. To name a new Technical Director, record them on a call.`
                  : td.active
                    ? `Active. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}.`
                  : heldForName
                    ? NAME_HELD_STATE
                    : `Waiting on their account. Recorded by ${td.recorded_by} on ${day(td.recorded_at)}. The role switches on the moment that address is confirmed on Pitch.`}
              </div>
              {/* The human's door (0121): a named, logged confirmation that
                  attaches the role. */}
              {heldForName ? (
                <form action={confirmTdName} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <input type="hidden" name="clubId" value={clubId} />
                  <button type="submit" className="btn btn-secondary">{NAME_HELD_CONFIRM}</button>
                </form>
              ) : null}
              {/* The operator's door for ending a TD's access (D-48, 0100).
                  Only while the role is live: there is nothing to end
                  otherwise. The database requires the reason and logs it. */}
              {td.active ? (
                <form action={endTd} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <input type="hidden" name="clubId" value={clubId} />
                  <label className="ops-field">
                    <span className="panel-h">Why</span>
                    <input className="ops-input" name="reason" required minLength={3} maxLength={500} />
                  </label>
                  <button type="submit" className="btn btn-secondary">End this Technical Director&rsquo;s access</button>
                </form>
              ) : null}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              None recorded. Until this call records one, nobody at this club can open its register.
            </div>
          )}
        </div>
        {/* The form is one panel; its sections are divided by hairlines. */}
        <form action={act} className="card ops-panel ga-form"><input type="hidden" name="clubId" value={clubId} />
          <div className="ops-sec">
            <div className="ops-pair">
              <Field name="operator" label="Operator" required placeholder="Your name" note="The human. Named, every time. Never “system”, never “admin”." />
              <Field name="answered_by" label="Answered by" note="Name and role as they gave it." />
            </div>
          </div>

          <div className="ops-sec">
            {/* Ink, not red (I-P1b): red is a state, and the bold sentence
                under it carries the weight. */}
            <div className="panel-h" style={{ color: T.ink }}>The number — find it yourself</div>
            <div style={guide}>
              <b style={{ color: T.ink }}>Ring the number you found. Never the number on the claim form.</b> Ringing the claimant&rsquo;s own number confirms only that they own the phone they wrote down.
            </div>
            <div className="ops-pair">
              <Field name="number_called" label="Number called" required note="The actual number dialled." />
              <Field name="number_source" label="Where you found it" required placeholder="e.g. club website /contact, FV club directory" />
            </div>
            <div style={hint}>A blank here invalidates the call and the flag cannot be set.</div>
          </div>

          <div className="ops-sec">
            <div className="panel-h">The four questions</div>
            <div className="ops-pair">
              <Choice name="club_confirmed" label="Club confirmed" note="Is this the club?" options={['yes', 'no']} unset />
              <Choice name="person_confirmed" label="Person confirmed" note="Did they independently name the claimant?" options={['yes', 'no']} unset />
              <Choice name="incorporated" label="Incorporated" note="As answered." options={['unknown', 'yes', 'no']} />
              <Choice name="authority_confirmed" label="Authority confirmed" note="As answered." options={['unknown', 'yes', 'no']} />
            </div>
            {c.claimant ? (
              <div style={guide}>
                Ask <i>&ldquo;who would that be?&rdquo;</i> — never <i>&ldquo;is it {c.claimant}?&rdquo;</i>. Offering the name leaves them nothing to do but agree.
              </div>
            ) : null}
            {/* The line that said a no or unknown here would "flag the
                subscription" is gone (BUZ, 29 Sep, "yes to the four"): billing
                is off (D-163), so it promised a flag nothing raises. */}
          </div>

          <div className="ops-sec">
            <div className="ops-pair">
              <label className="ops-field">
                <span className="panel-h">Outcome{star}</span>
                <select className="ops-input" name="outcome" required defaultValue="">
                  <option value="">Choose one</option>
                  <option value="verified">verified</option>
                  <option value="not_verified">not verified</option>
                  <option value="suspended">suspended</option>
                  <option value="takedown">takedown</option>
                </select>
                <span style={hint}>Verifying releases every held registration to this club.</span>
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
                  The values posted are still 0025's closed list. Brief G moved
                  the label's second sentence out of the label and under the
                  control, word for word. */}
              <label className="ops-field">
                <span className="panel-h">Why</span>
                <select className="ops-input" name="suspension_reason" defaultValue="">
                  <option value="">Choose one</option>
                  <option value="child_safety">A child-safety reason — families are told</option>
                  <option value="administrative">Administrative — paperwork, officials, a claim nobody recognised</option>
                  <option value="non_payment">Non-payment</option>
                </select>
                <span style={hint}>Recorded only when the outcome is suspended or takedown. It decides whether families are told.</span>
              </label>
            </div>
            <div style={guide}>
              Choose the child-safety reason only for a child-safety reason. Every family holding a live link they sent to this club is emailed once: that the club is no longer verified, nothing about why, and a button that switches their own link off. We do not switch it off for them. The other two reasons end this club&rsquo;s access and tell nobody.
            </div>
          </div>

          <div className="ops-sec">
            <div className="panel-h">Technical Director</div>
            {/* B2: a line for BUZ to say, set as the sheet's other spoken
                lines are, with the .ops-say rule on its left. Not a field. */}
            <div className="ops-say" style={guide} data-td-ask><i>&ldquo;{TD_ASK}&rdquo;</i></div>
            <div className="ops-pair">
              <Field name="td_name" label="Name" placeholder="Full name" note="The name they gave you on the call. Recorded only when the outcome is verified." />
              <Field name="td_email" label="Email address" type="email" placeholder="name@club.example.au" note="As the club gave it." />
            </div>
            <div style={guide}>
              This is the only way a club gets a Technical Director — never a form, never a claim, never someone saying so. The role switches on when that person confirms the address on their own Pitch account, and not before. Ask for that person&rsquo;s own address: a club inbox belongs to whoever reads it, and the role cannot attach to one.
            </div>
          </div>

          <div className="ops-sec">
            <div className="panel-h">Notes</div>
            <textarea className="ops-input" aria-label="Notes" style={{ height: 'auto', minHeight: 62, padding: '12px 13px', fontWeight: 500, lineHeight: 1.6, resize: 'vertical' }} rows={3} name="notes" />
            <div style={hint}>Anything that felt off belongs here even if you verified anyway.</div>
          </div>

          {/* The §39 line, then the press: the screen's one glow. */}
          <div className="ops-sec">
            <div style={guide} data-s39={s39To ? 'will' : 'wont'}>{s39Line(s39To)}</div>
            <button type="submit" className="btn btn-primary fl-glow">Log the call</button>
          </div>
        </form>
        </div>
      </div>
    </OpsConsole>
  );
}
