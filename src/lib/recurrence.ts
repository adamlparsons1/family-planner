/**
 * Recurrence expansion. Deliberately limited:
 * weekly by day-of-week, with optional start and end bounds, plus single-date
 * events. No monthly, no nth-weekday, no exception rules.
 *
 * Rules are STORED; occurrences are expanded at read time for the range being
 * displayed. Storing 52 rows per weekly club makes editing a nightmare.
 *
 * Pure functions, so this is testable without a database.
 */
import { appDayOfWeek, type AppDate } from './date';

export type EventRule = {
  id: number;
  title: string;
  icon: string;
  date: AppDate | null;
  daysOfWeek: number[] | null;
  startsOn: AppDate | null;
  endsOn: AppDate | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  isSchoolRelated: boolean;
};

export type Occurrence = {
  /** Identity of an occurrence is (eventId, date). */
  eventId: number;
  date: AppDate;
  title: string;
  icon: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  isSchoolRelated: boolean;
  isRecurring: boolean;
};

/** Does this rule produce an occurrence on this date? */
export function occursOn(rule: EventRule, date: AppDate): boolean {
  if (rule.date !== null) return rule.date === date;
  if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return false;
  if (rule.startsOn && date < rule.startsOn) return false;
  if (rule.endsOn && date > rule.endsOn) return false;
  return rule.daysOfWeek.includes(appDayOfWeek(date));
}

function toOccurrence(rule: EventRule, date: AppDate): Occurrence {
  return {
    eventId: rule.id,
    date,
    title: rule.title,
    icon: rule.icon,
    startTime: rule.startTime,
    endTime: rule.endTime,
    location: rule.location,
    notes: rule.notes,
    isSchoolRelated: rule.isSchoolRelated,
    isRecurring: rule.date === null,
  };
}

/** Every occurrence of every rule on one date, ordered all-day first then by time. */
export function expandForDate(rules: EventRule[], date: AppDate): Occurrence[] {
  return sortOccurrences(rules.filter((r) => occursOn(r, date)).map((r) => toOccurrence(r, date)));
}

/** Occurrences across a list of dates, keyed by date. */
export function expandForDates(rules: EventRule[], dates: AppDate[]): Map<AppDate, Occurrence[]> {
  const out = new Map<AppDate, Occurrence[]>();
  for (const date of dates) out.set(date, expandForDate(rules, date));
  return out;
}

/**
 * All-day events first, then by start time, then by title.
 * All-day items are the ones a family actually needs to see first.
 */
export function sortOccurrences(items: Occurrence[]): Occurrence[] {
  return [...items].sort((a, b) => {
    if (a.startTime === null && b.startTime !== null) return -1;
    if (a.startTime !== null && b.startTime === null) return 1;
    if (a.startTime !== null && b.startTime !== null && a.startTime !== b.startTime) {
      return a.startTime < b.startTime ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}
