// Achievements + other football — the generic repeatable-component pattern
// (CLAUDE.md build order §3). Chip + free text for experience entries; the
// entry grants access to nobody, ever (D-72).
import { notFound } from 'next/navigation';
import { PlayerFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { EXPERIENCE_KIND_LABELS, experienceKindsOffered, PREVIOUS_CLUB } from '@/lib/football';
import { requireRecordAuthor } from '@/lib/record-guard';
import { addAchievement, addExperience, removeAchievement, removeExperience } from './actions';
import { buildProgress } from '@/lib/build-progress';
import { BuildHeader, G } from '@/components/player-parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'More about you', robots: { index: false, follow: false } };

export default async function More({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  // Was `if (production) notFound()` — a deploy flag standing in for a
  // permission check. It is the record's owner, or the guardian of an
  // under-16 (N-10, 0169), and nobody else, in every environment.
  await requireRecordAuthor(recordId);
  // The band comes from the database (fn_age_band, derived from the date of
  // birth at read time, never stored — D-49) because it decides which kinds
  // this record may be offered: no school for an under-18 (D-161).
  //
  // The list itself is NOT filtered, deliberately. This is the family's own
  // editor, behind requireRecordAuthor, and an entry written before the rule
  // is their own words: it renders nowhere public any more, and they keep the
  // one control over it that matters — Remove. Nothing here deletes a row.
  const { rows } = await db.query(
    `select
       (select fn_age_band(p.dob) from person p where p.id = development_record.person_id) as band,
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
  const kinds = experienceKindsOffered(rows[0].band);

  const { done, total } = await buildProgress(recordId);

  // Remove in a list is the 44px text button (Head of Product Design ruling 2).
  const remove = (action: typeof removeExperience, field: string, id: string) => (
    <form action={action}><input type="hidden" name="recordId" value={recordId} /><input type="hidden" name={field} value={id} />
      <button type="submit" className="textbtn">Remove</button>
    </form>
  );

  return (
    <PlayerFrame active="cv">
      <div className="reading build-col" style={{ width: '100%', padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: `/build/${recordId}`, label: 'Back to the CV' }} />
        {/* C-P2 (BUZ, 1 Oct): the builder's header on all three steps. */}
        <BuildHeader recordId={recordId} title="Your football history" sub="The clubs you’ve been at, what you’ve won, and the football outside your club." done={done} total={total} here="Achievements" />

        {/* Three lists on the page, each a Panel list, each add form a panel
            under its list. No primary on this page, so nothing glows. */}
        <section className="c-gap">
          <h2 className="sec-h">Clubs before this one</h2>
          {clubs.length > 0 && (
            <div className="card rows">
              {clubs.map((e) => (
                <div key={e.id} className="row">
                  <div className="row-main">
                    <div className="row-t" style={{ fontSize: 13.5 }}>{e.orgName}</div>
                    {e.period && <div className="row-s" style={{ fontSize: 12 }}>{e.period}</div>}
                  </div>
                  {remove(removeExperience, 'experienceId', e.id)}
                </div>
              ))}
            </div>
          )}
          <form action={addExperience} className="card cv-edit-stack"><input type="hidden" name="recordId" value={recordId} />
            <input type="hidden" name="kind" value={PREVIOUS_CLUB} />
            <label className="field">
              <span className="field-label">Club</span>
              <input name="orgName" aria-label="Where" placeholder="e.g. Ashvale Lions FC" required maxLength={80} />
            </label>
            <label className="field">
              <span className="field-label">Years — optional</span>
              <input name="period" aria-label="When" placeholder="e.g. 2022–2024" maxLength={40} />
            </label>
            {/* N3 (BUZ, 1 Oct): the "＋" character goes; a stroke plus sits in
                the button. Same words. */}
            <button type="submit" className="btn btn-secondary" style={{ gap: 8 }}>{G.plus()}Add a club</button>
          </form>
          <div className="c-help" style={{ lineHeight: 1.55 }}>
            Your club now is the one you registered with — it&rsquo;s already at the top of your page. These are the ones before it, in your own words. Typing a club here does not tell them anything and does not let them see your page.
          </div>
        </section>

        <section className="c-gap">
          <h2 className="sec-h">Achievements</h2>
          {achievements.length > 0 && (
            <div className="card rows">
              {achievements.map((a) => (
                <div key={a.id} className="row">
                  <div className="row-main">
                    <div className="row-t" style={{ fontSize: 13.5 }}>{a.title}</div>
                    {a.detail && <div className="row-s" style={{ fontSize: 12 }}>{a.detail}</div>}
                  </div>
                  {remove(removeAchievement, 'achievementId', a.id)}
                </div>
              ))}
            </div>
          )}
          <form action={addAchievement} className="card cv-edit-stack"><input type="hidden" name="recordId" value={recordId} />
            <label className="field">
              <span className="field-label">Achievement</span>
              <input name="title" aria-label="Achievement" placeholder="e.g. U15 League — Runners up" required maxLength={80} />
            </label>
            <label className="field">
              <span className="field-label">When / where — optional</span>
              <input name="detail" aria-label="When or where" placeholder="e.g. 2026 season" maxLength={80} />
            </label>
            <button type="submit" className="btn btn-secondary" style={{ gap: 8 }}>{G.plus()}Add achievement</button>
          </form>
        </section>

        <section className="c-gap">
          <h2 className="sec-h">Other football</h2>
          {other.length > 0 && (
            <div className="card rows">
              {other.map((e) => (
                <div key={e.id} className="row">
                  {/* The kind is a fact, so a neutral Pill, not a green tag. */}
                  <span className="pill nodot">{EXPERIENCE_KIND_LABELS[e.kind as keyof typeof EXPERIENCE_KIND_LABELS]}</span>
                  <div className="row-main">
                    <div className="row-t" style={{ fontSize: 13.5 }}>{e.orgName}</div>
                    {e.period && <div className="row-s" style={{ fontSize: 12 }}>{e.period}</div>}
                  </div>
                  {remove(removeExperience, 'experienceId', e.id)}
                </div>
              ))}
            </div>
          )}
          <form action={addExperience} className="card cv-edit-stack"><input type="hidden" name="recordId" value={recordId} />
            <div className="field-label">Kind</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {/* .chip.pick, the product's own radio chip (globals.css, and
                  the same idiom as /club/post-trial) rather than a hand-rolled
                  copy of it. These were 28px tall against the charter's 44px
                  floor at every width, AND had no checked state at all — six
                  identical pills where one of them is already selected. The
                  class carries both. `kinds` (D-161) decides which of them a
                  band is offered; that is merged in untouched. */}
              {kinds.map((k, i) => (
                <label key={k} className="chip pick">
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} />
                  {EXPERIENCE_KIND_LABELS[k]}
                </label>
              ))}
            </div>
            <label className="field">
              <span className="field-label">Where</span>
              <input name="orgName" aria-label="Where" placeholder="e.g. Melbourne Futsal U15" required maxLength={80} />
            </label>
            <label className="field">
              <span className="field-label">When — optional</span>
              <input name="period" aria-label="When" placeholder="e.g. Summer 2025–26" maxLength={40} />
            </label>
            <button type="submit" className="btn btn-secondary" style={{ gap: 8 }}>{G.plus()}Add other football</button>
          </form>
        </section>
      </div>
    </PlayerFrame>
  );
}
