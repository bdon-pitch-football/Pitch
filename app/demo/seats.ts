// The seats a club demo walks through, in the order the story goes. Every
// one is a fictional dev-seed person (scripts/dev-db.mts).
export const SEATS = [
  { key: 'td', email: 'td@example.com', who: 'Technical Director', name: 'Marina Petrovic',
    what: 'Works the Interest Register: every player who has registered interest, sorted by team.' },
  { key: 'admin', email: 'admin@example.com', who: 'Club administrator', name: 'Pat Nguyen',
    what: 'Runs the club page, teams and trials. Sees no child’s details.' },
  { key: 'coach', email: 'coach@example.com', who: 'Coach', name: 'Sam Kaya',
    what: 'Their coaching page, and the registrations for the two teams the TD gave them.' },
  { key: 'parent', email: 'guardian@example.com', who: 'Parent', name: 'Alex',
    what: 'Parent of Deniz (14), Georgia (15) and Nate (17). Approves, sends and switches off.' },
  { key: 'teen', email: 'nate@example.com', who: 'Player, 17', name: 'Nate',
    what: 'A 17-year-old keeper. Sends their own CV; their parent is told every time.' },
  { key: 'adult', email: 'player@example.com', who: 'Player, adult', name: 'Jordan',
    what: 'An adult player, on their own.' },
] as const;
