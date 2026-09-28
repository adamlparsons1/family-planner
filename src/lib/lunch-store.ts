import 'server-only';
import { getDb } from '@/db';
import { lunchChoices } from '@/db/schema';
import type { AppDate } from '@/lib/date';
import type { LunchChoice } from '@/lib/lunch';

/** Longest dish name the morning card will take. A menu line, not a recipe. */
export const DISH_MAX = 80;

/**
 * Write one person's lunch for one date.
 *
 * The dish only ever belongs to a school dinner:
 * - choosing anything else clears it, so switching packed -> school later
 *   never resurrects last week's "fish fingers";
 * - choosing school with `dish` undefined keeps whatever is there, so flipping
 *   the switch does not wipe what someone typed;
 * - an empty or whitespace dish is stored as null.
 */
export async function saveLunch(input: {
  personId: number;
  date: AppDate;
  choice: LunchChoice;
  dish?: string | null;
}): Promise<void> {
  const db = await getDb();
  const { personId, date, choice } = input;
  const dish = choice !== 'school' ? null : input.dish === undefined ? undefined : normaliseDish(input.dish);

  await db
    .insert(lunchChoices)
    .values({ personId, date, choice, dish: dish ?? null })
    .onConflictDoUpdate({
      target: [lunchChoices.personId, lunchChoices.date],
      set: dish === undefined ? { choice } : { choice, dish },
    });
}

export function normaliseDish(dish: string | null): string | null {
  const trimmed = dish?.trim().replace(/\s+/g, ' ') ?? '';
  return trimmed === '' ? null : trimmed.slice(0, DISH_MAX);
}
