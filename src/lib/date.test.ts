import { describe, expect, it } from 'vitest';
import {
  addAppDays,
  appDayOfWeek,
  datesBetween,
  formatFriendlyDate,
  formatTime,
  getCurrentAppDate,
  isAppDate,
  isNightHour,
  isWeekend,
  toAppDate,
  weekOf,
} from './date';

/**
 * UK DST in 2026: clocks go forward Sun 29 March, back Sun 25 October.
 * Several tests below sit deliberately on those boundaries.
 */

describe('getCurrentAppDate - 03:00 rollover', () => {
  it('treats 00:30 as still belonging to the previous day', () => {
    // 2026-01-15T00:30Z is 00:30 GMT.
    expect(getCurrentAppDate(new Date('2026-01-15T00:30:00Z'))).toBe('2026-01-14');
  });

  it('treats 02:59 as still the previous day', () => {
    expect(getCurrentAppDate(new Date('2026-01-15T02:59:00Z'))).toBe('2026-01-14');
  });

  it('rolls over exactly at 03:00', () => {
    expect(getCurrentAppDate(new Date('2026-01-15T03:00:00Z'))).toBe('2026-01-15');
  });

  it('does not roll over at any other hour', () => {
    for (const hour of [4, 9, 12, 17, 21, 23]) {
      const iso = `2026-01-15T${String(hour).padStart(2, '0')}:00:00Z`;
      expect(getCurrentAppDate(new Date(iso))).toBe('2026-01-15');
    }
  });

  it('honours a rolloverHour of 0 (plain midnight)', () => {
    expect(getCurrentAppDate(new Date('2026-01-15T00:30:00Z'), 0)).toBe('2026-01-15');
  });

  it('rejects an out-of-range rollover hour', () => {
    expect(() => getCurrentAppDate(new Date(), 24)).toThrow();
    expect(() => getCurrentAppDate(new Date(), -1)).toThrow();
  });
});

describe('getCurrentAppDate - British Summer Time', () => {
  it('uses London local time, not UTC, in summer', () => {
    // 01:30 UTC in August is 02:30 BST -> before the 03:00 rollover -> previous day.
    expect(getCurrentAppDate(new Date('2026-08-15T01:30:00Z'))).toBe('2026-08-14');
    // 02:30 UTC in August is 03:30 BST -> after the rollover -> same day.
    expect(getCurrentAppDate(new Date('2026-08-15T02:30:00Z'))).toBe('2026-08-15');
  });

  it('handles the same wall-clock instant differently in winter', () => {
    // 02:30 UTC in January is 02:30 GMT -> before the rollover -> previous day.
    expect(getCurrentAppDate(new Date('2026-01-15T02:30:00Z'))).toBe('2026-01-14');
  });

  it('is correct on the spring-forward morning', () => {
    // 29 Mar 2026: 01:00 GMT becomes 02:00 BST. 01:30 UTC = 02:30 BST -> previous day.
    expect(getCurrentAppDate(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-28');
    // 02:30 UTC = 03:30 BST -> same day.
    expect(getCurrentAppDate(new Date('2026-03-29T02:30:00Z'))).toBe('2026-03-29');
  });

  it('is correct on the autumn fall-back morning', () => {
    // 25 Oct 2026: 02:00 BST becomes 01:00 GMT. 02:30 UTC = 02:30 GMT -> previous day.
    expect(getCurrentAppDate(new Date('2026-10-25T02:30:00Z'))).toBe('2026-10-24');
    expect(getCurrentAppDate(new Date('2026-10-25T03:30:00Z'))).toBe('2026-10-25');
  });

  it('never yields a date more than one day either side of the UTC date', () => {
    for (let hour = 0; hour < 24; hour++) {
      const iso = `2026-06-15T${String(hour).padStart(2, '0')}:00:00Z`;
      const result = getCurrentAppDate(new Date(iso));
      expect(['2026-06-14', '2026-06-15']).toContain(result);
    }
  });
});

describe('day arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addAppDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('adds days across a year boundary', () => {
    expect(addAppDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('adds days across the spring DST boundary without losing a day', () => {
    expect(addAppDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addAppDays('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('adds days across the autumn DST boundary without gaining a day', () => {
    expect(addAppDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addAppDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('handles a leap day', () => {
    expect(addAppDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addAppDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('subtracts days', () => {
    expect(addAppDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('appDayOfWeek - 0 = Sunday', () => {
  it('maps known dates correctly', () => {
    expect(appDayOfWeek('2026-08-30')).toBe(0); // Sunday
    expect(appDayOfWeek('2026-08-31')).toBe(1); // Monday
    expect(appDayOfWeek('2026-09-01')).toBe(2); // Tuesday - term starts, INSET
    expect(appDayOfWeek('2026-08-29')).toBe(6); // Saturday
  });

  it('identifies weekends', () => {
    expect(isWeekend('2026-08-29')).toBe(true);
    expect(isWeekend('2026-08-30')).toBe(true);
    expect(isWeekend('2026-08-31')).toBe(false);
  });
});

describe('weekOf - Monday first', () => {
  it('starts on Monday when given a midweek date', () => {
    const week = weekOf('2026-09-02'); // a Wednesday
    expect(week[0]).toBe('2026-08-31');
    expect(week[6]).toBe('2026-09-06');
    expect(week).toHaveLength(7);
  });

  it('treats Sunday as the END of the week, not the start', () => {
    const week = weekOf('2026-08-30'); // a Sunday
    expect(week[0]).toBe('2026-08-24');
    expect(week[6]).toBe('2026-08-30');
  });

  it('returns the same week for every day within it', () => {
    const expected = weekOf('2026-08-31');
    for (const day of expected) {
      expect(weekOf(day)).toEqual(expected);
    }
  });
});

describe('datesBetween', () => {
  it('is inclusive of both ends', () => {
    expect(datesBetween('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  it('returns a single date when from equals to', () => {
    expect(datesBetween('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
  });

  it('returns empty when the range is inverted', () => {
    expect(datesBetween('2026-09-03', '2026-09-01')).toEqual([]);
  });

  it('spans the summer holiday without drift', () => {
    const range = datesBetween('2026-07-22', '2026-08-31');
    expect(range).toHaveLength(41);
    expect(range.at(-1)).toBe('2026-08-31');
  });
});

describe('validation', () => {
  it('accepts and rejects the right shapes', () => {
    expect(isAppDate('2026-09-01')).toBe(true);
    expect(isAppDate('2026-9-1')).toBe(false);
    expect(isAppDate('2026-09-01T00:00:00Z')).toBe(false);
    expect(isAppDate(new Date())).toBe(false);
    expect(isAppDate(null)).toBe(false);
  });

  it('round-trips a Date through toAppDate', () => {
    expect(toAppDate(new Date('2026-08-15T12:00:00Z'))).toBe('2026-08-15');
    // 23:30 UTC in summer is already the next day in London.
    expect(toAppDate(new Date('2026-08-15T23:30:00Z'))).toBe('2026-08-16');
  });
});

describe('formatting', () => {
  it('writes plain-English dates with correct ordinals', () => {
    expect(formatFriendlyDate('2026-03-03')).toBe('Tuesday 3rd March');
    expect(formatFriendlyDate('2026-03-01')).toBe('Sunday 1st March');
    expect(formatFriendlyDate('2026-03-02')).toBe('Monday 2nd March');
    expect(formatFriendlyDate('2026-03-04')).toBe('Wednesday 4th March');
  });

  it('gets the 11th, 12th and 13th right', () => {
    expect(formatFriendlyDate('2026-03-11')).toContain('11th');
    expect(formatFriendlyDate('2026-03-12')).toContain('12th');
    expect(formatFriendlyDate('2026-03-13')).toContain('13th');
  });

  it('gets the 21st, 22nd, 23rd and 31st right', () => {
    expect(formatFriendlyDate('2026-03-21')).toContain('21st');
    expect(formatFriendlyDate('2026-03-22')).toContain('22nd');
    expect(formatFriendlyDate('2026-03-23')).toContain('23rd');
    expect(formatFriendlyDate('2026-03-31')).toContain('31st');
  });

  it('formats times and passes through all-day events', () => {
    expect(formatTime('15:45:00')).toBe('3:45pm');
    expect(formatTime('09:00:00')).toBe('9:00am');
    expect(formatTime(null)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
  });
});

describe('isNightHour', () => {
  it('handles an evening window that wraps midnight', () => {
    // 19:00 to 06:00 - the normal case, and the one that gets written wrong.
    expect(isNightHour(19, 19, 6)).toBe(true);
    expect(isNightHour(23, 19, 6)).toBe(true);
    expect(isNightHour(0, 19, 6)).toBe(true);
    expect(isNightHour(5, 19, 6)).toBe(true);
    expect(isNightHour(6, 19, 6)).toBe(false);
    expect(isNightHour(12, 19, 6)).toBe(false);
    expect(isNightHour(18, 19, 6)).toBe(false);
  });

  it('handles a window that does not wrap', () => {
    expect(isNightHour(2, 1, 5)).toBe(true);
    expect(isNightHour(0, 1, 5)).toBe(false);
    expect(isNightHour(5, 1, 5)).toBe(false);
  });

  it('is never night when the window is empty', () => {
    for (let h = 0; h < 24; h++) expect(isNightHour(h, 7, 7)).toBe(false);
  });

  it('covers every hour of the day exactly once for a 19-6 window', () => {
    const night = Array.from({ length: 24 }, (_, h) => isNightHour(h, 19, 6));
    expect(night.filter(Boolean)).toHaveLength(11); // 19,20,21,22,23,0,1,2,3,4,5
  });
});
