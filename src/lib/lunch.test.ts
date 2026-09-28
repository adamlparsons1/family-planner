import { describe, expect, it } from 'vitest';
import { defaultKey, lunchKey, resolveLunch, type LunchChoice } from './lunch';

const RUBY = 1;

const noChoices = new Map<string, LunchChoice>();
const noDefaults = new Map<string, LunchChoice>();

/** "School dinners on Mondays and Thursdays" as a standing pattern. */
const defaults = new Map<string, LunchChoice>([
  [defaultKey(RUBY, 1), 'school'],
  [defaultKey(RUBY, 4), 'school'],
  [defaultKey(RUBY, 2), 'packed'],
  [defaultKey(RUBY, 3), 'packed'],
  [defaultKey(RUBY, 5), 'packed'],
]);

describe('standing defaults', () => {
  it('produces the right choice for a whole week with no per-day input', () => {
    // Mon 7 to Fri 11 September 2026.
    const week: [string, LunchChoice][] = [
      ['2026-09-07', 'school'],
      ['2026-09-08', 'packed'],
      ['2026-09-09', 'packed'],
      ['2026-09-10', 'school'],
      ['2026-09-11', 'packed'],
    ];
    for (const [date, expected] of week) {
      const r = resolveLunch(date, RUBY, noChoices, defaults, true);
      expect(r.choice, date).toBe(expected);
      expect(r.isOverride, date).toBe(false);
      expect(r.isUnset, date).toBe(false);
    }
  });
});

describe('overrides', () => {
  it('a single-day choice beats the default and is flagged as an override', () => {
    const choices = new Map<string, LunchChoice>([[lunchKey(RUBY, '2026-09-07'), 'packed']]);
    const r = resolveLunch('2026-09-07', RUBY, choices, defaults, true);
    expect(r.choice).toBe('packed'); // the default was 'school'
    expect(r.isOverride).toBe(true);
  });

  it('does not leak into the rest of the week', () => {
    const choices = new Map<string, LunchChoice>([[lunchKey(RUBY, '2026-09-07'), 'packed']]);
    const thursday = resolveLunch('2026-09-10', RUBY, choices, defaults, true);
    expect(thursday.choice).toBe('school');
    expect(thursday.isOverride).toBe(false);
  });

  it('an override wins even on a non-school day', () => {
    const choices = new Map<string, LunchChoice>([[lunchKey(RUBY, '2026-09-05'), 'packed']]);
    const r = resolveLunch('2026-09-05', RUBY, choices, defaults, false); // Saturday
    expect(r.choice).toBe('packed');
    expect(r.isOverride).toBe(true);
  });
});

describe('days with no school lunch to decide', () => {
  it('is "at home" at the weekend', () => {
    const r = resolveLunch('2026-09-05', RUBY, noChoices, defaults, false);
    expect(r.choice).toBe('none');
    expect(r.isUnset).toBe(false);
  });

  it('is "at home" during the holidays and on INSET days', () => {
    const r = resolveLunch('2026-09-01', RUBY, noChoices, defaults, false);
    expect(r.choice).toBe('none');
  });
});

describe('nothing set at all', () => {
  it('is reported as unset, so the planner can prompt rather than guess', () => {
    const r = resolveLunch('2026-09-07', RUBY, noChoices, noDefaults, true);
    expect(r.isUnset).toBe(true);
    expect(r.choice).toBe('none');
  });

  it('is not reported as unset once a choice exists', () => {
    const choices = new Map<string, LunchChoice>([[lunchKey(RUBY, '2026-09-07'), 'school']]);
    expect(resolveLunch('2026-09-07', RUBY, choices, noDefaults, true).isUnset).toBe(false);
  });
});

describe('children do not affect each other', () => {
  it('keys defaults and choices per person', () => {
    const max = 2;
    const choices = new Map<string, LunchChoice>([[lunchKey(RUBY, '2026-09-08'), 'school']]);
    expect(resolveLunch('2026-09-08', RUBY, choices, defaults, true).choice).toBe('school');
    expect(resolveLunch('2026-09-08', max, choices, defaults, true).isUnset).toBe(true);
  });
});
