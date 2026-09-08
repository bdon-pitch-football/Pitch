// BuildCoachCV.dc.html — the coach editor, copy verbatim. WWCC card renders
// the attested (verified) or waiting-on-club variant; the number has nowhere
// to go and the copy says so plainly (D-98).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import Link from 'next/link';
import { addCoachClip, addRole, removeCoachClip, removeRole, saveCoachProfile } from './actions';
import { COACH_CLIP_CAP } from '@/lib/football';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function CoachEdit({ searchParams }: { searchParams: Promise<{ saved?: string; clip?: string; removed?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { saved, clip } = await searchParams;
  const { rows } = await db.query(
    `select p.first_name, coalesce(p.last_name,'') as last_name, cp.public_contact,
       cp.region, cp.philosophy, cp.badges, cp.public_slug,
       exists(select 1 from wwcc_attestation w where w.person_id = p.id and w.revoked_at is null) as wwcc,
       (select c.name from wwcc_attestation w join club c on c.id = w.club_id where w.person_id = p.id and w.revoked_at is null limit 1) as wwcc_club,
       (select c2.name from membership m join club c2 on c2.id = m.club_id where m.person_id = p.id and m.role = 'coach' and m.ended_at is null limit 1) as coach_club,
       (select coalesce(json_agg(json_build_object('id', cr.id, 'title', cr.title, 'org', cr.org_name,
           'from', cr.started_year, 'to', cr.ended_year) order by cr.sort), '[]'::json)
        from coach_role cr join coach_profile cp2 on cp2.id = cr.coach_profile_id where cp2.person_id = p.id) as roles,
       (select coalesce(json_agg(json_build_object('id', cc.id, 'url', cc.url, 'title', cc.title) order by cc.sort, cc.created_at), '[]'::json)
        from coach_clip cc join coach_profile cp3 on cp3.id = cc.coach_profile_id where cp3.person_id = p.id) as clips
     from person p
     left join coach_profile cp on cp.person_id = p.id
     where p.id = $1`,
    [me],
  );
  if (rows.length === 0) redirect('/signin');
  const c = rows[0];
  const roles: { id: string; title: string; org: string; from: string | null; to: string | null }[] = c.roles;
  const clips: { id: string; url: string; title: string }[] = c.clips ?? [];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your coach CV</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Five minutes. Edit anything later.</div>
        </div>
        {saved && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Saved.{c.public_slug ? ` Live at pitchfootball.com.au/${c.public_slug}` : ''}</div>}
        {clip === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Give it a title, and a YouTube, Veo or Instagram link.</div>}
        {clip === 'full' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That&rsquo;s {COACH_CLIP_CAP} clips — remove one to add another. A reel is a shortlist, not an archive.</div>}
        {clip === 'noprofile' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Save your profile first, then add clips.</div>}

        <form action={saveCoachProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={card}>
              <div style={label}>Full name</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
            </div>
            <div style={card}>
              <div style={label}>Region</div>
              <input style={input} name="region" defaultValue={c.region ?? ''} placeholder="Melbourne, VIC" />
          <div style={card}>
            <div style={label}>How clubs reach you — optional</div>
            <input style={input} name="publicContact" type="email" placeholder="you@example.com"
              defaultValue={c.public_contact ?? ''} />
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5, marginTop: 6 }}>
              Shown on your public page to clubs and other adults, and never to a signed-in under-18. Leave it blank and no contact route appears at all.
            </div>
          </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Badges — separate with |</div>
            <div style={card}>
              <input style={input} name="badges" defaultValue={(c.badges ?? []).join(' | ')} placeholder="AFC C Diploma | Community C" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>How you want to play</div>
            <div style={card}>
              <textarea name="philosophy" defaultValue={c.philosophy ?? ''} rows={3} placeholder="Possession with purpose. Every player touches the ball every drill, every session — confidence first, patterns second." style={{ ...input, fontWeight: 500, fontSize: 13.5, lineHeight: 1.55, resize: 'vertical' }} />
            </div>
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
              <form action={removeRole.bind(null, r.id)}>
                <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addRole} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={card}><div style={label}>Role</div><input style={input} name="title" placeholder="Head Coach · U15 Boys" required /></div>
              <div style={card}><div style={label}>Club or program</div><input style={input} name="org" placeholder="Riverside FC" required /></div>
              <div style={card}><div style={label}>From</div><input style={input} name="from" placeholder="2024" /></div>
              <div style={card}><div style={label}>To — blank if current</div><input style={input} name="to" placeholder="" /></div>
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
              <form action={removeCoachClip.bind(null, v.id)}>
                <button type="submit" style={{ height: 36, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 13px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          {clips.length < COACH_CLIP_CAP && (
            <form action={addCoachClip} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={label}>Title</div>
                <input style={input} name="title" placeholder="U14 session — pressing patterns" required maxLength={80} />
              </div>
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={label}>Link</div>
                <input style={input} name="url" placeholder="https://www.youtube.com/watch?v=…" required />
              </div>
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
    </div>
  );
}
