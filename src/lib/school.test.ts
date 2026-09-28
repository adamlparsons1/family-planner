import { describe, expect, it } from 'vitest';
import { isSchoolDay, taskAppliesOn } from './school';
import { appDayOfWeek } from './date';

/** The real seeded calendar around the start of Autumn term 2026. */
const NON_SCHOOL = new Set([
  '2026-08-27', // summer holiday (a Thursday)
  '2026-08-28',
  '2026-08-31',
  '2026-09-01', // INSET day (a Tuesday)
  '2026-10-26', // October half term
]);

describe('isSchoolDay', () => {
  it('is false during the holidays', () => {
    expect(isSchoolDay('2026-08-27', NON_SCHOOL)).toBe(false);
  });

  it('is false on an INSET day', () => {
    expect(isSchoolDay('2026-09-01', NON_SCHOOL)).toBe(false);
  });

  it('is false at weekends even though no row exists for them', () => {
    expect(isSchoolDay('2026-09-05', NON_SCHOOL)).toBe(false); // Saturday
    expect(isSchoolDay('2026-09-06', NON_SCHOOL)).toBe(false); // Sunday
  });

  it('is true on an ordinary term-time weekday', () => {
    expect(isSchoolDay('2026-09-02', NON_SCHOOL)).toBe(true); // Wednesday
    expect(isSchoolDay('2026-09-03', NON_SCHOOL)).toBe(true);
    expect(isSchoolDay('2026-09-04', NON_SCHOOL)).toBe(true);
  });
});

describe('taskAppliesOn', () => {
  const weekdays = [1, 2, 3, 4, 5];
  const everyday = { daysOfWeek: weekdays, schoolDaysOnly: false, isActive: true };
  const schoolOnly = { daysOfWeek: weekdays, schoolDaysOnly: true, isActive: true };

  const on = (task: typeof everyday, date: string) =>
    taskAppliesOn(task, date, NON_SCHOOL, appDayOfWeek(date));

  it('shows an everyday weekday task on a school day', () => {
    expect(on(everyday, '2026-09-02')).toBe(true);
  });

  it('shows an everyday weekday task during half term (brushing teeth still applies)', () => {
    expect(on(everyday, '2026-10-26')).toBe(true);
  });

  it('hides a school-days-only task on an INSET day', () => {
    expect(on(schoolOnly, '2026-09-01')).toBe(false);
  });

  it('hides a school-days-only task during half term', () => {
    expect(on(schoolOnly, '2026-10-26')).toBe(false);
  });

  it('hides every weekday task at the weekend, there being no weekend routine', () => {
    expect(on(everyday, '2026-09-05')).toBe(false);
    expect(on(schoolOnly, '2026-09-06')).toBe(false);
  });

  it('hides inactive tasks regardless of date', () => {
    expect(on({ ...everyday, isActive: false }, '2026-09-02')).toBe(false);
  });

  it('respects a narrower daysOfWeek pattern', () => {
    const tuesdaysOnly = { daysOfWeek: [2], schoolDaysOnly: false, isActive: true };
    expect(on(tuesdaysOnly, '2026-09-08')).toBe(true); // Tuesday
    expect(on(tuesdaysOnly, '2026-09-09')).toBe(false); // Wednesday
  });
});
