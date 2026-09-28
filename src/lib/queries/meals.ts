import 'server-only';
import { asc, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { lunchChoices, lunchDefaults, meals } from '@/db/schema';
import { defaultKey, lunchKey, resolveLunch, type LunchChoice, type ResolvedLunch } from '@/lib/lunch';
import type { AppDate } from '@/lib/date';

export async function getMealsForDates(dates: AppDate[]): Promise<Map<AppDate, typeof meals.$inferSelect>> {
  if (dates.length === 0) return new Map();
  const db = await getDb();
  const rows = await db.select().from(meals).where(inArray(meals.date, dates));
  return new Map(rows.map((m) => [m.date, m]));
}

/** A resolved lunch plus the school dinner's dish, when one was written in. */
export type LunchCell = ResolvedLunch & { dish: string | null };
export type LunchGrid = Map<string, LunchCell>;

/**
 * Resolved lunches for every person across every date, keyed `personId:date`.
 * One read of choices and one of defaults, then pure resolution.
 */
export async function getLunchGrid(
  dates: AppDate[],
  personIds: number[],
  schoolDays: (date: AppDate) => boolean,
): Promise<LunchGrid> {
  const db = await getDb();
  const [choiceRows, defaultRows] = await Promise.all([
    dates.length ? db.select().from(lunchChoices).where(inArray(lunchChoices.date, dates)) : [],
    db.select().from(lunchDefaults).orderBy(asc(lunchDefaults.dayOfWeek)),
  ]);

  const choices = new Map<string, LunchChoice>(
    choiceRows.map((c) => [lunchKey(c.personId, c.date), c.choice]),
  );
  const dishes = new Map<string, string>(
    choiceRows.filter((c) => c.choice === 'school' && c.dish).map((c) => [lunchKey(c.personId, c.date), c.dish!]),
  );
  const defaults = new Map<string, LunchChoice>(
    defaultRows.map((d) => [defaultKey(d.personId, d.dayOfWeek), d.choice]),
  );

  const grid: LunchGrid = new Map();
  for (const date of dates) {
    for (const personId of personIds) {
      const key = lunchKey(personId, date);
      const resolved = resolveLunch(date, personId, choices, defaults, schoolDays(date));
      grid.set(key, { ...resolved, dish: resolved.isOverride ? (dishes.get(key) ?? null) : null });
    }
  }
  return grid;
}

export async function getLunchDefaults() {
  const db = await getDb();
  return db.select().from(lunchDefaults).orderBy(asc(lunchDefaults.dayOfWeek));
}
