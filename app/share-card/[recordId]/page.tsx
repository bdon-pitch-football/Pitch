// ShareCV.dc.html — the child makes a card to post. Copy verbatim. Nothing
// is generated here: the shapes are drawn, not rendered from the record.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { requestCard } from './actions';
import { requireRecordActor } from '@/lib/record-guard';
import { TopBarShell } from '@/components/console-shell';
import { Check, G, Outcome, TextLink, Who } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Share card', robots: { index: false, follow: false } };

const SHAPES: [string, string, number, number][] = [['story', 'Story', 34, 60], ['square', 'Square', 52, 52], ['landscape', 'Landscape', 64, 34]];

// A card silhouette (spec C): a photo block, a name bar, two chip shapes and
// a stats rule, on the card's own gradient. Decorative blocks only — no text
// and no record data, because generating a preview IS generating the image
// before a parent has said yes (D-101). Never a club's colours (D-89).
const Sil = ({ w, h }: { w: number; h: number }) => (
  <div className="sil" aria-hidden style={{ width: w, height: h }}>
    <i className="b2" style={{ top: Math.round(h * 0.16), width: Math.round(w * 0.28), height: Math.round(w * 0.28), borderRadius: 4 }} />
    <i className="n" style={{ top: Math.round(h * 0.5), width: Math.round(w * 0.56), height: 4 }} />
    <i className="c" style={{ top: Math.round(h * 0.62), width: Math.round(w * 0.2), height: 6 }} />
    <i className="c" style={{ top: Math.round(h * 0.62), left: Math.round(w * 0.38), width: Math.round(w * 0.16), height: 6 }} />
    <i className="b2" style={{ top: Math.round(h * 0.8), width: Math.round(w * 0.7), height: 3 }} />
  </div>
);

// A flow, so the Top bar (spec A part 5), not the seat frame.
const Page = ({ children }: { children: React.ReactNode }) => (
  <TopBarShell>
    <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark back={{ href: '/home' }} />
      {children}
    </div>
  </TopBarShell>
);

export default async function ShareCard({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ asked?: string }>;
}) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { asked } = await searchParams;
  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  // C-P9 (BUZ, 1 Oct): an adult has no parent on the record, so a page that
  // tells them to ask one is untrue. /home links here only for under-18s with
  // a confirmed parent; reached by URL, an adult goes home, as /send does.
  if (rows[0].band === '18plus') redirect('/home');

  if (asked) {
    // The same outcome as every other "asked" in the player's screens. The
    // kicker is /send's approved line, in a new place (spec C).
    return (
      <Page>
        <Outcome tone="amber" kicker="Waiting on your parent" title="Asked. Nothing has been made yet.">
          Your parent sees the exact card and says yes. Then it&rsquo;s yours to post wherever you want.
        </Outcome>
      </Page>
    );
  }

  const act = requestCard;
  return (
    <Page>
      <form action={act} className="door" style={{ marginTop: 0 }}><input type="hidden" name="recordId" value={recordId} />
        <div className="pg-titles">
          <h1 className="pg-title">Share my CV</h1>
          <div className="pg-sub">Pitch makes you a card. You post it wherever you like — Instagram, Snap, a group chat, anywhere.</div>
        </div>
        <div className="c-gap">
          <div className="panel-h">Pick a shape</div>
          {/* Real radios: the chosen tile follows the checked one with no
              JavaScript (:has). The first was drawn chosen whatever was
              picked. */}
          <div className="shapes">
            {SHAPES.map(([value, text, w, h], i) => (
              <label key={value} className="shape">
                <input type="radio" name="shape" value={value} defaultChecked={i === 0} />
                <div className="shape-in">
                  <Sil w={w} h={h} />
                  <div className="shape-n">{text}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="card-sunken checks">
          <div className="checks-t">What&rsquo;s on it</div>
          <Check ok>Your first name and the letter your surname starts with. Nothing more of your name.</Check>
          <Check ok>Your positions, your number and the numbers you chose to show.</Check>
          <Check ok={false}>Not your club, not your age group, not where you live, not your face.</Check>
          <Check ok={false}>No link back to your page. Someone who likes it has to come and find Pitch themselves.</Check>
        </div>
        <Who guard icon={G.people()} title="Your parent sees it first">
          They look at the actual card and say yes. Then it&rsquo;s yours to post wherever you want.
        </Who>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="submit" className="btn btn-primary fl-glow">Ask my parent to approve it</button>
          {/* C-P5 (BUZ, 1 Oct): Cancel goes home, as it does on /send. It was a
              div that went nowhere. */}
          <TextLink href="/home">Cancel</TextLink>
        </div>
      </form>
    </Page>
  );
}
