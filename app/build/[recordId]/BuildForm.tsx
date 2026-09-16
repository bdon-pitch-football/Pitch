'use client';
// BuildProfile.dc.html — copy verbatim. The stat inputs show muted
// placeholders, never pre-filled zeros (D-70): a blank stays blank.
import { useState } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, STAT_KEYS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';
import { saveDraft } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c',
};

interface RecordData {
  id: string; first_name: string; last_name: string; photo_path: string | null; positions: string[];
  squad_number: number | null; foot: string | null; about: string;
  surfaced_stats: string[]; stats: Record<string, number>; has_pending: boolean; clips: number;
}

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default function BuildForm({ record, saved }: { record: RecordData; saved: boolean }) {
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [positions, setPositions] = useState<string[]>(record.positions ?? []);
  // Tracked so the progress line answers the screen as it is NOW, not as it
  // was when the page loaded: filling a field should move the bar.
  const [num, setNum] = useState<string>(record.squad_number == null ? '' : String(record.squad_number));
  const [about, setAbout] = useState<string>(record.about ?? '');
  const [stats, setStats] = useState<Record<string, string>>(
    Object.fromEntries(STAT_KEYS.map((k) => [k, record.stats?.[k] == null ? '' : String(record.stats[k])])),
  );
  const [surfaced, setSurfaced] = useState<string[]>(record.surfaced_stats?.length ? record.surfaced_stats : ['apps', 'goals', 'assists']);
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const toggleStat = (k: string) =>
    setSurfaced((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
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
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your CV</h1>
            <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Two minutes. Edit anything later.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Your page</div>
              <div aria-live="polite" style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{done} of {steps.length} done</div>
            </div>
            <div aria-hidden style={{ height: 6, borderRadius: 999, background: T.surface2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 999, background: T.accent, transition: 'width .3s cubic-bezier(.22,1,.36,1)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <div aria-current="page" style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, background: T.accent, color: T.onAccent, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em' }}>Your football</div>
            <a href={`/build/${record.id}/clips`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, background: T.surface2, border: `1px solid ${T.line}`, color: T.secondary, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>Highlights</a>
            <a href={`/build/${record.id}/more`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, background: T.surface2, border: `1px solid ${T.line}`, color: T.secondary, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>Achievements</a>
          </div>
        </div>
        {saved && (
          <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>
            Saved. {record.has_pending ? 'Your parent will see this change before it goes out.' : ''}
          </div>
        )}
        {/* photo leads the build screen: every good CV has one. One big target
            instead of a squeezed row: choosing a photo uploads it straight
            away. Without JavaScript the Upload button appears once a file is
            chosen (globals.css .photo-form), so the form still works. */}
        <form action={`/build/${record.id}/photo`} method="post" encType="multipart/form-data" className="photo-form"
          onSubmit={() => setUploading(true)}
          style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: T.surface2, border: record.photo_path ? `1px solid ${T.line}` : '1.5px dashed #3a4a42', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {record.photo_path ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={record.photo_path} alt="" width={64} height={64} style={{ objectFit: 'cover' }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 8 h2.5 l1.5-2 h6 l1.5 2 H19 a1.5 1.5 0 0 1 1.5 1.5 v8 A1.5 1.5 0 0 1 19 19 H5 a1.5 1.5 0 0 1-1.5-1.5 v-8 A1.5 1.5 0 0 1 5 8 Z" /><circle cx="12" cy="13" r="3.2" /></svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>Add profile photo</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.muted }}>Optional, but every good CV has one.</div>
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
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><input type="hidden" name="recordId" value={record.id} />
          <input type="hidden" name="positions" value={positions.join(',')} />
          <input type="hidden" name="surfaced" value={surfaced.join(',')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={card}>
              <div style={label}>Full name</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{record.first_name} {record.last_name}</div>
            </div>
            {/* Positions take the full width so all ten codes sit in two rows of
                five at 44px (BUZ, 16 Sep). The full names of what's picked show
                underneath, so a young player never has to guess what "DM" means. */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={label}>Positions</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: T.placeholder }}>Up to 3 · tap to order</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                {(Object.keys(POSITIONS) as PositionCode[]).map((code) => {
                  const idx = positions.indexOf(code);
                  return (
                    <button type="button" key={code} onClick={() => toggle(code)}
                      aria-label={`${POSITIONS[code].label}${idx >= 0 ? `, choice ${idx + 1}` : ''}`} title={POSITIONS[code].label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
                      minHeight: 44, borderRadius: 999, padding: '6px 0', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
                      fontWeight: idx === 0 ? 900 : 800,
                      background: idx === 0 ? T.accent : idx > 0 ? 'rgba(61,220,132,.14)' : 'transparent',
                      color: idx === 0 ? T.onAccent : idx > 0 ? T.accent : T.placeholder,
                      border: idx >= 0 ? '1px solid transparent' : `1px dashed #3a4a42`,
                    }}>
                      {idx >= 0 && <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.6, marginRight: 3 }}>{idx + 1}</span>}
                      {code}
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite" style={{ fontSize: 12.5, fontWeight: 600, color: positions.length ? T.secondary : T.placeholder, marginTop: 9, lineHeight: 1.45 }}>
                {positions.length
                  ? positions.map((c, i) => `${i + 1} ${POSITIONS[c as PositionCode].label}`).join(' · ')
                  : 'Not sure what a code means? Tap it and the full name shows here.'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 8 }}>
              <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <div style={label}>Number</div>
                <input style={{ ...input, textAlign: 'center', fontSize: 20, fontWeight: 900, color: T.accent }} name="squadNumber" aria-label="Squad number" type="number" min="1" max="99" value={num} onChange={(e) => setNum(e.target.value)} placeholder="—" />
              </div>
              <div style={card}>
              <div style={label}>Preferred foot</div>
              <select name="foot" aria-label="Preferred foot" defaultValue={record.foot ?? ''}>
                <option value="">—</option><option>Right</option><option>Left</option>
              </select>
            </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>About</div>
            <div style={card}>
              <textarea name="about" aria-label="About" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Right-footed 10 who plays between the lines. Working on my weak foot and pressing triggers…" style={{ ...input, fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* At 390 the two labels together are wider than the column, so
                the heading used to break mid-phrase beside the hint. Each
                keeps its own line now, and the hint drops underneath. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 12, rowGap: 3 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, whiteSpace: 'nowrap' }}>Season stats · self-reported</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, whiteSpace: 'nowrap' }}>Tap a name to show or hide it</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {STAT_KEYS.map((k: StatKey) => (
                <div key={k} style={{ ...card, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: surfaced.includes(k) ? 1 : 0.45 }}>
                  <input style={{ ...input, textAlign: 'center', fontSize: 19, fontWeight: 900 }} name={`stat_${k}`} aria-label={STAT_LABELS[k]} type="number" min="0" value={stats[k] ?? ''} onChange={(e) => setStats((v) => ({ ...v, [k]: e.target.value }))} placeholder="—" />
                  <button type="button" onClick={() => toggleStat(k)} style={{ minHeight: 44, width: '100%', margin: '0 0 -10px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: surfaced.includes(k) ? T.accent : T.muted, fontFamily: 'inherit' }}>{STAT_LABELS[k]}</button>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 15, padding: 15, fontSize: 15, fontWeight: 900, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>Save &amp; preview</button>
        </form>
      </div>
    </div>
  );
}
