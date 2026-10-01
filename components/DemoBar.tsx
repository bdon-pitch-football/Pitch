// The strip across the top of every page in a demo (lib/demo). Server-rendered:
// the layout only includes it when isDemo() says so.
//
// J-P1 (BUZ, 1 Oct): a demo is a mode, which is a state, so the strip is dark
// and the amber "Demo" pill carries it. It was solid green, and green is an
// action (D-173 (4)). The words are unchanged; the "·" between "Demo" and the
// line is now the pill's edge. Inside .fl-wide, so the pill lines up with the
// logo in the top bar or the rail below it. Never sticky: it pushes the page
// down by its 44px and scrolls away with it. "Switch seat" is 44px tall, the
// charter's floor at every width (.demo-bar-a; it was 24px). The CSS is in
// globals.css under THE CLUB DEMO.
export default function DemoBar() {
  return (
    <div role="note" className="demo-bar">
      <div className="fl-wide demo-bar-in">
        <span className="pill pill-wait">Demo</span>
        <span className="demo-bar-t">every person here is made up</span>
        <a href="/demo" className="demo-bar-a">Switch seat</a>
      </div>
    </div>
  );
}
