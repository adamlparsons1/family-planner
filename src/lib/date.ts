/**
 * The single source of truth for "what day is it?" in this app.
 *
 * Two rules, both load-bearing:
 *
 *  1. Everything is rendered in Europe/London. Timestamps are stored in UTC.
 *     Anything day-shaped (a meal, a lunch choice, a routine completion) is a
 *     plain 'YYYY-MM-DD' string and never a Date object, because a Date carries
 *     a time and a zone and both will eventually be wrong by an hour.
 *
 *  2. The day rolls over at 03:00 local, not midnight. A parent checking the
 *     plan at 00:30 is still living in the day that just ended.
 *
 * Never call `new Date()` inline anywhere else in this codebase. Call
 * getCurrentAppDate(). The whole point is that there is one place to be wrong.
 */
import { TZDate } from '@date-fns/tz';
import { addDays, format, getDay, parse, startOfDay } from 'date-fns';

export const APP_TIME_ZONE = 'Europe/London';
export const DEFAULT_ROLLOVER_HOUR = 3;

/** A calendar day with no time and no zone: 'YYYY-MM-DD'. */
export type AppDate = string;

const APP_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isAppDate(value: unknown): value is AppDate {
  return typeof value === 'string' && APP_DATE_PATTERN.test(value);
}

export function assertAppDate(value: unknown): AppDate {
  if (!isAppDate(value)) {
    throw new Error(`Expected a YYYY-MM-DD date string, received: ${String(value)}`);
  }
  return value;
}

/**
 * The app's current date, honouring the 03:00 rollover.
 *
 * @param now         Instant to evaluate. Injectable so this is testable; production callers omit it.
 * @param rolloverHour Hour (0-23) at which the app's day advances. 0 disables the offset.
 */
export function getCurrentAppDate(
  now: Date = new Date(),
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): AppDate {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > 23) {
    throw new Error(`rolloverHour must be an integer 0-23, received: ${rolloverHour}`);
  }
  const local = new TZDate(now, APP_TIME_ZONE);
  // Before the rollover hour we are still in "yesterday" as far as the app is concerned.
  const shifted = local.getHours() < rolloverHour ? addDays(local, -1) : local;
  return format(shifted, 'yyyy-MM-dd');
}

/** Parse an AppDate into a Date fixed at local midnight in Europe/London. */
export function appDateToDate(date: AppDate): Date {
  assertAppDate(date);
  return new TZDate(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    APP_TIME_ZONE,
  );
}

/** Format a Date as an AppDate, interpreting it in Europe/London. */
export function toAppDate(date: Date): AppDate {
  return format(new TZDate(date, APP_TIME_ZONE), 'yyyy-MM-dd');
}

export function addAppDays(date: AppDate, days: number): AppDate {
  return format(addDays(appDateToDate(date), days), 'yyyy-MM-dd');
}

/** Day of week, 0 = Sunday .. 6 = Saturday. Matches JS getDay() and `days_of_week` columns. */
export function appDayOfWeek(date: AppDate): number {
  return getDay(appDateToDate(date));
}

export function isWeekend(date: AppDate): boolean {
  const day = appDayOfWeek(date);
  return day === 0 || day === 6;
}

/** Monday-first week containing `date`, as seven AppDates. */
export function weekOf(date: AppDate): AppDate[] {
  const day = appDayOfWeek(date);
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = addAppDays(date, offsetToMonday);
  return Array.from({ length: 7 }, (_, i) => addAppDays(monday, i));
}

/** Inclusive date range. */
export function datesBetween(from: AppDate, to: AppDate): AppDate[] {
  assertAppDate(from);
  assertAppDate(to);
  const out: AppDate[] = [];
  for (let d = from; d <= to; d = addAppDays(d, 1)) {
    out.push(d);
    if (out.length > 3660) throw new Error('datesBetween: refusing to expand more than ~10 years');
  }
  return out;
}

/** "Tuesday 3rd March" — the header on the kiosk. Plain English, no year, no clutter. */
export function formatFriendlyDate(date: AppDate): string {
  const d = appDateToDate(date);
  const dayNumber = d.getDate();
  return `${format(d, 'EEEE')} ${dayNumber}${ordinalSuffix(dayNumber)} ${format(d, 'MMMM')}`;
}

export function formatShortDay(date: AppDate): string {
  return format(appDateToDate(date), 'EEE');
}

/** 'HH:mm:ss' (as stored) -> '3:45pm'. Returns null for all-day events. */
export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const parsed = parse(time.slice(0, 5), 'HH:mm', startOfDay(new Date(2000, 0, 1)));
  return format(parsed, 'h:mmaaa');
}

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Is the given hour inside the night-theme window?
 *
 * The window normally wraps midnight (19:00 to 06:00), which is the case that
 * gets written wrong, so it lives here with tests rather than inline in a
 * component.
 */
export function isNightHour(hour: number, fromHour: number, untilHour: number): boolean {
  if (fromHour === untilHour) return false;
  return fromHour > untilHour
    ? hour >= fromHour || hour < untilHour
    : hour >= fromHour && hour < untilHour;
}
