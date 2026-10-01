// THE single tokenised read path (D-80). Every surface that renders a record
// to a token holder — the CV page, the OG image, the link-state page, the
// PDF export — calls THIS module and nothing else. The permission decision
// itself lives in Postgres (fn_token_read, migration 0003); this file only
// carries the answer. No other file may query record data for a token.
//
// Dead links: expired, revoked, paused, guardian-disabled and never-existed
// all return the same null. The route renders one identical page for all of
// them (D-77) — no branch in here may distinguish them.
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { cache } from 'react';
import { db } from './db';
import type { ClubColours } from './club-colours';
import type { PlayerFixture } from './fixtures';
import { checkRate } from './ratelimit-db';

// clubColours / clubState: the current club's own colours and its state
// (D-174), the same club the club line names — fn_cv_club_colours (0165),
// asked here and nowhere else. Colours come back only while the club is
// verified. PlayerCV is the one reader; no card surface reads them (D-89).
export type CvData = PlayerFixture & { clubColours?: ClubColours | null; clubState?: string | null };

type ColoursAnswer = { primary: string | null; secondary: string | null; state: string } | null;
const coloursOf = (c: ColoursAnswer): Pick<CvData, 'clubColours' | 'clubState'> => ({
  clubColours: c?.primary && c.secondary ? { primary: c.primary, secondary: c.secondary } : null,
  clubState: c?.state ?? null,
});

/**
 * What PlayerCV is handed to wear: the CV's own answer from this module, and
 * nothing a page computed. Every CV surface passes it the same way (perms
 * cvcol7).
 */
export const wornColours = (cv: CvData) => ({ clubColours: cv.clubColours ?? null, clubState: cv.clubState ?? undefined });

/**
 * The club colours for a CV served from an under-16's approved snapshot. The
 * snapshot never holds them: like the club line (fn_approved_cv, 0054) they
 * follow the live membership, so they are asked on every read and laid over
 * whatever the snapshot carries. The caller holds the authorisation.
 */
export async function cvClubColours(personId: string): Promise<Pick<CvData, 'clubColours' | 'clubState'>> {
  const { rows } = await db.query('select fn_cv_club_colours($1) as colours', [personId]);
  return coloursOf(rows[0]?.colours ?? null);
}

// ---------------------------------------------------------------------------
// The rate limit on this path (CLAUDE.md §2, D-94; brief C, 29 Sep). Every
// unauthenticated endpoint has one, and this is the one a stranger holding a
// link actually reaches. Counted twice: per link, from anywhere, and per
// address, across every link. Both are counted on every read, whichever one
// bites, so a refused read costs what a passed one does.
//
// THE NUMBERS, chosen so that a family sharing a link normally never meets
// them. The busiest hour one link plausibly has: a parent posts it into a
// team group of twenty-five families, the club forwards it to its coaches,
// grandparents open it twice — sixty to a hundred opens. A page view counts
// once (its title and its body share one answer, below), and so does a
// preview card or a print. 300 an hour per link is three times that hour.
// The busiest address: a club office in trial week opening sixty CVs, or a
// school's shared connection — about a hundred. 600 an hour per address. The
// one case the address limit could reach a family is a mobile carrier putting
// many phones behind one address; at our size that is remote, and the number
// goes up before it bites anyone.
//
// WHAT IT STOPS: a machine hammering one link — scraping it, or sampling its
// response time, which over a real network takes thousands of reads of the
// same link to see a millisecond (the attack doc 14 E10 is written against) —
// and one address walking many links.
//
// WHAT A REFUSAL LOOKS LIKE: the dead-link page (D-77), with nothing to tell
// it from any other. Same copy, and the same database work as a string that
// was never a link — fn_token_read against a hash nothing can match — so a
// refused read of a live link and a refused read of nothing take the same
// time. No header, no status, no counter (doc 14 C7's oracle rule).
// ---------------------------------------------------------------------------
export const TOKEN_READ_LIMITS = { perLink: 300, perAddress: 600, windowSeconds: 60 * 60 } as const;

// One answer per request. The CV page reads the token for its title and
// again for its body (deliberately — see app/p/[token]/page.tsx), and the two
// must agree: a live title over a limited body would say the link exists.
// React's cache() holds the answer for one request and no longer; outside a
// render (the preview-card route) it simply asks.
const withinLimits = cache(async (hashHex: string): Promise<boolean> => {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const link = await checkRate(`token-read:link:${hashHex}`, TOKEN_READ_LIMITS.perLink, TOKEN_READ_LIMITS.windowSeconds);
  const address = await checkRate(`token-read:ip:${ip}`, TOKEN_READ_LIMITS.perAddress, TOKEN_READ_LIMITS.windowSeconds);
  return link && address;
});

export async function readCvByToken(rawToken: string): Promise<CvData | null> {
  // tokens are >=128-bit random strings; anything absurd is dead without a query
  if (!rawToken || rawToken.length > 200) return null;
  const hash = createHash('sha256').update(rawToken).digest();
  const lookup = (await withinLimits(hash.toString('hex'))) ? hash : randomBytes(32);

  const { rows } = await db.query('select fn_token_read($1) as bundle', [lookup]);
  const bundle = rows[0]?.bundle as
    | { record_id: string; person_id: string; band: string; approved_content: CvData | null }
    | null;
  if (!bundle) return null;

  // u16: the guardian-approved snapshot is the page (D-119). The band is
  // stamped on the way OUT rather than frozen into the snapshot — it is
  // derived from DOB at read time and must never be stored (doc 14 §J1), and
  // a child who turns 16 must not keep a stale band because their snapshot
  // was approved before their birthday.
  //
  // This line was written once before and silently lost: the edit that added
  // it was in a script whose LATER assertion failed, so the file was never
  // written. It went unnoticed because an absent band falls back to "minor",
  // which is the correct answer for a u16 — right for the wrong reason.
  if (bundle.approved_content) {
    // No filtering here, deliberately. A snapshot approved before D-161 still
    // holds a school entry and nothing rewrites it — but fn_approved_cv, the
    // one function that serves a snapshot to all four of its surfaces (0054,
    // 0061), is where that is answered. A second answer here would be a second
    // place to be wrong (L23).
    return { ...bundle.approved_content, band: bundle.band as CvData['band'], ...(await cvClubColours(bundle.person_id)) };
  }

  return assembleCv(bundle.record_id, bundle.person_id, bundle.band);
}

/**
 * What a request-access notice needs from a token, and nothing more (D-77,
 * D-80, doc 14 C6/C7; brief D, 29 Sep): the token's id, to count and log the
 * request against it, and the child's first name and one guardian address, to
 * write the email. The request-access handler used to ask share_token for
 * these itself, which made it a second reader of tokens; it asks here now.
 *
 * It resolves a token LIVE OR DEAD, because the request exists for the dead
 * one: that is the one case readCvByToken refuses. So it grants nothing to the
 * caller. It selects nothing from the record, and the answer never reaches the
 * requester: the handler redirects every path to the same page, no sooner
 * than the send floor (lib/send-dispatch answerNoSoonerThan).
 *
 * ONE QUERY SHAPE for every token. The statement starts from the hash, not
 * from share_token, and left-joins the rest, so a token that never existed
 * makes the same one query as a real one and gets back one row of nulls. An
 * absurd string is looked up as a hash nothing can match, rather than
 * answered without a query as readCvByToken does, for the same reason. It is
 * not counted against TOKEN_READ_LIMITS: nothing here is a read of a record,
 * and the request has its own limit (fn_access_request_allowed, one a day
 * per token).
 */
export type AccessNotice = { tokenId: string; firstName: string; guardianEmail: string | null };

export async function resolveTokenForNotice(rawToken: string): Promise<AccessNotice | null> {
  const hash = rawToken && rawToken.length <= 200 ? createHash('sha256').update(rawToken).digest() : randomBytes(32);
  const { rows } = await db.query(
    `select st.id as token_id, p.first_name,
       (select p2.email from guardianship_link g join person p2 on p2.id = g.guardian_id
        where g.child_id = p.id and g.approved_at is not null and g.revoked_at is null
          and p2.email is not null limit 1) as guardian_email
     from (select $1::bytea as token_hash) asked
     left join share_token st on st.token_hash = asked.token_hash
     left join development_record dr on dr.id = st.record_id
     left join person p on p.id = dr.person_id`,
    [hash],
  );
  const row = rows[0];
  if (!row?.token_id || !row.first_name) return null;
  return { tokenId: row.token_id, firstName: row.first_name, guardianEmail: row.guardian_email ?? null };
}

/**
 * Assemble a live record into the shape PlayerCV renders.
 *
 * 16–17 and 18+ have NO approved snapshot — lib/cv-build writes one only for
 * u16 — so anything reading a CV by snapshot alone can see a u16 and nobody
 * else. The club's own register did exactly that: it selected
 * profile_version where status='approved' and 404'd otherwise, so a club
 * could never open the CV of a seventeen-year-old or an adult on the list it
 * pays for. The dev fixture wrote a snapshot for every non-adult, including
 * a seventeen-year-old, which production never produces — so the hole was
 * invisible from the walkthrough.
 *
 * EXPORTED so there is one assembly rather than two. The AUTHORISATION stays
 * with the caller — fn_token_read for a share link, fn_can_work_register for
 * a club. This function is the shape, never the permission.
 */
export async function assembleCv(recordId: string, personId: string, band: string): Promise<CvData | null> {
  const bundle = { record_id: recordId, person_id: personId, band };
  const r = await db.query(
    `select
      (select row_to_json(x) from (
        select p.first_name, p.photo_path, p.last_name, dr.positions, dr.squad_number, dr.foot, dr.about, dr.surfaced_stats,
               -- D-84: the quarter, never the date (0082).
               fn_birth_quarter(p.dob) as birth_quarter
        from development_record dr join person p on p.id = dr.person_id
        where dr.id = $1) x) as core,
      -- D-160: each number with its source, its dates and the verifying
      -- CLUB — never the coach. The database's shape (0083), not ours.
      fn_stat_public($1) as stats,
      (select coalesce(json_agg(json_build_object('title', title, 'detail', detail) order by sort), '[]'::json)
        from achievement where record_id = $1) as achievements,
      -- fn_experience_public is the database's answer to which of these may
      -- appear on a public page for this record: no school for an under-18,
      -- decided from the date of birth at read time (D-161, 0061).
      (select coalesce(json_agg(json_build_object('kind', kind, 'orgName', org_name, 'period', season_label, 'note', notes)), '[]'::json)
        from experience_entry where record_id = $1 and kind <> 'previous_club'
          and fn_experience_public($1, kind)) as other,
      (select coalesce(json_agg(json_build_object('orgName', org_name, 'period', season_label) order by season_label desc nulls last, created_at desc), '[]'::json)
        from experience_entry where record_id = $1 and kind = 'previous_club') as previous_clubs,
      (select coalesce(json_agg(json_build_object('title', title, 'url', url) order by added_at), '[]'::json)
        from highlight where record_id = $1) as highlights,
      -- The club line is the database's answer, the same one every under-16
      -- snapshot is served with (fn_cv_club, 0054): the live membership, and
      -- no club at all while that club is suspended or taken down (0155).
      -- This used to be a second query of its own, which never asked.
      fn_cv_club($2) as membership,
      -- D-174: that club's own colours, while it is verified (0165).
      fn_cv_club_colours($2) as colours`,
    [bundle.record_id, bundle.person_id],
  );
  const row = r.rows[0];
  if (!row?.core) return null;

  return {
    slug: 'live',
    band: bundle.band as CvData['band'],
    birthQuarter: row.core.birth_quarter ?? null,
    firstName: row.core.first_name,
    photoPath: row.core.photo_path ?? undefined,
    lastName: row.core.last_name ?? '',
    dob: '',
    positions: row.core.positions,
    squadNumber: row.core.squad_number,
    foot: row.core.foot,
    club: row.membership?.club ?? '',
    clubCrestPath: row.membership?.clubCrestPath ?? undefined,
    // The club's suburb and state. Never the child's — we do not hold an
    // address for a player and this line must not start looking like one.
    locality: row.membership?.locality || undefined,
    squad: {
      name: row.membership?.squad?.name ?? '',
      ageGroup: row.membership?.squad?.ageGroup ?? '',
      competitionGender: row.membership?.squad?.competitionGender ?? null,
    },
    about: row.core.about ?? '',
    stats: row.stats,
    achievements: row.achievements,
    otherFootball: row.other,
    previousClubs: row.previous_clubs,
    highlights: row.highlights,
    highlightsUsed: row.highlights.length,
    surfacedStats: row.core.surfaced_stats,
    ...coloursOf(row.colours),
  };
}
