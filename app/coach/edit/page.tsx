// BuildCoachCV.dc.html — the coach editor, copy verbatim. WWCC card renders
// the attested (verified) or waiting-on-club variant; the number has nowhere
// to go and the copy says so plainly (D-98).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { imageSrc } from '@/lib/storage';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';
import Link from 'next/link';
import { addCoachAchievement, addCoachClip, addLicence, addRole, hideCoachPage, publishCoachPage, removeCoachAchievement, removeCoachClip, removeLicence, removeRole, saveCoachProfile } from './actions';
import CopyLink from '@/components/cv/CopyLink';
import { FAILURE_COPY } from '@/components/FailureState';
import PremiumRows from '@/components/PremiumRows';
import { COACH_CLIP_CAP } from '@/lib/football';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Build your coach CV', robots: { index: false, follow: false } };

// Floodlit (spec E, BUZ 1 Oct): one panel per form, every field the one
// .field well, the charter's two buttons and a 44px text button for Remove.
// The "＋" glyph on the four add buttons is a stroke plus. Every word, form
// action and field name is unchanged.
const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);

export default async function CoachEdit({ searchParams }: { searchParams: Promise<{ saved?: string; clip?: string; photo?: string; banner?: string; removed?: string; published?: string; hidden?: string; needs?: string; first?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // `needs` was declared nowhere and destructured nowhere: actions.ts sends
  // a coach here as ?needs=profile when a licence or an accomplishment is
  // saved before the coach page itself exists, and the page added zero words
  // — the press looked as though it had done nothing.
  const { saved, clip, photo, banner, published, hidden, needs, first } = await searchParams;
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
  // Their own photo, as an address for this read (John's ruling §1).
  c.photo_path = await imageSrc(c.photo_path);
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
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div className="pg-titles">
          <h1 className="pg-title">Build your coach CV</h1>
          <div className="pg-sub">Five minutes. Edit anything later.</div>
        </div>
        {/* The notice slot (A's notice): accent for Saved and Live, amber for
            every "didn't work", a plain panel for "Your page is down". */}
        {saved && <div className="card card-accent note">Saved.{live ? ` Live at pitchfootball.com.au/c/${c.public_slug}` : ''}</div>}
        {published && live && <div role="status" className="card card-accent note">Your page is live. Copy the link below and paste it wherever you talk to clubs and families.</div>}
        {hidden && !live && <div role="status" className="card note">Your page is down. The link won&rsquo;t open until you publish again.</div>}
        {clip === 'bad' && <div className="card card-amber note">Give it a title, and a YouTube, Veo or Instagram link.</div>}
        {photo === 'bad' && <div className="card card-amber note">That file didn&rsquo;t work. A PNG or JPEG under 8MB.</div>}
        {banner === 'bad' && <div className="card card-amber note">That file didn&rsquo;t work. A JPEG or PNG under 12MB, landscape if you have one.</div>}
        {needs === 'profile' && <div role="alert" className="card card-amber note">{FAILURE_COPY.coachNeedsProfile}</div>}

        {/* Coaches were the only profile in the product with no photo at all
            — players have one, clubs have a crest and a banner, and a coach
            rendered initials. They are adults publishing their own likeness
            on their own CV, which is the least fraught photo here. */}
        <form action="/coach/edit/photo" method="post" encType="multipart/form-data" className="card panel">
          <div className="pn-t">Your photo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="av66">
              {c.photo_path
                ? <img src={c.photo_path} alt="" width={66} height={66} style={{ objectFit: 'cover' }} />
                : <span>{`${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`}</span>}
            </div>
            <div className="quiet" style={{ fontSize: 12.5 }}>
              {c.photo_path ? 'Upload another to replace it.' : 'No photo yet — your page shows your initials until you add one.'}
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose a photo</span>
            <span className="filefield-hint">PNG or JPEG, under 8MB.</span>
          </label>
          <button type="submit" className="btn btn-secondary">Save the photo</button>
          <div className="quiet">
            We re-save the image ourselves, which removes any location data the file was carrying. A head-and-shoulders shot works best — it is cropped to a square.
          </div>
        </form>
        {/* A banner, composed behind the photo the way the club page does it.
            Same route controls as the club's: re-encoded, EXIF stripped,
            capped, and authorised against this coach's own profile. E3 (BUZ, 1 Oct):
            it sits under Your photo, the two uploads together; a JSX slip had
            nested it inside Where you've coached. */}
        <form action="/coach/edit/banner" method="post" encType="multipart/form-data" className="card panel">
          <div className="pn-t">Banner</div>
          <div className="banprev">
            {c.banner_path ? (
              <div className="banprev-img">
                <img src={c.banner_path} alt="" />
              </div>
            ) : (
              <div className="banprev-none empty-tile">No banner yet</div>
            )}
            <div className="banprev-who">
              <div className="banprev-av">
                {c.photo_path
                  ? <img src={c.photo_path} alt="" width={56} height={56} style={{ objectFit: 'cover' }} />
                  : <span>{`${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`}</span>}
              </div>
              <div className="banprev-nm">{c.first_name} {c.last_name}</div>
            </div>
          </div>
          <label className="filefield">
            <input type="file" name="banner" accept="image/png,image/jpeg,image/webp" required />
            <span className="filefield-title">Choose a banner</span>
            <span className="filefield-hint">A wide photo — your ground, a session, a team shot. Cropped to a strip, and your photo sits over the bottom-left of it.</span>
          </label>
          <button type="submit" className="btn btn-secondary">Save the banner</button>
        </form>

        {clip === 'full' && <div className="card card-amber note">That&rsquo;s {COACH_CLIP_CAP} clips — remove one to add another. A reel is a shortlist, not an archive.</div>}
        {clip === 'noprofile' && <div className="card card-amber note">Save your profile first, then add clips.</div>}

        <form action={saveCoachProfile} className="card panel" style={{ gap: 16 }}>
          <div className="stack8">
            <div className="field">
              <div className="field-label">Full name</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
            </div>
            <label className="field">
              <div className="field-label">Region</div>
              <input name="region" aria-label="Region" defaultValue={c.region ?? ''} placeholder="Melbourne, VIC" />
            </label>
            {/* A public contact is an adult's (0042): an under-18 is never
                contactable, so the field is not offered at all. */}
            {c.adult && (
              <label className="field">
                <div className="field-label">How clubs reach you — optional</div>
                <input name="publicContact" aria-label="Public contact" type="email" placeholder="you@example.com"
                  defaultValue={c.public_contact ?? ''} />
                <div className="field-help">
                  Shown on your public page to clubs and other adults, and never to a signed-in under-18. Leave it blank and no contact route appears at all.
                </div>
              </label>
            )}
          </div>

          <div className="stack8">
            <div className="panel-h">How you want to play</div>
            <label className="field">
              <textarea name="philosophy" aria-label="Coaching philosophy" defaultValue={c.philosophy ?? ''} rows={3} placeholder="Possession with purpose. Every player touches the ball every drill, every session — confidence first, patterns second." />
            </label>
            <div className="quiet">The part a technical director actually reads, and the part a parent decides on. Say it the way you&rsquo;d say it at the coffee.</div>
          </div>

          <button type="submit" className="btn btn-primary fl-glow">Save &amp; preview</button>
        </form>

        <section className="stack8">
          <h2 className="sec-h">Where you&rsquo;ve coached<span className="sec-aside">Newest first</span></h2>
          {roles.length > 0 && (
            <div className="card rows">
              {roles.map((r) => (
                <div key={r.id} className="row">
                  <div className="row-main">
                    <div className="row-t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{r.title}</span>
                      {!r.to && <span className="pill">Current</span>}
                    </div>
                    <div className="row-s">{r.org} · {r.from} — {r.to ?? 'now'}</div>
                  </div>
                  <form action={removeRole}><input type="hidden" name="roleId" value={r.id} />
                    <button type="submit" className="textbtn">Remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {/* E3 (BUZ, 1 Oct): the add-role form sits under the roles it adds
              to. It was four sections further down on a phone. */}
          <form action={addRole} className="card panel">
            <div className="grid2">
              <label className="field"><div className="field-label">Role</div><input name="title" aria-label="Title" placeholder="Head Coach · U15 Boys" required /></label>
              <label className="field"><div className="field-label">Club or program</div><input name="org" aria-label="Club or program" placeholder="Riverside FC" required /></label>
              <label className="field"><div className="field-label">From</div><input name="from" aria-label="From" placeholder="2024" /></label>
              <label className="field"><div className="field-label">To — blank if current</div><input name="to" aria-label="To" placeholder="" /></label>
            </div>
            <button type="submit" className="btn btn-secondary btn-ic"><Plus />Add a role</button>
          </form>
        </section>

        {/* Licences were one pipe-separated box — fine for one credential,
            useless for a coach who holds five, and with nowhere to say who
            issued it or when. */}
        <section className="stack9">
          <h2 className="sec-h">Licences &amp; qualifications</h2>
          {licences.length > 0 && (
            <div className="card rows">
              {licences.map((l) => (
                <div key={l.id} className="row">
                  <div className="row-main">
                    <div className="row-t">{l.title}</div>
                    {(l.issuer || l.year) && (
                      <div className="row-s">{[l.issuer, l.year].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  <form action={removeLicence}><input type="hidden" name="licenceId" value={l.id} />
                    <button type="submit" className="textbtn">Remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={addLicence} className="card panel">
            <label className="field">
              <div className="field-label">Licence</div>
              <input name="title" aria-label="Title" placeholder="e.g. AFC B Diploma" required maxLength={80} />
            </label>
            <div className="pair2">
              <label className="field">
                <div className="field-label">Who issued it — optional</div>
                <input name="issuer" aria-label="Who issued it" placeholder="e.g. Football Australia" maxLength={80} />
              </label>
              <label className="field">
                <div className="field-label">Year — optional</div>
                <input name="year" aria-label="Year" placeholder="e.g. 2024" maxLength={20} />
              </label>
            </div>
            <button type="submit" className="btn btn-secondary btn-ic"><Plus />Add a licence</button>
          </form>
          <div className="quiet">
            These are your own account and your page says so. We don&rsquo;t check them and they unlock nothing — the only credential on your page a club confirmed is your Working With Children Check.
          </div>
        </section>

        <section className="stack9">
          <h2 className="sec-h">What you&rsquo;ve done as a coach</h2>
          {wins.length > 0 && (
            <div className="card rows">
              {wins.map((a) => (
                <div key={a.id} className="row">
                  <div className="row-main">
                    <div className="row-t">{a.title}</div>
                    {a.detail && <div className="row-s">{a.detail}</div>}
                  </div>
                  <form action={removeCoachAchievement}><input type="hidden" name="achievementId" value={a.id} />
                    <button type="submit" className="textbtn">Remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={addCoachAchievement} className="card panel">
            <div className="pair2">
              <label className="field">
                <div className="field-label">What happened</div>
                <input name="title" aria-label="Title" placeholder="e.g. Promotion to State League 1" required maxLength={90} />
              </label>
              <label className="field">
                <div className="field-label">Where and when — optional</div>
                <input name="detail" aria-label="Where and when" placeholder="e.g. Riverside FC U15 Boys, 2026" maxLength={90} />
              </label>
            </div>
            <button type="submit" className="btn btn-secondary btn-ic"><Plus />Add an accomplishment</button>
          </form>
          <div className="quiet">
            <b>Keep it about the team, not about a child.</b> &ldquo;Promotion with the U15s&rdquo; is right; naming a player under 18 is not — the same rule as your session titles.
          </div>
        </section>

        <section className="stack8">
          <h2 className="sec-h">Sessions &amp; clips · {clips.length} of {COACH_CLIP_CAP}</h2>
          {clips.length > 0 && (
            <div className="card rows">
              {clips.map((v) => (
                <div key={v.id} className="row">
                  <div className="row-main">
                    <div className="row-t">{v.title}</div>
                    <div className="row-s ellip">{v.url}</div>
                  </div>
                  <form action={removeCoachClip}><input type="hidden" name="clipId" value={v.id} />
                    <button type="submit" className="textbtn">Remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {clips.length < COACH_CLIP_CAP && (
            <form action={addCoachClip} className="card panel">
              <label className="field">
                <div className="field-label">Title</div>
                <input name="title" aria-label="Title" placeholder="U14 session — pressing patterns" required maxLength={80} />
              </label>
              <label className="field">
                <div className="field-label">Link</div>
                <input name="url" aria-label="Link" placeholder="https://www.youtube.com/watch?v=…" required />
              </label>
              <button type="submit" className="btn btn-secondary btn-ic"><Plus />Add a clip</button>
              <div className="quiet" style={{ color: T.secondary }}>
                YouTube, Veo or Instagram. The video stays where it is — we keep the link, and nothing loads until someone presses play.
              </div>
              <div className="quiet" style={{ color: T.secondary, borderTop: `1px solid ${T.line}`, paddingTop: 9 }}>
                <b>Title the session, never a child.</b> &ldquo;U14 session — pressing patterns&rdquo; is right; naming a player under 18 is not. You know what is in your own footage; we only ever see the title.
              </div>
            </form>
          )}
          {/* D-164 (4): two locked Premium rows, an adult's page only. A
              16–17 who coaches MiniRoos never sees a paid surface (D-82). */}
          {c.adult && <PremiumRows on="coach" tapped={first === '1'} />}
        </section>

        {/* Publishing (D-75, D-100; 0043). The link card used to sit on the
            PUBLIC page, where it was furniture for the coach and noise for
            whoever was reading them. It belongs here, with the switch. */}
        <section className="stack8">
          <h2 className="sec-h">Your public page</h2>
          {!c.adult ? (
            <div className="card" style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Your coach page can go public once you turn 18. Until then you can build it here and nobody else sees it.
            </div>
          ) : live ? (
            <div className="card panel" style={{ gap: 11 }}>
              <Link href={`/c/${c.public_slug}`} style={{ fontSize: 14, fontWeight: 800, color: T.accent, textDecoration: 'none', overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center' }}>{pageUrl}</Link>
              <div className="quiet" style={{ fontSize: 12.5, marginTop: -6 }}>Live. Anyone with the link can read your page.</div>
              <CopyLink url={`https://${pageUrl}`} label="Copy the link" />
              <form action={hideCoachPage} style={{ display: 'flex' }}>
                <button type="submit" className="btn btn-secondary">Take my page down</button>
              </form>
              <div className="quiet" style={{ fontSize: 11.5 }}>
                Taking it down stops the link opening for anyone who has it. Publish again and the same link works again.
              </div>
            </div>
          ) : (
            <form action={publishCoachPage} className="card panel" style={{ gap: 11 }}>
              <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                {c.public_slug
                  ? <>Your page is down. Publish it again and <b style={{ color: T.ink }}>{pageUrl}</b> opens again.</>
                  : 'Publish it and you get a link to paste wherever you talk to clubs and families. Anyone with the link can read your page.'}
              </div>
              <button type="submit" className="btn btn-primary">Publish my page</button>
            </form>
          )}
        </section>

        <Link href="/jobs" className="btn btn-secondary">Coaching roles at clubs</Link>

        <section className="stack8">
          <h2 className="sec-h">Working With Children Check</h2>
          <div className="card panel" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-well)', background: c.wwcc ? 'rgba(61,220,132,.14)' : 'rgba(237,161,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c.wwcc ? T.accent : T.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{c.wwcc ? `Confirmed by ${c.wwcc_club}` : `Waiting on ${c.coach_club ?? 'your club'}`}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              {/* EC4 (BUZ, 1 Oct): with no club membership nobody was asked, so
                  the "We asked" sentence is said only when there is a club. */}
              <b style={{ color: T.ink }}>Your club confirms it, not you.</b>{c.coach_club ? ` We asked ${c.coach_club} to confirm you hold a current check.` : ''} Don&rsquo;t send us the number — we don&rsquo;t store it and there&rsquo;s nowhere to put it.
            </div>
          </div>
          <div className="quiet">Your CV publishes without it. Verification is what unlocks anything to do with players, and it&rsquo;s free on every tier.</div>
        </section>
      </div>
    </CoachConsole>
  );
}
