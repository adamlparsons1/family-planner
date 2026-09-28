import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  choreCompletions, chores, events, lunchDefaults, people,
  pointsLedger, routineCompletions, routineTasks, settings,
} from '@/db/schema';

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
});

async function child(name: string) {
  const db = await getDb();
  const [row] = await db.insert(people).values({
    name, displayName: name, role: 'child', colour: '#0072B2', icon: '*',
  }).returning();
  return row;
}

describe('events: exactly one schedule mode', () => {
  it('accepts a single-date event', async () => {
    const db = await getDb();
    await expect(
      db.insert(events).values({ title: 'Dentist', icon: '*', date: '2026-09-10' }),
    ).resolves.toBeDefined();
  });

  it('accepts a weekly recurring event', async () => {
    const db = await getDb();
    await expect(
      db.insert(events).values({ title: 'Swim Club', icon: '*', daysOfWeek: [2], endsOn: '2026-12-08' }),
    ).resolves.toBeDefined();
  });

  it('REJECTS an event that is both a date and a rule', async () => {
    const db = await getDb();
    await expect(
      db.insert(events).values({ title: 'Broken', icon: '*', date: '2026-09-10', daysOfWeek: [2] }),
    ).rejects.toThrow();
  });

  it('REJECTS an event that is neither', async () => {
    const db = await getDb();
    await expect(db.insert(events).values({ title: 'Broken', icon: '*' })).rejects.toThrow();
  });

  it('REJECTS an end date before its start date', async () => {
    const db = await getDb();
    await expect(
      db.insert(events).values({
        title: 'Backwards', icon: '*', daysOfWeek: [1],
        startsOn: '2026-12-01', endsOn: '2026-11-01',
      }),
    ).rejects.toThrow();
  });
});

describe('settings is a single row', () => {
  it('rejects a second settings row', async () => {
    const db = await getDb();
    await db.insert(settings).values({ id: 1, householdPasscodeHash: 'x', parentPinHash: 'y' });
    await expect(
      db.insert(settings).values({ id: 2, householdPasscodeHash: 'x', parentPinHash: 'y' }),
    ).rejects.toThrow();
  });
});

describe('routine completions', () => {
  it('cannot be recorded twice for the same task on the same day', async () => {
    const db = await getDb();
    const kid = await child('Twice');
    const [task] = await db.insert(routineTasks).values({
      personId: kid.id, title: 'Teeth', icon: '*', daysOfWeek: [1, 2, 3, 4, 5],
    }).returning();

    await db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-02' });
    await expect(
      db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-02' }),
    ).rejects.toThrow();

    // ...but the same task on a different day is fine.
    await expect(
      db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-03' }),
    ).resolves.toBeDefined();
  });

  it('unticking deletes the row, leaving no trace to block a re-tick', async () => {
    const db = await getDb();
    const kid = await child('Undo');
    const [task] = await db.insert(routineTasks).values({
      personId: kid.id, title: 'Shoes', icon: '*', daysOfWeek: [1],
    }).returning();

    await db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-07' });
    await db.delete(routineCompletions).where(eq(routineCompletions.taskId, task.id));
    await expect(
      db.insert(routineCompletions).values({ taskId: task.id, date: '2026-09-07' }),
    ).resolves.toBeDefined();
  });
});

describe('lunch defaults', () => {
  it('rejects a day-of-week outside 0-6', async () => {
    const db = await getDb();
    const kid = await child('Lunch');
    await expect(
      db.insert(lunchDefaults).values({ personId: kid.id, dayOfWeek: 7, choice: 'school' }),
    ).rejects.toThrow();
  });

  it('allows one default per person per day, and no more', async () => {
    const db = await getDb();
    const kid = await child('Lunch2');
    await db.insert(lunchDefaults).values({ personId: kid.id, dayOfWeek: 1, choice: 'school' });
    await expect(
      db.insert(lunchDefaults).values({ personId: kid.id, dayOfWeek: 1, choice: 'packed' }),
    ).rejects.toThrow();
  });
});

describe('points: deleting a chore must not corrupt history', () => {
  it('keeps the ledger and the completion record intact', async () => {
    const db = await getDb();
    const kid = await child('Earner');

    const [chore] = await db.insert(chores).values({
      title: 'Feed the dog', icon: '*', personId: kid.id, points: 5,
    }).returning();

    await db.insert(choreCompletions).values({
      choreId: chore.id, personId: kid.id, choreTitle: chore.title,
      pointsAwarded: chore.points, date: '2026-09-02',
    });
    await db.insert(pointsLedger).values({
      personId: kid.id, delta: 5, reason: 'Feed the dog', sourceType: 'chore', sourceId: chore.id,
    });

    const balanceBefore = await balanceOf(kid.id);
    expect(balanceBefore).toBe(5);

    await db.delete(chores).where(eq(chores.id, chore.id));

    // The balance is unchanged...
    expect(await balanceOf(kid.id)).toBe(5);
    // ...and the history still says what was done and what it was worth.
    const [completion] = await db.select().from(choreCompletions).where(eq(choreCompletions.personId, kid.id));
    expect(completion.choreTitle).toBe('Feed the dog');
    expect(completion.pointsAwarded).toBe(5);
    expect(completion.choreId).toBeNull();
  });

  it('derives a balance that always equals the sum of the ledger', async () => {
    const db = await getDb();
    const kid = await child('Spender');
    await db.insert(pointsLedger).values([
      { personId: kid.id, delta: 10, reason: 'Chores', sourceType: 'chore' },
      { personId: kid.id, delta: 4, reason: 'Chores', sourceType: 'chore' },
      { personId: kid.id, delta: -12, reason: 'Ice cream', sourceType: 'reward' },
      { personId: kid.id, delta: 3, reason: 'Being kind', sourceType: 'manual' },
    ]);
    expect(await balanceOf(kid.id)).toBe(5);
  });
});

async function balanceOf(personId: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.personId, personId));
  return row.total;
}
