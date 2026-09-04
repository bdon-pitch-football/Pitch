// Highlights.dc.html — paste-a-link clips, u18 variant (no premium rows).
// Click-to-play façades only on any public render (D-97); this screen never
// embeds anything either.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { CLIP_LIMIT_ADULT_FREE, CLIP_LIMIT_UNDER_18 } from '@/lib/football';
import { addClip, removeClip } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const sourceOf = (url: string) =>
  /youtu/i.test(url) ? 'YouTube' : /instagram/i.test(url) ? 'Instagram' : 'Veo';

export default async function Clips({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ error?: string; full?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound(); // until auth lands
  const { recordId } = await params;
  const { error, full } = await searchParams;
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
  const add = addClip.bind(null, recordId);

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
  const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Highlights</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Paste a link from YouTube, Instagram or Veo. No uploading, no waiting.</div>
        </div>
        {error && <div style={{ ...card, padding: '13px 14px', border: `1px solid ${T.amber}`, fontSize: 12.5, fontWeight: 700, color: T.secondary }}>That link isn&rsquo;t from YouTube, Instagram or Veo — check it and try again.</div>}
        {full && <div style={{ ...card, padding: '13px 14px', border: `1px solid ${T.amber}`, fontSize: 12.5, fontWeight: 700, color: T.secondary }}>All {cap} clip slots are used. Swap a clip out to add this one.</div>}
        <form action={add} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...card, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={label}>Video link</div>
            <input style={input} name="url" placeholder="https://veo.co/matches/…" required />
          </div>
          <div style={{ ...card, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={label}>Title</div>
            <input style={input} name="title" placeholder="e.g. vs Northern Utd — 2 goals" required maxLength={80} />
          </div>
          <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 15, padding: 14, fontSize: 15, fontWeight: 900, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Add highlight</button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your clips · {clips.length} of {cap} used</div>
          {clips.map((c, i) => (
            <div key={c.id} style={{ ...card, overflow: 'hidden' }}>
              <div style={{ height: 88, background: `linear-gradient(135deg, ${i % 2 ? '#182018' : '#1a2820'}, #101a14)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(61,220,132,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={T.onAccent}><path d="M8 5 L19 12 L8 19 Z" /></svg>
                </div>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: T.muted }}>{sourceOf(c.url)} · added {c.added}</div>
                </div>
                <form action={removeClip.bind(null, recordId, c.id)}>
                  <button type="submit" aria-label="Remove clip" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
                </form>
              </div>
            </div>
          ))}
          {clips.length < cap && (
            <div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.muted }}>＋ Add another clip</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{band === '18plus' ? 'Three clips, free' : 'Ten clips, free'}</div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: T.muted, textAlign: 'center' }}>Swap a clip out any time.</div>
      </div>
    </div>
  );
}
