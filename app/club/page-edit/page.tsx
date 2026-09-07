// The club's own page, editable. Today this is the crest — the one thing the
// brief specified (D-74) that was never wired up: club.crest_path has existed
// since the first migration and nothing read or wrote it, so every club page
// rendered an initials block.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function ClubPageEdit({ searchParams }: {
  searchParams: Promise<{ saved?: string; crest?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { saved, crest } = await searchParams;

  const { rows } = await db.query(
    `select c.id, c.name, c.crest_path, c.public_slug from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your club page</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>{c.name}</div>
        </div>

        {saved && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Crest saved. It&rsquo;s on your page now.</div>}
        {crest === 'bad' && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That file didn&rsquo;t work. A PNG or JPEG under 8MB.</div>}

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
          <input type="file" name="crest" accept="image/png,image/jpeg,image/webp" required
            style={{ fontSize: 13, color: T.secondary, fontFamily: 'inherit' }} />
          <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Save the crest</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            We re-save the image ourselves, which removes any location data the file was carrying. It is sized to fit rather than cropped square, so a tall badge keeps its shape.
          </div>
        </form>

        {c.public_slug && (
          <Link href={`/fc/${c.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>See your public page</Link>
        )}
        <Link href="/home" style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: T.muted, textDecoration: 'none', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Back</Link>
      </div>
    </div>
  );
}
