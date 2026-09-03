// All copy and data for the coming-soon page, lifted verbatim from the signed
// design (site/Pitch Website - Coming Soon v2.dc.html). Do not edit copy here
// without a design decision — the design file is the source of truth.

export type Persona = 'player' | 'coach' | 'club' | 'parent';

export const ACC: Record<Persona, string> = { player: '#3ddc84', coach: '#d95926', club: '#eda100', parent: '#a479e2' };
export const GLOW: Record<Persona, string> = { player: 'rgba(61,220,132,.22)', coach: 'rgba(217,89,38,.22)', club: 'rgba(237,161,0,.2)', parent: 'rgba(164,121,226,.22)' };
export const DOT: Record<Persona, [number, number]> = { player: [100, 62], coach: [40, 55], club: [173, 55], parent: [100, 9] };
export const ORDER: Persona[] = ['player', 'coach', 'club', 'parent'];
export const SEATS: [Persona, string][] = [['player', 'On the pitch'], ['coach', 'The sideline'], ['club', 'The stands'], ['parent', 'Behind the fence']];

export const FORMS: Record<string, [number, number][]> = {
  '4-3-3': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [30, 52], [50, 56], [70, 52], [18, 26], [50, 20], [82, 26]],
  '4-2-3-1': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [38, 58], [62, 58], [20, 38], [50, 40], [80, 38], [50, 18]],
  '3-5-2': [[50, 92], [25, 74], [50, 78], [75, 74], [10, 52], [32, 56], [50, 58], [68, 56], [90, 52], [38, 24], [62, 24]],
  '4-4-2': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [15, 50], [38, 54], [62, 54], [85, 50], [38, 24], [62, 24]],
};

export interface Group {
  name: string; x: number; y: number; tag: string; bib: string;
  lines: [string, number][]; note: string;
}
export const GROUPS: Group[] = [
  { name: 'U15 Boys', x: 22, y: 34, tag: 'Trial notice live', bib: '#eda100', lines: [['GK', 2], ['DEF', 6], ['MID', 5], ['FWD', 3]], note: 'Sixteen on the register for this squad. Four arrived this week as live pages, not attachments.' },
  { name: 'U13 Girls', x: 62, y: 22, tag: 'Squad page', bib: '#3ddc84', lines: [['GK', 1], ['DEF', 4], ['MID', 4], ['FWD', 2]], note: 'Eleven on the register. The coach reads the record; the registrar sees names and squads only.' },
  { name: 'Seniors', x: 48, y: 62, tag: 'Open register', bib: '#e34948', lines: [['GK', 3], ['DEF', 8], ['MID', 9], ['FWD', 5]], note: 'Twenty-five. Adults send their own page; nothing here needed a parent.' },
];

export const POS: Record<string, [number, number]> = { GK: [8, 50], CB: [28, 50], LB: [26, 18], RB: [26, 82], DM: [38, 50], CM: [52, 50], CAM: [66, 50], LW: [72, 18], RW: [72, 82], ST: [88, 50] };

export const FILM_SRC = ['/assets/hl-1.webp', '/assets/hl-2.webp', '/assets/hl-3.webp', '/assets/hl-4.webp', '/assets/hl-5.webp'];

// [persona, time, filmIndex, title, body]
export const HI: [Persona, string, number, string, string][] = [
  ['player', '62:10', 0, 'Your football, finally on the record.', 'Every club, every season, every position you’ve been moved to. Build it once and it follows you for the rest of your career.'],
  ['player', '62:11', 1, 'Get seen by the right club.', 'Send your page in one tap and the club opens it live. Down the track, clubs come looking for you — not the other way round.'],
  ['coach', '62:12', 3, 'Prove what you’ve built.', 'Squads, seasons, licences and the players you developed — one record that gets you the next job. Then your word on a player’s page, carried with them.'],
  ['club', '62:12', 2, 'Fill squads with players who want in.', 'The Interest Register keeps the players who want to be at your club, by squad. Then the whole pathway, U8s to seniors, in one view.'],
  ['parent', '62:14', 4, 'You hold every key.', 'Nothing about your child reaches a club until you’ve read it and slid to send. They get a record to grow into — with no feed to disappear into.'],
];

// [name, badge, price, per, desc, items, highlighted]
export type Tier = [string, string, string, string, string, string[], boolean];
export const PRICE: Record<Persona, [string, string, Tier[]]> = {
  player: ['Players · 18 and over', 'Your page is free for good. Pro is where your development becomes a trail clubs follow.', [
    ['Player · Free', 'Free for good', '$0', 'for good', 'Your whole history, three clips, one-tap sends to any club, PDF export.', ['Never rebuild your football history for a new club again', 'Get in front of the right club in one tap', 'Decide who sees your page and for how long'], true],
    ['Player Pro', 'Coming soon', '—', 'adults only', 'Where your record becomes a development trail — and clubs start coming to you.', ['Show a whole season, not three moments', 'Know when a club opened your page', 'Clubs asking for your page, not the other way round', 'Your development, season on season, answered properly'], false]]],
  coach: ['Coaches', 'Your record is free for good. Coach Pro puts your name on the players you developed.', [
    ['Coach · Free', 'Free for good', '$0', 'for good', 'Squads, seasons, licences, the players who came through. One page, sent like a player’s.', ['Ten seasons on the touchline, finally working for you', 'Walk into the next club with proof, not memory', 'Licences on the record — no chasing paperwork'], true],
    ['Coach Pro', 'Coming soon', '—', 'not yet settled', 'Where your coaching leaves a trail, not just a memory.', ['Your word on a player’s record, carried club to club', 'Squad development across a season, in your name', 'Be found by clubs looking for a coach', 'Turn a season of sessions into something you can show'], false]]],
  club: ['Clubs', 'Your club page is free. The Interest Register fills squads. Club Pro shows the whole pathway.', [
    ['Club · Free', 'Free for good', '$0', 'every club', 'Club page, squads, trial notices, CVs arriving as live pages, WWCC checks shown, PDF export.', ['Stop losing player CVs in a shared inbox', 'Trial notices that reach the players who want in', 'TD and registrar each see what they need'], false],
    // Prices are the GST-inclusive totals (D-109); the "incl. GST" label was
    // removed from display copy by BUZ, 3 Sep. Doc 22 A6.1 still states the
    // GST treatment in the contract.
    ['Interest Register', 'The paid tier', '$54', 'a month, cancel anytime', 'Or $329 for twelve months. Same for every club. The players who want to be at yours, kept by squad.', ['Fill a squad from players who already want to be here', 'Know how deep each age group is before trials', 'Next season’s register builds itself — no spreadsheet', 'Cancel anytime'], true],
    ['Club Pro', 'Coming soon', '—', 'not yet settled', 'Development across every squad, for clubs that want to see the trail. Founding clubs shape it first.', ['The whole pathway, U8s to seniors, in one view', 'Squad development over a season, coach by coach', 'Keep players and coaches together across seasons', 'Fewer volunteer hours on admin, more on football'], false]]],
  parent: ['Parents and guardians', 'Your child’s page is free, always. You hold the keys until it’s theirs.', [
    ['Under 18 · Free', 'Always free', '$0', 'always', 'The whole page, your keys, every send read by you first. No paid tier exists on a child’s account.', ['Nothing about your child reaches a club without you', 'Every season kept — a record to grow into', 'No feed, no messages, no leaderboard to disappear into'], true],
    ['When they turn 18', 'Their choice, later', '$0', 'still free', 'The page becomes theirs on their eighteenth birthday. Pro is theirs to consider, not yours to pay for.', ['They start adult football with a record, not a blank page', 'Your keys hand over cleanly', 'Pro is their decision — never a bill to you'], false]]],
};

// [kicker, title, body, poster]
export const STORY: [string, string, string, string][] = [
  ['Tuesday · training', 'Today: the raw material is kept.', 'Positions, clubs, seasons, the numbers you choose to show, three clips. That’s the page, and it’s free.', '/assets/story-1.webp'],
  ['Saturday · match day', 'Next: what Pro is.', 'We’re deciding what’s in it with the first coaches and clubs, not before them. Until it’s settled, the honest word is coming soon.', '/assets/story-2.webp'],
  ['The sideline · the clipboard', 'Always: under 18 stays free.', 'No paid tier exists on a child’s page. Pro, whatever it becomes, is an adult’s decision about their own record.', '/assets/story-3.webp'],
];

export const ROADMAP: [string, string, string, string, Persona][] = [
  ['Players 18+', 'Player Pro', 'Coming soon', 'Adults only. What’s in it is being decided with the people who’ll use it.', 'player'],
  ['Coaches', 'Coach Pro', 'Coming soon', 'Shaped with the first coaches on the record, not before.', 'coach'],
  ['Clubs', 'Club Pro', 'Coming soon', 'Founding clubs get the first say in what it is.', 'club'],
  ['Under 18', 'Always free', 'Settled', 'No Pro, no paid anything, on a child’s page. Ever.', 'parent'],
];

// per persona: [kicker, sub, tabs[key, title, desc]]
export const LOOKS: Record<Persona, [string, string, [string, string, string][]]> = {
  player: ['Your page', 'Built once, carried for good. What each part does for you.', [
    ['head', 'Who you are', 'Name, age, position, city, your number. Clubs know exactly who they’re looking at.'],
    ['pos', 'Where you play', 'Up to three positions, tapped on a pitch rather than picked from a list.'],
    ['clubs', 'Every club, every season', 'Your whole history in one place, so you never rebuild it for a new club. Coaches add their word as you go.'],
    ['nums', 'The numbers you choose', 'Appearances, goals, assists, clean sheets — show what makes your case. Season on season, they become your development trail.'],
    ['clips', 'Clips that make the case', 'YouTube, Instagram or Veo. Three on the free page; your whole season on Pro.'],
    ['link', 'The link', 'Send it in one tap; the club opens it live. Choose who can open it and for how long.']]],
  coach: ['Your record', 'Eleven seasons on a touchline, working for you for the first time.', [
    ['chead', 'Who you are', 'Name, role, how long you’ve been at it. The first thing a club sees when it’s hiring.'],
    ['clic', 'Licences, shown', 'Your coaching licences on the record. Clubs see what you’re qualified for without asking.'],
    ['csquads', 'Every squad, every season', 'Which clubs, which age groups, which years. Walk into the next interview with proof, not memory.'],
    ['cplayers', 'The players who came through', 'How many you’ve coached and where they went. Proof you develop players — the thing clubs actually hire for.'],
    ['cword', 'Your word on a player', 'A line on a player’s page, from you. It follows them club to club, and it carries your name.'],
    ['clink', 'The link', 'Send it to a club in one tap. Down the track, clubs looking for a coach find you.']]],
  club: ['Your club', 'Fill squads, see the pathway, spend volunteer hours on football.', [
    ['khead', 'Your club', 'Crest, founded, squads. The place players send their page to — and a founding mark if you were one of the eleven.'],
    ['ksquads', 'Squads and trial notices', 'Every age group on one page. Put a trial notice on the squad that needs players and the right ones find it.'],
    ['kreg', 'The Interest Register', 'Players who want to be at your club, kept by squad and by line. Know how deep U15s are before trial night, and start next season already ahead.'],
    ['kcvs', 'CVs arrive as live pages', 'No attachments lost in an inbox. Open the player’s page as it is today, with a coach’s word already on it.'],
    ['keyes', 'The pathway', 'TD reads the football, registrar runs the squads. Then Club Pro: U8s to seniors, every coach and season, in one view.']]],
  parent: ['Your keys', 'Your child gets a record to grow into. You hold every key until it’s theirs.', [
    ['phead', 'You, the guardian', 'Your account, with your child’s page underneath it. You hold every key until they turn 18.'],
    ['pchild', 'Their page', 'Positions, clubs, numbers, clips — every season kept, so at 18 they start with a record, not a blank page.'],
    ['preq', 'A request to send', 'They ask. You read it and slide to send. A mis-tap can’t do it.'],
    ['pkeys', 'The keys', 'Who can open the page, whether sends are locked, and a hold-to-pause that stops everything.'],
    ['pfeed', 'What isn’t there', 'No feed, no messages, no leaderboard. Nothing for a 14-year-old to disappear into.']]],
};

export const LOOK_KEYS = Object.values(LOOKS).flatMap((l) => l[2].map((t) => t[0]));
