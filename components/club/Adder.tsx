// A create form folded behind one chip (F, 1 Oct): the trials board's
// <details> disclosure. The form's own heading becomes the chip, so the
// heading is said once. A plain <details>: it opens and closes with
// JavaScript off, and the page decides whether it starts open (it does when
// the list it adds to is empty).
export function AdderSummary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
      {children}
    </summary>
  );
}
