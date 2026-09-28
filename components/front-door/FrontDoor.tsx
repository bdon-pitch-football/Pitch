// The product front door (D-164 (1)) — Home.dc.html (the chooser),
// LandingParent / LandingPlayer / LandingCoach / LandingClub and, from 1024px,
// DeskLandingClub's top bar. Copy verbatim from the signed screens EXCEPT any
// line that states a price, a date, "at launch", "for now" or a count of free
// places (D-163 as amended): those are held for BUZ and are not in this file
// at all, so they cannot render by accident. The held lines are listed in
// docs/team/reports/2026-09-28-builder-final-b.md.
//
// It renders only while the launch-day switch is on (0080): proxy.ts then
// serves it at `/` (app/front-door). Until then `/` is the coming-soon page,
// and this component is reachable from nowhere.
//
// Ways in, and where the designs put them: sign up (each landing's button →
// /join), trials ("Browse trials without an account" → /trials), claim your
// club (LandingClub's button → /join, whose club door explains the claim, and
// every unclaimed club page now carries "Claim your club" → /claim/[slug]),
// and sign in. No design carries a "find a club" element and no club search
// ships at launch (D-74), so there is none here: that is in the report as a
// question for BUZ, not invented.
//
// Server component, zero JS. The persona is a query parameter on `/` so the
// whole front door sits behind the one switch — a separate route would be a
// second thing to gate.
import Link from 'next/link';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

export const FRONT_DOOR_SEATS = ['player', 'parent', 'coach', 'club'] as const;
export type FrontDoorSeat = (typeof FRONT_DOOR_SEATS)[number];

// The designs give player and coach two colours with no token behind them
// (#d95926, #3987e5). Tokens only (lib/palette; the register screen retired
// #3987e5 for the same reason): the kicker and the edge take the nearest
// charter colour.
const ACCENT: Record<FrontDoorSeat, string> = { player: T.accent, parent: T.purple, coach: T.secondary, club: T.amber };

type Icon = string[];
const I = {
  runner: ['M12 6.5 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', 'M12 10 V15 M12 15 L8 20 M12 15 L16.5 18.5 M6 12.5 L12 11 M18 11.5 L12 11'],
  family: ['M9 7 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0', 'M16.5 9 m-2.1 0 a2.1 2.1 0 1 0 4.2 0 a2.1 2.1 0 1 0 -4.2 0', 'M4.5 20 C4.5 15.5 6.5 13.5 9 13.5 C11.5 13.5 13.5 15.5 13.5 20 M14.5 20 C14.5 16.8 15.4 14.8 16.5 14.8 C18.4 14.8 19.8 16.5 19.8 20'],
  clipboard: ['M8 4 H16 a2 2 0 0 1 2 2 V19 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 Z', 'M9.5 4 V2.8 H14.5 V4 M9 9 H15 M9 12.5 H15 M9 16 H12.5'],
  flag: ['M6 21 V4 M6 4 H17 L15 7 L17 10 H6', 'M3.5 21 H10'],
  calendar: ['M6 5 H18 a2.5 2.5 0 0 1 2.5 2.5 V18 a2.5 2.5 0 0 1 -2.5 2.5 H6 a2.5 2.5 0 0 1 -2.5 -2.5 V7.5 A2.5 2.5 0 0 1 6 5 Z', 'M3.5 9.5 h17', 'M8 3.5 v3 M16 3.5 v3'],
  squad: ['M8 8 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0', 'M16 8 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0', 'M3 19 c0 -3.4 2 -5.6 5 -5.6 s5 2.2 5 5.6', 'M12.5 19 c0 -3.4 1.6 -5.6 3.5 -5.6 s5 2.2 5 5.6'],
  pathway: ['M4 20 V13 M4 13 l7 -4 l4 2.2 l5 -2.8', 'M4 13 V6.5 l7 -3.5 l4 2.2 l5 -2.7 V9'],
  lock: ['M6.5 10.5 H17.5 a2.5 2.5 0 0 1 2.5 2.5 V18 a2.5 2.5 0 0 1 -2.5 2.5 H6.5 A2.5 2.5 0 0 1 4 18 V13 a2.5 2.5 0 0 1 2.5 -2.5 Z', 'M8 10.5 V7.5 a4 4 0 0 1 8 0 v3'],
  search: ['M11 11 m-6.5 0 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0', 'M20 20 L15.8 15.8', 'M5 5 L19 19'],
  bubble: ['M20.5 12.5 a8 8 0 1 0 -3.2 6.4 L21 20 Z'],
  bin: ['M5 7 h14', 'M9.5 7 V5 h5 v2', 'M6.5 7 l1 12.5 h9 L17.5 7'],
  send: ['M21 3 L11 13', 'M21 3 L14.5 21 L11 13 L3 9.5 Z'],
  case: ['M5.5 7.5 H18.5 a2.5 2.5 0 0 1 2.5 2.5 V17.5 a2.5 2.5 0 0 1 -2.5 2.5 H5.5 A2.5 2.5 0 0 1 3 17.5 V10 a2.5 2.5 0 0 1 2.5 -2.5 Z', 'M9 7.5 V5.5 a1.5 1.5 0 0 1 1.5 -1.5 h3 A1.5 1.5 0 0 1 15 5.5 v2'],
  recruit: ['M9 8 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', 'M3.5 20 c0 -4.5 2.5 -7 5.5 -7 s5.5 2.5 5.5 7', 'M17 9 h5 M19.5 6.5 v5'],
  shield: ['M12 3 l7.5 3 v6 c0 4.5 -3.2 7.8 -7.5 9 c-4.3 -1.2 -7.5 -4.5 -7.5 -9 V6 Z', 'M8.8 12 l2.2 2.2 l4.2 -4.4'],
} satisfies Record<string, Icon>;

function Glyph({ d, color, size = 17 }: { d: Icon; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

const Tick = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
);

const kicker = (color: string): React.CSSProperties => ({ ...sectionLabel, color });
const body: React.CSSProperties = { fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 };

function Hero({ seat, kick, title, text, cta }: { seat: FrontDoorSeat; kick: string; title: React.ReactNode; text: string; cta: [string, string] }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'var(--hero)', padding: '26px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: ACCENT[seat] }} />
      <div style={kicker(ACCENT[seat])}>{kick}</div>
      <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em', color: T.ink }}>{title}</h1>
      <div style={{ fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }}>{text}</div>
      <Link href={cta[1]} className="btn btn-primary" style={{ marginTop: 4 }}>{cta[0]}</Link>
    </div>
  );
}

function Feature({ icon, tint, title, text }: { icon: Icon; tint: string; title: string; text: string }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Glyph d={icon} color={tint} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
        <div style={body}>{text}</div>
      </div>
    </div>
  );
}

function Section({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={kicker(T.accent)}>{label}</h2>
        {sub && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

// "Coming soon" — the designs' own roadmap lines. None names a price or a date.
function Soon({ items }: { items: string[] }) {
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(237,161,0,.14)', borderRadius: 999, padding: '5px 11px', alignSelf: 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: T.amber }} />
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.amber }}>Coming soon</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: T.amber, flexShrink: 0, marginTop: 7 }} />
            <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.45 }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Close({ cta, foot }: { cta: [string, string]; foot: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      <Link href={cta[1]} className="btn btn-primary">{cta[0]}</Link>
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, textAlign: 'center' }}>{foot}</div>
    </div>
  );
}

const Rule = () => <div style={{ height: 1, background: T.line }} />;

// ---- the four landings ------------------------------------------------------

function Parent() {
  const cta: [string, string] = ['Set up your child’s profile', '/join'];
  return (
    <>
      <Hero seat="parent" kick="For parents" title={<>Your kid&rsquo;s football, kept properly.</>} cta={cta}
        text="Every season, every club, every goal they were proud of — in one record that belongs to them. Not a spreadsheet on someone's laptop that disappears when the coach does." />
      <Section label="You hold the keys" sub="This is a record about a child. The controls sit with you.">
        <Feature icon={I.lock} tint={T.purple} title="Nothing exists until you say so" text="Under 16, nothing your child builds is visible to anyone until you approve it — not to a club, not to a search, not to us. If you do nothing, it deletes itself in fourteen days." />
        <Feature icon={I.search} tint={T.purple} title="Under-16s cannot be searched for" text={'Not "hidden by default". There is no search on Pitch that reaches an under-16 — not for clubs, not for coaches, not for us. It is not a setting that can be switched on.'} />
        <Feature icon={I.bubble} tint={T.purple} title="Nobody messages your child" text="There is no way to send a message to a child on Pitch. If a club wants to talk, it comes to you and your child together, and it is written down." />
        <Feature icon={I.bin} tint={T.purple} title="One tap deletes it" text="You or your child, any time, no reason needed. We keep a record that consent was given and withdrawn — nothing else." />
      </Section>
      <Section label="What it's actually for">
        <Feature icon={I.clipboard} tint={T.accent} title="A CV worth sending to a club" text="Position, squad number, the clubs they've played for, what they achieved, a couple of clips. Two minutes to build. It looks like something, which matters more at fourteen than anyone admits." />
        <Feature icon={I.send} tint={T.accent} title="And a way to send it" text="Your child asks to send their CV to a club. It comes to you first — you check the address, you press send. The club gets a link you can switch off, not a file that stays in their inbox." />
      </Section>
      <Soon items={[
        'What your child\'s coach is actually working on with them',
        'Everything they\'ve done, kept — even when they change clubs',
        'Game time you don\'t have to count from the sideline',
        'Clubs finding your child when they\'re old enough',
      ]} />
      <Close cta={cta} foot="Australia first · Data stored in Australia" />
    </>
  );
}

function Player() {
  const cta: [string, string] = ['Build my CV', '/join'];
  const steps: [string, string][] = [
    ['Your position, your number, your clubs', 'Pick up to three positions from a real list. Add the clubs you\'ve played for, and the football that happened outside them — school, futsal, rep sides.'],
    ['The numbers you choose to show', 'Appearances, goals, assists, clean sheets. You pick which of them go on your page, so a keeper isn\'t stuck showing three zeros where the goals go.'],
    ['Clips that stay put', 'YouTube, Instagram or Veo.'],
  ];
  return (
    <>
      <Hero seat="player" kick="For players · 18 and over" title="Stop retyping your football." cta={cta}
        text="Every preseason you write the same email. Clubs, positions, what you did last year, a highlights link that expires. Build it once, keep it for good, send it in one tap." />
      <Section label="Two minutes, then it's yours">
        {steps.map(([title, text], i) => (
          <div key={title} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div className="tnum" style={{ width: 34, height: 34, borderRadius: 11, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 900, color: T.accent }}>{i + 1}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
              <div style={body}>{text}</div>
            </div>
          </div>
        ))}
      </Section>
      <Section label="Sending it">
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.ink, lineHeight: 1.2 }}>Send it to a club without writing an email.</div>
          <div style={body}>Find a club or a trial notice, check the address, send. The club opens a page, not an attachment — so if you change clubs in March, what they&rsquo;re looking at changes too. And you can switch the link off whenever you like.</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}><Tick /><div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 700 }}>One tap. No cover letter. No attachment.</div></div>
        </div>
      </Section>
      <Soon items={[
        'Clubs finding you, not just you finding clubs',
        'Your coach\'s word on your record, not only your own',
        'Every season you play, kept — whatever club you end up at',
        'Clubs asking to see your CV',
      ]} />
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, textAlign: 'center' }}>Nothing here promises a club will call you.</div>
      <Close cta={cta} foot="Australia first" />
    </>
  );
}

function Coach() {
  const cta: [string, string] = ['Build my coach CV', '/join'];
  return (
    <>
      <Hero seat="coach" kick="For coaches" title="Six years of coaching, on one page." cta={cta}
        text="Clubs, squads, badges, the way you actually want to play." />
      <Section label="One link, two jobs">
        <Feature icon={I.case} tint={T.accent} title="Going for a job" text="Send it to a club instead of a paragraph in WhatsApp. It exports to PDF too, for the clubs that still want one attached." />
        <Feature icon={I.recruit} tint={T.accent} title="Building a squad" text="Copy the link into the group chat, the club newsletter, wherever you already talk to families. A parent deciding where to send their kid can read who you are before they meet you." />
        <div style={{ ...body, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <Glyph d={I.lock} color={T.muted} size={15} />
          <span>You copy your link and share it yourself. Pitch never sends it for you, and never gives you a player&rsquo;s or family&rsquo;s contact details.</span>
        </div>
      </Section>
      <Section label="Verified means something">
        <Feature icon={I.shield} tint={T.accent} title="Your check, confirmed by your club" text="Your club confirms you hold a current check, and that is all anyone sees. The number itself is never shown or stored." />
      </Section>
      <Soon items={[
        'Every season you coach becomes proof when you go for the next job',
        'A whole squad tracked in fifteen minutes',
        'The game-time question answered before a parent asks it',
        'You see your own record before your club does',
        'One place for your squad, instead of three group chats',
      ]} />
      <Close cta={cta} foot="Australia first" />
    </>
  );
}

function Club() {
  const cta: [string, string] = ['Claim your club page', '/join'];
  return (
    <>
      <Hero seat="club" kick="For clubs & technical directors" title={<>Put your trials where families can find them.</>} cta={cta}
        text="Claim your club’s page, put your trial dates on it, and give families one place to check that isn’t a Facebook post they had to be following you to see." />
      <Section label="What a claimed page carries">
        <Feature icon={I.calendar} tint={T.amber} title="Trial notices" text="Age group, date, ground, and the positions you're actually short of. Listings expire on their own, so nobody turns up to a trial that happened last month." />
        <Feature icon={I.squad} tint={T.amber} title="Every squad you run" text="MiniRoos through to seniors, each team a row of its own. Add one, retire one, in a tap." />
        <Feature icon={I.pathway} tint={T.amber} title="Who you've produced" text="The pathway wall — where your juniors went on to." />
      </Section>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={kicker(T.muted)}>Who reads a child&rsquo;s record</h2>
        <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }}>
          You, and the verified coaches on that player&rsquo;s squad. <span style={{ color: T.muted }}>Not your administrators, not an unverified coach, not a rival club, and not us.</span>
        </div>
      </div>
      <Rule />
      <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--hero)', border: `1px solid ${T.line}`, borderRadius: 20, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: T.amber }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ fontSize: 21, fontWeight: 900, color: T.ink, lineHeight: 1.15, letterSpacing: '-0.015em' }}>The Interest Register</h2>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }}>Every player who wants to be at your club, in one list, all year — not forty emails and a form you built yourself in the fortnight before a trial.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {['Players register their interest inside Pitch. Nothing for you to build.',
            'Filter by position, age and squad. The gap in your squad, in one tap.',
            'The players you can’t take this year are still there next year.'].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}><Tick /><div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div></div>
          ))}
        </div>
      </div>
      <Rule />
      <Soon items={[
        'Never lose a player because nobody knew he was available',
        'Know what every squad is working on without asking four coaches',
        'Show a parent what their fees bought, in numbers',
        'Keep a player’s whole history when he moves up an age group',
        'Recruit the coach you want, with a record you can actually read',
      ]} />
      <Close cta={cta} foot="Australia first" />
    </>
  );
}

// ---- the chooser (Home.dc.html) ---------------------------------------------

const DOORS: [FrontDoorSeat, string, string, Icon, string][] = [
  ['player', 'A player', 'Your complete player passport', I.runner, T.accent],
  ['parent', 'A parent', 'Set up and control your child’s profile', I.family, T.purple],
  ['coach', 'A coach', 'Six years of coaching on one page', I.clipboard, T.secondary],
  ['club', 'A club', 'Create your digital home ground', I.flag, T.amber],
];

function Chooser() {
  return (
    <>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'var(--hero)', padding: '26px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div aria-hidden style={{ position: 'absolute', right: -18, top: -34, fontSize: 165, fontWeight: 900, color: 'rgba(61,220,132,.07)', lineHeight: 1, letterSpacing: '-0.04em' }}>10</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em', color: T.ink, position: 'relative' }}>Somebody should be writing this down.</h1>
        <div style={{ fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6, position: 'relative' }}>Seasons end. Coaches move. Clubs change. The record should be the thing that stays.</div>
      </div>
      <nav aria-label="Who are you?" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <h2 style={sectionLabel}>Who are you?</h2>
        {DOORS.map(([seat, title, sub, icon, tint]) => (
          // A plain link, not <Link>: a prefetch skips proxy.ts, so it would
          // fetch `/` as the coming-soon page and navigate to that.
          <a key={seat} href={`/?for=${seat}`} className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none' }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Glyph d={icon} color={tint} size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{title}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.4 }}>{sub}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M9 6 l6 6 l-6 6" /></svg>
          </a>
        ))}
      </nav>
      <Link href="/trials" className="btn btn-secondary">Browse trials without an account</Link>
      <Rule />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Tick />
        <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>Under 16, nothing exists until a parent approves it.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: T.muted, fontWeight: 700, minHeight: 44 }}>
        Already have an account?<Link href="/signin" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Sign in</Link>
      </div>
    </>
  );
}

export default function FrontDoor({ seat }: { seat: FrontDoorSeat | null }) {
  // DeskLandingClub: from 1024px a club reads the page under a top bar with
  // the accent edge and a way to sign in. The phone column is the same column.
  const desk = seat === 'club';
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', flexDirection: 'column' }}>
      {desk && (
        <div className="fd-desk" style={{ flexDirection: 'column' }}>
          <div style={{ height: 4, background: T.amber }} />
          <div style={{ height: 62, borderBottom: `1px solid ${T.line}`, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 28px', gap: 24 }}>
            <Link href="/signin" style={{ fontSize: 13, fontWeight: 700, color: T.secondary, textDecoration: 'none', minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Sign in</Link>
          </div>
        </div>
      )}
      <style>{`.fd-desk { display: none; } @media (min-width: 1024px) { .fd-desk { display: flex; } }`}</style>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22, padding: '22px 18px 34px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={seat ? { href: '/' } : undefined} />
        {seat === 'parent' ? <Parent /> : seat === 'player' ? <Player /> : seat === 'coach' ? <Coach /> : seat === 'club' ? <Club /> : <Chooser />}
      </div>
    </div>
  );
}
