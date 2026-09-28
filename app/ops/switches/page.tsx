// The kill switches (D-94 §10; migration 0044). Two of them, for the night
// something has gone wrong: pause every shared CV link, or switch every live
// link off for good. Nothing here reads a child's record (D-79) — the page
// shows counts and the switch log, and nothing else.
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { OpsConsole } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { REVOKE_ALL_PHRASE } from '@/lib/ops-policy';
import { revokeAllLinks, setLinksPaused } from './actions';
import { T } from '@/lib/palette';
import { card, fieldLabel, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Emergency switches', robots: { index: false, follow: false } };

const input: React.CSSProperties = { background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };
const ACTION: Record<string, string> = {
  links_paused: 'Paused every shared link',
  links_resumed: 'Switched shared links back on',
  links_all_revoked: 'Switched off every live link',
};

export default async function Switches({ searchParams }: { searchParams: Promise<{ done?: string; n?: string; told?: string; error?: string }> }) {
  await requireOperator();
  const { done, n, told, error } = await searchParams;
  const state = (await db.query(
    `select fn_public_links_paused() as paused,
       (select count(*)::int from share_token where revoked_at is null and (expires_at is null or expires_at > now())) as live`,
  )).rows[0];
  const log = (await db.query(
    `select action, operator_email, reason, links_affected,
       to_char(at at time zone 'Australia/Melbourne', 'DD Mon YYYY HH24:MI') as at
     from ops_switch_event order by id desc limit 10`,
  )).rows as { action: string; operator_email: string; reason: string; links_affected: number | null; at: string }[];
  const paused: boolean = state.paused;

  return (
    <OpsConsole active="switches">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Emergency switches</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>For the night something has gone wrong. Every switch is logged with your name and your reason.</div>
        </div>

        {done === 'paused' && <div role="status" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Every shared link is paused.</div>}
        {done === 'resumed' && <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Shared links are back on.</div>}
        {done === 'revoked' && <div role="status" style={{ ...card, border: `1px solid ${T.red}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>{Number(n ?? 0)} links switched off. {Number(told ?? 0)} families and players emailed.</div>}
        {error === 'reason' && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Say why. It goes in the log.</div>}
        {error === 'family' && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Nothing was switched off. Write the sentence families will read.</div>}
        {error === 'confirm' && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Nothing was switched off. Type the words exactly as shown.</div>}

        <div className="player-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={sectionLabel}>Pause shared links</div>
            <form action={setLinksPaused} style={{ ...card, border: `1px solid ${paused ? T.amber : T.line}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="hidden" name="paused" value={paused ? 'off' : 'on'} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: paused ? 'rgba(237,161,0,.14)' : 'rgba(61,220,132,.14)', color: paused ? T.amber : T.accent, borderRadius: 7, padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {paused ? 'Paused' : 'On'}
                </div>
                <div style={{ fontSize: 13, color: T.secondary, fontWeight: 700 }}>{state.live} live {state.live === 1 ? 'link' : 'links'}</div>
              </div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                {paused
                  ? 'Every player’s shared link shows the same page a dead link does. Switch it back on and every link that was working works again.'
                  : 'Pausing makes every player’s shared link show the same page a dead link does, until you switch it back on. Nothing is lost. Coach and club pages stay up.'}
              </div>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                <div style={fieldLabel}>Why</div>
                <input name="reason" style={input} required minLength={3} maxLength={500} placeholder="What happened" />
              </label>
              <button type="submit" className={paused ? 'btn btn-primary' : 'btn btn-secondary'}>{paused ? 'Switch shared links back on' : 'Pause every shared link'}</button>
            </form>

            <div style={{ ...sectionLabel, marginTop: 8 }}>Switch off every link</div>
            <form action={revokeAllLinks} style={{ ...card, border: `1px solid ${T.red}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                <b style={{ color: T.ink }}>This can&rsquo;t be undone.</b> Every live link stops working for good. Each family has to send a new one. Their timeline says Pitch switched it off, and they get an email. Use it when links may have got into the wrong hands.
              </div>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                <div style={fieldLabel}>Why</div>
                <input name="reason" style={input} required minLength={3} maxLength={500} placeholder="What happened" />
              </label>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                <div style={fieldLabel}>What families will read</div>
                <textarea name="familyReason" required minLength={10} maxLength={300} rows={3} placeholder="One plain sentence about what happened. No names, no clubs, no guesses." style={{ ...input, fontWeight: 500, resize: 'vertical', lineHeight: 1.5 }} />
                <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5, marginTop: 4 }}>Every guardian and every player 16 or over whose link goes is emailed, with this sentence in the middle.</div>
              </label>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                <div style={fieldLabel}>Type {REVOKE_ALL_PHRASE}</div>
                <input name="confirm" style={input} required autoComplete="off" spellCheck={false} />
              </label>
              <button type="submit" className="btn btn-secondary" style={{ borderColor: T.red, color: T.red }}>Switch off every link</button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={sectionLabel}>Switch log</div>
            {log.length === 0 ? (
              <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 500 }}>Nothing has been switched.</div>
            ) : log.map((e, i) => (
              <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{ACTION[e.action] ?? e.action}{e.links_affected != null ? ` · ${e.links_affected}` : ''}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.at} · {e.operator_email}</div>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{e.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </OpsConsole>
  );
}
