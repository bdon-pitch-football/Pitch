// InviteCompose.dc.html — copy verbatim where it still applies, templated to
// the player. D-153 made it reach every band, gave it the trial, and made it
// the place a club reads the answer. New lines are awaiting BUZ.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { sendInvitation } from './actions';
import { TopBarShell } from '@/components/console-shell';
import { registerBackHref } from '@/lib/register-back';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invite a family', robots: { index: false, follow: false } };

const ANSWER: Record<string, string> = { yes: 'Will be there', interested_not_date: 'Interested, but not that date' };

export default async function InviteCompose({ params, searchParams }: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ cannot?: string; back?: string }>;
}) {
  const { registrationId } = await params;
  const { cannot, back } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  // A malformed id is the same answer as a row that is not there.
  if (!isUuid(registrationId)) notFound();

  // fn_can_invite is the whole decision: this club's worker, the club
  // verified, and either the paid register or a registration against a trial
  // this club posted (D-153). Anything else is not-found — never a greyed
  // button, never "no longer accepting".
  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band, c.name as club_name,
       to_char(r.created_at at time zone 'Australia/Melbourne', 'FMMonth') as reg_month,
       (select row_to_json(t) from (
          select tn.title, to_char(tn.trial_on, 'Dy FMDD Mon') as date, tn.time_venue
          from trial_notice tn where tn.id = r.trial_notice_id) t) as trial,
       (select i.id from invitation i where i.registration_id = r.id order by i.created_at desc limit 1) as invitation_id
     from registration r join person p on p.id = r.player_id join club c on c.id = r.club_id
     where r.id = $1 and fn_can_invite($2, r.id)`,
    [registrationId, me],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;
  const minor = r.band !== '18plus';
  const trial = r.trial as { title: string; date: string; time_venue: string } | null;

  // P1 (BUZ, 1 Oct): every way back lands on the register as the TD left
  // it — the same filters, at this row (lib/register-back).
  const backHref = registerBackHref(back, registrationId);

  // One invitation per registration (P10). Once it has gone, this is where
  // the club sees what came back: 'sent' or 'answered', never read or lapsed
  // (P7) — and on an answer, only what the family chose to hand over.
  //
  // A door outside the console (F, 1 Oct): A's logo-only top bar, the page
  // header with its way back at every width, then the door.
  if (r.invitation_id) {
    const state = (await db.query('select fn_invitation_state($1,$2) as s', [me, r.invitation_id])).rows[0]?.s as string | null;
    const answer = state === 'answered'
      ? ((await db.query(
          `select shared_fields from invitation_reply where invitation_id = $1 and approved_at is not null`,
          [r.invitation_id])).rows[0]?.shared_fields as { answer?: string; note?: string; email?: string; phone?: string } | undefined)
      : undefined;
    return (
      <TopBarShell>
        <div className="inv-page">
          <div className="inv-col"><HeaderMark back={{ href: backHref, label: 'The register' }} /></div>
          <div className="door">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="inv-kicker">{r.club_name}</div>
              <h1 className="pg-title">{answer ? `${name} replied` : `Invitation sent to ${name}`}</h1>
              {trial && <div style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 700 }}>{trial.title} · {trial.date}</div>}
            </div>
            {answer ? (
              <div className="card card-accent" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>{ANSWER[answer.answer ?? 'yes'] ?? ANSWER.yes}</div>
                {answer.note && <div style={{ fontSize: 13.5, fontStyle: 'italic', color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{answer.note}&rdquo;</div>}
                <div style={{ height: 1, background: 'var(--line)' }} />
                <div className="panel-h">What they handed over</div>
                {answer.email && <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-all' }}>{answer.email}</div>}
                {answer.phone && <div style={{ fontSize: 14, fontWeight: 700 }}>{answer.phone}</div>}
                {!answer.email && !answer.phone && <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>No contact details. That is their choice, and it is allowed.</div>}
              </div>
            ) : (
              <div className="card" style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                It is in {minor ? `${name}’s Pitch account and their parent’s` : `${name}’s Pitch account`}. If they reply, you will see it here. If they don&rsquo;t, you are told nothing — silence is an allowed answer.
              </div>
            )}
            <Link href={backHref} className="btn btn-ghost">Back to the register</Link>
          </div>
        </div>
      </TopBarShell>
    );
  }

  const act = sendInvitation;
  const where: [string, boolean][] = minor
    ? [
        [`Into ${name}’s Pitch account and their parent’s. Not an email, not a text.`, true],
        [`${name} and their parent both see it. Nothing comes back to you until a parent approves the reply.`, true],
        ['You get no phone number and no email address — unless the family chooses to hand one over.', false],
        ['If they ignore it, you are told nothing. Silence is an allowed answer.', false],
      ]
    : [
        [`Into ${name}’s Pitch account. Not an email, not a text.`, true],
        [`${name} decides whether to reply.`, true],
        ['You get no phone number and no email address — unless they choose to hand one over.', false],
        ['If they ignore it, you are told nothing. Silence is an allowed answer.', false],
      ];

  return (
    <TopBarShell>
      <div className="inv-page">
        <div className="inv-col"><HeaderMark back={{ href: backHref, label: 'The register' }} /></div>
        <div className="door">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* The club's name, muted: amber is a state, and this is not one. */}
            <div className="inv-kicker">{r.club_name}</div>
            <h1 className="pg-title">Invite {name}</h1>
            <div className="pg-sub">
              {trial ? `${name} registered interest in ${trial.title}.` : `${name} went on your register in ${r.reg_month}.`} This is the only way you can reach {name}.
            </div>
          </div>
          <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="registrationId" value={registrationId} />
            {cannot && (
              <div role="alert" className="inv-refused">
                Take out the link, email address or phone number, and keep it under 400 characters. The family chooses what contact details to hand over.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="field-label">What you&rsquo;re sending</div>
              {/* Each tile reads its own radio (:has(input:checked)), so the
                  one picked shows as picked, with JavaScript off. */}
              <div className="inv-choices">
                <label className="choice-tile">
                  <input type="radio" name="kind" value="trial" defaultChecked />
                  <b>A trial invitation</b>
                  <span>{trial ? `${trial.date} · ${trial.time_venue}` : 'has a date'}</span>
                </label>
                <label className="choice-tile">
                  <input type="radio" name="kind" value="interested" />
                  <b>We&rsquo;re interested</b>
                  <span>no date yet</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="field-label">A line from you, if you want</div>
              <div className="field" style={{ minHeight: 74 }}>
                <textarea name="body" aria-label="A line from you, if you want" rows={3} placeholder={`Saw ${name} at the trials. We're short in the 16s and we'd like a proper look.`} style={{ fontSize: 13.5 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{minor ? `Football only. ${name} and their parent both read this.` : 'Football only.'}</div>
            </div>
            <div className="inv-where">
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>Where this actually goes</div>
              {where.map(([t, ok]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  {ok
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
                  <div style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* The door's one primary, so the one glow. */}
              <button type="submit" className="btn btn-primary fl-glow">{minor ? `Send it to ${name} and their parent` : `Send it to ${name}`}</button>
              <Link href={backHref} className="btn btn-ghost">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </TopBarShell>
  );
}
