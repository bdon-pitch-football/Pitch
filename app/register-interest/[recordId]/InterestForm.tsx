'use client';
// RegisterInterest.dc.html form body — copy verbatim for the under-16 variant.
// The self-registering lines (16–17, 18+) are new, awaiting BUZ (D-153).
// C-P4 (BUZ, 1 Oct, after the copy check): a parent registering their
// under-16 reads the approved words, "What the club receives" as /g/interest
// words it, and none of Send's. Lines that spoke to the child are left out,
// not reworded: the sub, the positions help and the "Being on a register…"
// well.
import { useState } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { Check, G, TextLink, Who } from '@/components/player-parts';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { composeInterest } from './actions';

export default function InterestForm({ recordId, club, squads, cvPositions, preselectSquad, mode, band, firstName, trial }: {
  recordId: string;
  club: { id: string; name: string; suburb: string; verified: boolean };
  squads: { id: string; name: string }[];
  cvPositions: string[];
  preselectSquad?: string;
  // 'self' — a 16-17 or adult going on the register themselves; 'ask' — an
  // under-16, whose parent sends it (D-153, D-91); 'guardian' — that parent,
  // putting them on it themselves (C-P4).
  mode: 'self' | 'ask' | 'guardian';
  band: 'u16' | '16_17' | '18plus';
  firstName: string;
  trial?: { id: string; title: string; date: string };
}) {
  const self = mode === 'self';
  const parent = mode === 'guardian';
  const [positions, setPositions] = useState<string[]>(cvPositions);
  const [note, setNote] = useState('');
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const act = composeInterest;

  return (
    // A flow, so the page wraps this in the Top bar (spec A part 5), not the
    // seat frame; the form is a door. One panel header with /g/* (audit
    // ruling 19): the way back is the panel's first line, inside it.
      <main className="fl-wide pd-flow">
        <form action={act} className="door"><input type="hidden" name="recordId" value={recordId} />
          <HeaderMark back={{ href: '/home' }} />
          <div className="pg-titles">
            <h1 className="pg-title">{parent ? `Register ${firstName}’s interest` : 'Register your interest'}</h1>
            {!parent && <div className="pg-sub">{club.name} keep a register of players who want to be there. Put your name on it and they have your CV when they&rsquo;re looking.</div>}
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
                {/* N-8 (b), John's M9 ruling (1 Oct): the parent's tile carries
                    /g/interest's pill under /g/interest's rule — only the
                    positive, only when verified, never a negative, never a word
                    about the registration. The child's own view has none. */}
                {parent && club.verified && <div style={{ marginTop: 4 }}><span className="pill pill-live">Verified club on Pitch</span></div>}
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
            <div className="field-label">{parent ? `Where ${firstName} would play` : 'Where you’d play'}</div>
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
            {!parent && <div className="c-help">Filled in from your CV. Change it if you&rsquo;d play somewhere else for this club.</div>}
          </div>
          <div className="c-gap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="field-label">One line, if you want</div>
              <div className="c-help" style={{ fontSize: 11, fontWeight: 700 }}>{note.length} / 140</div>
            </div>
            <label className="field">
              <textarea name="note" aria-label="One line, if you want" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={2} placeholder="Right-footed 10. Happy anywhere across the front three." style={{ minHeight: 40 }} />
            </label>
            <div className="c-help">{self || parent ? `Football only. ${club.name} read it on their register.` : 'Football only. Your parent reads this before it goes anywhere.'}</div>
          </div>
          {parent ? (
            // /g/interest's rows, less the one the who-line below says (said once).
            <div className="card-sunken checks">
              <div className="checks-t">What the club receives</div>
              <Check ok>A link to {firstName}&rsquo;s CV — not a file, and not a copy. They cannot download or keep one.</Check>
              <Check ok>If they invite {firstName} to a trial, that invitation comes to you first.</Check>
              <hr />
              <Check ok={false}>No contact details for you or {firstName} — not now, and not if they reply.</Check>
              <Check ok={false}>They see the name, the age and the club — that is how a coach picks a squad. No birthday, no school, no address, and no way to contact either of you.</Check>
            </div>
          ) : (
            <div className="card-sunken checks">
              <Check ok>A link to your CV — the live page, not a copy of it.</Check>
              <Check ok>Your name, your age, your club, the squad, where you&rsquo;d play, and your one line — what a coach picks a squad on.</Check>
              <hr />
              <Check ok={false}>Not your birthday, your phone, your email, your address or your school.</Check>
              <Check ok={false}>Take yourself off and the link stops working the same minute.</Check>
            </div>
          )}
          {parent ? (
            <Who icon={G.tick(18)}>
              You can take {firstName} off the register any time from {firstName}&rsquo;s controls. Their access ends when you do.
            </Who>
          ) : self ? (
            <Who icon={G.tick(18)} title="This goes straight on their register">
              {band === '16_17' ? 'Your parent can see which clubs you are on. ' : ''}If {club.name} want you at a trial, they invite you through Pitch.
            </Who>
          ) : (
            <Who guard icon={G.people()} title="Your parent sends this one">
              You&rsquo;re under 16, so we ask your parent to read it and press send. It&rsquo;s the same for every club.
            </Who>
          )}
          {!parent && (
            <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--muted)' }}>
              {G.info()}
              <div className="c-help" style={{ fontSize: 12.5, lineHeight: 1.55 }}>Being on a register isn&rsquo;t a trial spot and it isn&rsquo;t a decision, so there is nothing here to be turned down from. You stay on it until you take yourself off — this season, and the next one.</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="submit" className="btn btn-primary fl-glow">{parent ? `Put ${firstName} on the register` : self ? 'Put me on the register' : 'Ask my parent to send it'}</button>
            {/* C-P5 (BUZ, 1 Oct): Cancel goes home, as it does on /send. It was a
                div that went nowhere. */}
            <TextLink href="/home">Cancel</TextLink>
          </div>
        </form>
      </main>
  );
}
