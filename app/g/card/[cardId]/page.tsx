// ShareApproval — the guardian sees the EXACT image, behind sign-in, before
// it exists anywhere else (D-101). The one sentence that matters is not
// softened: once it's out, we can't take it back.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, ParentPage } from '@/components/parent-sheet';
import { approveCard } from './actions';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Share card', robots: { index: false, follow: false } };

export default async function CardApproval({ params, searchParams }: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ approved?: string }>;
}) {
  const { cardId } = await params;
  const { approved } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // A malformed id reaches Postgres as a uuid cast and throws, which is a
  // 500 on a screen a guardian opens from an SMS. Same answer as a row
  // that is not there.
  if (!isUuid(cardId)) notFound();

  const { rows } = await db.query(
    `select sca.card_kind, sca.approved_at, p.first_name
     from share_card_approval sca
     join development_record dr on dr.id = sca.record_id
     join person p on p.id = dr.person_id
     where sca.id = $1 and fn_guardian_controls($2, p.id)  -- 0177: never an adult's parent`,
    [cardId, me],
  );
  if (rows.length === 0) notFound();
  const c = rows[0];
  const name: string = c.first_name;
  const done = approved || c.approved_at;

  return (
    <ParentPage>
      <HeaderMark back={{ href: '/home', label: 'Your family' }} />
      <AskHead initial={name[0]} kicker={`${name} made a card`}
        title={done ? `Approved. It's ${name}'s to post.` : 'This is the exact card'}
        sub={done ? undefined : 'Not a description of it — the image itself. Nothing exists anywhere until you say yes.'} />

      {/* The exact image, never cropped; from 1024 held to 420px so the
          answer stays near the fold. */}
      <div className="card pd-cardframe">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/g/card/${cardId}/image`} alt={`Card for ${name}`} />
      </div>

      {!done ? (
        <>
          <div className="card-sunken" style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            If you approve it, {name} can save it and post it wherever they like. <b style={{ color: T.ink }}>Once it&rsquo;s out, we can&rsquo;t take it back</b> — that&rsquo;s true of any image on any platform, and we&rsquo;d rather say so than pretend we have a switch we don&rsquo;t have.
          </div>
          {/* D-PD-0: two equal answers, nothing glows. D-PD-1: the No writes
              nothing and goes where the back link and silence already go
              (D-138). An <a>, never a second form. */}
          <div className="fl-answer">
            <form action={approveCard}><input type="hidden" name="cardId" value={cardId} />
              <button type="submit" className="btn btn-secondary">Approve this card</button>
            </form>
            <Link href="/home" className="btn btn-secondary">Not this one</Link>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Saved as approved. The image {name} posts is byte-for-byte the one you just looked at.</div>
      )}
    </ParentPage>
  );
}
