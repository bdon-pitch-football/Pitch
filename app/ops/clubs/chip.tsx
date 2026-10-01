// A club's state as A's pill (spec I, I-P1c, BUZ 1 Oct): the same words as
// the verification queue for the three states it shows, and "Unclaimed" the
// fourth, as the neutral pill — not yet a state of ours (D-172). It keeps
// data-club-state, which the suites read.
export function StateChip({ state }: { state: string }) {
  const [word, tone] =
    state === 'verified' ? ['Verified', 'pill pill-live']
      : state === 'suspended' ? ['Suspended', 'pill pill-stop']
      : state === 'claimed' ? ['Awaiting call', 'pill pill-wait']
      : ['Unclaimed', 'pill'];
  return <span data-club-state={state} className={tone}>{word}</span>;
}
