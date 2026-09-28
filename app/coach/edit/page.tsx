// BuildCoachCV.dc.html — the coach editor, copy verbatim. WWCC card renders
// the attested (verified) or waiting-on-club variant; the number has nowhere
// to go and the copy says so plainly (D-98).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';
import Link from 'next/link';
import { addCoachAchievement, addCoachClip, addLicence, addRole, hideCoachPage, publishCoachPage, removeCoachAchievement, removeCoachClip, removeLicence, removeRole, saveCoachProfile } from './actions';
import CopyLink from '@/components/cv/CopyLink';
import { COACH_CLIP_CAP } from '@/lib/football';
import { T } from '@/lib/palette';
import { card, fieldLabel as label } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Build your coach CV', robots: { index: false, follow: false } };

const input: React.CSSProperties = { background: 'transparent', border: 'none', color: T.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function CoachEdit({ searchParams }: { searchParams: Promise<{ saved?: string; clip?: string; photo?: string; banner?: string; removed?: string; published?: string; hidden?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { saved, clip, photo, banner, published, hidden } = await searchParams;
  const { rows } = await db.query(
    `select p.first_name, coalesce(p.last_name,'') as last_name, p.photo_path, cp.public_contact,
       cp.region, cp.philosophy, cp.public_slug, cp.banner_path, cp.hidden_at,
       fn_age_band(p.dob) = '18plus' as adult,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select c.name from wwcc_attestation w join club c on c.id = w.club_id where w.person_id = p.id and w.revoked_at is null limit 1) as wwcc_club,
       (select c2.name from membership m join club c2 on c2.id = m.club_id where m.person_id = p.id and m.role = 'coach' and m.ended_at is null limit 1) as coach_club,
       (select coalesce(json_agg(json_build_object('id', cr.id, 'title', cr.title, 'org', cr.org_name,
           'from', cr.started_year, 'to', cr.ended_year) order by cr.ended_year desc nulls first, cr.started_year desc nulls last), '[]'::json)
        from coach_role cr join coach_profile cp2 on cp2.id = cr.coach_profile_id where cp2.person_id = p.id) as roles,
       (select coalesce(json_agg(json_build_object('id', cc.id, 'url', cc.url, 'title', cc.title) order by cc.sort, cc.created_at), '[]'::json)
        from coach_clip cc join coach_profile cp3 on cp3.id = cc.coach_profile_id where cp3.person_id = p.id) as clips,
       (select coalesce(json_agg(json_build_object('id', l.id, 'title', l.title, 'issuer', l.issuer, 'year', l.year) order by l.year desc nulls last, l.sort), '[]'::json)
        from coach_licence l join coach_profile cp4 on cp4.id = l.coach_profile_id where cp4.person_id = p.id) as licences,
       (select coalesce(json_agg(json_build_object('id', a.id, 'title', a.title, 'detail', a.detail) order by a.sort), '[]'::json)
        from coach_achievement a join coach_profile cp5 on cp5.id = a.coach_profile_id where cp5.person_id = p.id) as wins
     from person p
     left join coach_profile cp on cp.person_id = p.id
     where p.id = $1`,
    [me],
  );
  if (rows.length === 0) redirect('/signin');
  const c = rows[0];
  const roles: { id: string; title: string; org: string; from: string | null; to: string | null }[] = c.roles;
  const clips: { id: string; url: string; title: string }[] = c.clips ?? [];
  const licences: { id: string; title: string; issuer: string | null; year: string | null }[] = c.licences ?? [];
  const wins: { id: string; title: string; detail: string | null }[] = c.wins ?? [];
  // Live = published and not taken down (0043). An under-18 can hold neither
  // a link nor a contact (0042), so for them the card says when it opens.
  const live = Boolean(c.public_slug) && !c.hidden_at && c.adult;
  const pageUrl = c.public_slug ? `pitchfootball.com.au/c/${c.public_slug}` : null;

  return (
    <CoachConsole active="edit">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your coach CV</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Five minutes. Edit anything later.</div>
        </div>
        {saved && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Saved.{live ? ` Live at pitchfootball.com.au/c/${c.public_slug}` : ''}</div>}
        {published && live && <div role="status" style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Your page is live. Copy the link below and paste it wherever you talk to clubs and families.</div>}
        {hidden && !live && <div role="status" style={{ ...card, fontSize: 13, fontWeight: 700, color: T.secondary }}>Your page is down. The link won&rsquo;t open until you publish again.</div>}
        {clip === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Give it a title, and a YouTube, Veo or Instagram link.</div>}
        {photo === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That file didn&rsquo;t work. A PNG or JPEG under 8MB.</div>}
        {banner === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That file didn&rsquo;t work. A JPEG or PNG under 12MB, landscape if you have one.</div>}

        {/* Coaches were the only profile in the product with no photo at all
            — players have one, clubs have a crest and a banner, and a coach
            rendered initials. They are adults publishing their own likeness
            on their own CV, which is the least fraught photo here. */}
        <form action="/coach/edit/photo" method="post" encType="multipart/form-data" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Your photo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 66, height: 66, borderRadius: 20, background: T.surface2, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {c.photo_path
                ? <img src={c.photo_path} alt="" width={66} height={66} style={{ objectFit: 'cover' }} />
                : <span style={{ fontWeight: 900, fontSize: 22, color: T.muted }}>{`${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              {c.photo_path ? 'Upload another to replace it.' : 'No photo yet — your page shows your initials until you add one.'}
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose a photo</span>
            <span className="filefield-hint">PNG or JPEG, under 8MB.</span>
          </label>
          <button type="submit" className="btn btn-secondary">Save the photo</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            We re-save the image ourselves, which removes any location data the file was carrying. A head-and-shoulders shot works best — it is cropped to a square.
          </div>
        </form>
        {clip === 'full' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That&rsquo;s {COACH_CLIP_CAP} clips — remove one to add another. A reel is a shortlist, not an archive.</div>}
        {clip === 'noprofile' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Save your profile first, then add clips.</div>}

        <form action={saveCoachProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={card}>
              <div style={label}>Full name</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
            </div>
            <label style={card}>
              <div style={label}>Region</div>
              <input style={input} name="region" aria-label="Region" defaultValue={c.region ?? ''} placeholder="Melbourne, VIC" />
            </label>
            {/* A public contact is an adult's (0042): an under-18 is never
                contactable, so the field is not offered at all. */}
            {c.adult && (
              <label style={card}>
                <div style={label}>How clubs reach you — optional</div>
                <input style={input} name="publicContact" aria-label="Public contact" type="email" placeholder="you@example.com"
                  defaultValue={c.public_contact ?? ''} />
                <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5, marginTop: 6 }}>
                  Shown on your public page to clubs and other adults, and never to a signed-in under-18. Leave it blank and no contact route appears at all.
                </div>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>How you want to play</div>
            <label style={card}>
              <textarea name="philosophy" aria-label="Coaching philosophy" defaultValue={c.philosophy ?? ''} rows={3} placeholder="Possession with purpose. Every player touches the ball every drill, every session — confidence first, patterns second." style={{ ...input, fontWeight: 500, fontSize: 13.5, lineHeight: 1.55, resize: 'vertical' }} />
            </label>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>The part a technical director actually reads, and the part a parent decides on. Say it the way you&rsquo;d say it at the coffee.</div>
          </div>

          <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 15, padding: 15, fontSize: 15, fontWeight: 900, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Save &amp; preview</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={label}>Where you&rsquo;ve coached</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.placeholder }}>Newest first</div>
          </div>
          {roles.map((r) => (
            <div key={r.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{r.title}</div>
                  {!r.to && <div style={{ background: 'rgba(61,220,132,.14)', color: T.accent, borderRadius: 7, padding: '2px 7px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current</div>}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{r.org} · {r.from} — {r.to ?? 'now'}</div>
              </div>
              <form action={removeRole}><input type="hidden" name="roleId" value={r.id} />
                <button type="submit" style={{ minHeight: 44, minWidth: 44, padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          {/* A banner, composed behind the photo the way the club page does it.
            Same route controls as the club's: re-encoded, EXIF stripped,
            capped, and authorised against this coach's own profile. */}
        <form action="/coach/edit/banner" method="post" encType="multipart/form-data" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Banner</div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: 'var(--hero)' }}>
            {c.banner_path ? (
              <div style={{ position: 'relative', lineHeight: 0 }}>
                <img src={c.banner_path} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,21,16,0) 42%, rgba(10,21,16,.78) 100%)' }} />
              </div>
            ) : (
              <div style={{ width: '100%', height: 110, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: T.muted, fontWeight: 500 }}>No banner yet</div>
            )}
            <div style={{ position: 'relative', zIndex: 1, padding: '0 14px 12px 14px' }}>
              <div style={{ width: 56, height: 56, marginTop: -26, borderRadius: 16, background: '#1b2b22', border: '3px solid #0e1b14', boxShadow: '0 0 0 1px rgba(238,245,240,.18), 0 8px 20px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {c.photo_path
                  ? <img src={c.photo_path} alt="" width={56} height={56} style={{ objectFit: 'cover' }} />
                  : <span style={{ fontWeight: 900, fontSize: 19, color: T.muted }}>{`${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`}</span>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.015em', marginTop: 7 }}>{c.first_name} {c.last_name}</div>
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="banner" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose a banner</span>
            <span className="filefield-hint">A wide photo — your ground, a session, a team shot. Cropped to a strip, and your photo sits over the bottom-left of it.</span>
          </label>
          <button type="submit" className="btn btn-secondary">Save the banner</button>
        </form>

        {/* Licences were one pipe-separated box — fine for one credential,
            useless for a coach who holds five, and with nowhere to say who
            issued it or when. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>Licences &amp; qualifications</div>
          {licences.map((l) => (
            <div key={l.id} style={{ ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{l.title}</div>
                {(l.issuer || l.year) && (
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{[l.issuer, l.year].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              <form action={removeLicence}><input type="hidden" name="licenceId" value={l.id} />
                <button type="submit" style={{ minHeight: 44, minWidth: 44, padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addLicence} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Licence</div>
              <input style={input} name="title" aria-label="Title" placeholder="e.g. AFC B Diploma" required maxLength={80} />
            </label>
            <label style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Who issued it — optional</div>
              <input style={input} name="issuer" aria-label="Who issued it" placeholder="e.g. Football Australia" maxLength={80} />
            </label>
            <label style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Year — optional</div>
              <input style={input} name="year" aria-label="Year" placeholder="e.g. 2024" maxLength={20} />
            </label>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add a licence</button>
          </form>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            These are your own account and your page says so. We don&rsquo;t check them and they unlock nothing — the only credential on your page a club confirmed is your Working With Children Check.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>What you&rsquo;ve done as a coach</div>
          {wins.map((a) => (
            <div key={a.id} style={{ ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{a.title}</div>
                {a.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{a.detail}</div>}
              </div>
              <form action={removeCoachAchievement}><input type="hidden" name="achievementId" value={a.id} />
                <button type="submit" style={{ minHeight: 44, minWidth: 44, padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addCoachAchievement} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>What happened</div>
              <input style={input} name="title" aria-label="Title" placeholder="e.g. Promotion to State League 1" required maxLength={90} />
            </label>
            <label style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Where and when — optional</div>
              <input style={input} name="detail" aria-label="Where and when" placeholder="e.g. Riverside FC U15 Boys, 2026" maxLength={90} />
            </label>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add an accomplishment</button>
          </form>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>Keep it about the team, not about a child.</b> &ldquo;Promotion with the U15s&rdquo; is right; naming a player under 18 is not — the same rule as your session titles.
          </div>
        </div>

        <form action={addRole} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={card}><div style={label}>Role</div><input style={input} name="title" aria-label="Title" placeholder="Head Coach · U15 Boys" required /></label>
              <label style={card}><div style={label}>Club or program</div><input style={input} name="org" aria-label="Club or program" placeholder="Riverside FC" required /></label>
              <label style={card}><div style={label}>From</div><input style={input} name="from" aria-label="From" placeholder="2024" /></label>
              <label style={card}><div style={label}>To — blank if current</div><input style={input} name="to" aria-label="To" placeholder="" /></label>
            </div>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add a role</button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>Sessions &amp; clips · {clips.length} of {COACH_CLIP_CAP}</div>
          {clips.map((v) => (
            <div key={v.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{v.title}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.url}</div>
              </div>
              <form action={removeCoachClip}><input type="hidden" name="clipId" value={v.id} />
                <button type="submit" style={{ height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 13px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          {clips.length < COACH_CLIP_CAP && (
            <form action={addCoachClip} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={label}>Title</div>
                <input style={input} name="title" aria-label="Title" placeholder="U14 session — pressing patterns" required maxLength={80} />
              </label>
              <label style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={label}>Link</div>
                <input style={input} name="url" aria-label="Link" placeholder="https://www.youtube.com/watch?v=…" required />
              </label>
              <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add a clip</button>
              <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                YouTube, Veo or Instagram. The video stays where it is — we keep the link, and nothing loads until someone presses play.
              </div>
              <div style={{ fontSize: 12, color: T.secondary, fontWeight: 500, lineHeight: 1.55, borderTop: `1px solid ${T.line}`, paddingTop: 9 }}>
                <b style={{ color: T.ink }}>Title the session, never a child.</b> &ldquo;U14 session — pressing patterns&rdquo; is right; naming a player under 18 is not. You know what is in your own footage; we only ever see the title.
              </div>
            </form>
          )}
        </div>

        {/* Publishing (D-75, D-100; 0043). The link card used to sit on the
            PUBLIC page, where it was furniture for the coach and noise for
            whoever was reading them. It belongs here, with the switch. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>Your public page</div>
          {!c.adult ? (
            <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Your coach page can go public once you turn 18. Until then you can build it here and nobody else sees it.
            </div>
          ) : live ? (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Link href={`/c/${c.public_slug}`} style={{ fontSize: 14, fontWeight: 800, color: T.accent, textDecoration: 'none', overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center' }}>{pageUrl}</Link>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Live. Anyone with the link can read your page.</div>
              <CopyLink url={`https://${pageUrl}`} label="Copy the link" />
              <form action={hideCoachPage} style={{ display: 'flex' }}>
                <button type="submit" className="btn btn-secondary">Take my page down</button>
              </form>
              <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
                Taking it down stops the link opening for anyone who has it. Publish again and the same link works again.
              </div>
            </div>
          ) : (
            <form action={publishCoachPage} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                {c.public_slug
                  ? <>Your page is down. Publish it again and <b style={{ color: T.ink }}>{pageUrl}</b> opens again.</>
                  : 'Publish it and you get a link to paste wherever you talk to clubs and families. Anyone with the link can read your page.'}
              </div>
              <button type="submit" className="btn btn-primary">Publish my page</button>
            </form>
          )}
        </div>

        <Link href="/jobs" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Coaching roles at clubs</Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>Working With Children Check</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: c.wwcc ? 'rgba(61,220,132,.14)' : 'rgba(237,161,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c.wwcc ? T.accent : T.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{c.wwcc ? `Confirmed by ${c.wwcc_club}` : `Waiting on ${c.coach_club ?? 'your club'}`}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              <b style={{ color: T.ink }}>Your club confirms it, not you.</b> We asked {c.coach_club ?? 'your club'} to confirm you hold a current check. Don&rsquo;t send us the number — we don&rsquo;t store it and there&rsquo;s nowhere to put it.
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Your CV publishes without it. Verification is what unlocks anything to do with players, and it&rsquo;s free on every tier.</div>
        </div>
      </div>
    </CoachConsole>
  );
}
