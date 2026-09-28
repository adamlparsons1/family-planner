import { describe, expect, it } from 'vitest';
import { expandForDate, expandForDates, occursOn, sortOccurrences, type EventRule } from './recurrence';

const base: EventRule = {
  id: 1, title: 'Thing', icon: '*', date: null, daysOfWeek: null,
  startsOn: null, endsOn: null, startTime: null, endTime: null,
  location: null, notes: null, isSchoolRelated: false,
};

/** A typical club: Swim Club, Tuesdays, 15 Sep to 8 Dec 2026. */
const scienceClub: EventRule = {
  ...base, id: 10, title: 'Swim Club', icon: '*',
  daysOfWeek: [2], startsOn: '2026-09-15', endsOn: '2026-12-08', startTime: '15:30:00',
};

describe('single-date events', () => {
  const dentist: EventRule = { ...base, id: 2, title: 'Dentist', date: '2026-09-10' };

  it('occurs on its date and no other', () => {
    expect(occursOn(dentist, '2026-09-10')).toBe(true);
    expect(occursOn(dentist, '2026-09-09')).toBe(false);
    expect(occursOn(dentist, '2026-09-11')).toBe(false);
  });

  it('is not marked as recurring', () => {
    expect(expandForDate([dentist], '2026-09-10')[0].isRecurring).toBe(false);
  });
});

describe('weekly recurrence', () => {
  it('appears on every matching weekday within its bounds', () => {
    // Tuesdays in the club's run: 15/22/29 Sep, 6/13/20 Oct, 3/10/17/24 Nov, 1/8 Dec.
    const tuesdays = [
      '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13',
      '2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17',
      '2026-11-24', '2026-12-01', '2026-12-08',
    ];
    for (const d of tuesdays) expect(occursOn(scienceClub, d)).toBe(true);
  });

  it('does not appear on other weekdays', () => {
    expect(occursOn(scienceClub, '2026-09-16')).toBe(false); // Wednesday
    expect(occursOn(scienceClub, '2026-09-14')).toBe(false); // Monday
  });

  it('does not appear before it starts', () => {
    expect(occursOn(scienceClub, '2026-09-08')).toBe(false); // a Tuesday, but too early
    expect(occursOn(scienceClub, '2026-09-01')).toBe(false);
  });

  it('DISAPPEARS after its end date, without anyone tidying up', () => {
    expect(occursOn(scienceClub, '2026-12-08')).toBe(true); // last session
    expect(occursOn(scienceClub, '2026-12-15')).toBe(false); // the Tuesday after
    expect(occursOn(scienceClub, '2027-01-05')).toBe(false);
  });

  it('runs forever when unbounded', () => {
    const swimming: EventRule = { ...base, id: 3, title: 'Swimming', daysOfWeek: [6] };
    expect(occursOn(swimming, '2026-09-05')).toBe(true);
    expect(occursOn(swimming, '2030-09-07')).toBe(true);
  });

  it('handles a rule on several days a week', () => {
    const school: EventRule = { ...base, id: 4, title: 'School', daysOfWeek: [1, 2, 3, 4, 5] };
    expect(occursOn(school, '2026-09-07')).toBe(true);  // Mon
    expect(occursOn(school, '2026-09-11')).toBe(true);  // Fri
    expect(occursOn(school, '2026-09-12')).toBe(false); // Sat
  });

  it('is marked as recurring', () => {
    expect(expandForDate([scienceClub], '2026-09-15')[0].isRecurring).toBe(true);
  });

  it('editing the rule changes every occurrence, because there is only one row', () => {
    const renamed = { ...scienceClub, title: 'Mad Science' };
    for (const d of ['2026-09-15', '2026-10-20', '2026-12-08']) {
      expect(expandForDate([renamed], d)[0].title).toBe('Mad Science');
    }
  });
});

describe('expansion across a week', () => {
  it('places each occurrence on the right day', () => {
    const week = ['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20'];
    const map = expandForDates([scienceClub], week);
    expect(map.get('2026-09-15')).toHaveLength(1);
    expect(map.get('2026-09-14')).toHaveLength(0);
    expect(map.get('2026-09-16')).toHaveLength(0);
    expect([...map.keys()]).toHaveLength(7);
  });
});

describe('ordering', () => {
  it('puts all-day items first, then times in order', () => {
    const items = sortOccurrences([
      { ...base, eventId: 1, date: '2026-09-15', startTime: '15:30:00', title: 'Club', isRecurring: false },
      { ...base, eventId: 2, date: '2026-09-15', startTime: null, title: 'Non-uniform day', isRecurring: false },
      { ...base, eventId: 3, date: '2026-09-15', startTime: '09:00:00', title: 'Dentist', isRecurring: false },
    ] as never);
    expect(items.map((i) => i.title)).toEqual(['Non-uniform day', 'Dentist', 'Club']);
  });

  it('breaks ties on title so the order never jitters between renders', () => {
    const items = sortOccurrences([
      { ...base, eventId: 1, date: '2026-09-15', startTime: '09:00:00', title: 'Zoo', isRecurring: false },
      { ...base, eventId: 2, date: '2026-09-15', startTime: '09:00:00', title: 'Assembly', isRecurring: false },
    ] as never);
    expect(items.map((i) => i.title)).toEqual(['Assembly', 'Zoo']);
  });
});
