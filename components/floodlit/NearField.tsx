'use client';
// Distance's field: "Suburb or postcode", worked out on this device (trials
// board filters, BUZ approved 2 Oct; John, 2 Oct, Q1 and Q4). A combobox over
// the Victorian places file, which is fetched whole the first time the field
// is focused — before anything is typed, the same bytes for everyone — so the
// request says nothing about what anybody types.
//
// What is typed lives in the board's React state and nowhere else (John's
// conditions, and the permission suite's tf-near checks hold the source to
// them): the input has no name and sits in no form, so nothing can submit
// it and Enter does nothing; autocomplete is off, so the browser does not
// remember a child's home suburb in its own form history; spellcheck,
// autocorrect and autocapitalise are off, so no spelling service is sent
// it; nothing writes the address bar, the history, storage, a cookie or an
// analytics event; and a reload forgets it. No geolocation, ever.
import { useId, useState } from 'react';
import { PLACES_FILE } from '@/lib/places-vic-file';

// [name, postcode, lat, lng, council] — lib/places-vic's shape.
export type Place = [string, number, number, number, number];
export type Picked = { label: string; at: [number, number] };

let loading: Promise<Place[]> | null = null;
const loadPlaces = () => {
  loading ??= fetch(PLACES_FILE).then((r) => r.json()).then((d: { places: Place[] }) => d.places)
    .catch(() => { loading = null; return []; });
  return loading;
};

// Matches as typed: a name that starts with the text, or a word in it that
// does ("Pres" → Preston, "West" → Brunswick West), or a postcode that
// starts with the digits. At most eight, in the file's alphabetical order —
// never by distance, never by anything about the family.
function search(places: Place[], text: string): Place[] {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return [];
  const digits = /^\d+$/.test(t);
  const out: Place[] = [];
  for (const p of places) {
    const name = p[0].toLowerCase();
    if (digits ? String(p[1]).startsWith(t) : name.startsWith(t) || name.includes(` ${t}`)) out.push(p);
    if (out.length === 8) break;
  }
  return out;
}

export default function NearField({ headingId, text, setText, picked, onPick, onClear }: {
  headingId: string; text: string; setText: (t: string) => void; picked: Picked | null;
  onPick: (p: Picked) => void; onClear: () => void;
}) {
  const id = useId();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = places && !picked ? search(places, text) : [];
  const nothing = Boolean(places) && !picked && text.trim().length >= 2 && matches.length === 0;
  const listOpen = open && matches.length > 0;
  const pick = (p: Place) => { onPick({ label: `${p[0]} ${p[1]}`, at: [p[2], p[3]] }); setOpen(false); };

  return (
    <div className="near">
      <div className={picked || open ? 'near-field on' : 'near-field'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="near-ic"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          className="near-in" type="text" role="combobox" placeholder="Suburb or postcode"
          aria-labelledby={headingId} aria-expanded={listOpen} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={listOpen ? `${id}-o${active}` : undefined}
          autoComplete="off" spellCheck={false} autoCorrect="off" autoCapitalize="off" inputMode="search" enterKeyHint="done"
          value={picked ? picked.label : text}
          onFocus={() => { if (!places) loadPlaces().then(setPlaces); setOpen(true); }}
          onChange={(e) => { if (picked) onClear(); setText(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % matches.length); }
            else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
            else if (e.key === 'Enter') { e.preventDefault(); if (listOpen && matches[active]) pick(matches[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        />
        {(picked || text) && (
          <button type="button" className="near-x" aria-label="Clear suburb" onClick={() => { onClear(); setOpen(false); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      {listOpen && (
        <ul className="near-list" role="listbox" id={`${id}-list`} aria-labelledby={headingId}>
          {matches.map((p, i) => (
            <li key={`${p[0]}-${p[1]}`} id={`${id}-o${i}`} role="option" aria-selected={i === active} className="near-opt"
              // mousedown, not click: the input's blur closes the list first.
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
              <span>{p[0]}</span><span className="pc">{p[1]}</span>
            </li>
          ))}
        </ul>
      )}
      {nothing && <div className="near-none" role="status">No Victorian suburb or postcode matches that.</div>}
    </div>
  );
}
