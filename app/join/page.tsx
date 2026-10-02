'use client';
// The sign-up door — SignUp.dc.html + ParentDetails.dc.html, copy verbatim.
// This block ships the u16 player path (the pending invitation, D-17); the
// other role doors arrive with their flows.
//
// Floodlit (BUZ, 1 Oct: floodlit-join-signin-claim.html #j-*). The logo-only
// top bar (spec A part 5, P2: the logo links home), then every step in the
// door panel (part 20): on a phone the column as drawn, from 640 the same
// column lifted onto the panel. The roles go two-up and the name and date of
// birth pair up from 640 (D-147, "pairs may go two-up"); reading order, the
// fields and every name and value posted are unchanged. The way back on a
// step is the page header's, in the column at every width (A part 5).
import { useEffect, useState } from 'react';
import { createAccount, createClubAccount, createCoachAccount, startPendingInvitation } from './actions';
import { ageOn } from '@/lib/age';
import SiteNav from '@/components/floodlit/SiteNav';
import { HeaderMark } from '@/components/Wordmark';
import { SUPPORT_EMAIL } from '@/lib/support';

const CHEVRON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6 l6 6 l-6 6" /></svg>;
const TICK = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>;
const INFO = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill="currentColor" /></svg>;

const ROLES = [
  ['player', 'Player', 'Build your football CV'],
  ['coach', 'Coach', 'Develop your squad'],
  ['parent', 'Parent / Guardian', 'Approve and see their record'],
  ['club', 'Club', "Your club's home ground"],
] as const;

// D-63, D-164 (3): accounts are Australia-only. The country is asked FIRST,
// before a name or a date of birth, in every door on this page. Somewhere
// else is told plainly and collects nothing, at any age: no field is drawn,
// no form exists on that screen, and nothing is sent anywhere. Nothing about
// the answer is stored either way — Australia is simply what lets the rest
// of the page appear, and the server refuses a sign-up that did not come
// through it (actions.ts, inAustralia).
const COUNTRIES = [['AU', 'Australia'], ['elsewhere', 'Somewhere else']] as const;

export default function Join() {
  const [role, setRole] = useState('player');
  const [step, setStep] = useState<'country' | 'elsewhere' | 'signup' | 'parent' | 'account'>('country');
  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);
  // A refusal used to redirect here and say nothing at all: the form came back
  // blank and the person had no idea why. Read after mount, so the server and
  // the first client render agree.
  const [notice, setNotice] = useState<string | null>(null);
  // F7: the club they pressed Claim on, read after mount like the notices.
  // Only the club door carries it on; the action checks it again.
  const [claim, setClaim] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('claim') ?? '';
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c) && c.length <= 80) { setClaim(c); setRole('club'); }
    // A refusal comes back to a person who already said Australia: show it
    // where they were, not behind the country question again.
    if (q.get('clubAge') || q.get('coachAge') || q.get('error')) setStep('signup');
    if (q.get('clubAge')) setNotice('A club page is run by adults, so we could not set that one up. Ask someone on your committee to do it.');
    else if (q.get('coachAge')) setNotice(`A coaching page is for adults, so we could not set that one up. Your club can bring you in in the meantime — email ${SUPPORT_EMAIL}.`);
    else if (q.get('error')) setNotice('That did not go through. Check the email address and that your password is at least ten characters.');
  }, []);

  // The same calendar answer the database gives (lib/age, fn_age_band): on
  // the eighteenth birthday itself this screen and the database agree.
  const age = ageOn(dob);
  // The coach door opens on 21 Sep (BUZ): a coach builds their own page.
  // Eighteen or over — a coach account for a child is a child's account with
  // no guardian on it, and the server refuses one whatever this form says.
  const coachOk = role === 'coach' && age !== null && age >= 18;
  // A club person makes an ACCOUNT here; the club itself is claimed with the
  // code we email to the club's own address, and verified on a call (D-126).
  const clubOk = role === 'club' && age !== null && age >= 18;
  const canContinue = Boolean(firstName.trim() && dob && agreed && (role === 'player' || coachOk || clubOk));
  // A door that is closed says why on the screen (the amber notes below), so
  // Continue stays disabled for it. Anything else that is missing — the name,
  // the date of birth, the tick — is the browser's own required-field prompt
  // when Continue is pressed: a disabled button that says nothing was a dead
  // end for a child or a parent (round E). Words of our own for a missing
  // field are held for BUZ; until they are approved, the prompt is the
  // browser's, in the browser's language, and nothing of ours renders.
  const doorClosed = role === 'parent' || ((role === 'coach' || role === 'club') && age !== null && age < 18);


  // The way back from the last step is to the step before it, with what was
  // typed still there, so it is a button and not a link. The page header's
  // back, in the column at every width (A part 5).
  const backToSignup = (
    <div className="pg-head">
      <button type="button" className="pg-back" onClick={() => setStep('signup')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6 l-6 6 l6 6" /></svg>
        Back
      </button>
    </div>
  );

  return (
    <div className="floodlight has-topbar door-page">
      <SiteNav links={[]} signIn={false} />
      <main className="fl-wide door-flow">
      <div className="door">
        {step === 'country' ? (
          <>
            <h1 className="pg-title">Where do you live?</h1>
            <div className="choices">
              {COUNTRIES.map(([key, title]) => (
                <button key={key} type="button" className="choice is-line" onClick={() => setStep(key === 'AU' ? 'signup' : 'elsewhere')}>
                  <span className="t" style={{ flex: 1 }}>{title}</span>
                  <span className="ch">{CHEVRON}</span>
                </button>
              ))}
            </div>
          </>
        ) : step === 'elsewhere' ? (
          <>
            {/* Collects nothing: no input, no form, no request (D-63).
                The way back is the product's own (HeaderMark: an arrow and the
                word, top left), not a bare arrow: in the rehearsal a
                mis-tap on Somewhere else read as a dead end. It is a link to
                /join, which opens on the country question — the one thing
                this screen was reached from — and works before any script
                has run. Nothing typed is lost, because nothing was asked.
                The globe sits in the dashed "not yet" tile, drawn, no words. */}
            <HeaderMark back={{ href: '/join' }} />
            <div className="glyph-tile is-dashed" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12 h18" /><path d="M12 3 c3 3.2 3 14.8 0 18 c-3 -3.2 -3 -14.8 0 -18" /></svg>
            </div>
            <h1 className="door-h1s">Pitch is only open in Australia.</h1>
          </>
        ) : step === 'signup' ? (
          <>
            {notice && (
              <div role="alert" className="card card-amber door-note">{notice}</div>
            )}
            <h1 className="pg-title">What&rsquo;s your position?</h1>
            <div className="choices two">
              {/* Each chip is named by its title alone ("Player") and described
                  by its line underneath, so a screen reader says the name a
                  sighted person reads first (round E). */}
              {ROLES.map(([key, title, sub]) => (
                <button key={key} type="button" onClick={() => setRole(key)} aria-labelledby={`role-${key}`} aria-describedby={`role-${key}-sub`} className={role === key ? 'choice on' : 'choice'}>
                  <span className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {key === 'player' && <><circle cx="13" cy="5" r="2.4" /><path d="M9 21 l2.5-6 3-2 -1-4.5 -4 2.5 M14.5 8.5 l3.5 2 M13.5 13 l3 3.5 2 4" /></>}
                      {key === 'coach' && <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5 V3 h6 v1.5 M9 10 h6 M9 14 h6" /></>}
                      {key === 'parent' && <><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></>}
                      {key === 'club' && <><path d="M6 21 V4 l11 3.5 L6 11" /></>}
                    </svg>
                  </span>
                  <span className="main">
                    <span id={`role-${key}`} className="t">{title}</span>
                    <span id={`role-${key}-sub`} className="s-m">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {/* A form only so the browser checks the fields when Continue is
                pressed; it posts nowhere. display: contents keeps the column's
                spacing exactly as it was. */}
            <form onSubmit={(e) => { e.preventDefault(); if (canContinue) setStep(age !== null && age < 16 ? 'parent' : 'account'); }} style={{ display: 'contents' }}>
              <div className="stack8" style={{ marginTop: 4 }}>
                <div className="pair2">
                  <label className="field">
                    <div className="field-label">First name</div>
                    {/* A name of spaces is no name: the pattern asks for one character that is not a space. */}
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" required pattern=".*\S.*" />
                  </label>
                  <label className="field">
                    <div className="field-label">Date of birth</div>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="DD / MM / YYYY" required />
                  </label>
                </div>
                <div className="door-small">
                  {role === 'coach'
                    ? 'Your coaching page is yours. It stays private until you publish it, and it shows no club until a club confirms you.'
                    : role === 'club'
                      ? 'You make your own account here. Next you claim your club’s page with a code we email to the club’s own address — and a person from Pitch rings the club to verify it.'
                      : 'Under 16? A parent will need to approve your profile before it goes live.'}
                </div>
              </div>
              {/* The label wraps the input, so the label is the tap target — and it was
                  23px tall, because it is one line of 12px text. A person believes
                  this tick is what writes their consent record (D-147: >=44px at
                  every width). */}
              <label className="tick">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
                <span>
                  I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>
                </span>
              </label>
              {/* Three of the four role chips are selectable and CANNOT SIGN UP:
                  createAccount is player-shaped (it always makes a development
                  record), so parent, coach and club were gated out — leaving a
                  dead 45%-opacity button and no explanation. A door that is
                  closed has to say so; a door that looks open and does nothing
                  is the worst version. */}
              {role === 'coach' && age !== null && age < 18 && (
                <div className="card card-amber door-note">
                  <b>A coaching page is for adults.</b> You can still coach — plenty of good coaches are your age — but the page and its link wait until you turn 18. Your club can set you up in the meantime: email {SUPPORT_EMAIL}.
                </div>
              )}
              {role === 'club' && age !== null && age < 18 && (
                <div className="card card-amber door-note">
                  <b>A club page is run by adults.</b> Ask someone on your committee to set it up.
                </div>
              )}
              {role === 'parent' && (
                <div className="card card-amber door-note">
                  <b>This door is not open yet.</b> A parent joins when their child does — the child starts, and the approval comes to you by text and email.
                </div>
              )}
              {/* The one glow, unless the door is closed: a screen whose only
                  primary is unavailable has no glow (A part 18). */}
              <button type="submit" disabled={doorClosed} className={doorClosed ? 'btn btn-primary' : 'btn btn-primary fl-glow'} style={{ opacity: canContinue ? 1 : 0.45 }}>Continue</button>
            </form>
          </>
        ) : step === 'account' ? (
          <>
            {backToSignup}
            <div className="door-hd">
              <div className="door-kick">Last step</div>
              <h1 className="pg-title">Your account</h1>
            </div>
            <form action={role === 'coach' ? createCoachAccount : role === 'club' ? createClubAccount : createAccount} className="door-form">
              <input type="hidden" name="country" value="AU" />
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="dob" value={dob} />
              {role === 'club' && claim && <input type="hidden" name="claim" value={claim} />}
              <div className="door-stack">
                {(role === 'coach' || role === 'club') && (
                  <label className="field"><div className="field-label">Last name</div><input name="lastName" placeholder="Your surname" /></label>
                )}
                <label className="field"><div className="field-label">Email</div><input name="email" type="email" placeholder="you@example.com" required /></label>
                <label className="field"><div className="field-label">Password — at least ten characters</div><input name="password" type="password" minLength={10} required /></label>
                {role === 'player' && age !== null && age < 18 && (
                  <>
                    <label className="field"><div className="field-label">A parent or guardian&rsquo;s name</div><input name="guardianName" required /></label>
                    <label className="field"><div className="field-label">Their mobile</div><input name="guardianPhone" type="tel" placeholder="0412 345 678" required /></label>
                    <label className="field"><div className="field-label">Their email</div><input name="guardianEmail" type="email" required /></label>
                    <div className="door-small">You&rsquo;re {age}, so a parent stays in the loop. We text and email them to confirm. Until they do, you can build your page but not send it. After that, they&rsquo;re told each time you send, and any club approach goes to you both together.</div>
                  </>
                )}
              </div>
              <button type="submit" className="btn btn-primary fl-glow">{role === 'coach' ? 'Create my coaching account' : 'Create my account'}</button>
              {role === 'coach' && (
                <div className="door-small" style={{ lineHeight: 1.55 }}>
                  Next: your coaching page — how you coach, your teams, your licences. Reading a club&rsquo;s registrations is separate: the club names you and confirms your Working with Children Check.
                </div>
              )}
              {role === 'club' && (
                <div className="door-small" style={{ lineHeight: 1.55 }}>
                  Next: find your club on Pitch and press <b>Claim</b>. We email a code to the club&rsquo;s own public address, so the person who claims it is someone the club can already be reached at. If your club isn&rsquo;t on Pitch yet, you can ask us to add it there.
                </div>
              )}
            </form>
          </>
        ) : (
          <>
            {backToSignup}
            <div className="door-hd">
              <div className="door-kick">Last step</div>
              <h1 className="pg-title">Who should we ask?</h1>
              <div className="pg-sub">
                You&rsquo;re {age}, so a parent has to approve your page before anyone can see it. Give us their mobile and email.
              </div>
            </div>
            <form action={startPendingInvitation} className="door-form">
              <input type="hidden" name="country" value="AU" />
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="dob" value={dob} />
              <div className="door-stack">
                <label className="field"><div className="field-label">Their name</div><input name="guardianName" required /></label>
                <label className="field"><div className="field-label">Their mobile</div><input name="guardianPhone" type="tel" placeholder="0412 345 678" required /></label>
                <label className="field"><div className="field-label">Their email</div><input name="guardianEmail" type="email" required /></label>
              </div>
              <div className="door-ticks">
                {[
                  // D-156: a text and an email, one link each. "Wrong number? You
                  // can change it while you wait" was promised here and never
                  // built; it is out until it is (a child redirecting their own
                  // approval is a question for John first).
                  'We send them a text and an email, each with a link. Nothing else, ever, unless you ask them for something.',
                  'They approve your page, and after that they hold the controls.',
                ].map((t) => (
                  <div key={t}>{TICK}<div>{t}</div></div>
                ))}
              </div>
              <div className="card-sunken door-info">
                {INFO}
                <div>Put in your own number and nothing happens — the approval has to come from an adult&rsquo;s own phone, and we check the two are different.</div>
              </div>
              <button type="submit" className="btn btn-primary fl-glow">Ask them to approve it</button>
            </form>
          </>
        )}
      </div>
      </main>
    </div>
  );
}
