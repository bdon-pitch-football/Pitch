// Doc 14 rows that wait on BUZ, because doc 14 and the register disagree and
// the builder may not choose between them (brief L, 29 Sep).
//
// Each row has BOTH versions of its check written, in the suites that test
// it. This file is the switch: the suites run the version it names, and
// gate-coverage counts the row as open while it says 'pending'. A ruling is
// one line here — nothing else has to change for the gate to read it. If BUZ
// rules for the version the product does not do yet, that version's checks
// go red until the product is changed to match, which is the point.
//
//   M7  `club_unverified` posts a trial notice.
//       'doc 14' — permitted: the notice is public and carries no minor's
//                  data (doc 14 M7 as written).
//       'D-90'   — refused: the board's sources are a VERIFIED club posting
//                  its own and Pitch compiling the rest (D-90), which is what
//                  /club/post-trial has always done.
//
//   M8  `club_unverified` adds a coach or an administrator.
//       'doc 14' — permitted: club-internal, no minor involved (doc 14 M8 as
//                  written). No door for it exists today.
//       'D-154'  — refused: only the club's Technical Director brings a coach
//                  in (D-154's restrictive reading), a TD is confirmed at
//                  verification and never before (D-93), and no screen adds
//                  an administrator at any club — so a club that has not been
//                  verified adds nobody. Which is what the product does.
export const RULINGS = {
  M7: 'pending',
  M8: 'pending',
};
