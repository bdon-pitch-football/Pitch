'use client';
// The charter primary (spec C): it was a hand-built dark button, a third
// button style. Never drawn as a paid feature (D-121).
export default function PrintButton() {
  return (
    <div className="no-print sheet-bar">
      <button type="button" onClick={() => window.print()} className="btn btn-primary btn-auto">
        Save as PDF
      </button>
    </div>
  );
}
