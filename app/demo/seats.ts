// The seats a club demo walks through, in the order the story goes. Every
// one is a fictional dev-seed person (scripts/dev-db.mts).
export const SEATS = [
  { key: 'td', email: 'td@example.com', who: 'Technical Director', name: 'Marina Petrovic',
    what: 'Works the Interest Register: every player who has registered interest, sorted by team.' },
  { key: 'admin', email: 'admin@example.com', who: 'Club administrator', name: 'Pat Nguyen',
    what: 'Runs the club page, teams and trials. Sees no child’s details.' },
  { key: 'coach', email: 'coach@example.com', who: 'Coach', name: 'Sam Kaya',
    what: 'Their coaching page, and the registrations for the two teams the TD gave them.' },
  // The club we have not rung yet (D-126). Without a seat at an unverified
  // club, the held register — a count and not one name, whatever the club
  // pays — could not be shown at all, and it is the answer to the hardest
  // question a technical director asks.
  { key: 'held', email: 'sunbury@example.com', who: 'A club we haven’t rung yet', name: 'M. Harris',
    what: 'Claimed their page, hasn’t been verified. Families are registering and the club sees a count and no names.' },
  { key: 'parent', email: 'guardian@example.com', who: 'Parent', name: 'Alex',
    what: 'Parent of Deniz (14), Georgia (15) and Nate (17). Approves, sends and switches off.' },
  { key: 'teen', email: 'nate@example.com', who: 'Player, 17', name: 'Nate',
    what: 'A 17-year-old keeper. Sends their own CV; their parent is told every time.' },
  { key: 'adult', email: 'player@example.com', who: 'Player, adult', name: 'Jordan',
    what: 'An adult player, on their own.' },
] as const;
