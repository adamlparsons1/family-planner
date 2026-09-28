/**
 * School-day logic. Pure functions so they can be tested without a database.
 *
 * Weekends are DERIVED, never stored (see schema.ts). A date is a school day
 * unless it is a weekend or appears in non_school_days.
 */
import { isWeekend, type AppDate } from './date';

export function isSchoolDay(date: AppDate, nonSchoolDates: ReadonlySet<AppDate>): boolean {
  if (isWeekend(date)) return false;
  return !nonSchoolDates.has(date);
}

/**
 * Whether a routine task should appear on a given date.
 *
 * `daysOfWeek` and `schoolDaysOnly` are ANDed: the day must match the weekly
 * pattern, and if the task is school-only it must additionally be a school day.
 *
 */
export function taskAppliesOn(
  task: { daysOfWeek: number[]; schoolDaysOnly: boolean; isActive: boolean },
  date: AppDate,
  nonSchoolDates: ReadonlySet<AppDate>,
  dayOfWeek: number,
): boolean {
  if (!task.isActive) return false;
  if (!task.daysOfWeek.includes(dayOfWeek)) return false;
  if (task.schoolDaysOnly && !isSchoolDay(date, nonSchoolDates)) return false;
  return true;
}
