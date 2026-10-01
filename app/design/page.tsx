// The design gallery — Floodlit (spec A part 24). Every shell part from
// docs/design/specs/A-shells-and-homes.md, by its bold name and in the
// spec's order, each at 390 and at 1024+ side by side.
//
// It exists so we iterate on the SYSTEM rather than on seventy-four screens:
// fix a part here and every screen that uses it moves. It also makes drift
// visible — a fourth button, a literal shadow, a green "you are here" should
// be caught on this page, not in production.
//
// The two columns are containers, as in the mockup (floodlit-shells.html):
// the product's own rules answer to the window, so the few parts that change
// with width get a container-query twin below, scoped to .gal, saying what
// that part does in a 390 or a 1024+ column. The values are the stylesheet's;
// only the condition differs.
//
// Development only. It is not a user-facing surface, it never ships, and its
// words are labels for us, not copy.
import { notFound } from 'next/navigation';
import Wordmark, { HeaderMark } from '@/components/Wordmark';
import SiteNav from '@/components/floodlit/SiteNav';
import { ICONS, type IconKey } from '@/components/console-shell';

export const metadata = { title: 'Floodlit parts', robots: { index: false, follow: false } };

const GALLERY_CSS = `
.gal-pair { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.gal-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.gal-col.n { width: 390px; flex: none; max-width: 100%; }
.gal-col.w { flex: 1; min-width: 300px; }
.gal-lab { font-size: 10px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--muted); }
.gal-scr { container-type: inline-size; position: relative; border: 1px solid var(--line); border-radius: var(--r-hero); overflow: hidden; }
.gal-pad { display: flex; flex-direction: column; gap: 14px; padding: 22px 18px; }
.gal .seat-tabs, .gal .seat-sheet { position: static; }
.gal .seat-sheet { margin: 0 10px 10px; }
.gal-frame { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 420px; }
.gal-frame .console-nav { display: flex; flex-direction: column; gap: 2px; padding: 18px 14px 22px 18px; background: var(--glass); border-right: 1px solid var(--glass-line); }
.gal-frame .pg-head-mark { display: none; }
.gal-frame .pg-head:not(:has(.pg-back)) { display: none; }
@container (max-width: 1023px) {
  .gal .hero-panel { padding: 18px 16px; }
  .gal .home-grid { grid-template-columns: minmax(0, 1fr); }
  .gal .fl-nav-brand { order: 2; }
  .gal .fl-nav-left { order: 1; }
}
@container (min-width: 1024px) {
  .gal .hero-panel { padding: 24px 24px 22px; }
  .gal .home-grid { grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; }
  .gal .fl-nav-brand { order: 1; }
}
@container (max-width: 639px) {
  .gal .door { margin-top: 0; padding: 0; background: none; border: 0; box-shadow: none; max-width: 560px; }
  .gal .door .field { background: var(--surface-2); }
  .gal .door .card { background: var(--fl-surface); box-shadow: var(--shadow-card); }
  .gal .door .card-sunken { background: var(--surface-sunken); }
}
@container (min-width: 640px) {
  .gal .door { margin-top: 0; padding: 28px 28px 30px; background: var(--fl-surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow-float); }
}
@container (max-width: 767px) {
  .gal .ops-head { display: none; }
  .gal .ops-row { grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "club club club" "when when when" "held status action"; gap: 8px 12px; }
  .gal .ops-held-word { display: inline; }
}
@container (min-width: 768px) {
  .gal .ops-head, .gal .ops-row { grid-template-columns: minmax(0, 1fr) 118px 52px 124px 142px; grid-template-areas: "club when held status action"; gap: 14px; }
  .gal .ops-head { display: grid; padding: 13px 14px 9px 14px; }
  .gal .ops-held-word { display: none; }
}
`;

const Glyph = ({ k, on = false, size = 18 }: { k: IconKey; on?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--ink)' : 'var(--muted)'}
    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
);
const Chev = () => (
  <span className="row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg></span>
);

type Mode = 'n' | 'w';
function Part({ n, name, note, flush, children }: {
  n: number; name: string; note: string; flush?: boolean; children: (m: Mode) => React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 26, borderTop: '1px solid var(--line)' }}>
      <div className="pg-titles">
        <h2 className="sec-h" style={{ fontSize: 12 }}>{n} · {name}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55, maxWidth: 720 }}>{note}</div>
      </div>
      <div className="gal-pair">
        {(['n', 'w'] as const).map((m) => (
          <div key={m} className={`gal-col ${m}`}>
            <div className="gal-lab">{m === 'n' ? '390' : '1024 and up'}</div>
            <div className="gal-scr floodlight">{flush ? children(m) : <div className="gal-pad">{children(m)}</div>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const RAIL: { k: IconKey; label: string; on?: boolean; count?: number }[] = [
  { k: 'home', label: 'Home' }, { k: 'register', label: 'Register', count: 4 },
  { k: 'children', label: 'Squads', on: true }, { k: 'crest', label: 'Crest & club page' },
];

function Rail({ club = true }: { club?: boolean }) {
  return (
    <nav className="console-nav" aria-label="Example rail">
      <div className="rail-mark"><Wordmark size={20} /></div>
      <div className="seat-card">
        <div className="seat-card-id">
          {club
            ? <div aria-hidden style={{ width: 40, height: 40, borderRadius: 'var(--r-well)', background: 'rgba(255,255,255,.08)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>R</div>
            : <div aria-hidden style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--secondary)', flexShrink: 0 }}>J</div>}
          <div style={{ minWidth: 0 }}>
            <div className="seat-card-name">{club ? 'Example club' : 'Example player'}</div>
            <div className="seat-card-role">{club ? 'Technical Director' : 'Example club'}</div>
          </div>
        </div>
        {club && <span className="pill pill-live">Verified</span>}
      </div>
      {RAIL.map((d) => (
        <a key={d.label} href="#rail" className="console-nav-link" aria-current={d.on ? 'page' : undefined}>
          <Glyph k={d.k} on={d.on} />{d.label}
          {d.count ? <span className="console-nav-count">{d.count}</span> : null}
        </a>
      ))}
      <a href="#rail" className="console-nav-link" style={{ marginTop: 'auto' }}>Sign out</a>
    </nav>
  );
}

function Bar({ sheet = false }: { sheet?: boolean }) {
  return (
    <>
      {sheet && (
        <div className="seat-sheet">
          <a href="#bar" className="seat-sheet-link" aria-current="page"><Glyph k="send" on size={19} /><span>Current door in the sheet</span></a>
          <a href="#bar" className="seat-sheet-link"><span>Sign out</span></a>
        </div>
      )}
      <nav className="seat-tabs" aria-label="Example bar">
        <a href="#bar" className="seat-tab" aria-current={sheet ? undefined : 'page'}><span className="seat-tab-ic"><Glyph k="home" on={!sheet} size={21} /></span><span>Home</span></a>
        <a href="#bar" className="seat-tab"><span className="seat-tab-ic"><Glyph k="cv" size={21} /></span><span>My CV</span></a>
        <a href="#bar" className="seat-tab"><span className="seat-tab-ic"><Glyph k="trials" size={21} /></span><span>Trials</span></a>
        <span className="seat-tab" data-current={sheet ? 'true' : undefined}><span className="seat-tab-ic"><Glyph k="more" on={sheet} size={21} /></span><span>More</span></span>
      </nav>
    </>
  );
}

export default function DesignGallery() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="floodlight gal" style={{ minHeight: '100dvh', color: 'var(--ink)' }}>
      <style>{GALLERY_CSS}</style>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '22px 18px 80px', display: 'flex', flexDirection: 'column', gap: 30 }}>
        <HeaderMark />
        <div className="pg-titles">
          <h1 className="pg-title">Floodlit — the shell parts</h1>
          <div className="pg-sub" style={{ maxWidth: 760 }}>
            Spec A, parts 1–23, by their names, at 390 and at 1024 and up. Change a part in app/globals.css and every
            screen that uses it follows. Anything on a screen that is not on this page is drift.
          </div>
        </div>

        <Part n={1} name="Frame" flush note="Phone: one column with the seat bar. From 1024px: the 232px rail plus content, max 1200px. Every seat's frame paints the floodlight.">
          {(m) => m === 'n'
            ? <><div className="gal-pad"><HeaderMark back={{ href: '#frame', label: 'Home' }} /><div className="card">The page column.</div></div><Bar /></>
            : <div className="gal-frame"><Rail /><div className="gal-pad"><HeaderMark back={{ href: '#frame', label: 'Home' }} /><div className="card">The page column, beside the rail. The column&rsquo;s mark has gone: the rail carries it.</div></div></div>}
        </Part>

        <Part n={2} name="Seat bar" flush note="Below 1024 only. The nav bar's glass; the current door is ink on a --here pill behind its icon, never green.">
          {(m) => m === 'n' ? <div style={{ paddingTop: 40 }}><Bar /></div> : <div className="gal-pad"><div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)' }}>No seat bar from 1024px: the rail carries the same doors.</div></div>}
        </Part>

        <Part n={3} name="More sheet" flush note="The rest of a seat's doors, plus Sign out, in a <details>. Tokens only: --fl-surface and --shadow-float.">
          {(m) => m === 'n' ? <div style={{ paddingTop: 20 }}><Bar sheet /></div> : <div className="gal-pad"><div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)' }}>No sheet from 1024px: every door is in the rail.</div></div>}
        </Part>

        <Part n={4} name="Rail and console sidebar" flush note="One component. The rail mark (the logo, top left, not a link) above the seat card; the current door on --here with no accent bar; door counts never zero; Sign out at the foot.">
          {(m) => m === 'n'
            ? <div className="gal-pad"><div className="card-sunken" style={{ fontSize: 13, color: 'var(--muted)' }}>No rail below 1024px: the seat bar carries the same doors.</div></div>
            : <div className="gal-frame"><Rail /><div className="gal-pad"><div className="seat-card" style={{ maxWidth: 260 }}><div className="seat-card-id"><div style={{ minWidth: 0 }}><div className="seat-card-name">Unverified club</div><div className="seat-card-role">Club administrator</div></div></div><span className="pill pill-wait pill-wrap">A sentence-long state wraps inside its pill</span></div></div></div>}
        </Part>

        <Part n={5} name="Top bar" flush note="SiteNav, logo only, on every page outside a seat frame. Logo right on a phone, left from 1024px. .has-topbar hides the page's own mark.">
          {() => <div className="has-topbar"><SiteNav links={[]} signIn={false} homeLink={false} /><div className="gal-pad"><HeaderMark back={{ href: '#top', label: 'Back' }} /><div className="card">The page header keeps its way back; its mark has gone.</div></div></div>}
        </Part>

        <Part n={6} name="Page header" note="HeaderMark: the way back on the left (44px of target), the mark on the right. Inside a frame the mark leaves the column from 1024px.">
          {(m) => m === 'n' ? <HeaderMark back={{ href: '#head', label: 'Home' }} /> : <div className="gal-frame" style={{ minHeight: 0, gridTemplateColumns: '1fr' }}><HeaderMark back={{ href: '#head', label: 'Home' }} /></div>}
        </Part>

        <Part n={7} name="Page title" note="The h1 and the line under it that open a reading page.">
          {() => <div className="pg-titles"><h2 className="pg-title">A page title</h2><div className="pg-sub">The one line under it, in secondary, that says what the page is for.</div></div>}
        </Part>

        <Part n={8} name="Section heading and panel heading" note="A section heading sits on the page with a hairline to the edge; a panel heading sits inside a panel with none.">
          {() => <><div className="sec-h">A section heading</div><div className="card"><div className="panel-h">A panel heading</div><div style={{ fontSize: 13.5, color: 'var(--secondary)', marginTop: 8 }}>Inside the panel.</div></div></>}
        </Part>

        <Part n={9} name="Panel" note=".card and lib/ui's card: the Floodlit surface and the card shadow, both tokens. A panel inside a panel steps up one surface and drops the second shadow.">
          {() => <div className="card"><div className="panel-h">Panel</div><div className="card" style={{ marginTop: 10, fontSize: 13 }}>A panel inside a panel: --surface-2, no shadow.</div></div>}
        </Part>

        <Part n={10} name="Well" note=".card-sunken, unchanged: for text you read. Disclosure goes down, so a well never carries a shadow.">
          {() => <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', lineHeight: 1.55 }}>An explanation, a note, the why.</div>}
        </Part>

        <Part n={11} name="Notice" note="A panel with a state edge. Purple is a club's invitation, amber anything else waiting or held, red stopped. Green never marks a waiting state. The lead notice adds .fl-float.">
          {() => <>
            <div className="card card-purple fl-float"><div className="notice-k" style={{ color: 'var(--purple)' }}>Invitation</div><div style={{ fontSize: 13.5, marginTop: 8 }}>The lead notice, lifted.</div></div>
            <div className="card card-amber"><div className="notice-k" style={{ color: 'var(--amber)' }}>Waiting</div></div>
            <div className="card card-red"><div className="notice-k" style={{ color: 'var(--red)' }}>Stopped</div></div>
          </>}
        </Part>

        <Part n={12} name="Pill" note="A status fact, never a control. .tag takes the pill's radius.">
          {() => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="pill">Plain</span><span className="pill pill-live">Live</span><span className="pill pill-wait">Waiting</span>
            <span className="pill pill-guard">Guardian</span><span className="pill pill-stop">Stopped</span>
            <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Tag</span>
          </div>}
        </Part>

        <Part n={13} name="List row, step row and door list" note="A row: a title, one quiet line, an end (the accent word or a chevron), 56px. A step row is the 44px to-do well. A door list is a panel of rows with a glyph each.">
          {() => <>
            <div className="card rows">
              <a href="#rows" className="row"><div className="row-main"><div className="row-t">A list row</div><div className="row-s">One quiet line under it</div></div><span className="row-end">Open</span></a>
              <a href="#rows" className="row"><div className="row-main"><div className="row-t">Another row</div></div><Chev /></a>
            </div>
            <a href="#rows" className="row-step"><span style={{ flex: 1 }}>A step row</span><Chev /></a>
            <div className="card rows doors">
              {(['cv', 'trials', 'clip', 'star'] as const).map((k) => (
                <a key={k} href="#rows" className="row"><span className="row-ic"><Glyph k={k} /></span><div className="row-main"><div className="row-t">A door ({k})</div></div><Chev /></a>
              ))}
            </div>
          </>}
        </Part>

        <Part n={14} name="Hero panel" note="The seat's identity panel: --hero, the 22px hero radius, the floating shadow. The player's variant carries the CV's ghost numeral.">
          {() => <div className="hero-panel sheen">
            <span className="cv-num" aria-hidden>9</span>
            <div className="hero-id"><div className="hero-av">J</div><div style={{ minWidth: 0 }}><div className="hero-h">A hero heading</div><div className="hero-m">A quiet line</div></div></div>
            <div className="hero-well"><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>pitchfootball.com.au/p/····</div></div>
          </div>}
        </Part>

        <Part n={15} name="Stat and stat row" note="The numeral keeps its exact class string (the zero sweep reads it); the label is .stat-l. Omitted at zero, never a 0.">
          {() => <div className="card"><div className="stat-row">
            <div><div className="numeral numeral-l">99</div><div className="stat-l">On the register</div></div>
            <div><div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>8</div><div className="stat-l">New</div></div>
            <div><div className="numeral numeral-m" style={{ color: 'var(--amber)' }}>12</div><div className="stat-l">Shortlisted</div></div>
            <div><div className="numeral numeral-m" style={{ color: 'var(--purple)' }}>3</div><div className="stat-l">Invited</div></div>
          </div></div>}
        </Part>

        <Part n={16} name="Empty tile" note="Dashed means not yet. Never an illustration, never an apology. Both sentences in one element.">
          {() => <div className="card empty"><span className="empty-tile" aria-hidden /><div className="empty-b"><b className="empty-t">The first sentence.</b>The rest of it, in the same element.</div></div>}
        </Part>

        <Part n={17} name="Table" note=".ops-table and the console rows: the panel surface and shadow. The same columns and breakpoints as before (the table from 768px).">
          {() => <div className="ops-table">
            <div className="ops-head"><div>Club</div><div>Claimed</div><div>Held</div><div>Status</div><div /></div>
            {['Example club', 'Another club'].map((c) => (
              <div key={c} className="ops-row console-row-hover">
                <div className="ops-club" style={{ fontWeight: 800 }}>{c}</div>
                <div className="ops-when" style={{ fontSize: 12, color: 'var(--muted)' }}>1 Oct</div>
                <div className="ops-held" style={{ fontWeight: 800 }}>4 <span className="ops-held-word">held</span></div>
                <div className="ops-status"><span className="pill pill-wait">Waiting</span></div>
                <div className="ops-action"><a href="#table" className="console-btn">Open</a></div>
              </div>
            ))}
          </div>}
        </Part>

        <Part n={18} name="Buttons, and the one glow" note="The charter's two buttons and the 44px ghost. .fl-glow goes on the first primary in 390 reading order and on no other: a list row's primary, or a consent answer, never glows. .btn-auto is a width, not a third button.">
          {(m) => <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 420 }}>
            <button type="button" className={m === 'n' ? 'btn btn-primary fl-glow' : 'btn btn-primary'}>{m === 'n' ? 'The one primary, glowing' : 'A primary, as drawn beside it'}</button>
            <button type="button" className="btn btn-secondary">Secondary — 46px</button>
            <button type="button" className="btn btn-ghost">Ghost — 44px</button>
            <button type="button" className="btn btn-secondary btn-auto">Auto width</button>
            <button type="button" className="btn btn-primary" disabled>Disabled</button>
          </div>}
        </Part>

        <Part n={19} name="Field" note=".field, unchanged; aria-invalid takes the amber edge.">
          {() => <>
            <label className="field"><span className="field-label">Text</span><input placeholder="you@example.com" /></label>
            <label className="field" aria-invalid="true"><span className="field-label">Needs another look</span><input defaultValue="not an address" /></label>
          </>}
        </Part>

        <Part n={20} name="Door panel" note="A form is a door. On a phone the column as drawn; from 640px the form sits in a lifted panel. A list never goes inside a door.">
          {() => <div className="door">
            <div className="pg-titles"><h2 className="pg-title">A form</h2><div className="pg-sub">Its one line.</div></div>
            <label className="field"><span className="field-label">Email</span><input placeholder="you@example.com" /></label>
            <button type="button" className="btn btn-primary">Continue</button>
          </div>}
        </Part>

        <Part n={21} name="Quiet shell" flush note="The top bar over the 460px (or 640px wide) reading column: /unsubscribe, /manage, /stop-cvs and the legal pages.">
          {() => <div className="has-topbar"><SiteNav links={[]} signIn={false} homeLink={false} /><div className="gal-pad" style={{ maxWidth: 460, margin: '0 auto' }}><div className="pg-titles"><h2 className="pg-title">A quiet page</h2><div className="pg-sub">Its one line.</div></div></div></div>}
        </Part>

        <Part n={22} name="Failure shell" flush note="The top bar, the glyph tile at the card radius, the page title, the well, and the way out as the one glowing primary.">
          {() => <div className="has-topbar"><SiteNav links={[]} signIn={false} homeLink={false} /><div className="gal-pad">
            <div style={{ width: 56, height: 56, borderRadius: 'var(--r-card)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M8.5 12 h7" /></svg></div>
            <div className="pg-titles"><h2 className="pg-title">A failure heading</h2><div className="pg-sub">The reason.</div></div>
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>Why there is no more.</div>
            <button type="button" className="btn btn-primary">The way out</button>
          </div></div>}
        </Part>

        <Part n={23} name="Home grid" note=".home-grid (.player-grid kept as an alias): one column in the 390 order; from 1024px main plus a 320px aside.">
          {() => <div className="home-grid">
            <div><div className="card">Main column</div><div className="card">Main column</div></div>
            <div><div className="card">Aside</div></div>
          </div>}
        </Part>
      </div>
    </div>
  );
}
