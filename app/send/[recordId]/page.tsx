// "Send my CV", in all three bands (D-99). Copy verbatim from the signed
// screens where they exist: SendCV.dc.html (the under-16 composer) and
// SendCVAdult.dc.html (18+). The 16–17 line and the "sending is off" and
// "sent" states are new and awaiting BUZ's sign-off.
//
// Which screen renders is decided by lib/send-state.ts — the SAME function the
// action reads — so the page can never offer a send the action will refuse.
//
// C-P4 (BUZ, 1 Oct; N5's words): a confirmed parent who opens this for their
// under-16 — the club page's "Send {first}'s CV to {club}" — sends it from
// here, in their own words, rather than reading the child's and approving
// their own request by email. The child in their own seat is unchanged.
//
// From a club's own page (?club=<slug>) the club and its address are filled
// in (0160; John, 30 Sep §2): the address only when the database says it is a
// role address, checked within 90 days and not stopped, and then IN FULL —
// the guardian reviews exactly this (D-91, doc 14 L2/L4), and a masked
// address cannot be reviewed. Both fields stay editable. A club that asked
// Pitch to stop gets a plain "can't send", and no reason.
import { notFound, redirect } from 'next/navigation';
import { requireRecordActor } from '@/lib/record-guard';
import { sendState } from '@/lib/send-state';
import { PlayerFrame } from '@/components/player-shell';
import { HeaderMark } from '@/components/Wordmark';
import { composeSend, freshLink, switchOffMine } from './actions';
import { db } from '@/lib/db';
import CopyLink from '@/components/cv/CopyLink';
import { Check, G, Outcome, TextLink, Who } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send your CV', robots: { index: false, follow: false } };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <PlayerFrame active="send">
    <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark back={{ href: '/home' }} />
      {children}
    </div>
  </PlayerFrame>
);

export default async function SendCv({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ asked?: string; sent?: string; error?: string; off?: string; link?: string; club?: string; blocked?: string }>;
}) {
  const { recordId } = await params;
  const { personId } = await requireRecordActor(recordId);
  const { asked, sent, error, off, link, club, blocked } = await searchParams;
  const state = await sendState(recordId, personId);
  if (!state) notFound();
  // L10/L11: no send surface at all, rather than one that goes nowhere.
  if (state.mode === 'none') redirect('/home');

  if (state.mode === 'ask' && asked) {
    return (
      <Shell>
        <Outcome tone="amber" kicker="Waiting on your parent" title="Asked. Nothing has been sent yet.">
          Your parent checks the address and presses send. It&rsquo;s the same for every club.
        </Outcome>
      </Shell>
    );
  }

  // L38: a limited send lands here too, so nothing on this screen may depend
  // on whether a send row was actually written — no club name, no link.
  if (state.mode === 'self' && sent) {
    return (
      <Shell>
        <Outcome tone="accent" kicker="Sent" title="Sent. It’s gone to the club as a link.">
          That&rsquo;s everything on your side. Switch your link off any time and the club&rsquo;s copy stops working.
        </Outcome>
      </Shell>
    );
  }
  // C-P4: the parent's, on the same terms — and with /g/send's own line, the
  // link being the child's for the parent to pause or replace.
  if (state.mode === 'guardian' && sent) {
    return (
      <Shell>
        <Outcome tone="accent" kicker="Sent" title="Sent. It’s gone to the club as a link.">
          You can pause or replace {state.firstName}&rsquo;s link any time — the club&rsquo;s access stops when you do.
        </Outcome>
      </Shell>
    );
  }

  // L6: told plainly that sending is off — about their own account, and
  // nothing about who switched it (doc 15 §22).
  if (state.mode === 'off') {
    return (
      <Shell>
        <Outcome tone="muted" kicker="Sending is off" title="Sending is off on your account">
          Your CV can&rsquo;t be sent from here at the moment. If you want it back on, talk to your parent.
        </Outcome>
      </Shell>
    );
  }

  // The club's page passes its slug. A slug is a-z, 0-9 and hyphens (0130);
  // anything else is ignored rather than asked about.
  const slug = typeof club === 'string' && /^[a-z0-9-]{1,80}$/.test(club) ? club : null;
  const held = slug
    ? (await db.query(
        `select club_name, address, to_char(checked_on, 'FMDD FMMonth') as checked, blocked
         from fn_send_address_for_club($1)`,
        [slug],
      )).rows[0] as { club_name: string; address: string | null; checked: string | null; blocked: boolean } | undefined
    : undefined;

  // 0160: the club asked Pitch to stop, or the action refused an address that
  // did. Nothing else on the page — no form, no reason, nothing about the club.
  if (blocked || held?.blocked) {
    return (
      <Shell>
        <Outcome tone="muted" kicker="Not sent" title="We can’t send to this club through Pitch">
          Nothing has been sent.
        </Outcome>
      </Shell>
    );
  }

  const self = state.mode === 'self';
  // C-P4: the parent sends this one themselves, so it is sent, not asked for.
  const parent = state.mode === 'guardian';
  const act = composeSend;
  return (
    <Shell>
      {/* A form is a door (spec C): the phone column as drawn, lifted onto a
          panel from 640px. "Your links" is a list, so it is the page under
          it, never inside it. */}
      <form action={act} className="door" style={{ marginTop: 0 }}><input type="hidden" name="recordId" value={recordId} />
        <div className="pg-titles">
          <h1 className="pg-title">{parent ? `Send ${state.firstName}’s CV` : 'Send my CV'}</h1>
          <div className="pg-sub">Pick who it goes to. Your CV goes as a link, so it always shows what&rsquo;s on your page today.</div>
        </div>
        {error && <div className="card card-amber c-say" style={{ fontSize: 12.5 }}>Check the club name and the email address — a wrong address just goes nowhere.</div>}
        {/* The club travels with the form, so a mistyped address comes back
            with the club still filled in (?error=1&club=). */}
        {slug && <input type="hidden" name="club" value={slug} />}
        {/* "Sending to" heads both wells, and each well names its own field.
            D-172: nothing here draws an unclaimed club — its name in the
            field, and nothing else. */}
        <div className="c-gap">
          <div className="panel-h">Sending to</div>
          <label className="field" aria-invalid={error ? true : undefined}>
            <span className="field-label">Club</span>
            <input name="clubName" aria-label="Club" placeholder="e.g. Northern United SC" required maxLength={60} defaultValue={held?.club_name} />
          </label>
          <label className="field" aria-invalid={error ? true : undefined}>
            <span className="field-label">Their email address</span>
            <input className="c-mono" name="address" aria-label="Their email address" type="email" placeholder="football@theclub.com.au" required defaultValue={held?.address ?? undefined} />
          </label>
          {held?.address && held.checked ? (
            <div className="c-help">The address {held.club_name} publishes on its own website, checked {held.checked}. Change it if you have a better one.</div>
          ) : (
            <div className="c-help">From the club&rsquo;s own trial notice. Check it&rsquo;s right — a wrong address just goes nowhere.</div>
          )}
        </div>
        {/* A Well: text you read. A cross is "not given", not danger. */}
        <div className="card-sunken checks">
          <div className="checks-t">What the club gets</div>
          <Check ok>A link to your CV — the same page you&rsquo;d send anyone.</Check>
          <Check ok={false}>If you switch your link off, it stops working for them.</Check>
          <Check ok={false}>Not your phone number, your email or your address. They never get those.</Check>
        </div>
        {self ? (
          <Who icon={G.send()} title="You send this yourself">
            {state.band === '16_17' ? 'Your parent is told each time you send. ' : ''}Switch the link off later and the club&rsquo;s copy stops working.
          </Who>
        ) : parent ? (
          <Who icon={G.send()} title="You send this one">
            You can pause or replace {state.firstName}&rsquo;s link any time — the club&rsquo;s access stops when you do.
          </Who>
        ) : (
          <Who guard icon={G.people()} title="Your parent sends this one">
            You&rsquo;re under 16, so we ask your parent to check the address and press send. It&rsquo;s the same for every club.
          </Who>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="submit" className="btn btn-primary fl-glow">{self || parent ? 'Send it now' : 'Ask my parent to send it'}</button>
          <TextLink href="/home">Cancel</TextLink>
        </div>
      </form>
      {self && <YourLinks recordId={recordId} personId={personId} off={Boolean(off)} fresh={typeof link === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(link) ? link : null} />}
    </Shell>
  );
}

// The player's own links (John's rulings, 17 Sep §3). What actually happened,
// and never a number: no count, no "x of ten", no limit. A send the daily
// limit held shows as one that didn't go (0046), with no figure. A player
// here is 16 or over and sending for themselves ('self'), so the club's
// address is theirs to see (U-5 hides it only from under-16s).
async function YourLinks({ recordId, personId, off, fresh }: { recordId: string; personId: string; off: boolean; fresh: string | null }) {
  const { rows } = await db.query(
    `select * from (
       select at, club_name, recipient, token_id, live, false as held from fn_send_log($1, $1)
       union all
       select at, club_name, null, null, false, true from send_held where person_id = $1
     ) x order by at desc limit 50`,
    [personId],
  );
  const sends = rows as { at: string; club_name: string | null; recipient: string | null; token_id: string | null; live: boolean; held: boolean }[];
  const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' });
  const freshUrl = fresh ? `pitchfootball.com.au/p/${fresh}` : null;

  return (
    <section id="links" className="c-gap">
      <h2 className="sec-h">Your links</h2>
      {off && <div role="status" className="card card-accent c-say">Switched off. That club&rsquo;s link stopped working just now.</div>}
      {freshUrl && (
        <div role="status" className="card card-accent" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="checks-t">Your fresh link</div>
          {/* Text to copy, not a link: ink, monospace. */}
          <div className="link-v" style={{ fontSize: 13 }}>{freshUrl}</div>
          <CopyLink url={`https://${freshUrl}`} label="Copy the link" />
          <div className="c-help">Copy it now. We only show it this once. Every link you had before has stopped working.</div>
        </div>
      )}
      {sends.length === 0 ? (
        <div className="card empty">
          <div className="empty-tile c-glyph" aria-hidden>{G.send(16)}</div>
          <div><span className="empty-t">You haven&rsquo;t sent your CV to a club yet.</span></div>
        </div>
      ) : (
        <div className="card rows">
          {sends.map((x, i) => (
            <div key={i} className="row">
              <div className="row-main">
                <div className="row-t" style={{ fontSize: 14 }}>{x.club_name ?? 'A club'}</div>
                <div className="row-s" style={{ overflowWrap: 'anywhere' }}>
                  {day(x.at)}{x.recipient ? ` · ${x.recipient}` : ''}
                </div>
                {x.held && <div className="c-s2" style={{ marginTop: 2 }}>This one didn&rsquo;t go. You can send it again later.</div>}
              </div>
              {x.held ? null : x.live && x.token_id ? (
                <form action={switchOffMine} style={{ flexShrink: 0 }}>
                  <input type="hidden" name="recordId" value={recordId} />
                  <input type="hidden" name="tokenId" value={x.token_id} />
                  <button type="submit" className="console-btn">Switch off</button>
                </form>
              ) : (
                <div className="row-s" style={{ fontWeight: 700, flexShrink: 0 }}>Switched off</div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* N4 (BUZ, 1 Oct): the button carries the words, so the heading that
          repeated them goes; the line under it says the consequence. */}
      <form action={freshLink} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="hidden" name="recordId" value={recordId} />
        <div className="c-s2">Every link you&rsquo;ve sent stops working straight away, and you get a new one to share. Clubs that had your old link won&rsquo;t be able to open it.</div>
        <button type="submit" className="btn btn-secondary">Make a fresh link</button>
      </form>
    </section>
  );
}
