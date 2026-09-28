// The 404 — every notFound() in the product, and every URL that matches no
// route at all, land here (Next: the root not-found file handles both). See
// components/FailureState.tsx for why it exists and what it must never do.
//
// Next hands this file no props, which is the point: there is nothing here to
// branch on, so a dead club slug, an expired job id and a registrant whose
// guardian has just paused them are one page, one body, one status.
import FailureState, { FAILURE_COPY, NOT_FOUND_GLYPH } from '@/components/FailureState';

const c = FAILURE_COPY.notFound;

export const metadata = { title: c.title };

export default function NotFound() {
  return (
    <>
      <FailureState kind="not-found" glyph={NOT_FOUND_GLYPH} heading={c.heading} reason={c.reason} why={c.why}>
        <a href="/" className="btn btn-primary">{c.action}</a>
      </FailureState>
    </>
  );
}
