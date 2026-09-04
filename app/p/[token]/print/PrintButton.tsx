'use client';
export default function PrintButton() {
  return (
    <div className="no-print" style={{ maxWidth: 760, margin: '0 auto 18px auto', display: 'flex', justifyContent: 'flex-end' }}>
      <button onClick={() => window.print()} style={{ background: '#0b120e', color: '#eef5f0', border: 'none', borderRadius: 10, height: 40, padding: '0 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
        Save as PDF
      </button>
    </div>
  );
}
