// Register interest, in every band (D-153). RegisterInterest.dc.html is the
// under-16 variant, copy verbatim; the self-registering screens and states
// for 16–17 and 18+ are new and awaiting BUZ's sign-off. Being on a register
// is not a trial spot and not a decision — there is nothing here to be
// turned down from.
//
// Which screen renders is lib/send-state — the same gate the action reads.
//
// C-P4 (BUZ, 1 Oct, after the copy check): a confirmed parent who opens this
// for their under-16 — the club page's "Register {first}'s interest" — puts
// them on the register from here, in the approved words, rather than reading
// the child's and approving their own request. The child's view is unchanged.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { HeaderMark } from '@/components/Wordmark';
import InterestForm from './InterestForm';
import { requireRecordActor } from '@/lib/record-guard';
import { sendState } from '@/lib/send-state';
import { TopBarShell } from '@/components/console-shell';
import { Outcome } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Register interest', robots: { index: false, follow: false } };

// The outcomes: the same Notice as Send's (spec C), under the Top bar.
const Status = ({ tone, kicker, title, children }: { tone: 'accent' | 'amber' | 'muted'; kicker: string; title: string; children: React.ReactNode }) => (
  <TopBarShell>
    <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark back={{ href: '/home' }} />
      <Outcome tone={tone} kicker={kicker} title={title}>{children}</Outcome>
    </div>
  </TopBarShell>
);

export default async function RegisterInterest({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ club?: string; squad?: string; trial?: string; asked?: string; registered?: string; error?: string }>;
}) {
  const { recordId } = await params;
  const { personId } = await requireRecordActor(recordId);
  const { club: clubParam, squad: squadParam, trial: trialParam, asked, registered } = await searchParams;

  const state = await sendState(recordId, personId);
  if (!state) notFound();
  // L10/L11: no surface at all, rather than one that goes nowhere.
  if (state.mode === 'none') redirect('/home');

  const rec = await db.query(
    `select dr.positions, p.first_name from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rec.rows.length === 0) notFound();

  const cp = clubParam && isUuid(clubParam) ? clubParam : null;
  const club = await db.query(
    cp
      ? `select id, name, suburb, club_state from club where id = $1 and club_state in ('claimed','verified')`
      : `select id, name, suburb, club_state from club where club_state = 'verified' order by created_at limit 1`,
    cp ? [cp] : [],
  );
  if (club.rows.length === 0) notFound();
  const c = club.rows[0];

  // A trial tag is a dated notice: an open-now expression of interest (0173)
  // has no day for a club to invite to.
  const trial = trialParam && isUuid(trialParam)
    ? ((await db.query(
        `select id, title, to_char(trial_on, 'Dy FMDD Mon') as date from fn_trial_notices_advertised()
         where id = $1 and club_id = $2 and trial_on is not null`,
        [trialParam, c.id])).rows[0] ?? null)
    : null;

  if (state.mode === 'off') {
    return (
      <Status tone="muted" kicker="Sending is off" title="Sending is off on your account">
        Your CV can&rsquo;t go to a club from here at the moment. If you want it back on, talk to your parent.
      </Status>
    );
  }

  if (state.mode === 'self' && registered) {
    return (
      <Status tone="accent" kicker="On the register" title={`You’re on ${c.name}’s register.`}>
        {trial ? `For ${trial.title}, ${trial.date}. ` : ''}If the club wants you at a trial, it invites you through Pitch.
      </Status>
    );
  }

  // C-P4: /g/interest's own after-words, under the same Notice.
  if (state.mode === 'guardian' && registered) {
    return (
      <Status tone="accent" kicker="On the register" title={`${state.firstName} is on ${c.name}’s register.`}>
        You can take {state.firstName} off the register any time from {state.firstName}&rsquo;s controls. Their access ends when you do.
      </Status>
    );
  }

  if (state.mode === 'ask' && asked) {
    return (
      <Status tone="amber" kicker="Waiting on your parent" title={`Asked. Nothing has gone to ${c.name} yet.`}>
        Your parent reads it and presses send. It&rsquo;s the same for every club.
      </Status>
    );
  }

  // Same numeric age sort the register and the club page use — sorting the
  // name as text drops the seniors into the middle of the juniors.
  const squads = (await db.query(
    `select s.id, s.name from squad s
     left join age_group ag on ag.code = s.age_group
     where s.club_id = $1 order by coalesce(ag.sort, 999), s.name`,
    [c.id],
  )).rows as { id: string; name: string }[];
  // A squad arrives from the club page's chips. It is a convenience, never a
  // grant — an id that is not this club's squad is simply dropped.
  const preselectSquad = squads.some((s) => s.id === squadParam) ? squadParam : undefined;

  return (
    <TopBarShell>
    <InterestForm
      recordId={recordId}
      club={{ id: c.id, name: c.name, suburb: c.suburb ?? '', verified: c.club_state === 'verified' }}
      squads={squads}
      preselectSquad={preselectSquad}
      cvPositions={rec.rows[0].positions ?? []}
      mode={state.mode}
      band={state.band}
      firstName={state.firstName}
      trial={trial ? { id: trial.id, title: trial.title, date: trial.date } : undefined}
    />
    </TopBarShell>
  );
}
