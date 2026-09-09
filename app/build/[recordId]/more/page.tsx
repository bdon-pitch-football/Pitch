// Achievements + other football — the generic repeatable-component pattern
// (CLAUDE.md build order §3). Chip + free text for experience entries; the
// entry grants access to nobody, ever (D-72).
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { EXPERIENCE_KIND_LABELS, OTHER_FOOTBALL_KINDS, PREVIOUS_CLUB } from '@/lib/football';
import { requireRecordActor } from '@/lib/record-guard';
import { addAchievement, addExperience, removeAchievement, removeExperience } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function More({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  // Was `if (production) notFound()` — a deploy flag standing in for a
  // permission check. It is the record's own actor or their guardian, and
  // nobody else, in every environment.
  await requireRecordActor(recordId);
  const { rows } = await db.query(
    `select
       (select coalesce(json_agg(json_build_object('id', id, 'title', title, 'detail', detail) order by sort), '[]'::json)
        from achievement where record_id=$1) as achievements,
       (select coalesce(json_agg(json_build_object('id', id, 'kind', kind, 'orgName', org_name, 'period', season_label) order by created_at), '[]'::json)
        from experience_entry where record_id=$1 and kind <> 'previous_club') as other,
       (select coalesce(json_agg(json_build_object('id', id, 'orgName', org_name, 'period', season_label) order by season_label desc nulls last, created_at desc), '[]'::json)
        from experience_entry where record_id=$1 and kind = 'previous_club') as clubs
     from development_record where id=$1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  const achievements: { id: string; title: string; detail: string | null }[] = rows[0].achievements;
  const other: { id: string; kind: string; orgName: string; period: string | null }[] = rows[0].other;
  const clubs: { id: string; orgName: string; period: string | null }[] = rows[0].clubs;

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
  const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, width: '100%' };
  const section: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: `/build/${recordId}`, label: 'Back to the CV' }} />
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your football history</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>The clubs you&rsquo;ve been at, what you&rsquo;ve won, and the football outside your club.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={section}>Clubs before this one</div>
          {clubs.map((e) => (
            <div key={e.id} style={{ ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{e.orgName}</div>
                {e.period && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.period}</div>}
              </div>
              <form action={removeExperience.bind(null, recordId, e.id)}>
                <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addExperience.bind(null, recordId)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="kind" value={PREVIOUS_CLUB} />
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Club</div>
              <input style={input} name="orgName" placeholder="e.g. Northcote City FC" required maxLength={80} />
            </div>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Years — optional</div>
              <input style={input} name="period" placeholder="e.g. 2022–2024" maxLength={40} />
            </div>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add a club</button>
          </form>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            Your club now is the one you registered with — it&rsquo;s already at the top of your page. These are the ones before it, in your own words. Typing a club here does not tell them anything and does not let them see your page.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={section}>Achievements</div>
          {achievements.map((a) => (
            <div key={a.id} style={{ ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{a.title}</div>
                {a.detail && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{a.detail}</div>}
              </div>
              <form action={removeAchievement.bind(null, recordId, a.id)}>
                <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addAchievement.bind(null, recordId)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Achievement</div>
              <input style={input} name="title" placeholder="e.g. U15 League — Runners up" required maxLength={80} />
            </div>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>When / where — optional</div>
              <input style={input} name="detail" placeholder="e.g. 2026 season" maxLength={80} />
            </div>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add achievement</button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={section}>Other football</div>
          {other.map((e) => (
            <div key={e.id} style={{ ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ background: 'rgba(61,220,132,.12)', color: T.accent, borderRadius: 7, padding: '3px 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{EXPERIENCE_KIND_LABELS[e.kind as keyof typeof EXPERIENCE_KIND_LABELS]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{e.orgName}</div>
                {e.period && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.period}</div>}
              </div>
              <form action={removeExperience.bind(null, recordId, e.id)}>
                <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Remove</button>
              </form>
            </div>
          ))}
          <form action={addExperience.bind(null, recordId)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={label}>Kind</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {OTHER_FOOTBALL_KINDS.map((k, i) => (
                  <label key={k} style={{ cursor: 'pointer' }}>
                    <input type="radio" name="kind" value={k} defaultChecked={i === 0} style={{ position: 'absolute', opacity: 0 }} />
                    <span style={{ display: 'inline-block', borderRadius: 999, padding: '6px 11px', fontSize: 12, fontWeight: 800, background: T.surface2, color: T.secondary, border: `1px solid ${T.line}` }}>{EXPERIENCE_KIND_LABELS[k]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>Where</div>
              <input style={input} name="orgName" placeholder="e.g. Melbourne Futsal U15" required maxLength={80} />
            </div>
            <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={label}>When — optional</div>
              <input style={input} name="period" placeholder="e.g. Summer 2025–26" maxLength={40} />
            </div>
            <button type="submit" style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 12, height: 44, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add other football</button>
          </form>
        </div>
      </div>
    </div>
  );
}
