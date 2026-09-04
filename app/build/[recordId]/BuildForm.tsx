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
  surfaced_stats: string[]; stats: Record<string, number>; has_pending: boolean;
}

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default function BuildForm({ record, saved }: { record: RecordData; saved: boolean }) {
  const [positions, setPositions] = useState<string[]>(record.positions ?? []);
  const [surfaced, setSurfaced] = useState<string[]>(record.surfaced_stats?.length ? record.surfaced_stats : ['apps', 'goals', 'assists']);
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const toggleStat = (k: string) =>
    setSurfaced((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const act = saveDraft.bind(null, record.id);

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your CV</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Two minutes. Edit anything later.</div>
        </div>
        {saved && (
          <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>
            Saved. {record.has_pending ? 'Your parent will see this change before it goes out.' : ''}
          </div>
        )}
        {/* photo leads the build screen: every good CV has one */}
        <form action={`/build/${record.id}/photo`} method="post" encType="multipart/form-data" style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
          {record.photo_path ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={record.photo_path} alt="" width={52} height={52} style={{ borderRadius: 16, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, border: '1.5px dashed #3a4a42', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8 h2.5 l1.5-2 h6 l1.5 2 H19 a1.5 1.5 0 0 1 1.5 1.5 v8 A1.5 1.5 0 0 1 19 19 H5 a1.5 1.5 0 0 1-1.5-1.5 v-8 A1.5 1.5 0 0 1 5 8 Z" /><circle cx="12" cy="13" r="3.2" /></svg>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Add profile photo</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: T.muted }}>Optional</div>
          </div>
          <input type="file" name="photo" accept="image/*" required style={{ width: 108, fontSize: 11, color: T.muted, fontFamily: 'inherit' }} />
          <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 11, height: 36, padding: '0 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Upload</button>
        </form>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="positions" value={positions.join(',')} />
          <input type="hidden" name="surfaced" value={surfaced.join(',')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={card}>
              <div style={label}>Full name</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{record.first_name} {record.last_name}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 8 }}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={label}>Positions</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: T.placeholder }}>Up to 3 · tap to order</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.keys(POSITIONS) as PositionCode[]).map((code) => {
                    const idx = positions.indexOf(code);
                    return (
                      <button type="button" key={code} onClick={() => toggle(code)} style={{
                        borderRadius: 999, padding: '6px 11px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                        fontWeight: idx === 0 ? 900 : 800,
                        background: idx === 0 ? T.accent : idx > 0 ? 'rgba(61,220,132,.14)' : 'transparent',
                        color: idx === 0 ? T.onAccent : idx > 0 ? T.accent : T.placeholder,
                        border: idx >= 0 ? '1px solid transparent' : `1px dashed #3a4a42`,
                      }}>
                        {idx >= 0 && <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.6, marginRight: 4 }}>{idx + 1}</span>}
                        {POSITIONS[code].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <div style={label}>Number</div>
                <input style={{ ...input, textAlign: 'center', fontSize: 20, fontWeight: 900, color: T.accent }} name="squadNumber" type="number" min="1" max="99" defaultValue={record.squad_number ?? ''} placeholder="—" />
              </div>
            </div>
            <div style={card}>
              <div style={label}>Preferred foot</div>
              <select name="foot" defaultValue={record.foot ?? ''} style={{ ...input, appearance: 'none' }}>
                <option value="">—</option><option>Right</option><option>Left</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>About</div>
            <div style={card}>
              <textarea name="about" defaultValue={record.about} rows={3} placeholder="Right-footed 10 who plays between the lines. Working on my weak foot and pressing triggers…" style={{ ...input, fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Season stats · self-reported</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.accent }}>Tap a name to show or hide it</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {STAT_KEYS.map((k: StatKey) => (
                <div key={k} style={{ ...card, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: surfaced.includes(k) ? 1 : 0.45 }}>
                  <input style={{ ...input, textAlign: 'center', fontSize: 19, fontWeight: 900 }} name={`stat_${k}`} type="number" min="0" defaultValue={record.stats[k] ?? ''} placeholder="—" />
                  <button type="button" onClick={() => toggleStat(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: surfaced.includes(k) ? T.accent : T.muted, fontFamily: 'inherit' }}>{STAT_LABELS[k]}</button>
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
