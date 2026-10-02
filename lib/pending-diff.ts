// What a child's waiting change changes, kind by kind — the parent's review on
// /g/pending (BUZ, 2 Oct: "every change"; spec D, /g/pending; D-119).
//
// The page used to read only the About, so a photo, a clip, a list entry or a
// stat was approved unseen, and a change with an unchanged About read "Nothing
// is waiting on you." This compares the approved version's content with the
// waiting one's, for every kind the page shows, and nothing else decides what
// the page shows: a section renders exactly when its kind differs, and
// "Nothing is waiting on you." exactly when none does.
//
// Pure: no database, no framework, so the permission suite can run it against
// the same versions the page reads.
import { POSITIONS, STAT_LABELS, provenanceLabel, type PositionCode, type StatKey } from './football.ts';

type Content = Record<string, unknown> | null | undefined;
type Item = Record<string, unknown>;

export type ListKind = 'highlights' | 'previousClubs' | 'achievements' | 'otherFootball';
export interface ListChange { item: Item; change: 'added' | 'removed' }
export interface DetailRow { label: string; from: string; to: string; toProvenance: string | null }
export interface PendingDiff {
  about: { from: string; to: string } | null;
  photo: { from: string | null; to: string | null } | null;
  highlights: ListChange[];
  previousClubs: ListChange[];
  achievements: ListChange[];
  otherFootball: ListChange[];
  details: DetailRow[];
}

/** The empty value on this page: an em dash, never a zero (D-70). */
export const EMPTY = '—';

// One shape for one entry, whatever order jsonb handed its keys back in, and
// whether an empty field was written as null or left out (a version written
// before a field existed has no key for it; that is not a change).
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x as Item).sort().filter((k) => (x as Item)[k] !== null && (x as Item)[k] !== undefined).map((k) => [k, (x as Item)[k]])) : x));

const list = (c: Content, k: string): Item[] => (Array.isArray(c?.[k]) ? (c![k] as Item[]) : []);

// Added: in the waiting version beyond what the approved one has; removed: the
// reverse — counted, so a second copy of an entry is a change of its own.
function listDiff(from: Item[], to: Item[]): ListChange[] {
  const left = new Map<string, number>();
  for (const i of from) left.set(canon(i), (left.get(canon(i)) ?? 0) + 1);
  const added: ListChange[] = [];
  for (const i of to) {
    const k = canon(i);
    if ((left.get(k) ?? 0) > 0) left.set(k, left.get(k)! - 1);
    else added.push({ item: i, change: 'added' });
  }
  const removed: ListChange[] = [];
  const right = new Map<string, number>();
  for (const i of to) right.set(canon(i), (right.get(canon(i)) ?? 0) + 1);
  for (const i of from) {
    const k = canon(i);
    if ((right.get(k) ?? 0) > 0) right.set(k, right.get(k)! - 1);
    else removed.push({ item: i, change: 'removed' });
  }
  return [...added, ...removed];
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const shown = (v: unknown): string => (v === null || v === undefined || v === '' ? EMPTY : String(v));
const positions = (v: unknown): string => {
  const codes = Array.isArray(v) ? (v as string[]) : [];
  const names = codes.map((c) => POSITIONS[c as PositionCode]?.label ?? c);
  return names.length ? names.join(' · ') : EMPTY;
};

// A stat's value as the page renders it: a number above zero, or the dash.
type StatEntry = { season?: string; key?: string; value?: unknown; provenance?: string };
const statValue = (e: StatEntry | undefined): string => {
  const n = Number(e?.value);
  return e && Number.isFinite(n) && n > 0 ? String(n) : EMPTY;
};

/**
 * Every change the waiting version makes to the approved one, kind by kind.
 * `approved` is null when nothing has been approved yet: then everything the
 * waiting version holds is new. School entries never count or render for an
 * under-18 (D-161); this page is an under-16's.
 */
export function pendingDiff(approved: Content, pending: Content): PendingDiff {
  const a = approved ?? {};
  const p = pending ?? {};
  const noSchool = (xs: Item[]) => xs.filter((x) => x.kind !== 'school');

  const aboutFrom = text(a.about), aboutTo = text(p.about);
  const photoFrom = (a.photoPath as string | null | undefined) ?? null;
  const photoTo = (p.photoPath as string | null | undefined) ?? null;

  const details: DetailRow[] = [];
  const row = (label: string, from: string, to: string, toProvenance: string | null = null) => {
    if (from !== to) details.push({ label, from, to, toProvenance });
  };
  row('Positions', positions(a.positions), positions(p.positions));
  row('Number', shown(a.squadNumber), shown(p.squadNumber));
  row('Preferred foot', shown(a.foot), shown(p.foot));
  // Each stat by season and key. A change from 0 to empty is no change: both
  // read "—". The new value carries its own source — after an edit, always
  // self-reported (0083; John, 2 Oct): no number is approved still wearing a
  // verification it no longer has.
  const stats = (c: Item) => (Array.isArray(c.stats) ? (c.stats as StatEntry[]) : []);
  const keyOf = (e: StatEntry) => `${e.season ?? ''}|${e.key ?? ''}`;
  const keys = [...new Set([...stats(a), ...stats(p)].map(keyOf))].sort();
  for (const k of keys) {
    const from = stats(a).find((e) => keyOf(e) === k), to = stats(p).find((e) => keyOf(e) === k);
    const label = STAT_LABELS[(to ?? from)?.key as StatKey] ?? String((to ?? from)?.key ?? '');
    const toShown = statValue(to);
    row(label, statValue(from), toShown, toShown === EMPTY ? null : provenanceLabel(to?.provenance));
  }

  return {
    about: aboutFrom !== aboutTo ? { from: aboutFrom, to: aboutTo } : null,
    photo: photoFrom !== photoTo ? { from: photoFrom, to: photoTo } : null,
    highlights: listDiff(list(a, 'highlights'), list(p, 'highlights')),
    previousClubs: listDiff(list(a, 'previousClubs'), list(p, 'previousClubs')),
    achievements: listDiff(list(a, 'achievements'), list(p, 'achievements')),
    otherFootball: listDiff(noSchool(list(a, 'otherFootball')), noSchool(list(p, 'otherFootball'))),
    details,
  };
}

/** The kinds that changed, in the page's order — exactly the sections it renders. */
export function changedKinds(d: PendingDiff): string[] {
  return [
    d.about && 'about', d.photo && 'photo', d.highlights.length && 'highlights', d.previousClubs.length && 'previousClubs',
    d.achievements.length && 'achievements', d.otherFootball.length && 'otherFootball', d.details.length && 'details',
  ].filter((k): k is string => typeof k === 'string');
}
