'use client';
// The 500 — an uncaught render error anywhere below the root layout. With no
// error.tsx the product served Next's stock unstyled page, and nobody had
// decided what it says.
//
// It renders NOTHING about the error. Not the message, not the digest, not a
// stack: D-94 §1 forbids a secret, a token or a personal datum in any error
// message or trace, and the error object handed to a client boundary carries
// the original message in development. The way a person tells us is the
// report route in the footer, which every page already carries.
//
// An error boundary must be a Client Component (Next), so this file cannot
// export metadata — the tab kept the site default, "Pitch Football — every
// season on the record.", on a page that had just fallen over. React's own
// <title> element hoists into the head and fixes that.
import FailureState, { ERROR_GLYPH, FAILURE_COPY } from '@/components/FailureState';

const c = FAILURE_COPY.error;

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <title>{`${c.title} · Pitch Football`}</title>
      <FailureState kind="error" glyph={ERROR_GLYPH} heading={c.heading} reason={c.reason} why={c.why}>
        <button type="button" onClick={() => retry()} className="btn btn-primary">{c.action}</button>
        <a href="/home" className="btn btn-secondary">{c.home}</a>
      </FailureState>
    </>
  );
}
