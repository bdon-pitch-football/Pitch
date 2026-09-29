// A club's state as the verification queue's chip (OpsVerification.dc.html):
// the same pill, the same colours and, for the three states the queue shows,
// the same words. "Unclaimed" is the fourth, and is new (held, brief I).
import { T } from '@/lib/palette';

export function StateChip({ state }: { state: string }) {
  const [word, colour] =
    state === 'verified' ? ['Verified', T.accent]
      : state === 'suspended' ? ['Suspended', T.red]
      : state === 'claimed' ? ['Awaiting call', T.amber]
      : ['Unclaimed', T.muted];
  return (
    <span data-club-state={state} style={{ display: 'inline-flex', alignItems: 'center', background: T.surface2, borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: colour }}>
      {word}
    </span>
  );
}
