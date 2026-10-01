'use client';
// "Save as PDF", shared by the player's and the coach's print (D-121). The
// charter's primary at its own width (spec C, adopted by E): it was a
// one-off 44px/radius-10 dark button. Hidden in print.
export default function PrintButton() {
  return (
    <div className="no-print print-bar">
      <button type="button" onClick={() => window.print()} className="btn btn-primary btn-auto">
        Save as PDF
      </button>
    </div>
  );
}
