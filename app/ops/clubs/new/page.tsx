// Add an unclaimed club listing (brief I; D-64, D-90; 0130). Name, suburb,
// state, the club's own public contact address, and where the details came
// from — required, as number_source is on the call sheet. The listing is
// `unclaimed`, so its page carries the D-64 disclaimer it carries for every
// unclaimed listing, and the club claims it later through /claim, unchanged:
// the claim code goes to the address entered here, and nowhere else.
//
// The database refuses a duplicate by name and suburb, and names the operator
// on the listing and in the log (fn_ops_add_club). Held with its words.
import { notFound } from 'next/navigation';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';
import { addClub } from '../actions';
import { ListingFields } from '../listing-fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add a club', robots: { index: false, follow: false } };

export default async function AddClub({ searchParams }: {
  searchParams: Promise<{ error?: string; request?: string; name?: string; suburb?: string; state?: string; contact?: string }>;
}) {
  await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  const { error, request, name, suburb, state, contact } = await searchParams;
  // From a club's ask (0159): the form starts with what the club told us.
  const asked = request ? { name: name ?? '', suburb: suburb ?? null, state: state === 'NSW' ? 'NSW' : 'VIC',
    contact_email: contact ?? null, listing_source: 'Asked by the club on Pitch; address checked on its website' } : undefined;
  return (
    <OpsConsole active="clubs">
      <div className="console ops-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Add a club" back={{ href: '/ops/clubs', label: 'Clubs' }} />
        {error && (
          <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>
            {error === 'dup' ? 'A club with that name and suburb is already listed.' : 'Fill in the name, suburb, state and where you found it.'}
          </div>
        )}
        <form action={addClub} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ListingFields c={asked} />
            {request && <input type="hidden" name="request" value={request} />}
          </div>
          <button type="submit" className="btn btn-primary">Add a club</button>
        </form>
      </div>
    </OpsConsole>
  );
}
