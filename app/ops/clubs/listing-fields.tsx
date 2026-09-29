// The fields of a club listing (brief I, 0130): the same labelled 44px wells
// the call sheet uses (OpsCall.dc.html), on the add screen and the club's own
// screen. Every label and placeholder here is one the product already shows —
// the call sheet's "Name", "Email address" and "Where you found it", the
// trials board's two states — except "Suburb", which is new (held).
import { T } from '@/lib/palette';
import { sectionLabel } from '@/lib/ui';

const star = <span style={{ color: T.red }}> *</span>;

export type Listing = { name: string; suburb: string | null; state: string | null; contact_email: string | null; listing_source: string | null };

function Field({ name, label, required, placeholder, type, value }: {
  name: string; label: string; required?: boolean; placeholder?: string; type?: string; value?: string | null;
}) {
  return (
    <label className="ops-field">
      <span style={sectionLabel}>{label}{required ? star : null}</span>
      <input className="ops-input" name={name} type={type} required={required} placeholder={placeholder} defaultValue={value ?? undefined} />
    </label>
  );
}

export function ListingFields({ c }: { c?: Listing }) {
  return (
    <>
      <div className="ops-pair">
        <Field name="name" label="Name" required value={c?.name} />
        <Field name="suburb" label="Suburb" required value={c?.suburb} />
        <label className="ops-field">
          <span style={sectionLabel}>State{star}</span>
          {/* D-04: Victoria and New South Wales, the two the board filters by. */}
          <select className="ops-input" name="state" required defaultValue={c?.state ?? 'VIC'}>
            <option value="VIC">Victoria</option>
            <option value="NSW">New South Wales</option>
          </select>
        </label>
        <Field name="contact" label="Email address" type="email" placeholder="football@yourclub.com.au" value={c?.contact_email} />
      </div>
      <Field name="source" label="Where you found it" required placeholder="e.g. club website /contact, FV club directory" value={c?.listing_source} />
    </>
  );
}
