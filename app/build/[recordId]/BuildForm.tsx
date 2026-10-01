'use client';
// BuildProfile.dc.html — copy verbatim. The stat inputs show muted
// placeholders, never pre-filled zeros (D-70): a blank stays blank.
import { useState } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, STAT_KEYS, STAT_LABELS, STAT_SETS, positionGroup, type PositionCode, type StatKey } from '@/lib/football';
import { saveDraft } from './actions';
import { T } from '@/lib/palette';
import { BuildHeader, G, Say } from '@/components/player-parts';

interface RecordData {
  id: string; first_name: string; last_name: string; photo_path: string | null; positions: string[];
  squad_number: number | null; foot: string | null; about: string;
  surfaced_stats: string[]; stats: Record<string, number>; has_pending: boolean; clips: number;
}

export default function BuildForm({ record, saved, photoBad, children }: { record: RecordData; saved: boolean; photoBad?: boolean; children?: React.ReactNode }) {
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [positions, setPositions] = useState<string[]>(record.positions ?? []);
  // Tracked so the progress line answers the screen as it is NOW, not as it
  // was when the page loaded: filling a field should move the bar.
  const [num, setNum] = useState<string>(record.squad_number == null ? '' : String(record.squad_number));
  const [about, setAbout] = useState<string>(record.about ?? '');
  // A zero is never printed as a value, here least of all: a form showing 0
  // reads as already-saved and invites people to leave it (D-70, generalised
  // by D-162). An absent stat and a zero both open as the muted placeholder,
  // and saving a blank removes the row rather than writing one.
  const [stats, setStats] = useState<Record<string, string>>(
    Object.fromEntries(STAT_KEYS.map((k) => [k, record.stats?.[k] ? String(record.stats[k]) : ''])),
  );
  // D-105: the form OPENS with this position's set pre-ticked and the player
  // changes it from there. STAT_SETS is that default and was imported by
  // nothing — the outfield three were typed in here instead, so a goalkeeper
  // opened their own page with Goals and Assists lit and Clean sheets dimmed.
  // It is a default selection, never a renderer: the player still chooses, and
  // the never-zero rule still decides what a chosen stat does on the page.
  //
  // The default follows the positions being PICKED, not only the ones already
  // stored, because a record is created with no positions at all (join and the
  // guardian flow both insert bare) — so a keeper's first visit has nothing to
  // be position-aware about yet, and a default read once at mount would hand
  // every new keeper the outfield set and never correct itself. A stored
  // choice wins, and from the first tap the selection is the player's own and
  // follows nothing.
  const defaultSurfaced: string[] = [...STAT_SETS[positionGroup(positions)]];
  const [chosen, setChosen] = useState<string[] | null>(record.surfaced_stats?.length ? record.surfaced_stats : null);
  const surfaced = chosen ?? defaultSurfaced;
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const toggleStat = (k: string) =>
    setChosen((c) => {
      const cur = c ?? defaultSurfaced;
      return cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    });
  const act = saveDraft;

  // Six things make a page worth sending, and they are the same six /home
  // counts. Each is a real field — nothing here is a score.
  const steps = [
    Boolean(record.photo_path),
    positions.length > 0,
    num.trim() !== '',
    about.trim() !== '',
    Object.values(stats).some((v) => v.trim() !== ''),
    record.clips > 0,
  ];
  const done = steps.filter(Boolean).length;

  return (
    <div style={{ width: '100%', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading build-col" style={{ width: '100%', padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        {/* The builder's header (spec C; C-P2): the same on all three steps.
            The progress fill and the current step are facts, not actions, so
            neither is green (D-173 (4)). */}
        <BuildHeader recordId={record.id} title="Build your CV" sub="Two minutes. Edit anything later." done={done} total={steps.length} here="Your football" preview />
        {saved && (
          // Purple when the change is now the parent's to see (D-119).
          <Say tone={record.has_pending ? 'purple' : 'accent'}>
            Saved. {record.has_pending ? 'Your parent will see this change before it goes out.' : ''}
          </Say>
        )}
        {/* C-P6 (BUZ, 1 Oct): the photo route sends a bad file, a file over
            8 MB or a storage failure back here with ?photo=bad, and the page
            used to say nothing. The words are the ones /coach/edit and
            /club/page-edit already say for the same refusal (BUZ, 1 Oct).
            8 MB is the route's own cap (photo/route.ts). */}
        {photoBad && <Say tone="amber" role="status">That file didn&rsquo;t work. A PNG or JPEG under 8MB.</Say>}
        <div className="build-grid">
          {/* THE CARD (spec C): the five fields the card draws — photo, name,
              positions, number, foot — on the card's own gradient, the squad
              number standing behind them as it does on the CV. Never a club's
              colours here (D-89; only the CV may wear them, D-174).
              The photo upload is its own form and forms cannot nest, so the
              number and the foot sit here, outside the story form, and join
              it with form="cv". A browser posts them with the rest, with or
              without JavaScript; the posted fields are the ones it always
              posted. */}
          <div className="cv-edit">
            {num.trim() !== '' && <div className="cv-num" aria-hidden>{num}</div>}
            {/* photo leads the build screen: every good CV has one. One big
                target instead of a squeezed row: choosing a photo uploads it
                straight away. Without JavaScript the Upload button appears
                once a file is chosen (globals.css .photo-form), so the form
                still works. */}
            <form action={`/build/${record.id}/photo`} method="post" encType="multipart/form-data" className="photo-form cv-edit-stack"
              onSubmit={() => setUploading(true)} style={{ gap: 12 }}>
              <div className="photo-row">
                {record.photo_path ? (
                  <div className="cv-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={record.photo_path} alt="" width={92} height={92} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div className="cv-avatar dash" aria-hidden>{G.cam()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* N2 (BUZ, 1 Oct): the title stops asking for a photo
                      that is already there. */}
                  <div className="photo-t">{record.photo_path ? 'Profile photo' : 'Add profile photo'}</div>
                  <div className="photo-s">Optional, but every good CV has one.</div>
                </div>
              </div>
              <label className="filefield">
                <input type="file" name="photo" aria-label="Add profile photo" accept="image/*" required
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;
                    setPhotoName(file.name);
                    setUploading(true);
                    e.currentTarget.form?.requestSubmit();
                  }} />
                <span className="filefield-title">{uploading ? 'Uploading…' : photoName ?? (record.photo_path ? 'Choose a new photo' : 'Choose a photo')}</span>
                <span className="filefield-hint">JPG or PNG.</span>
              </label>
              <button type="submit" className="btn btn-secondary photo-save">Upload photo</button>
            </form>
            <div className="cv-edit-stack" style={{ gap: 3 }}>
              <div className="field-label">Full name</div>
              <div className="name-v">{record.first_name} {record.last_name}</div>
            </div>
            {/* Positions take the full width so all ten codes sit in two rows
                of five at 44px (BUZ, 16 Sep). The full names of what's picked
                show underneath, so a young player never has to guess what "DM"
                means. The first pick is the one the card leads with. */}
            <div className="cv-edit-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <div className="field-label">Positions</div>
                <div className="hint-r">Up to 3 · tap to order</div>
              </div>
              <div className="pos-grid">
                {(Object.keys(POSITIONS) as PositionCode[]).map((code) => {
                  const idx = positions.indexOf(code);
                  return (
                    <button type="button" key={code} onClick={() => toggle(code)} className={idx === 0 ? 'pos lead' : 'pos'}
                      aria-pressed={idx >= 0}
                      aria-label={`${POSITIONS[code].label}${idx >= 0 ? `, choice ${idx + 1}` : ''}`} title={POSITIONS[code].label}>
                      {idx >= 0 && <i>{idx + 1}</i>}
                      {code}
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite" className={positions.length ? 'pos-line' : 'pos-line none'}>
                {positions.length
                  ? positions.map((c, i) => `${i + 1} ${POSITIONS[c as PositionCode].label}`).join(' · ')
                  : 'Not sure what a code means? Tap it and the full name shows here.'}
              </div>
            </div>
            <div className="cv-edit-two">
              <label className="field">
                <span className="field-label">Number</span>
                <input className="num-in" form="cv" name="squadNumber" aria-label="Squad number" type="number" min="1" max="99" value={num} onChange={(e) => setNum(e.target.value)} placeholder="—" />
              </label>
              <label className="field">
                <span className="field-label">Preferred foot</span>
                <select form="cv" name="foot" aria-label="Preferred foot" defaultValue={record.foot ?? ''}>
                  <option value="">—</option><option>Right</option><option>Left</option>
                </select>
              </label>
            </div>
          </div>
          <form id="cv" action={act} className="build-story"><input type="hidden" name="recordId" value={record.id} />
            <input type="hidden" name="positions" value={positions.join(',')} />
            {/* Posted only once the player has chosen. Absent means "I have not
                touched this", and the server then applies the default for the
                positions it is saving — which is the only way a keeper who has
                JavaScript switched off gets the keeper's set (D-105). */}
            {chosen !== null && <input type="hidden" name="surfaced" value={chosen.join(',')} />}
            <div className="c-gap">
              <h2 className="sec-h">About</h2>
              <label className="field">
                <textarea name="about" aria-label="About" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Right-footed 10 who plays between the lines. Working on my weak foot and pressing triggers…" />
              </label>
            </div>
            <div className="c-gap">
              {/* At 390 the two labels together are wider than the column, so
                  the heading keeps its own line and the hint drops under it.
                  The hint is a fact about the tiles, not an action: secondary. */}
              <div className="hint-line">
                <h2 className="sec-h">Season stats · self-reported</h2>
                <div className="h">Tap a name to show or hide it</div>
              </div>
              {/* The toggle's words stay bare inside the button (pv-r2 and the
                  write suite read them by aria-pressed). */}
              <div className="stats4">
                {STAT_KEYS.map((k: StatKey) => (
                  <div key={k} className={surfaced.includes(k) ? 'stat-in' : 'stat-in off'}>
                    <input name={`stat_${k}`} aria-label={STAT_LABELS[k]} type="number" min="0" value={stats[k] ?? ''} onChange={(e) => setStats((v) => ({ ...v, [k]: e.target.value }))} placeholder="—" />
                    <button type="button" onClick={() => toggleStat(k)} aria-pressed={surfaced.includes(k)}>{STAT_LABELS[k]}</button>
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary fl-glow">Save &amp; preview</button>
          </form>
          {children}
        </div>
      </div>
    </div>
  );
}
