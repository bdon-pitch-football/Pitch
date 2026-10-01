'use client';
// RegisterInterest.dc.html form body — copy verbatim for the under-16 variant.
// The self-registering lines (16–17, 18+) are new, awaiting BUZ (D-153).
import { useState } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { Check, G, TextLink, Who } from '@/components/player-parts';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { composeInterest } from './actions';

export default function InterestForm({ recordId, club, squads, cvPositions, preselectSquad, mode, band, trial }: {
  recordId: string;
  club: { id: string; name: string; suburb: string };
  squads: { id: string; name: string }[];
  cvPositions: string[];
  preselectSquad?: string;
  // 'self' — a 16-17 or adult going on the register themselves; 'ask' — an
  // under-16, whose parent sends it (D-153, D-91).
  mode: 'self' | 'ask';
  band: 'u16' | '16_17' | '18plus';
  trial?: { id: string; title: string; date: string };
}) {
  const self = mode === 'self';
  const [positions, setPositions] = useState<string[]>(cvPositions);
  const [note, setNote] = useState('');
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const act = composeInterest;

  return (
    // A flow, so the page wraps this in the Top bar (spec A part 5), not the
    // seat frame; the form is a door.
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <form action={act} className="door" style={{ marginTop: 0 }}><input type="hidden" name="recordId" value={recordId} />
          <div className="pg-titles">
            <h1 className="pg-title">Register your interest</h1>
            <div className="pg-sub">{club.name} keep a register of players who want to be there. Put your name on it and they have your CV when they&rsquo;re looking.</div>
          </div>
          <input type="hidden" name="clubId" value={club.id} />
          <input type="hidden" name="positions" value={positions.join(',')} />
          {trial && <input type="hidden" name="trialId" value={trial.id} />}
          <div className="c-gap">
            <div className="field-label">Interested in</div>
            {/* The club is a fact here, not an action: no green edge, and the
                trial line is secondary text with a calendar glyph. */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="club-tile">{club.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
              <div>
                <div className="row-t" style={{ fontSize: 15 }}>{club.name}</div>
                <div className="row-s" style={{ fontSize: 12 }}>{club.suburb}</div>
                {trial && <div className="trial-l">{G.cal()}For {trial.title} · {trial.date}</div>}
              </div>
            </div>
          </div>
          {/* C-P8 (BUZ, 1 Oct): a club with no squads offered a select of one
              "—". No field at all then; it posted nothing either way. */}
          {squads.length > 0 && (
            <label className="field">
              <span className="field-label">Which squad</span>
              <select name="squadId" aria-label="Which squad" defaultValue={preselectSquad ?? ''}>
                <option value="">—</option>
                {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div className="c-gap">
            <div className="field-label">Where you&rsquo;d play</div>
            {/* The shared picker: on is tinted, no lead and no order numbers,
                because this form keeps no order. */}
            <div className="pos-grid">
              {(Object.keys(POSITIONS) as PositionCode[]).map((code) => {
                const on = positions.includes(code);
                return (
                  <button type="button" key={code} onClick={() => toggle(code)} aria-label={POSITIONS[code].label} aria-pressed={on} title={POSITIONS[code].label} className="pos">{code}</button>
                );
              })}
            </div>
            <div aria-live="polite" className={positions.length ? 'pos-line' : 'pos-line none'}>
              {positions.length
                ? (Object.keys(POSITIONS) as PositionCode[]).filter((c) => positions.includes(c)).map((c) => POSITIONS[c].label).join(' · ')
                : 'Not sure what a code means? Tap it and the full name shows here.'}
            </div>
            <div className="c-help">Filled in from your CV. Change it if you&rsquo;d play somewhere else for this club.</div>
          </div>
          <div className="c-gap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="field-label">One line, if you want</div>
              <div className="c-help" style={{ fontSize: 11, fontWeight: 700 }}>{note.length} / 140</div>
            </div>
            <label className="field">
              <textarea name="note" aria-label="One line, if you want" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={2} placeholder="Right-footed 10. Happy anywhere across the front three." style={{ minHeight: 40 }} />
            </label>
            <div className="c-help">{self ? `Football only. ${club.name} read it on their register.` : 'Football only. Your parent reads this before it goes anywhere.'}</div>
          </div>
          <div className="card-sunken checks">
            <Check ok>A link to your CV — the live page, not a copy of it.</Check>
            <Check ok>Your name, your age, your club, the squad, where you&rsquo;d play, and your one line — what a coach picks a squad on.</Check>
            <hr />
            <Check ok={false}>Not your birthday, your phone, your email, your address or your school.</Check>
            <Check ok={false}>Take yourself off and the link stops working the same minute.</Check>
          </div>
          {self ? (
            <Who icon={G.tick(18)} title="This goes straight on their register">
              {band === '16_17' ? 'Your parent can see which clubs you are on. ' : ''}If {club.name} want you at a trial, they invite you through Pitch.
            </Who>
          ) : (
            <Who guard icon={G.people()} title="Your parent sends this one">
              You&rsquo;re under 16, so we ask your parent to read it and press send. It&rsquo;s the same for every club.
            </Who>
          )}
          <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--muted)' }}>
            {G.info()}
            <div className="c-help" style={{ fontSize: 12.5, lineHeight: 1.55 }}>Being on a register isn&rsquo;t a trial spot and it isn&rsquo;t a decision, so there is nothing here to be turned down from. You stay on it until you take yourself off — this season, and the next one.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="submit" className="btn btn-primary fl-glow">{self ? 'Put me on the register' : 'Ask my parent to send it'}</button>
            {/* C-P5 (BUZ, 1 Oct): Cancel goes home, as it does on /send. It was a
                div that went nowhere. */}
            <TextLink href="/home">Cancel</TextLink>
          </div>
        </form>
      </div>
  );
}
