// Highlights.dc.html — paste-a-link clips. Under 18 the screen is clean;
// an adult's carries Highlights18.dc.html's two locked Premium rows (D-164,
// D-82: never on an under-18 account, decided from the band the database
// derived for this record).
// Click-to-play façades only on any public render (D-97); this screen never
// embeds anything either.
import { notFound } from 'next/navigation';
import { PlayerFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import { requireRecordActor } from '@/lib/record-guard';
import { HeaderMark } from '@/components/Wordmark';
import { CLIP_LIMIT_ADULT_FREE, CLIP_LIMIT_UNDER_18 } from '@/lib/football';
import { addClip, removeClip } from './actions';
import PremiumRows from '@/components/PremiumRows';
import { buildProgress } from '@/lib/build-progress';
import { BuildHeader, G } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Highlights', robots: { index: false, follow: false } };

const sourceOf = (url: string) =>
  /youtu/i.test(url) ? 'YouTube' : /instagram/i.test(url) ? 'Instagram' : 'Veo';

export default async function Clips({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ error?: string; full?: string; first?: string }>;
}) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { error, full, first } = await searchParams;
  const { rows } = await db.query(
    `select fn_age_band(p.dob) as band,
       (select coalesce(json_agg(json_build_object('id', h.id, 'title', h.title, 'url', h.url,
          'added', to_char(h.added_at at time zone 'Australia/Melbourne', 'DD Mon')) order by h.added_at desc), '[]'::json)
        from highlight h where h.record_id = $1) as clips
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  const band = rows[0].band as string;
  const cap = band === '18plus' ? CLIP_LIMIT_ADULT_FREE : CLIP_LIMIT_UNDER_18;
  const clips: { id: string; title: string; url: string; added: string }[] = rows[0].clips;
  const add = addClip;

  const { done, total } = await buildProgress(recordId);

  return (
    <PlayerFrame active="cv">
      <div className="reading build-col" style={{ width: '100%', padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: `/build/${recordId}`, label: 'Back to the CV' }} />
        {/* C-P2 (BUZ, 1 Oct): the builder's header on all three steps. */}
        <BuildHeader recordId={recordId} title="Highlights" sub="Paste a link from YouTube, Instagram or Veo. No uploading, no waiting." done={done} total={total} here="Highlights" />
        {error && <div className="card card-amber c-say">That link isn&rsquo;t from YouTube, Instagram or Veo — check it and try again.</div>}
        {full && <div className="card card-amber c-say">All {cap} clip slots are used. Swap a clip out to add this one.</div>}
        {/* A form is a door: from 640px it lifts onto its panel. The list
            below it is the page, never inside the door. */}
        <form action={add} className="door" style={{ gap: 10, marginTop: 0 }}><input type="hidden" name="recordId" value={recordId} />
          <label className="field" aria-invalid={error ? true : undefined}>
            <span className="field-label">Video link</span>
            <input name="url" aria-label="Video link" placeholder="https://veo.co/matches/…" required />
          </label>
          <label className="field">
            <span className="field-label">Title</span>
            <input name="title" aria-label="Title" placeholder="e.g. vs Northern Utd — 2 goals" required maxLength={80} />
          </label>
          <button type="submit" className="btn btn-primary fl-glow">Add highlight</button>
        </form>
        <div className="c-gap" style={{ gap: 10 }}>
          <h2 className="sec-h">Your clips · {clips.length} of {cap} used</h2>
          {clips.map((c, i) => (
            <div key={c.id} className="card clip-ed">
              {/* Nothing plays on this screen, so the mark is neutral, not the
                  CV's green play button (spec C). */}
              <div className={i % 2 ? 'clip-ed-p alt' : 'clip-ed-p'} aria-hidden>{G.play()}{sourceOf(c.url)}</div>
              <div className="clip-ed-c">
                <div style={{ minWidth: 0 }}>
                  <div className="row-t" style={{ fontSize: 13.5 }}>{c.title}</div>
                  <div className="row-s" style={{ fontSize: 11.5 }}>{sourceOf(c.url)} · added {c.added}</div>
                </div>
                <form action={removeClip}><input type="hidden" name="recordId" value={recordId} /><input type="hidden" name="clipId" value={c.id} />
                  <button type="submit" aria-label="Remove clip" className="textbtn">Remove</button>
                </form>
              </div>
            </div>
          ))}
          {clips.length < cap && (
            // The not-yet slot (spec A part 16): dashed means "not yet". N3
            // (BUZ, 1 Oct): the "＋" character goes; a stroke plus sits in the
            // tile. Same words.
            <div className="card empty">
              <div className="empty-tile c-glyph" aria-hidden>{G.plus(18)}</div>
              <div>
                <span className="empty-t">Add another clip</span>
                <span className="empty-b">{band === '18plus' ? 'Three clips, free' : 'Ten clips, free'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="foot-s">Swap a clip out any time.</div>
        {band === '18plus' && <PremiumRows on="clips" tapped={first === '1'} />}
      </div>
    </PlayerFrame>
  );
}
