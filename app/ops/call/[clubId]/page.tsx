// The call sheet — doc 27's thirteen log fields, built as written. The
// operator is named, every time; a blank number_source invalidates the
// call. (OpsCall.dc.html styling pass to follow; the fields and their
// notes are doc 27 verbatim.)
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { logCall } from './actions';
import { requireOperator } from '@/lib/ops-guard';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verification call', robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 4 };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };
const select: React.CSSProperties = { ...input, appearance: 'none' as const };

export default async function CallSheet({ params }: { params: Promise<{ clubId: string }> }) {
  await requireOperator();
  const { clubId } = await params;
  const { rows } = await db.query(`select name, suburb, state, contact_email from club where id = $1`, [clubId]);
  if (rows.length === 0) notFound();
  const c = rows[0];
  const act = logCall;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/ops/verification', label: 'The queue' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em' }}>Call sheet — {c.name}</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[c.suburb, c.state].filter(Boolean).join(' ')}{c.contact_email ? ` · ${c.contact_email}` : ''}</div>
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><input type="hidden" name="clubId" value={clubId} />
          <label style={card}><div style={label}>Operator — the human. Named, every time. Never &ldquo;system&rdquo;, never &ldquo;admin&rdquo;.</div><input style={input} name="operator" placeholder="Your name" required /></label>
          <label style={card}><div style={label}>Number called — the actual number dialled</div><input style={input} name="number_called" required /></label>
          <label style={card}><div style={label}>Number source — where you found it. A blank here invalidates the call.</div><input style={input} name="number_source" placeholder={'e.g. club website /contact, FV club directory'} required /></label>
          <label style={card}><div style={label}>Answered by — name and role as they gave it</div><input style={input} name="answered_by" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={card}><div style={label}>Club confirmed — is this the club</div><select style={select} name="club_confirmed"><option value="yes">yes</option><option value="no">no</option></select></div>
            <div style={card}><div style={label}>Person confirmed — did they independently name the claimant</div><select style={select} name="person_confirmed"><option value="yes">yes</option><option value="no">no</option></select></div>
            <div style={card}><div style={label}>Incorporated — as answered</div><select style={select} name="incorporated"><option>unknown</option><option>yes</option><option>no</option></select></div>
            <div style={card}><div style={label}>Authority confirmed — as answered</div><select style={select} name="authority_confirmed"><option>unknown</option><option>yes</option><option>no</option></select></div>
          </div>
          <div style={card}>
            <div style={label}>Outcome</div>
            <select style={select} name="outcome" required>
              <option value="">Choose one</option>
              <option value="verified">verified</option>
              <option value="not_verified">not verified</option>
              <option value="suspended">suspended</option>
              <option value="takedown">takedown</option>
            </select>
          </div>
          <label style={card}><div style={label}>Notes — anything that felt off belongs here even if you verified anyway</div><textarea style={{ ...input, resize: 'vertical' }} rows={3} name="notes" /></label>
          <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            &ldquo;Incorporated&rdquo; and &ldquo;authority&rdquo; answered no or unknown do not fail verification — they flag the subscription, not the safety check. Verifying releases every held registration to this club.
          </div>
          <button type="submit" className="btn btn-primary">Log the call</button>
        </form>
      </div>
    </div>
  );
}
