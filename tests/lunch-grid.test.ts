import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDb } from '@/db';
import { lunchChoices, lunchDefaults, meals, people } from '@/db/schema';
import { getLunchGrid, getMealsForDates } from '@/lib/queries/meals';
import { lunchKey } from '@/lib/lunch';

let kid: typeof people.$inferSelect;
const WEEK = ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13'];
const alwaysSchoolDay = (d: string) => !['2026-09-12', '2026-09-13'].includes(d); // weekend

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  [kid] = await db.insert(people).values({
    name: 'L', displayName: 'Lunch', role: 'child', colour: '#7FB3DA', icon: 'L',
  }).returning();

  // "School dinners on Mondays and Thursdays, packed the rest."
  await db.insert(lunchDefaults).values([
    { personId: kid.id, dayOfWeek: 1, choice: 'school' },
    { personId: kid.id, dayOfWeek: 2, choice: 'packed' },
    { personId: kid.id, dayOfWeek: 3, choice: 'packed' },
    { personId: kid.id, dayOfWeek: 4, choice: 'school' },
    { personId: kid.id, dayOfWeek: 5, choice: 'packed' },
  ]);
});

describe('a default pattern fills a whole week with no per-day input', () => {
  it('resolves every weekday from the standing pattern alone', async () => {
    const grid = await getLunchGrid(WEEK, [kid.id], alwaysSchoolDay);
    const choiceOn = (d: string) => grid.get(lunchKey(kid.id, d))!;

    expect(choiceOn('2026-09-07').choice).toBe('school'); // Mon
    expect(choiceOn('2026-09-08').choice).toBe('packed'); // Tue
    expect(choiceOn('2026-09-09').choice).toBe('packed'); // Wed
    expect(choiceOn('2026-09-10').choice).toBe('school'); // Thu
    expect(choiceOn('2026-09-11').choice).toBe('packed'); // Fri

    // None of them are overrides - nobody typed anything per-day.
    for (const d of WEEK.slice(0, 5)) expect(choiceOn(d).isOverride).toBe(false);
  });

  it('leaves the weekend as at-home', async () => {
    const grid = await getLunchGrid(WEEK, [kid.id], alwaysSchoolDay);
    expect(grid.get(lunchKey(kid.id, '2026-09-12'))!.choice).toBe('none');
    expect(grid.get(lunchKey(kid.id, '2026-09-13'))!.choice).toBe('none');
  });
});

describe('a single-day override', () => {
  it('displays as an override and does not disturb the rest of the week', async () => {
    const db = await getDb();
    // Monday is normally a school dinner; this Monday it is packed.
    await db.insert(lunchChoices).values({ personId: kid.id, date: '2026-09-07', choice: 'packed' });

    const grid = await getLunchGrid(WEEK, [kid.id], alwaysSchoolDay);
    const monday = grid.get(lunchKey(kid.id, '2026-09-07'))!;
    expect(monday.choice).toBe('packed');
    expect(monday.isOverride).toBe(true);

    // Thursday still follows the pattern.
    const thursday = grid.get(lunchKey(kid.id, '2026-09-10'))!;
    expect(thursday.choice).toBe('school');
    expect(thursday.isOverride).toBe(false);
  });

  it('reverts to the default when the override row is removed', async () => {
    const db = await getDb();
    await db.delete(lunchChoices);
    const grid = await getLunchGrid(WEEK, [kid.id], alwaysSchoolDay);
    const monday = grid.get(lunchKey(kid.id, '2026-09-07'))!;
    expect(monday.choice).toBe('school');
    expect(monday.isOverride).toBe(false);
  });
});

describe('meals', () => {
  it('stores one dinner per date', async () => {
    const db = await getDb();
    await db.insert(meals).values({ date: '2026-09-07', title: 'Spaghetti bolognese', icon: 'P' });
    const byDate = await getMealsForDates(WEEK);
    expect(byDate.get('2026-09-07')?.title).toBe('Spaghetti bolognese');
    expect(byDate.get('2026-09-08')).toBeUndefined();
  });

  it('refuses a second dinner on the same date', async () => {
    const db = await getDb();
    await expect(
      db.insert(meals).values({ date: '2026-09-07', title: 'Something else', icon: 'X' }),
    ).rejects.toThrow();
  });
});
