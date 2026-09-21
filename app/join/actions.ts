'use server';
// Server actions for the child sign-up door (D-17). Validation is
// server-side; the client is never trusted for age or identity.
import { redirect } from 'next/navigation';
import { createPendingInvitation } from '@/lib/guardian-flow';
import { legalStamp } from '@/lib/legal-stamp';

const AU_MOBILE = /^04\d{2}\s?\d{3}\s?\d{3}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function startPendingInvitation(formData: FormData) {
  const firstName = String(formData.get('firstName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const guardianName = String(formData.get('guardianName') ?? '').trim();
  const guardianPhone = String(formData.get('guardianPhone') ?? '').trim();
  const guardianEmail = String(formData.get('guardianEmail') ?? '').trim();

  // D-157: the parent's email is required. It is the second channel D-156
  // needs, and every control a parent has needs an account to use it.
  if (!firstName || !dob || !guardianName || !AU_MOBILE.test(guardianPhone) || !EMAIL_RE.test(guardianEmail)) {
    redirect('/join?error=1');
  }
  const { id } = await createPendingInvitation({
    firstName,
    dob,
    guardianName,
    guardianPhone,
    guardianEmail,
  });
  redirect(`/join/waiting/${id}`);
}


// 16–17 and 18+ branches (D-96, D-49). A fresh 16–17 signup without a
// guardian contact is incomplete, not merely unverified — the off-switch
// and routed contact are unbuildable without one. Adults walk straight in.
// Both accept the ToS themselves (logged, version-stamped).
export async function createAccount(formData: FormData) {
  const { db } = await import('@/lib/db');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const guardianName = String(formData.get('guardianName') ?? '').trim();
  const guardianPhone = String(formData.get('guardianPhone') ?? '').trim();
  const guardianEmail = String(formData.get('guardianEmail') ?? '').trim();
  if (!firstName || !dob || !EMAIL_RE.test(email) || password.length < 10) redirect('/join?error=1');

  const client = await db.connect();
  let personId: string;
  let existing = false;
  try {
    await client.query('begin');
    const band = (await client.query('select fn_age_band($1::date) as b', [dob])).rows[0].b as string;
    if (band === 'u16') { await client.query('rollback'); redirect('/join'); }
    // D-155 as amended / D-157: a 16–17 names a parent with a mobile AND an
    // email, and that parent confirms on both before the link exists.
    if (band === '16_17' && (!guardianName || !AU_MOBILE.test(guardianPhone) || !EMAIL_RE.test(guardianEmail)
        || guardianEmail.toLowerCase() === email)) {
      await client.query('rollback'); redirect('/join?error=1');
    }
    // An address that already has an account is NEVER touched here. This
    // used to "upsert": signing up with someone else's email reset their
    // password and signed you in as them — a parent's account, a club
    // director's. Now the existing account is left exactly as it is, and
    // the response below is the same either way (D-94 §2: no enumeration).
    const person = await client.query(
      `insert into person (first_name, dob, dob_locked, email) values ($1,$2,true,$3)
       on conflict (email) do nothing returning id`,
      [firstName, dob, email],
    );
    if (person.rows.length === 0) {
      await client.query('rollback');
      existing = true;
      personId = '';
    } else {
      personId = person.rows[0].id;
      await client.query(`insert into development_record (person_id) values ($1) on conflict (person_id) do nothing`, [personId]);
      // A 16–17's parent is no longer written as an approved guardian here
      // (it used to be: no email, no DOB, approved by nobody but the teen).
      // The confirmation request goes out after the commit, below.
      await client.query(
        `insert into consent_event (event, actor_id, subject_id, policy_version, detail)
         values ('tos_accepted',$1,$1,$2,'{}'), ('policy_accepted',$1,$1,$3,'{}')`,
        [personId, legalStamp('22'), legalStamp('20')],
      );
      await client.query('commit');
    }
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  // Nobody is signed in by signing up: the same destination whether the
  // account is new or the address was already taken, and the same work
  // (a password hash either way), so neither the page nor its timing says
  // which. A new member signs in with the password they just chose.
  const { setPassword, hashPasswordForTiming } = await import('@/lib/auth');
  if (existing) await hashPasswordForTiming(password);
  else {
    await setPassword(personId, password);
    const band = (await db.query('select fn_age_band($1::date) as b', [dob])).rows[0].b as string;
    if (band === '16_17') {
      await createPendingInvitation({ firstName, dob, guardianName, guardianPhone, guardianEmail, childId: personId });
    }
  }
  redirect('/signin?joined=1');
}
// A COACH signs themselves up (BUZ, 21 Sep — D-75's "one coach brings fifteen
// families" is unreachable through an inbox). Eighteen or over, and the age
// gate is the database's answer, not the form's: a coach account for a child
// is a child's account made through a door with no guardian on it, and this
// product never makes one of those.
//
// What a coach account IS, and why self-serve is safe: their own page, and
// nothing else. It reads no register, sees no child, and goes public only
// once they publish it. Reading a club's registrations needs that club to
// name them AND attest their Working With Children Check (D-98, D-154), which
// is a club's act and cannot be self-asserted.
export async function createCoachAccount(formData: FormData) {
  const { db } = await import('@/lib/db');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!firstName || !dob || !EMAIL_RE.test(email) || password.length < 10) redirect('/join?error=1');

  const client = await db.connect();
  let personId = '';
  let existing = false;
  try {
    await client.query('begin');
    const band = (await client.query('select fn_age_band($1::date) as b', [dob])).rows[0].b as string;
    if (band !== '18plus') { await client.query('rollback'); redirect('/join?coachAge=1'); }
    // The same rule as the player door: an address that already has an
    // account is never touched, and the answer never says which (D-94 §2).
    const person = await client.query(
      `insert into person (first_name, last_name, dob, dob_locked, email) values ($1,$2,$3,true,$4)
       on conflict (email) do nothing returning id`,
      [firstName, lastName || null, dob, email],
    );
    if (person.rows.length === 0) {
      await client.query('rollback');
      existing = true;
    } else {
      personId = person.rows[0].id;
      // The page itself: empty until they fill it in, public only when they
      // publish it (D-100).
      await client.query(`insert into coach_profile (person_id) values ($1) on conflict (person_id) do nothing`, [personId]);
      await client.query(
        `insert into consent_event (event, actor_id, subject_id, policy_version, detail)
         values ('tos_accepted',$1,$1,$2,'{}'), ('policy_accepted',$1,$1,$3,'{}')`,
        [personId, legalStamp('22'), legalStamp('20')],
      );
      await client.query('commit');
    }
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  const { setPassword, hashPasswordForTiming } = await import('@/lib/auth');
  if (existing) await hashPasswordForTiming(password);
  else await setPassword(personId, password);
  redirect('/signin?joined=1');
}

// A CLUB PERSON signs themselves up (BUZ, 21 Sep). This makes an ACCOUNT and
// nothing else: no player record, no coach page, no club. What it is for is
// the next step — claiming the club's page with the code we email to the
// club's own published address (doc 15 §34) — and that claim is what ties a
// person to a club.
//
// It does NOT verify anybody. Verified is a human act with a name, a time and
// the authority question answered on a phone call (D-126), and no form can
// set it. Adults only: a club's page is run by adults.
export async function createClubAccount(formData: FormData) {
  const { db } = await import('@/lib/db');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!firstName || !dob || !EMAIL_RE.test(email) || password.length < 10) redirect('/join?error=1');

  const client = await db.connect();
  let personId = '';
  let existing = false;
  try {
    await client.query('begin');
    const band = (await client.query('select fn_age_band($1::date) as b', [dob])).rows[0].b as string;
    if (band !== '18plus') { await client.query('rollback'); redirect('/join?clubAge=1'); }
    const person = await client.query(
      `insert into person (first_name, last_name, dob, dob_locked, email) values ($1,$2,$3,true,$4)
       on conflict (email) do nothing returning id`,
      [firstName, lastName || null, dob, email],
    );
    if (person.rows.length === 0) {
      await client.query('rollback');
      existing = true;
    } else {
      personId = person.rows[0].id;
      await client.query(
        `insert into consent_event (event, actor_id, subject_id, policy_version, detail)
         values ('tos_accepted',$1,$1,$2,'{}'), ('policy_accepted',$1,$1,$3,'{}')`,
        [personId, legalStamp('22'), legalStamp('20')],
      );
      await client.query('commit');
    }
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  const { setPassword, hashPasswordForTiming } = await import('@/lib/auth');
  if (existing) await hashPasswordForTiming(password);
  else await setPassword(personId, password);
  redirect('/signin?joined=1');
}
