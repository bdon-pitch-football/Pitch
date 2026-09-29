// OpsToday.dc.html — the console's home (brief G, 29 Sep; BUZ: "build both").
//
// EVERYTHING ON THIS PAGE IS A COUNT. Two read-only functions answer it
// (0110): fn_ops_today, one row of integers, and fn_ops_delivery_failures,
// the channel, time and provider status of each failed send. Neither returns
// a name, an address, a message or an id, and this page asks the database
// nothing else — the permission suite reads the query text below and fails if
// that changes (ops-t1–ops-t4). The only door off the page is to the lookup
// (/ops/support), which asks you for a contact detail you already have; no
// row here links to a person (D-79).
//
// A zero is never printed (D-162): a tile whose count is zero is omitted, and
// so is a part of a line under a tile. "Live subscriptions" is in the signed
// design and is NOT here — billing is off (D-163). Held for BUZ.
import Link from 'next/link';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today', robots: { index: false, follow: false } };

type Today = {
  signups_total: number; signups_player: number; signups_parent: number; signups_coach: number; signups_club: number;
  approvals_sent: number; approved: number; registrations: number; registration_clubs: number;
  held: number; awaiting: number; awaiting_oldest_days: number;
};
type Failure = { channel: string; failed_at: string; provider_said: string | null };

// "Monday 29 September", the signed header's shape.
const todayLine = () => {
  const parts = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
};
const hhmm = (d: string) => new Date(d).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Australia/Melbourne' });
// D-168's backlog tile. Its words are NOT approved yet (brief H), so it
// renders in development only, like the console's other held words.
// Approved by BUZ, 29 Sep (recorded in APPROVALS-28-SEP).
const HELD_WAITING_TEXTS = ['Texts waiting for SMS', 'parents\u2019 approval requests'] as const;
// Parts of a line, with every zero left out (D-162).
const line = (parts: [number, string][]) => parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(' · ');

function Tile({ label, value, colour, sub }: { label: string; value: number; colour?: string; sub?: string }) {
  return (
    <div data-ops-tile={label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em', color: colour ?? T.ink, lineHeight: 1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.4 }}>{sub}</div> : null}
    </div>
  );
}

export default async function OpsToday() {
  await requireOperator();
  const t = (await db.query(`select * from fn_ops_today()`)).rows[0] as Today;
  const failures = (await db.query(`select channel, failed_at, provider_said from fn_ops_delivery_failures()`)).rows as Failure[];
  // D-168 (0120): the parents' approval texts still waiting for SMS, so the
  // backlog is watched clearing once SMS is live. A count, nothing else.
  const waitingTexts = Number((await db.query(`select fn_sms_queued_count() as n`)).rows[0]?.n ?? 0);
  const sms = failures.filter((f) => f.channel === 'sms').length;
  const email = failures.length - sms;

  const tiles = [
    t.signups_total > 0 && <Tile key="s" label="Signups today" value={t.signups_total}
      sub={line([[t.signups_player, 'player'], [t.signups_parent, 'parent'], [t.signups_coach, 'coach'], [t.signups_club, 'club']])} />,
    t.approvals_sent > 0 && <Tile key="a" label="Approvals sent" value={t.approvals_sent} sub="to guardians" />,
    t.approved > 0 && <Tile key="o" label="Approved" value={t.approved} colour={T.accent}
      sub={`${Math.round((100 * t.approved) / t.approvals_sent)}% of sent`} />,
    failures.length > 0 && <Tile key="f" label="Delivery failures" value={failures.length} colour={T.red}
      sub={[line([[sms, 'SMS'], [email, 'email']]), 'see below'].join(' · ')} />,
    t.registrations > 0 && <Tile key="r" label="Registrations" value={t.registrations}
      sub={`across ${t.registration_clubs} club${t.registration_clubs === 1 ? '' : 's'}`} />,
    t.held > 0 && <Tile key="h" label="Held" value={t.held} colour={T.amber} sub="clubs not yet verified" />,
    t.awaiting > 0 && <Tile key="w" label="Clubs awaiting a call" value={t.awaiting} colour={T.amber}
      sub={t.awaiting_oldest_days > 0 ? `oldest ${t.awaiting_oldest_days} day${t.awaiting_oldest_days === 1 ? '' : 's'}` : undefined} />,
    // Held words (brief H): development only until BUZ approves them.
    HELD_WAITING_TEXTS && waitingTexts > 0 && <Tile key="q" label={HELD_WAITING_TEXTS[0]} value={waitingTexts} colour={T.amber} sub={HELD_WAITING_TEXTS[1]} />,
  ].filter(Boolean);

  return (
    <OpsConsole active="today">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Today" sub={`${todayLine()} · Australia/Melbourne`} />
        {tiles.length > 0 && <div className="ops-tiles">{tiles}</div>}

        {failures.length > 0 && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800 }}>Delivery failures — last 24 hours</h2>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
              These are the ones worth acting on. A guardian who never received the SMS reads as &ldquo;the parent ignored us&rdquo; everywhere else in the funnel.
            </div>
            <div className="ops-table">
              <div className="ops-head ops-fail" aria-hidden>
                <div>Channel</div><div>When</div><div>Provider said</div><div />
              </div>
              {failures.map((f, i) => (
                <div key={i} className="ops-fail">
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.secondary }}>{f.channel === 'sms' ? 'SMS' : 'Email'}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.muted }}>{hhmm(f.failed_at)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.red, overflowWrap: 'anywhere' }}>{f.provider_said ?? '—'}</div>
                  <div><Link href="/ops/support" className="console-btn">Open in lookup</Link></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.8" r="0.6" fill={T.muted} />
          </svg>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
            Everything on this page is a count. No name, no record, and no way to get to one from here — the only route to an individual is a lookup against a contact detail somebody gave you.
          </div>
        </div>
      </div>
    </OpsConsole>
  );
}
