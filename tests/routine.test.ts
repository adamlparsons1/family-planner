import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { nonSchoolDays, people, routineCompletions, routineTasks } from '@/db/schema';
import { getChildRoutine } from '@/lib/queries/routine';
import { getCurrentAppDate } from '@/lib/date';

let kid: typeof people.$inferSelect;

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });

  [kid] = await db.insert(people).values({
    name: 'Test', displayName: 'Test', role: 'child', colour: '#7FB3DA', icon: '*',
  }).returning();

  await db.insert(routineTasks).values([
    { personId: kid.id, title: 'Eat breakfast', icon: 'b', category: 'Breakfast', sortOrder: 0, daysOfWeek: [1,2,3,4,5], schoolDaysOnly: false },
    { personId: kid.id, title: 'Brush teeth', icon: 't', category: 'Bathroom', sortOrder: 1, daysOfWeek: [1,2,3,4,5], schoolDaysOnly: false },
    { personId: kid.id, title: 'Water bottle', icon: 'w', category: 'Ready to go', sortOrder: 2, daysOfWeek: [1,2,3,4,5], schoolDaysOnly: true },
  ]);

  // 2026-09-01 is an INSET day; 2026-09-02 and 03 are ordinary school days.
  await db.insert(nonSchoolDays).values({ date: '2026-09-01', reason: 'inset', label: 'INSET day' });
});

describe('getChildRoutine', () => {
  it('groups tasks into stages in order', async () => {
    const r = await getChildRoutine(kid, '2026-09-02'); // Wednesday, school day
    expect(r.stages.map((s) => s.category)).toEqual(['Breakfast', 'Bathroom', 'Ready to go']);
    expect(r.total).toBe(3);
  });

  it('hides school-days-only tasks on an INSET day but keeps the rest', async () => {
    const r = await getChildRoutine(kid, '2026-09-01'); // Tuesday, INSET
    const titles = r.stages.flatMap((s) => s.tasks.map((t) => t.title));
    expect(titles).toContain('Eat breakfast');
    expect(titles).toContain('Brush teeth');
    expect(titles).not.toContain('Water bottle');
    expect(r.total).toBe(2);
  });

  it('shows nothing at the weekend, there being no weekend routine', async () => {
    const r = await getChildRoutine(kid, '2026-09-05'); // Saturday
    expect(r.total).toBe(0);
    expect(r.stages).toEqual([]);
  });
});

describe('completions are per-day and reset by the date rolling over', () => {
  it('counts a completion on the day it was made, and not the next day', async () => {
    const db = await getDb();
    const [task] = await db.select().from(routineTasks)
      .where(and(eq(routineTasks.personId, kid.id), eq(routineTasks.title, 'Eat breakfast')));

    await db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-02' });

    const wed = await getChildRoutine(kid, '2026-09-02');
    expect(wed.completed).toBe(1);

    // The next day starts clean. There is no reset job: a new date simply has no rows.
    const thu = await getChildRoutine(kid, '2026-09-03');
    expect(thu.completed).toBe(0);
  });

  it('unticking removes the row so the task can be ticked again', async () => {
    const db = await getDb();
    const [task] = await db.select().from(routineTasks)
      .where(and(eq(routineTasks.personId, kid.id), eq(routineTasks.title, 'Brush teeth')));

    await db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-04' });
    expect((await getChildRoutine(kid, '2026-09-04')).completed).toBe(1);

    await db.delete(routineCompletions)
      .where(and(eq(routineCompletions.taskId, task.id), eq(routineCompletions.date, '2026-09-04')));
    expect((await getChildRoutine(kid, '2026-09-04')).completed).toBe(0);

    await db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-04' });
    expect((await getChildRoutine(kid, '2026-09-04')).completed).toBe(1);
  });
});

describe('the day a completion lands on, around the 03:00 rollover', () => {
  /**
   * The acceptance criterion is that completions reset at 03:00 and not at any
   * other hour. There is no scheduled job: the date a completion is written
   * against comes from getCurrentAppDate(), so the rollover IS the reset.
   */
  it('writes to the previous day before 03:00', () => {
    expect(getCurrentAppDate(new Date('2026-09-03T00:30:00Z'))).toBe('2026-09-02');
    expect(getCurrentAppDate(new Date('2026-09-03T01:59:00Z'))).toBe('2026-09-02');
  });

  it('writes to the new day from 03:00 onward', () => {
    expect(getCurrentAppDate(new Date('2026-09-03T03:00:00Z'))).toBe('2026-09-03');
    expect(getCurrentAppDate(new Date('2026-09-03T07:15:00Z'))).toBe('2026-09-03');
  });

  it('does not reset at midnight', () => {
    const justBeforeMidnight = getCurrentAppDate(new Date('2026-09-02T23:00:00Z'));
    const justAfterMidnight = getCurrentAppDate(new Date('2026-09-03T00:10:00Z'));
    expect(justAfterMidnight).toBe(justBeforeMidnight);
  });
});
