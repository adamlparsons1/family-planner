/**
 * Lunch resolution. Pure, so it is testable without a database.
 *
 * A specific `lunch_choices` row for a date always wins. Otherwise the standing
 * `lunch_defaults` pattern for that weekday applies. The UI must make it
 * obvious which days are overrides, because that is the whole point of them.
 *
 * Families often set lunches week by week rather than relying on a standing
 * pattern, so in practice most days are explicit choices and the defaults are
 * a convenience for pre-filling the planner.
 */
import { appDayOfWeek, isWeekend, type AppDate } from './date';

export type LunchChoice = 'school' | 'packed' | 'none';

export type ResolvedLunch = {
  choice: LunchChoice;
  /** True when an explicit row for this date overrode the standing pattern. */
  isOverride: boolean;
  /** True when nothing is set at all - neither a choice nor a default. */
  isUnset: boolean;
};

export const LUNCH_LABELS: Record<LunchChoice, string> = {
  school: 'School dinner',
  packed: 'Packed lunch',
  none: 'At home',
};

/** Icons carry this for the children: a plate versus a lunchbox. */
export const LUNCH_ICONS: Record<LunchChoice, string> = {
  school: '🍽️',
  packed: '🥪',
  none: '🏡',
};

export function resolveLunch(
  date: AppDate,
  personId: number,
  choices: Map<string, LunchChoice>,
  defaults: Map<string, LunchChoice>,
  isSchoolDay: boolean,
): ResolvedLunch {
  const explicit = choices.get(`${personId}:${date}`);
  if (explicit) return { choice: explicit, isOverride: true, isUnset: false };

  // No school means no school lunch to decide about.
  if (!isSchoolDay || isWeekend(date)) {
    return { choice: 'none', isOverride: false, isUnset: false };
  }

  const fallback = defaults.get(`${personId}:${appDayOfWeek(date)}`);
  if (fallback) return { choice: fallback, isOverride: false, isUnset: false };

  return { choice: 'none', isOverride: false, isUnset: true };
}

export function lunchKey(personId: number, date: AppDate): string {
  return `${personId}:${date}`;
}

export function defaultKey(personId: number, dayOfWeek: number): string {
  return `${personId}:${dayOfWeek}`;
}
