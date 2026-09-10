// The design gallery. Every primitive, in every state, on one page.
//
// It exists so we iterate on the SYSTEM rather than on twenty screens: fix a
// control here and every screen that uses it moves. It also makes drift
// visible — a fourth button variant should be caught on this page, not in
// production.
//
// Development only. It is not a user-facing surface and it never ships.
import { notFound } from 'next/navigation';
import { HeaderMark } from '@/components/Wordmark';

export const metadata = { robots: { index: false, follow: false } };

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 26, borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 'var(--ls-title)', color: 'var(--ink)' }}>{title}</div>
        {note && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55, maxWidth: 560 }}>{note}</div>}
      </div>
      {children}
    </section>
  );
}

export default function DesignGallery() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '22px 18px 80px', display: 'flex', flexDirection: 'column', gap: 30 }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 'var(--ls-title)' }}>Night Match</div>
          <div style={{ fontSize: 14, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
            Every primitive in the product, in every state. Change something here and every screen follows.
            Anything that appears on a screen and not on this page is drift.
          </div>
        </div>

        <Row title="Surfaces" note="Three levels, and each one means something. Raised is where you act. Sunken is what you read. The page is neither.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            <div className="card"><div className="kicker">Raised · surface</div><div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500, marginTop: 6 }}>Act here. Forms, rows with buttons.</div></div>
            <div className="card-sunken"><div className="kicker">Sunken · new</div><div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500, marginTop: 6 }}>Read this. Explanations, quotes, notes.</div></div>
            <div className="card card-accent"><div className="kicker" style={{ color: 'var(--accent)' }}>Confirmed</div><div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500, marginTop: 6 }}>Something worked.</div></div>
            <div className="card card-amber"><div className="kicker" style={{ color: 'var(--amber)' }}>Attention</div><div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500, marginTop: 6 }}>Held, waiting, needs you.</div></div>
          </div>
        </Row>

        <Row title="Display numerals" note="The charter gives numerals their own letter-spacing and the product renders almost every number as body text. A register of ninety-nine players should say ninety-nine like it means it.">
          <div className="card" style={{ display: 'flex', alignItems: 'baseline', gap: 28, flexWrap: 'wrap' }}>
            <div><div className="numeral numeral-l" style={{ color: 'var(--ink)' }}>99</div><div className="kicker" style={{ marginTop: 6 }}>Players</div></div>
            <div><div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>81</div><div className="kicker" style={{ marginTop: 6 }}>New</div></div>
            <div><div className="numeral numeral-m" style={{ color: 'var(--amber)' }}>12</div><div className="kicker" style={{ marginTop: 6 }}>Shortlisted</div></div>
            <div><div className="numeral numeral-s" style={{ color: 'var(--secondary)' }}>18</div><div className="kicker" style={{ marginTop: 6 }}>Apps</div></div>
          </div>
        </Row>

        <Row title="Buttons" note="Two from the charter, plus a ghost. The ghost is a stretch: 'Not now', 'Cancel' and 'Back' are currently bare links with no hit area, and a 44px target is an accessibility requirement rather than a style choice.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 420 }}>
            <button className="btn btn-primary">Primary — 50px</button>
            <button className="btn btn-secondary">Secondary — 46px</button>
            <button className="btn btn-ghost">Ghost — 44px, was a bare link</button>
            <button className="btn btn-primary" disabled>Disabled</button>
          </div>
        </Row>

        <Row title="Fields" note="The native select and file input were rendering as OS controls inside hand-made cards. On the crest uploader that meant a grey 'Choose file / No file chosen' button, which reads as a bug.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
            <label className="field"><span className="field-label">Text</span><input placeholder="you@example.com" /></label>
            <div className="field"><span className="field-label">Select — ours, not the browser&rsquo;s</span>
              <select defaultValue="U14"><option>U13</option><option>U14</option><option>U15</option></select>
            </div>
            <label className="field"><span className="field-label">Long text</span><textarea rows={3} placeholder="Why this club, and what you&rsquo;d bring." /></label>
            <label className="filefield">
              <input type="file" accept="image/*" />
              <span className="filefield-title">Choose an image</span>
              <span className="filefield-hint">PNG or JPEG, under 8MB. We re-save it and strip any location data.</span>
            </label>
          </div>
        </Row>

        <Row title="Chips" note="Filters toggle and carry their count. Status chips never toggle — they are a fact about a row, not a control.">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <span className="chip" aria-pressed="true">All ages <span className="chip-count">99</span></span>
              <span className="chip">U13 <span className="chip-count">16</span></span>
              <span className="chip">U14 <span className="chip-count">11</span></span>
              <span className="chip">Seniors <span className="chip-count">12</span></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <span className="tag" style={{ background: 'rgba(61,220,132,.14)', color: 'var(--accent)' }}>New</span>
              <span className="tag" style={{ background: 'rgba(237,161,0,.14)', color: 'var(--amber)' }}>Shortlisted</span>
              <span className="tag" style={{ background: 'rgba(57,135,229,.16)', color: '#3987e5' }}>Invited</span>
              <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Volunteer</span>
            </div>
          </div>
        </Row>

        <Row title="Empty states" note="Three of these rendered as a heading over nothing during the walkthrough. An empty section should say what will appear there, or not appear at all.">
          <div className="card-sunken" style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55, maxWidth: 560 }}>
            Nothing yet beyond your approval. Anything you do here — renewing his link, pausing his page, replying to a club — is written down and shows up in this list.
          </div>
        </Row>

        <Row title="Reading width" note="D-147: reading surfaces cap at 640px from 1024px up. They were capped at 560, which is the tablet rule applied to desktop — the design system forking by omission.">
          <div className="reading card" style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
            This column is 560px, then 640px at 1024px and above.
          </div>
        </Row>
      </div>
    </div>
  );
}
