// The one page every non-live link serves (D-77): expired, revoked, paused,
// guardian-disabled, never existed — identical copy, identical structure,
// for all of them. No name, no club, no photo, no age. Faithful to
// LinkState.dc.html (anon variant; the verified-club request-access variant
// arrives with auth).
import SiteNav from '@/components/floodlit/SiteNav';
import { FAILURE_COPY, GlyphTile } from '@/components/FailureState';
import { requestAccess } from '@/app/p/[token]/request/actions';
import { T } from '@/lib/palette';
import { DashedTile, ParentPage } from '@/components/parent-sheet';

// The three approved sentences, in one place, because a second page now says
// them (FinishedLink, below).
const WORDS = {
  heading: 'This link doesn\u2019t open anything',
  reason: 'It may have been switched off, it may have expired, or it may never have been a link at all. We don\u2019t say which.',
  why: 'That is deliberate. If we told you which, anyone could use a wrong link to find out whether a particular child is on Pitch. The answer is the same either way.',
};

// The lock, in the failure shell's glyph tile (radius 16; it was 18, not a
// charter value). One glyph for every kind of dead link.
const LOCK = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" /></svg>
);

// D-PD-4 (BUZ, 1 Oct): a finished approval link (/a/*: approved, held,
// purged, or never a link) used to serve the root 404, so a parent who had
// just said yes and opened the other link read that their child's page "may
// have been taken down". It now says LinkState's words, at 200, with the
// failure path's way out. It is handed nothing, so it can say nothing
// different for any cause (D-77, D-155: a hold reads as an approval). No
// request-access form: that is for somebody holding a share link.
export function FinishedLink() {
  // Floodlit (spec D, 6b): the top bar, the reading column, and the glyph
  // tile dashed — nothing to act on here (Head of Product Design ruling 4).
  // The way out is the screen's one primary, so it glows (spec A part 22).
  return (
    <ParentPage page>
      <DashedTile>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" /></svg>
      </DashedTile>
      <div className="ask" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.015em' }}>{WORDS.heading}</h1>
        <div className="pd-sub">{WORDS.reason}</div>
      </div>
      <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{WORDS.why}</div>
      <a href="/home" className="btn btn-primary fl-glow">{FAILURE_COPY.notFound.action}</a>
    </ParentPage>
  );
}

export default function LinkState({ token, asked }: { token?: string; asked?: boolean }) {
  // Floodlit (spec H): the failure shell's sibling. The bar is the live CV's
  // bar exactly (SiteNav signIn={false} homeLink={false}, PlayerCV), so a
  // live link and a dead one can never differ in their chrome. Then the glyph
  // tile, the page title, the why as a well, and the one affordance as a
  // panel with field wells and the screen's one glow. Every part is a
  // constant: nothing here may vary by the kind of dead link (D-77).
  // HC1 (BUZ, 1 Oct): the third card ("Not signed in as a verified
  // club?…") is gone — the page says "we don't say which" once.
  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', flexDirection: 'column' }}>
      <SiteNav signIn={false} homeLink={false} />
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <GlyphTile>{LOCK}</GlyphTile>
        <div className="pg-titles">
          <h1 className="pg-title">{WORDS.heading}</h1>
          <div className="pg-sub">{WORDS.reason}</div>
        </div>
        <div className="card-sunken" style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{WORDS.why}</div>

        {/* The one affordance on this page (D-77, doc 14 C6). The requester
            types their own name and role and the family decides. The reply
            below is the SAME whether a request was sent, silently dropped as
            a repeat inside 24 hours, or aimed at a token that never existed —
            anything else tells a stranger their guess found something. */}
        {token && (asked ? (
          <div className="card">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
              If there is a family at the other end of this link, they have your name and your role. Whether they answer is up to them, and we will not ask again on your behalf.
            </div>
          </div>
        ) : (
          <form action={requestAccess} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}><input type="hidden" name="token" value={token} />
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>Were you sent this link?</div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Tell the family who you are and they can send you a new one. We pass on exactly what you type and nothing else.
            </div>
            <label className="field">
              <span className="field-label">Your name</span>
              <input name="name" required maxLength={80} />
            </label>
            <label className="field">
              <span className="field-label">Your role and club</span>
              <input name="role" required maxLength={120} placeholder="Technical Director, Riverside FC" />
            </label>
            {/* LinkState.dc.html draws this as the primary button (#3ddc84,
                50px) and the build had drifted to the secondary well. It is
                the ONLY action on the page; a lone action is primary, and it
                carries the screen's one glow. */}
            <button type="submit" className="btn btn-primary fl-glow">Ask the family</button>
          </form>
        ))}
      </div>
    </div>
  );
}
