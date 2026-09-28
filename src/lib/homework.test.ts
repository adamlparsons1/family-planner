import { describe, expect, it } from 'vitest';
import { dueLabel, homeworkState, homeworkWeek, type HomeworkItemLike } from './homework';

const THURSDAY = 4;

describe('the homework week', () => {
  it('runs Thursday to Wednesday when it starts on Thursday', () => {
    // 2026-09-28 is a Monday.
    expect(homeworkWeek('2026-09-28', THURSDAY)).toEqual({ start: '2026-09-24', end: '2026-09-30' });
  });

  it('starts on the Thursday itself', () => {
    expect(homeworkWeek('2026-10-01', THURSDAY).start).toBe('2026-10-01');
  });

  it('puts Wednesday at the end of the week, not the start of the next', () => {
    expect(homeworkWeek('2026-09-30', THURSDAY).start).toBe('2026-09-24');
  });

  it('follows the setting when the day changes', () => {
    expect(homeworkWeek('2026-09-28', 1)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(homeworkWeek('2026-09-27', 1).start).toBe('2026-09-21'); // Sunday belongs to the week before
  });
});

const phonics: HomeworkItemLike = {
  kind: 'weekly', targetPerWeek: 3, dueDate: null, setOn: '2026-09-01', isActive: true,
};

describe('weekly homework', () => {
  it('counts only this week\'s ticks', () => {
    const s = homeworkState(phonics, ['2026-09-22', '2026-09-24', '2026-09-28'], '2026-09-29', THURSDAY);
    expect(s).toMatchObject({ done: 2, target: 3, complete: false });
  });

  it('is complete at its target, and empty again when the new week starts', () => {
    const ticks = ['2026-09-25', '2026-09-26', '2026-09-28'];
    expect(homeworkState(phonics, ticks, '2026-09-30', THURSDAY).complete).toBe(true);
    expect(homeworkState(phonics, ticks, '2026-10-01', THURSDAY)).toMatchObject({ done: 0, complete: false });
  });

  it('counts two ticks on the same day', () => {
    const tt = { ...phonics, targetPerWeek: 4 };
    expect(homeworkState(tt, ['2026-09-28', '2026-09-28'], '2026-09-28', THURSDAY).done).toBe(2);
  });

  it('is hidden once retired', () => {
    expect(homeworkState({ ...phonics, isActive: false }, [], '2026-09-28', THURSDAY).visible).toBe(false);
  });
});

const topic: HomeworkItemLike = {
  kind: 'one_off', targetPerWeek: null, dueDate: '2026-10-09', setOn: '2026-09-25', isActive: true,
};

describe('one-off homework', () => {
  it('shows from the day it was set until it is done', () => {
    expect(homeworkState(topic, [], '2026-09-24', THURSDAY).visible).toBe(false);
    expect(homeworkState(topic, [], '2026-09-25', THURSDAY).visible).toBe(true);
  });

  it('stays visible, marked overdue, after its due date', () => {
    expect(homeworkState(topic, [], '2026-10-12', THURSDAY)).toMatchObject({ visible: true, overdue: true });
  });

  it('survives a new homework week: a fortnightly project is not reset', () => {
    expect(homeworkState(topic, [], '2026-10-02', THURSDAY)).toMatchObject({ visible: true, complete: false });
  });

  it('stays on screen for the rest of the day it was ticked, then goes', () => {
    expect(homeworkState(topic, ['2026-10-05'], '2026-10-05', THURSDAY)).toMatchObject({ visible: true, complete: true });
    expect(homeworkState(topic, ['2026-10-05'], '2026-10-06', THURSDAY).visible).toBe(false);
  });

  it('is never overdue once done', () => {
    expect(homeworkState(topic, ['2026-10-12'], '2026-10-12', THURSDAY).overdue).toBe(false);
  });
});

describe('due labels', () => {
  it('reads naturally', () => {
    expect(dueLabel('2026-09-28', '2026-09-28')).toBe('Due today');
    expect(dueLabel('2026-09-29', '2026-09-28')).toBe('Due tomorrow');
    expect(dueLabel('2026-10-09', '2026-09-28')).toBe('Due Fri 9 Oct');
    expect(dueLabel('2026-09-25', '2026-09-28')).toBe('Was due Fri 25 Sept');
  });
});
