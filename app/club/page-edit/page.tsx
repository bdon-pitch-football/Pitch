// The club's own page, editable. Today this is the crest — the one thing the
// brief specified (D-74) that was never wired up: club.crest_path has existed
// since the first migration and nothing read or wrote it, so every club page
// rendered an initials block.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { addClubVideo, removeClubVideo, saveClubStory, addWanted, removeWanted, addAlumni, removeAlumni } from './actions';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit your club page', robots: { index: false, follow: false } };

export default async function ClubPageEdit({ searchParams }: {
  searchParams: Promise<{ saved?: string; crest?: string; banner?: string; video?: string; removed?: string; story?: string; wanted?: string; alumni?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { saved, crest, banner, video, story, wanted, alumni } = await searchParams;

  const { rows } = await db.query(
    `select c.id, c.name, c.crest_path, c.banner_path, c.public_slug, c.philosophy, c.pathway_line, c.established from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];
  const videos = (await db.query(
    `select id, url, title from club_video where club_id = $1 order by sort, created_at`, [c.id],
  )).rows as { id: string; url: string; title: string }[];
  const notices = (await db.query(
    `select id, title, detail from players_wanted_notice where club_id = $1 order by created_at`, [c.id],
  )).rows as { id: string; title: string; detail: string | null }[];
  const wall = (await db.query(
    `select id, line, detail from alumni_entry where club_id = $1 order by sort, created_at`, [c.id],
  )).rows as { id: string; line: string; detail: string | null }[];
  const warn = (msg: string) => <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>{msg}</div>;
  const hint: React.CSSProperties = { fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 };
  const removeBtn: React.CSSProperties = { height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };

  return (
    <ClubConsole active="page-edit">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your club page</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>{c.name}</div>
        </div>

        {saved && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Saved. It&rsquo;s on your page now.</div>}
        {crest === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That file didn&rsquo;t work. A PNG or JPEG under 8MB.</div>}
        {banner === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That file didn&rsquo;t work. A JPEG or PNG under 12MB, landscape if you have one.</div>}
        {video === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Give it a title, and a YouTube, Veo or Instagram link.</div>}

        <form id="story" action={saveClubStory} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13, scrollMarginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>About your club</div>
          {story === 'bad' && warn('The philosophy can be up to 400 characters, the pathway up to 80, and the year founded is four digits.')}
          <label className="field"><span className="field-label">Our philosophy</span>
            <textarea id="club-philosophy" name="philosophy" rows={4} maxLength={400} defaultValue={c.philosophy ?? ''} placeholder="Every junior plays, every junior develops." />
          </label>
          <label className="field"><span className="field-label">Pathway</span>
            <input id="club-pathway" name="pathway" maxLength={80} defaultValue={c.pathway_line ?? ''} placeholder="MiniRoos → Juniors → Seniors" />
          </label>
          <label className="field"><span className="field-label">Year founded</span>
            <input id="club-founded" name="founded" inputMode="numeric" pattern="(18|19|20)[0-9]{2}" maxLength={4} defaultValue={c.established ?? ''} placeholder="1974" />
          </label>
          <button type="submit" className="btn btn-primary">Save</button>
          <div style={hint}>Your philosophy shows on your page straight after your trials. Up to 400 characters.</div>
        </form>

        <form action="/club/page-edit/crest" method="post" encType="multipart/form-data" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Club crest</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 66, height: 66, borderRadius: 16, background: T.surface2, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {c.crest_path
                ? <img src={c.crest_path} alt="" width={66} height={66} style={{ objectFit: 'contain' }} />
                : <span style={{ fontWeight: 900, fontSize: 24, color: T.muted }}>{c.name[0]}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              {c.crest_path ? 'Upload another to replace it.' : 'No crest yet — your page shows a letter until you add one.'}
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="crest" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose your crest</span>
            <span className="filefield-hint">PNG or JPEG, under 8MB. Sized to fit rather than cropped, so a tall badge keeps its shape.</span>
          </label>
          <button type="submit" className="btn btn-primary">Save the crest</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            We re-save the image ourselves, which removes any location data the file was carrying. It is sized to fit rather than cropped square, so a tall badge keeps its shape.
          </div>
        </form>

        <form action="/club/page-edit/banner" method="post" encType="multipart/form-data" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Banner</div>
          {/* Shown the way the public page composes it — photo behind, crest
              over the bottom-left — so a club can see what its own crop is
              about to cover before it saves. */}
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: 'var(--hero)' }}>
            {c.banner_path ? (
              <div style={{ position: 'relative', lineHeight: 0 }}>
                <img src={c.banner_path} alt="" style={{ width: '100%', height: 118, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,21,16,0) 42%, rgba(10,21,16,.78) 100%)' }} />
              </div>
            ) : (
              <div style={{ width: '100%', height: 118, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                No banner yet
              </div>
            )}
            <div style={{ position: 'relative', zIndex: 1, padding: '0 14px 12px 14px' }}>
              <div style={{ width: 62, height: 62, marginTop: -30, borderRadius: 14, background: '#1b2b22', border: '3px solid #0e1b14', boxShadow: '0 0 0 1px rgba(238,245,240,.18), 0 8px 20px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.crest_path
                  ? <img src={c.crest_path} alt="" width={62} height={62} style={{ objectFit: 'contain' }} />
                  : <span style={{ fontWeight: 900, fontSize: 22, color: T.muted }}>{c.name[0]}</span>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.015em', marginTop: 8 }}>{c.name}</div>
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="banner" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose a banner</span>
            <span className="filefield-hint">A wide photo of your ground or a team shot. Cropped to a wide strip, and your crest sits over the bottom-left of it.</span>
          </label>
          <button type="submit" className="btn btn-secondary">Save the banner</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            It gets cropped to a wide strip and darkened towards the bottom, where your crest and your club name sit. Anything you want seen wants to be near the middle or the top.
          </div>
        </form>

        <form id="wanted" action={addWanted} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13, scrollMarginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Players wanted</div>
          {wanted === 'bad' && warn('Give the notice a title of up to 60 characters. The detail line can be up to 100.')}
          {wanted === 'full' && warn('Six notices is the most at once. Remove one first.')}
          <label className="field"><span className="field-label">Title</span>
            <input id="wanted-title" name="title" required maxLength={60} placeholder="U13 Boys — Goalkeeper" />
          </label>
          <label className="field"><span className="field-label">Detail</span>
            <input id="wanted-detail" name="detail" maxLength={100} placeholder="Train Tue & Thu · immediate start" />
          </label>
          <button type="submit" className="btn btn-secondary">Add the notice</button>
          <div style={hint}>Families see these on your page and register their interest from there. Up to six at a time.</div>
        </form>
        {notices.map((w) => (
          <div key={w.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{w.title}</div>
              {w.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{w.detail}</div>}
            </div>
            <form action={removeWanted}><input type="hidden" name="wantedId" value={w.id} />
              <button type="submit" style={removeBtn}>Remove</button>
            </form>
          </div>
        ))}

        <form id="alumni" action={addAlumni} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13, scrollMarginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Alumni wall</div>
          {alumni === 'tick' && warn('Tick the box to confirm everyone named is 18 or over.')}
          {alumni === 'bad' && warn('Who and where they went can be up to 40 characters each, and the detail up to 80.')}
          {alumni === 'full' && warn('Twelve entries is the most at once. Remove one first.')}
          <label className="field"><span className="field-label">Who</span>
            <input id="alumni-who" name="who" required maxLength={40} placeholder="Marco V." />
          </label>
          <label className="field"><span className="field-label">Went on to</span>
            <input id="alumni-to" name="to" maxLength={40} placeholder="NPL Victoria" />
          </label>
          <label className="field"><span className="field-label">Detail</span>
            <input id="alumni-detail" name="detail" maxLength={80} placeholder="Juniors 2012–2018" />
          </label>
          <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>Never name anyone under 18.</b> For a younger player, leave the name out: &ldquo;A 2019 U13, now in an NPL squad.&rdquo;
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.5, cursor: 'pointer' }}>
            <input id="alumni-adults" type="checkbox" name="adults" value="yes" required style={{ marginTop: 3 }} />
            Everyone named here is 18 or over.
          </label>
          <button type="submit" className="btn btn-secondary">Add to the wall</button>
        </form>
        {wall.map((a) => (
          <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{a.line}</div>
              {a.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{a.detail}</div>}
            </div>
            <form action={removeAlumni}><input type="hidden" name="alumniId" value={a.id} />
              <button type="submit" style={removeBtn}>Remove</button>
            </form>
          </div>
        ))}

        <form action={addClubVideo} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Club video</div>
          <label className="field"><span className="field-label">Title</span>
            <input name="title" placeholder="Our 2026 season" required maxLength={80} />
          </label>
          <label className="field"><span className="field-label">Link</span>
            <input name="url" placeholder="https://www.youtube.com/watch?v=…" required />
          </label>
          <button type="submit" className="btn btn-secondary">Add the video</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            YouTube, Veo or Instagram. The video stays where it is — we only keep the link, and nothing loads until someone presses play.
          </div>
          <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, lineHeight: 1.55, borderTop: `1px solid ${T.line}`, paddingTop: 11 }}>
            <b style={{ color: T.ink }}>Keep the title about the club, not about a child.</b> &ldquo;Our 2026 season&rdquo; is fine; naming a player under 18 is not — the same rule as your pathway wall. You know what is in your own footage; we only ever see the title.
          </div>
        </form>

        {videos.map((v) => (
          <div key={v.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.url}</div>
            </div>
            <form action={removeClubVideo}><input type="hidden" name="videoId" value={v.id} />
              <button type="submit" style={{ height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </form>
          </div>
        ))}

        {/* The public page used to carry its own address in a bordered card,
            which is furniture for the club and noise for a family reading it.
            It belongs here, where the club is already standing. */}
        {c.public_slug && (
          <Link href={`/fc/${c.public_slug}`} className="lift" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your club page link</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/fc/{c.public_slug}</div>
          </Link>
        )}
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </ClubConsole>
  );
}
