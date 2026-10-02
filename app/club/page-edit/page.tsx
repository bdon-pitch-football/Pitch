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
import { addClubVideo, removeClubVideo, saveClubStory, addWanted, removeWanted, addAlumni, removeAlumni, saveClubColours, clearClubColours } from './actions';
import { PRESETS, clubTheme } from '@/lib/club-colours';
import ClubHeroPreview from '@/components/club/ClubHeroPreview';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit your club page', robots: { index: false, follow: false } };

export default async function ClubPageEdit({ searchParams }: {
  searchParams: Promise<{ saved?: string; crest?: string; banner?: string; video?: string; removed?: string; story?: string; wanted?: string; alumni?: string; colours?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { saved, crest, banner, video, story, wanted, alumni, colours } = await searchParams;

  const { rows } = await db.query(
    `select c.id, c.name, c.club_state, c.suburb, c.state, c.crest_path, c.banner_path, c.public_slug, c.philosophy, c.pathway_line, c.established, c.colour_primary, c.colour_secondary from club c
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
  // P4 (BUZ, 1 Oct): the laptop's one sticky preview carries the two counts
  // /fc shows and its first trial — the club's own public facts, read the way
  // its public page reads them, and nothing about any person.
  const pub = (await db.query(
    `select (select count(*)::int from squad s where s.club_id = $1) as squads,
       (select count(*)::int from fn_trial_notices_advertised() t where t.club_id = $1) as trials`, [c.id],
  )).rows[0] as { squads: number; trials: number };
  const first = (await db.query(
    `select to_char(t.trial_on, 'FMDD') as day, upper(to_char(t.trial_on, 'Mon')) as mon, t.title, t.time_venue
     from fn_trial_notices_advertised() t where t.club_id = $1 order by t.trial_on limit 1`, [c.id],
  )).rows[0] as { day: string; mon: string; title: string; time_venue: string } | undefined;

  // The same arithmetic the public page uses (0160, D-173), so what a club
  // sees here is what families see. A suspended club's preview stays green.
  const theme = clubTheme({ primary: c.colour_primary, secondary: c.colour_secondary }, c.club_state === 'unclaimed' ? 'claimed' : c.club_state);
  const hero = {
    name: c.name as string, verified: c.club_state === 'verified', crestPath: c.crest_path as string | null,
    established: c.established, place: [c.suburb, c.state].filter(Boolean).join(' '), pathway: c.pathway_line as string | null, theme,
  };
  const warn = (msg: string) => <div role="alert" className="cc-said cc-said-warn">{msg}</div>;
  const hint: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 };
  const h: React.CSSProperties = { fontSize: 14, fontWeight: 900 };

  return (
    <ClubConsole active="page-edit">
      <div className="console cc-page pe-page">
        <HeaderMark />
        <div className="pg-titles" style={{ gap: 2 }}>
          <h1 className="pg-title">Your club page</h1>
          <div className="pg-sub" style={{ fontSize: 13.5 }}>{c.name}</div>
        </div>

        <div className="cc-split">
          <div className="cc-main">
            {saved && <div className="cc-said cc-said-ok">Saved. It&rsquo;s on your page now.</div>}
            {crest === 'bad' && <div className="cc-said cc-said-warn">That file didn&rsquo;t work. A PNG or JPEG under 8MB.</div>}
            {banner === 'bad' && <div className="cc-said cc-said-warn">That file didn&rsquo;t work. A JPEG or PNG under 12MB, landscape if you have one.</div>}
            {video === 'bad' && <div className="cc-said cc-said-warn">Give it a title, and a YouTube, Veo or Instagram link.</div>}

            <form id="story" action={saveClubStory} className="card pe-form">
              <div style={h}>About your club</div>
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
              {/* The page's first primary, so its one glow. */}
              <button type="submit" className="btn btn-primary fl-glow">Save</button>
              <div style={hint}>Your philosophy shows on your page straight after your trials. Up to 400 characters.</div>
            </form>

            <form action="/club/page-edit/crest" method="post" encType="multipart/form-data" className="card pe-form">
              <div style={h}>Club crest</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* No crest yet is the dashed "not yet" tile. */}
                {c.crest_path ? (
                  <div className="pe-crest">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.crest_path} alt="" width={66} height={66} style={{ objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div className="pe-crest empty-tile"><span style={{ fontWeight: 900, fontSize: 24, color: 'var(--muted)' }}>{c.name[0]}</span></div>
                )}
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
                  {c.crest_path ? 'Upload another to replace it.' : 'No crest yet — your page shows a letter until you add one.'}
                </div>
              </div>
              <label className="filefield">
                <input type="file" name="crest" accept="image/png,image/jpeg,image/webp" required />
                <span className="filefield-title">Choose your crest</span>
                <span className="filefield-hint">PNG or JPEG, under 8MB. Sized to fit rather than cropped, so a tall badge keeps its shape.</span>
              </label>
              <button type="submit" className="btn btn-primary">Save the crest</button>
              <div style={hint}>
                We re-save the image ourselves, which removes any location data the file was carrying. It is sized to fit rather than cropped square, so a tall badge keeps its shape.
              </div>
            </form>

            <form action="/club/page-edit/banner" method="post" encType="multipart/form-data" className="card pe-form">
              <div style={h}>Banner</div>
              {/* Shown the way the public page composes it — photo behind, crest
                  over it — so a club can see what its own crop is about to
                  cover before it saves. From 1024 the sticky preview beside the
                  forms does this job, so this one is phone and tablet only. */}
              <div className="cc-only-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ClubHeroPreview {...hero} bannerPath={c.banner_path} />
                {!c.banner_path && <div className="chp-nobanner">No banner yet</div>}
              </div>
              <label className="filefield">
                <input type="file" name="banner" accept="image/png,image/jpeg,image/webp" required />
                <span className="filefield-title">Choose a banner</span>
                <span className="filefield-hint">A wide photo of your ground or a team shot. Cropped to a wide strip, and your crest sits over the bottom-left of it.</span>
              </label>
              <button type="submit" className="btn btn-secondary">Save the banner</button>
              <div style={hint}>
                It gets cropped to a wide strip and darkened towards the bottom, where your crest and your club name sit. Anything you want seen wants to be near the middle or the top.
              </div>
            </form>

            {/* Club colours (0160, D-173). The page shows the same arithmetic the
                public page uses, so what a club sees here is what families see. */}
            <form id="colours" action={saveClubColours} className="card pe-form">
              <div style={h}>Club colours</div>
              {colours === 'bad' && warn('Pick one of the pairs, or both of your own colours.')}
              <div className="cc-only-narrow">
                <ClubHeroPreview {...hero} />
              </div>
              <fieldset className="pe-presets">
                <legend className="field-label" style={{ marginBottom: 8 }}>Pick a pair</legend>
                {PRESETS.map((p, i) => {
                  const on = c.colour_primary === p.primary && c.colour_secondary === p.secondary;
                  return (
                    <label key={p.name} className="pe-preset">
                      <input type="radio" name="preset" value={String(i)} defaultChecked={on} style={{ accentColor: 'var(--accent)' }} />
                      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 'var(--r-well)', flexShrink: 0, background: `linear-gradient(135deg, ${p.primary} 55%, ${p.secondary} 55%)`, border: '1px solid rgba(255,255,255,.18)' }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--secondary)' }}>{p.name}</span>
                    </label>
                  );
                })}
              </fieldset>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44 }}>
                <input type="radio" name="preset" value="custom" defaultChecked={Boolean(c.colour_primary) && !PRESETS.some((p) => p.primary === c.colour_primary && p.secondary === c.colour_secondary)} style={{ accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 800 }}>Or your own two colours</span>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label className="field" style={{ flex: 1 }}><span className="field-label">Main colour</span>
                  <input id="club-colour-primary" name="primary" type="color" defaultValue={c.colour_primary ?? PRESETS[0].primary} style={{ width: '100%', height: 36, border: 'none', background: 'transparent', padding: 0 }} />
                </label>
                <label className="field" style={{ flex: 1 }}><span className="field-label">Second colour</span>
                  <input id="club-colour-secondary" name="secondary" type="color" defaultValue={c.colour_secondary ?? PRESETS[0].secondary} style={{ width: '100%', height: 36, border: 'none', background: 'transparent', padding: 0 }} />
                </label>
              </div>
              {/* John's condition 3 (D-174): the club is told, where it chooses,
                  that its colours also dress its players' CVs. BUZ approved the
                  line on 1 Oct (docs/team/APPROVALS-28-SEP.md). A CV wears a
                  club's colours only once the club is verified (D-174, the
                  call), so the line shows only then: to a claimed club that has
                  not had the call it would promise what does not happen, and no
                  other words take its place (BUZ, 1 Oct, via Leo). */}
              {c.club_state === 'verified' && (
                <div style={hint} data-cv-colours-line="">Your colours appear on your club page, and on the CV of players who list your club as their current club.</div>
              )}
              <button type="submit" className="btn btn-primary">Save the colours</button>
              <div style={hint}>Your colours go behind your name and down the edge of your page. Buttons stay green, so families always know what to press. If a colour would make your name hard to read, we darken it just enough.</div>
            </form>
            {c.colour_primary && (
              <form action={clearClubColours} style={{ marginTop: -8 }}>
                <button type="submit" className="btn btn-ghost">Go back to Pitch green</button>
              </form>
            )}

            <form id="wanted" action={addWanted} className="card pe-form">
              <div style={h}>Players wanted</div>
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
            {notices.length > 0 && (
              <div className="card rows pe-list">
                {notices.map((w) => (
                  <div key={w.id} className="pe-item">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{w.title}</div>
                      {w.detail && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{w.detail}</div>}
                    </div>
                    <form action={removeWanted}><input type="hidden" name="wantedId" value={w.id} />
                      <button type="submit" className="textbtn">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form id="alumni" action={addAlumni} className="card pe-form">
              <div style={h}>Alumni wall</div>
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
              <div style={{ fontSize: 12, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                <b style={{ color: 'var(--ink)' }}>Never name anyone under 18.</b> For a younger player, leave the name out: &ldquo;A 2019 U13, now in an NPL squad.&rdquo;
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 13, fontWeight: 700, color: 'var(--secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                <input id="alumni-adults" type="checkbox" name="adults" value="yes" required style={{ marginTop: 3 }} />
                Everyone named here is 18 or over.
              </label>
              <button type="submit" className="btn btn-secondary">Add to the wall</button>
            </form>
            {wall.length > 0 && (
              <div className="card rows pe-list">
                {wall.map((a) => (
                  <div key={a.id} className="pe-item">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{a.line}</div>
                      {a.detail && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{a.detail}</div>}
                    </div>
                    <form action={removeAlumni}><input type="hidden" name="alumniId" value={a.id} />
                      <button type="submit" className="textbtn">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={addClubVideo} className="card pe-form">
              <div style={h}>Club video</div>
              <label className="field"><span className="field-label">Title</span>
                <input name="title" placeholder="Our 2026 season" required maxLength={80} />
              </label>
              <label className="field"><span className="field-label">Link</span>
                <input name="url" placeholder="https://www.youtube.com/watch?v=…" required />
              </label>
              <button type="submit" className="btn btn-secondary">Add the video</button>
              <div style={hint}>
                YouTube, Veo or Instagram. The video stays where it is — we only keep the link, and nothing loads until someone presses play.
              </div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55, borderTop: '1px solid var(--line)', paddingTop: 11 }}>
                <b style={{ color: 'var(--ink)' }}>Keep the title about the club, not about a child.</b> &ldquo;Our 2026 season&rdquo; is fine; naming a player under 18 is not — the same rule as your pathway wall. You know what is in your own footage; we only ever see the title.
              </div>
            </form>
            {videos.length > 0 && (
              <div className="card rows pe-list">
                {videos.map((v) => (
                  <div key={v.id} className="pe-item">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{v.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.url}</div>
                    </div>
                    <form action={removeClubVideo}><input type="hidden" name="videoId" value={v.id} />
                      <button type="submit" className="textbtn">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            {/* The public page used to carry its own address in a bordered card,
                which is furniture for the club and noise for a family reading it.
                It belongs here, where the club is already standing. */}
            {c.public_slug && (
              <Link href={`/fc/${c.public_slug}`} className="card lift" style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'center', textDecoration: 'none' }}>
                <div className="field-label">Your club page link</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>pitchfootball.com.au/fc/{c.public_slug}</div>
              </Link>
            )}
            <Link href="/home" className="btn btn-ghost">Back</Link>
          </div>

          {/* P4 (BUZ, 1 Oct): from 1024, one sticky preview of the club page
              beside the forms; the two in-form previews give way to it. */}
          <aside className="cc-only-wide">
            <div className="panel-h">Your club page</div>
            <ClubHeroPreview {...hero} bannerPath={c.banner_path} stats={pub}
              firstTrial={first ? { day: first.day, mon: first.mon, title: first.title, timeVenue: first.time_venue } : null} />
          </aside>
        </div>
      </div>
    </ClubConsole>
  );
}
