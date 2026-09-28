/**
 * Homework arithmetic. Pure, so it is testable without a database and
 * safe to import on the client.
 *
 * The homework week starts on a configurable day (Thursday, when the new
 * homework comes home) rather than Monday, and the day still rolls over at
 * 03:00 like everything else: a tick at 1am on Thursday counts for the week
 * that is ending.
 */
import { addAppDays, appDayOfWeek, type AppDate } from './date';

export type HomeworkKind = 'weekly' | 'one_off';

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** First and last day of the homework week containing `date`. */
export function homeworkWeek(date: AppDate, startDay: number): { start: AppDate; end: AppDate } {
  const back = (appDayOfWeek(date) - startDay + 7) % 7;
  const start = addAppDays(date, -back);
  return { start, end: addAppDays(start, 6) };
}

export type HomeworkItemLike = {
  kind: HomeworkKind;
  targetPerWeek: number | null;
  dueDate: AppDate | null;
  setOn: AppDate;
  isActive: boolean;
};

export type HomeworkState = {
  /** Ticks that count right now: this week's for weekly, 0 or 1 for a one-off. */
  done: number;
  target: number;
  complete: boolean;
  /** A one-off past its due date and not done. Never hidden for this. */
  overdue: boolean;
  /** Whether the kiosk shows it today. */
  visible: boolean;
};

/**
 * Where one piece of homework stands on `today`, given the dates of every tick
 * it has (any order).
 */
export function homeworkState(
  item: HomeworkItemLike,
  tickDates: AppDate[],
  today: AppDate,
  startDay: number,
): HomeworkState {
  if (item.kind === 'weekly') {
    const { start, end } = homeworkWeek(today, startDay);
    const target = Math.max(1, item.targetPerWeek ?? 1);
    const done = tickDates.filter((d) => d >= start && d <= end).length;
    return { done, target, complete: done >= target, overdue: false, visible: item.isActive };
  }

  const complete = tickDates.length > 0;
  const lastTick = tickDates.reduce<AppDate | null>((a, d) => (a === null || d > a ? d : a), null);
  return {
    done: complete ? 1 : 0,
    target: 1,
    complete,
    overdue: !complete && item.dueDate !== null && item.dueDate < today,
    // Shown from the day it was set until it is ticked off, and for the rest
    // of the day it was ticked, so a mis-tap can still be undone.
    visible: item.isActive && item.setOn <= today && (!complete || lastTick === today),
  };
}

/** "Due Fri 10 Oct", "Due today", "Due tomorrow", "Was due Tue 6 Oct". */
export function dueLabel(dueDate: AppDate, today: AppDate): string {
  if (dueDate === today) return 'Due today';
  if (dueDate === addAppDays(today, 1)) return 'Due tomorrow';
  const when = formatDueDate(dueDate);
  return dueDate < today ? `Was due ${when}` : `Due ${when}`;
}

/** "Fri 9 Oct". */
export function formatDueDate(dueDate: AppDate): string {
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}
