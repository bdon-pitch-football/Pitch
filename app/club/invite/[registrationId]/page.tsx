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
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invite a family', robots: { index: false, follow: false } };

const ANSWER: Record<string, string> = { yes: 'Will be there', interested_not_date: 'Interested, but not that date' };

export default async function InviteCompose({ params, searchParams }: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ cannot?: string }>;
}) {
  const { registrationId } = await params;
  const { cannot } = await searchParams;
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

  const label = sectionLabel;

  // One invitation per registration (P10). Once it has gone, this is where
  // the club sees what came back: 'sent' or 'answered', never read or lapsed
  // (P7) — and on an answer, only what the family chose to hand over.
  if (r.invitation_id) {
    const state = (await db.query('select fn_invitation_state($1,$2) as s', [me, r.invitation_id])).rows[0]?.s as string | null;
    const answer = state === 'answered'
      ? ((await db.query(
          `select shared_fields from invitation_reply where invitation_id = $1 and approved_at is not null`,
          [r.invitation_id])).rows[0]?.shared_fields as { answer?: string; note?: string; email?: string; phone?: string } | undefined)
      : undefined;
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark back={{ href: '/club/register', label: 'The register' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.amber }}>{r.club_name}</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{answer ? `${name} replied` : `Invitation sent to ${name}`}</h1>
            {trial && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 700 }}>{trial.title} · {trial.date}</div>}
          </div>
          {answer ? (
            <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>{ANSWER[answer.answer ?? 'yes'] ?? ANSWER.yes}</div>
              {answer.note && <div style={{ fontSize: 13.5, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{answer.note}&rdquo;</div>}
              <div style={{ height: 1, background: T.line }} />
              <div style={label}>What they handed over</div>
              {answer.email && <div style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-all' }}>{answer.email}</div>}
              {answer.phone && <div style={{ fontSize: 14, fontWeight: 700 }}>{answer.phone}</div>}
              {!answer.email && !answer.phone && <div style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>No contact details. That is their choice, and it is allowed.</div>}
            </div>
          ) : (
            <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              It is in {minor ? `${name}’s Pitch account and their parent’s` : `${name}’s Pitch account`}. If they reply, you will see it here. If they don&rsquo;t, you are told nothing — silence is an allowed answer.
            </div>
          )}
          <Link href="/club/register" className="btn btn-ghost">Back to the register</Link>
        </div>
      </div>
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
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/club/register', label: 'The register' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.amber }}>{r.club_name}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Invite {name}</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            {trial ? `${name} registered interest in ${trial.title}.` : `${name} went on your register in ${r.reg_month}.`} This is the only way you can reach {name}.
          </div>
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="registrationId" value={registrationId} />
          {cannot && (
            <div role="alert" style={{ background: 'rgba(227,73,72,.12)', border: '1px solid rgba(227,73,72,.35)', borderRadius: 12, padding: '11px 13px', fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}>
              Take out the link, email address or phone number, and keep it under 400 characters. The family chooses what contact details to hand over.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="field-label">What you&rsquo;re sending</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="kind" value="trial" defaultChecked style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ minHeight: 62, borderRadius: 14, background: 'rgba(61,220,132,.14)', border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: T.accent }}>A trial invitation</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.secondary }}>{trial ? `${trial.date} · ${trial.time_venue}` : 'has a date'}</div>
                </div>
              </label>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="kind" value="interested" style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ minHeight: 62, borderRadius: 14, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>We&rsquo;re interested</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: T.muted }}>no date yet</div>
                </div>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="field-label">A line from you, if you want</div>
            <div style={{ ...card, minHeight: 74 }}>
              <textarea name="body" aria-label="A line from you, if you want" rows={3} placeholder={`Saw ${name} at the trials. We're short in the 16s and we'd like a proper look.`} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical' }} />
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{minor ? `Football only. ${name} and their parent both read this.` : 'Football only.'}</div>
          </div>
          <div style={{ borderRadius: 16, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 100%)', border: `1px solid ${T.line}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Where this actually goes</div>
            {where.map(([t, ok]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                {ok
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary">{minor ? `Send it to ${name} and their parent` : `Send it to ${name}`}</button>
            <Link href="/club/register" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted, textDecoration: 'none' }}>Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
