// The invitation, as the family sees it (D-117, D-153). ONE page for every
// family member it reaches — an adult player, a 16–17 or under-16 player, and
// their parent — because two pages answering one question is one of them
// wrong later.
//
//   18+       the player reads it and replies alone
//   under 18  the player and parent both see it; the player may write the
//             reply, and it reaches the club only when a parent approves it
//
// InviteGuardian.dc.html and GuardianReply.dc.html are verbatim where they
// still apply. Player-facing and approval lines are new, awaiting BUZ.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { invitationView } from '@/lib/invitations';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, ParentPage, TickGlyph } from '@/components/parent-sheet';
import { sendReply } from './actions';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'An invitation', robots: { index: false, follow: false } };

// The answer sheet (spec D): the top bar, the page header's way back, and
// the door panel from 640px.
const Shell = ({ back, children }: { back: { href: string; label?: string }; children: React.ReactNode }) => (
  <ParentPage>
    <HeaderMark back={back} />
    {children}
  </ParentPage>
);

const Tick = ({ children }: { children: React.ReactNode }) => (
  <div className="pd-tk"><TickGlyph /><div>{children}</div></div>
);

const ANSWER: Record<string, string> = { yes: 'will be there', interested_not_date: 'is interested, but not that date' };

export default async function Invitation({ params, searchParams }: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ reply?: string }>;
}) {
  const { invitationId } = await params;
  const { reply } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  // A malformed id is the same answer as a row that is not there.
  if (!isUuid(invitationId)) notFound();

  const v = await invitationView(invitationId, me);
  if (!v) notFound();

  const minor = v.band !== '18plus';
  const self = v.viewer === 'self';
  const guardian = v.viewer === 'guardian';
  // A guardian of an adult sees only what the adult re-granted — never the power to reply.
  const canAct = self || (guardian && minor);
  const name = v.playerFirstName;
  const back = guardian ? { href: '/home', label: 'Your family' } : { href: '/home' };
  const draft = v.reply && !v.reply.approved ? v.reply : null;
  const clubInitials = v.clubName.split(' ').map((w) => w[0]).slice(0, 2).join('');

  if (v.reply?.approved) {
    return (
      <Shell back={back}>
        <h1 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Reply sent to {v.clubName}.</h1>
        <div className="pd-body">Only what was switched on went with it.</div>
      </Shell>
    );
  }

  if (reply && canAct) {
    const approving = guardian && Boolean(draft);
    const writerIsChild = self && minor;
    const myEmail = writerIsChild ? null
      : ((await db.query('select email from person where id = $1', [me])).rows[0]?.email as string | undefined) ?? null;
    const currentAnswer = draft?.answer ?? 'yes';
    return (
      <Shell back={back}>
        <AskHead initial={guardian ? name[0] : undefined} kicker={`${name}${v.kind === 'trial' ? ' · trial invitation' : ''}`}
          title={approving ? `Approve ${name}’s reply` : `Reply to ${v.clubName}`}
          sub={writerIsChild
            ? 'Your parent approves it before it goes. Nothing reaches the club until then.'
            : approving
              ? `${name} wrote this. Change anything you want — it goes to ${v.clubName} when you approve it.`
              : 'You choose what goes with your answer. Everything below starts switched off.'} />
        <form action={sendReply} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="invitationId" value={invitationId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="sec-h">{writerIsChild ? 'Your answer' : `${self ? 'Your' : `${name}’s`} answer`}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* .opt (globals.css): the checked radio is the one drawn chosen.
                  Both used to be painted fixed, the first always as chosen. */}
              <label className="opt">
                <input type="radio" name="answer" value="yes" defaultChecked={currentAnswer === 'yes'} />
                <div>{self ? 'I’ll be there' : `${name} will be there`}</div>
              </label>
              <label className="opt">
                <input type="radio" name="answer" value="interested_not_date" defaultChecked={currentAnswer === 'interested_not_date'} />
                <div>Interested, not that date</div>
              </label>
            </div>
          </div>
          {!writerIsChild && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="sec-h">What you hand over</h2>
              {myEmail && (
                <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', minHeight: 44 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>My email address</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.muted, lineHeight: 1.45, wordBreak: 'break-all' }}>{myEmail}</div>
                  </div>
                  <input type="checkbox" name="share_email" style={{ width: 20, height: 20, accentColor: T.accent }} />
                </label>
              )}
              <label className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>A phone number, if you want to give one</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>So they can call you about the day. Leave it empty and they get none.</div>
                <input name="share_phone" type="tel" aria-label="A phone number, if you want to give one" placeholder="04xx xxx xxx" style={{ background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: '6px 0 0 0' }} />
              </label>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="sec-h">Anything you want to say</h2>
            <div className="card" style={{ minHeight: 74 }}>
              <textarea name="note" aria-label="Anything you want to say" rows={3} defaultValue={draft?.note ?? ''} style={{ background: 'transparent', border: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical' }} />
            </div>
          </div>
          {!writerIsChild && (
            <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The moment you hand over a phone number, that part of the conversation leaves Pitch and we cannot switch it off for you. {self ? 'Your' : `${name}’s`} CV link is separate — you keep that control whatever you do here.</div>
            </div>
          )}
          {/* D-PD-0: the press that hands something to a club is the charter
              secondary, and the No beside it is the same size. D-PD-1 (BUZ,
              1 Oct): the first screen's "Not this time", beside the submit
              too. It writes nothing (D-138). An <a>, never a form: the write
              suite finds this form by its invitationId field. */}
          <div className="fl-answer">
            <button type="submit" className="btn btn-secondary">
              {writerIsChild ? 'Send it to my parent to approve' : approving ? `Approve and send to ${v.clubName}` : 'Send my reply'}
            </button>
            <Link href="/home" className="btn btn-secondary">Not this time</Link>
          </div>
        </form>
      </Shell>
    );
  }

  const heading = v.kind === 'trial'
    ? (self ? `${v.clubName} would like you at a trial` : `${v.clubName} would like ${name} at a trial`)
    : (self ? `${v.clubName} would like to talk to you` : `${v.clubName} would like to talk to you about ${name}`);
  const kicker = guardian && draft ? `${name} has written a reply` : guardian ? 'Waiting on you' : draft ? 'Waiting on your parent' : 'An invitation';
  // D-F5 (BUZ, 1 Oct): a guardian of an adult cannot approve or reply (L9),
  // so the line says who can.
  const sub = guardian
    ? (minor ? `${name} can see this too. Nothing goes back to ${v.clubName} until you approve a reply.` : `${name} can see this too. Only ${name} can reply.`)
    : minor
      ? (draft ? 'Your reply is with your parent. It goes to the club when they approve it.' : 'Your parent can see this too. If you reply, they approve it before it goes.')
      : `Nothing goes back to ${v.clubName} unless you reply.`;

  return (
    <Shell back={back}>
      <AskHead initial={guardian ? name[0] : undefined} kicker={kicker} title={heading} sub={sub} />
      {/* Purple: a club's invitation (spec A part 11). */}
      <div className="card card-purple" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 13 }}>
          <div className="pd-club-tile">{clubInitials}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{v.clubName}</div>
            {/* doc 15 §25: never "verified against Football Victoria" — that state
                does not exist (D-126). It said so here until D-153. */}
            {v.clubVerified && <div><span className="pill pill-live">Verified club</span></div>}
          </div>
        </div>
        {v.trial && (
          <div style={{ borderTop: `1px solid ${T.line}`, padding: '13px 0' }}>
            <div className="pd-flabel" style={{ marginBottom: 4 }}>The trial</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{v.trial.title}</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary }}>{v.trial.date} · {v.trial.timeVenue}</div>
          </div>
        )}
        {v.note && (
          <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 13 }}>
            <div className="pd-flabel" style={{ marginBottom: 4 }}>Their note</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>&ldquo;{v.note}&rdquo;</div>
          </div>
        )}
      </div>

      {guardian && draft && (
        <div className="card card-amber" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{name} {ANSWER[draft.answer] ?? ANSWER.yes}</div>
          {draft.note && <div style={{ fontSize: 13, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{draft.note}&rdquo;</div>}
          <div className="pd-small">This has not gone to {v.clubName}. It goes when you approve it.</div>
        </div>
      )}

      <div className="pd-ticks">
        <Tick>They have the CV, the name, the age and the club. They have never had a phone number or an email address.</Tick>
        <Tick>Doing nothing is a complete answer. They are told nothing either way.</Tick>
        <Tick>{self && minor ? 'They can’t get your phone number or your email address from Pitch.' : 'If you say yes, you choose what you hand over. It is not automatic.'}</Tick>
      </div>

      {/* D-PD-0: two equal answers, nothing glows (replying hands something
          to a club). "Not this time" writes nothing (D-138). */}
      {canAct && (
        <div className="fl-answer">
          <Link href={`/g/invite/${invitationId}?reply=1`} className="btn btn-secondary">
            {guardian && draft ? 'Review and approve' : self && minor && draft ? 'Change my reply' : `Reply to ${v.clubName}`}
          </Link>
          <Link href="/home" className="btn btn-secondary">Not this time</Link>
        </div>
      )}
      <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>&ldquo;Not this time&rdquo; does not take {self ? 'you' : name} off their register and does not count against {self ? 'you' : name}. It closes this one invitation, and the club is simply not told.</div>
      </div>
    </Shell>
  );
}
