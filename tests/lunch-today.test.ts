import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { lunchChoices, lunchDefaults, people } from '@/db/schema';
import { getLunchGrid } from '@/lib/queries/meals';
import { lunchKey } from '@/lib/lunch';
import { normaliseDish, saveLunch } from '@/lib/lunch-store';

let ruby: typeof people.$inferSelect;
let younger: typeof people.$inferSelect;
const MONDAY = '2026-09-28';
const TUESDAY = '2026-09-29';
const WEDNESDAY = '2026-09-30';

async function row(personId: number, date: string) {
  const db = await getDb();
  const [r] = await db.select().from(lunchChoices)
    .where(and(eq(lunchChoices.personId, personId), eq(lunchChoices.date, date)));
  return r;
}

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  [ruby] = await db.insert(people).values({
    name: 'R', displayName: 'Ruby', role: 'child', colour: '#7FB3DA', icon: 'R', showLunchOnCard: true,
  }).returning();
  [younger] = await db.insert(people).values({
    name: 'T', displayName: 'Younger', role: 'child', colour: '#EFB0CC', icon: 'T',
  }).returning();
  // Ruby usually has school dinner on Wednesdays.
  await db.insert(lunchDefaults).values({ personId: ruby.id, dayOfWeek: 3, choice: 'school' });
});

describe('school dinner menus', () => {
  it('shows lunch on a card only when switched on', () => {
    expect(younger.showLunchOnCard).toBe(false);
    expect(ruby.showLunchOnCard).toBe(true);
  });

  it('records the dish for one date, ahead of time, and nothing else', async () => {
    await saveLunch({ personId: ruby.id, date: TUESDAY, choice: 'school', dish: '  Fish fingers   and chips ' });
    expect(await row(ruby.id, TUESDAY)).toMatchObject({ choice: 'school', dish: 'Fish fingers and chips' });
    expect(await row(ruby.id, MONDAY)).toBeUndefined();
  });

  it('returns the dish in the lunch grid the morning card reads', async () => {
    const grid = await getLunchGrid([MONDAY, TUESDAY], [ruby.id], () => true);
    expect(grid.get(lunchKey(ruby.id, TUESDAY))).toMatchObject({
      choice: 'school', isOverride: true, dish: 'Fish fingers and chips',
    });
    expect(grid.get(lunchKey(ruby.id, MONDAY))?.dish).toBeNull();
  });

  it('adds a dish to a day that was school dinner by the usual pattern', async () => {
    await saveLunch({ personId: ruby.id, date: WEDNESDAY, choice: 'school', dish: 'Roast chicken' });
    const grid = await getLunchGrid([WEDNESDAY], [ruby.id], () => true);
    expect(grid.get(lunchKey(ruby.id, WEDNESDAY))).toMatchObject({ choice: 'school', dish: 'Roast chicken' });
  });

  it('keeps the dish when school dinner is chosen again without one', async () => {
    await saveLunch({ personId: ruby.id, date: TUESDAY, choice: 'school' });
    expect((await row(ruby.id, TUESDAY)).dish).toBe('Fish fingers and chips');
  });

  it('clears the dish on moving to packed lunch, so it never comes back', async () => {
    await saveLunch({ personId: ruby.id, date: TUESDAY, choice: 'packed' });
    expect(await row(ruby.id, TUESDAY)).toMatchObject({ choice: 'packed', dish: null });
    await saveLunch({ personId: ruby.id, date: TUESDAY, choice: 'school' });
    expect((await row(ruby.id, TUESDAY)).dish).toBeNull();
  });

  it('clears the dish on moving to at home', async () => {
    await saveLunch({ personId: ruby.id, date: WEDNESDAY, choice: 'none' });
    expect(await row(ruby.id, WEDNESDAY)).toMatchObject({ choice: 'none', dish: null });
  });

  it('does not change the usual weekday pattern', async () => {
    const db = await getDb();
    const defaults = await db.select().from(lunchDefaults).where(eq(lunchDefaults.personId, ruby.id));
    expect(defaults).toEqual([expect.objectContaining({ dayOfWeek: 3, choice: 'school' })]);
  });

  it('treats a blank dish as none, and caps a long one', () => {
    expect(normaliseDish('   ')).toBeNull();
    expect(normaliseDish(null)).toBeNull();
    expect(normaliseDish('x'.repeat(200))).toHaveLength(80);
  });
});
