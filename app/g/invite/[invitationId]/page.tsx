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
import { sendReply } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', purple: '#a479e2', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'An invitation', robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

const Shell = ({ back, children }: { back: { href: string; label?: string }; children: React.ReactNode }) => (
  <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
    <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark back={back} />
      {children}
    </div>
  </div>
);

const Tick = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{children}</div>
  </div>
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
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>Reply sent to {v.clubName}.</h1>
        <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Only what was switched on went with it.</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name}{v.kind === 'trial' ? ' · trial invitation' : ''}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{approving ? `Approve ${name}’s reply` : `Reply to ${v.clubName}`}</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            {writerIsChild
              ? 'Your parent approves it before it goes. Nothing reaches the club until then.'
              : approving
                ? `${name} wrote this. Change anything you want — it goes to ${v.clubName} when you approve it.`
                : 'You choose what goes with your answer. Everything below starts switched off.'}
          </div>
        </div>
        <form action={sendReply} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="invitationId" value={invitationId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>{writerIsChild ? 'Your answer' : `${self ? 'Your' : `${name}’s`} answer`}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="answer" value="yes" defaultChecked={currentAnswer === 'yes'} style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ minHeight: 52, borderRadius: 14, background: 'rgba(61,220,132,.14)', border: `1.5px solid ${T.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 8px', fontSize: 14, fontWeight: 900, color: T.accent }}>{self ? 'I’ll be there' : `${name} will be there`}</div>
              </label>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="answer" value="interested_not_date" defaultChecked={currentAnswer === 'interested_not_date'} style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ minHeight: 52, borderRadius: 14, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 8px', fontSize: 14, fontWeight: 700, color: T.muted }}>Interested, not that date</div>
              </label>
            </div>
          </div>
          {!writerIsChild && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>What you hand over</div>
              {myEmail && (
                <label style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>My email address</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.muted, lineHeight: 1.45, wordBreak: 'break-all' }}>{myEmail}</div>
                  </div>
                  <input type="checkbox" name="share_email" style={{ width: 20, height: 20, accentColor: T.accent }} />
                </label>
              )}
              <label style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>A phone number, if you want to give one</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>So they can call you about the day. Leave it empty and they get none.</div>
                <input name="share_phone" type="tel" aria-label="A phone number, if you want to give one" placeholder="04xx xxx xxx" style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', padding: '6px 0 0 0' }} />
              </label>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Anything you want to say</div>
            <div style={{ ...card, minHeight: 74 }}>
              <textarea name="note" aria-label="Anything you want to say" rows={3} defaultValue={draft?.note ?? ''} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical' }} />
            </div>
          </div>
          {!writerIsChild && (
            <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The moment you hand over a phone number, that part of the conversation leaves Pitch and we cannot switch it off for you. {self ? 'Your' : `${name}’s`} CV link is separate — you keep that control whatever you do here.</div>
            </div>
          )}
          <button type="submit" className="btn btn-primary">
            {writerIsChild ? 'Send it to my parent to approve' : approving ? `Approve and send to ${v.clubName}` : 'Send my reply'}
          </button>
        </form>
      </Shell>
    );
  }

  const heading = v.kind === 'trial'
    ? (self ? `${v.clubName} would like you at a trial` : `${v.clubName} would like ${name} at a trial`)
    : (self ? `${v.clubName} would like to talk to you` : `${v.clubName} would like to talk to you about ${name}`);
  const kicker = guardian && draft ? `${name} has written a reply` : guardian ? 'Waiting on you' : draft ? 'Waiting on your parent' : 'An invitation';
  const sub = guardian
    ? `${name} can see this too. Nothing goes back to ${v.clubName} until you approve a reply.`
    : minor
      ? (draft ? 'Your reply is with your parent. It goes to the club when they approve it.' : 'Your parent can see this too. If you reply, they approve it before it goes.')
      : `Nothing goes back to ${v.clubName} unless you reply.`;

  return (
    <Shell back={back}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{kicker}</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{heading}</h1>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{sub}</div>
      </div>
      <div style={{ ...card, border: `1px solid ${T.purple}`, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: T.secondary, flexShrink: 0 }}>{clubInitials}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{v.clubName}</div>
            {/* doc 15 §25: never "verified against Football Victoria" — that state
                does not exist (D-126). It said so here until D-153. */}
            {v.clubVerified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, background: T.accent }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: T.accent }}>Verified club</div>
              </div>
            )}
          </div>
        </div>
        {v.trial && (
          <div style={{ borderTop: `1px solid ${T.line}`, padding: '13px 0' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>The trial</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{v.trial.title}</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary }}>{v.trial.date} · {v.trial.timeVenue}</div>
          </div>
        )}
        {v.note && (
          <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 13 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>Their note</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>&ldquo;{v.note}&rdquo;</div>
          </div>
        )}
      </div>

      {guardian && draft && (
        <div style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{name} {ANSWER[draft.answer] ?? ANSWER.yes}</div>
          {draft.note && <div style={{ fontSize: 13, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{draft.note}&rdquo;</div>}
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>This has not gone to {v.clubName}. It goes when you approve it.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Tick>They have the CV, the name, the age and the club. They have never had a phone number or an email address.</Tick>
        <Tick>Doing nothing is a complete answer. They are told nothing either way.</Tick>
        <Tick>{self && minor ? 'They can’t get your phone number or your email address from Pitch.' : 'If you say yes, you choose what you hand over. It is not automatic.'}</Tick>
      </div>

      {canAct && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <Link href={`/g/invite/${invitationId}?reply=1`} className="btn btn-primary">
            {guardian && draft ? 'Review and approve' : self && minor && draft ? 'Change my reply' : `Reply to ${v.clubName}`}
          </Link>
          <Link href="/home" style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Not this time</Link>
        </div>
      )}
      <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>&ldquo;Not this time&rdquo; does not take {self ? 'you' : name} off their register and does not count against {self ? 'you' : name}. It closes this one invitation, and the club is simply not told.</div>
      </div>
    </Shell>
  );
}
