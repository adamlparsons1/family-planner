import 'server-only';
import { getDb } from '@/db';
import { settings } from '@/db/schema';

/**
 * Every column except session_secret, which only /setup and the session code
 * read. Naming the columns keeps this working on a database that has not had
 * that column's migration yet.
 */
const columns = {
  id: settings.id,
  householdPasscodeHash: settings.householdPasscodeHash,
  parentPinHash: settings.parentPinHash,
  dayRolloverHour: settings.dayRolloverHour,
  nightThemeFromHour: settings.nightThemeFromHour,
  homeworkWeekStartDay: settings.homeworkWeekStartDay,
  updatedAt: settings.updatedAt,
};

export type Settings = Omit<typeof settings.$inferSelect, 'sessionSecret'>;

/**
 * The single settings row. Throws if the database has not been seeded, because
 * every gate in the app depends on it and failing loudly at startup is far
 * better than failing quietly at 7am.
 */
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const [row] = await db.select(columns).from(settings);
  if (!row) {
    throw new Error('No settings row found. Run `npm run db:seed` before starting the app.');
  }
  return row;
}

/**
 * The night-theme hour, read outside the normal settings path so the root
 * layout can render before the database is seeded rather than throwing.
 */
export async function getNightThemeHour(): Promise<number> {
  try {
    return (await getSettings()).nightThemeFromHour;
  } catch {
    return 19;
  }
}
