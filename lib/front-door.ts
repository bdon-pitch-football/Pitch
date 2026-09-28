// The launch-day switch (D-164 (1), 0080). Until app_config front_door_open
// is the literal 'true', `/` serves the coming-soon page exactly as it did
// before the front door existed. One answer, in the database, read here and
// nowhere else — the same shape as billing (lib/billing, 0075).
import 'server-only';
import { db } from './db';

export async function frontDoorOpen(): Promise<boolean> {
  const { rows } = await db.query('select fn_front_door_open() as open');
  return rows[0]?.open === true;
}
