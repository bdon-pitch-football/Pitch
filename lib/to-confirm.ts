// Words BUZ approved in substance but whose exact wording is still ⟨to confirm⟩
// (Head of Product Design, 1 Oct: walkthrough B1/B2). Each sits here alone so
// the confirmed words drop in with a one-line change, and a test can tell
// whether any draft is still in place before a release.

/** B1: /build/[id]/preview for an under-16 with no approved version yet. */
export const PREVIEW_EMPTY_TITLE = 'Nothing to preview yet';

/** B2: shown when someone claims with the club's own shared (published) address. */
export const SHARED_ADDRESS_WARNING =
  'This is the club’s shared address. It can run the page, but your Technical Director signs up with their own email address to read the register.';

/** Every draft above, for the release check. Remove an entry once BUZ confirms it. */
export const STILL_TO_CONFIRM = ['PREVIEW_EMPTY_TITLE', 'SHARED_ADDRESS_WARNING'] as const;
