// ShareApproval — the guardian sees the EXACT image, behind sign-in, before
// it exists anywhere else (D-101). The one sentence that matters is not
// softened: once it's out, we can't take it back.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { approveCard } from './actions';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function CardApproval({ params, searchParams }: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ approved?: string }>;
}) {
  const { cardId } = await params;
  const { approved } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select sca.card_kind, sca.approved_at, p.first_name
     from share_card_approval sca
     join development_record dr on dr.id = sca.record_id
     join person p on p.id = dr.person_id
     join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where sca.id = $1`,
    [cardId, me],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name: string = c.first_name;
  const done = approved || c.approved_at;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name} made a card</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{done ? `Approved. It's ${name}'s to post.` : 'This is the exact card'}</div>
          {!done && <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Not a description of it — the image itself. Nothing exists anywhere until you say yes.</div>}
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/g/card/${cardId}/image`} alt={`Card for ${name}`} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        </div>

        {!done ? (
          <>
            <div className="card-sunken" style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              If you approve it, {name} can save it and post it wherever they like. <b style={{ color: T.ink }}>Once it&rsquo;s out, we can&rsquo;t take it back</b> — that&rsquo;s true of any image on any platform, and we&rsquo;d rather say so than pretend we have a switch we don&rsquo;t have.
            </div>
            <form action={approveCard.bind(null, cardId)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
              <button type="submit" className="btn btn-primary">Approve this card</button>
              <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Not this one</div>
            </form>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Saved as approved. The image {name} posts is byte-for-byte the one you just looked at.</div>
        )}
      </div>
    </div>
  );
}
