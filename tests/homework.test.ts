import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { homeworkCompletions, homeworkItems, people, pointsLedger } from '@/db/schema';
import { addTick, getHomeworkBoard, removeTick } from '@/lib/homework-store';

const THU = 4;
const MON = '2026-09-28';
const TUE = '2026-09-29';
const NEXT_THU = '2026-10-01';

let ruby: typeof people.$inferSelect;
let younger: typeof people.$inferSelect;

async function item(values: Partial<typeof homeworkItems.$inferInsert>) {
  const db = await getDb();
  const [i] = await db.insert(homeworkItems).values({
    personId: ruby.id, title: 'Phonics book', icon: 'b', kind: 'weekly', targetPerWeek: 3,
    setOn: '2026-09-01', ...values,
  }).returning();
  return i;
}

async function done(personId: number, itemId: number, date: string) {
  const board = await getHomeworkBoard([personId], date, THU);
  return board.get(personId)?.find((h) => h.id === itemId);
}

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  [ruby] = await db.insert(people).values({
    name: 'R', displayName: 'Ruby', role: 'child', colour: '#7FB3DA', icon: 'R',
  }).returning();
  [younger] = await db.insert(people).values({
    name: 'T', displayName: 'Younger', role: 'child', colour: '#EFB0CC', icon: 'T',
  }).returning();
});

describe('ticking weekly homework', () => {
  it('counts up to the target and stops there', async () => {
    const tt = await item({ title: 'Times tables', targetPerWeek: 4, unitLabel: '25 correct answers' });
    for (let n = 0; n < 4; n++) expect((await addTick(tt.id, ruby.id, MON, THU)).ok).toBe(true);
    expect(await addTick(tt.id, ruby.id, MON, THU)).toEqual({ ok: false, error: 'All done for this week!' });
    expect(await done(ruby.id, tt.id, MON)).toMatchObject({ done: 4, target: 4, complete: true });
  });

  it('starts from empty on Thursday', async () => {
    const book = await item({});
    await addTick(book.id, ruby.id, MON, THU);
    await addTick(book.id, ruby.id, TUE, THU);
    expect((await done(ruby.id, book.id, TUE))?.done).toBe(2);
    expect((await done(ruby.id, book.id, NEXT_THU))?.done).toBe(0);
  });

  it('takes back the latest tick this week, never last week\'s', async () => {
    const sheet = await item({ title: 'Sheet', targetPerWeek: 2 });
    await addTick(sheet.id, ruby.id, TUE, THU);
    await removeTick(sheet.id, ruby.id, NEXT_THU, THU); // nothing this week: no-op
    expect((await done(ruby.id, sheet.id, TUE))?.done).toBe(1);
    await removeTick(sheet.id, ruby.id, TUE, THU);
    expect((await done(ruby.id, sheet.id, TUE))?.done).toBe(0);
  });

  it('refuses another child ticking it', async () => {
    const maths = await item({ title: 'Maths' });
    expect((await addTick(maths.id, younger.id, MON, THU)).ok).toBe(false);
  });

  it('never touches the points ledger', async () => {
    const db = await getDb();
    expect(await db.select().from(pointsLedger)).toHaveLength(0);
  });
});

describe('one-off homework', () => {
  it('is done with one tick and cannot be ticked twice', async () => {
    const topic = await item({ title: 'Romans project', kind: 'one_off', targetPerWeek: null, dueDate: '2026-10-09', setOn: MON });
    expect((await addTick(topic.id, ruby.id, TUE, THU)).ok).toBe(true);
    expect((await addTick(topic.id, ruby.id, TUE, THU)).ok).toBe(false);
    expect(await done(ruby.id, topic.id, TUE)).toMatchObject({ complete: true });
    // Gone from the board the next day.
    expect(await done(ruby.id, topic.id, '2026-09-30')).toBeUndefined();
  });

  it('can be unticked after a mis-tap', async () => {
    const db = await getDb();
    const poster = await item({ title: 'Poster', kind: 'one_off', targetPerWeek: null, setOn: MON });
    await addTick(poster.id, ruby.id, TUE, THU);
    await removeTick(poster.id, ruby.id, TUE, THU);
    expect(await db.select().from(homeworkCompletions).where(eq(homeworkCompletions.itemId, poster.id))).toHaveLength(0);
  });

  it('carries on into the next homework week until done', async () => {
    const leaflet = await item({ title: 'Leaflet', kind: 'one_off', targetPerWeek: null, dueDate: '2026-10-02', setOn: MON });
    expect(await done(ruby.id, leaflet.id, '2026-10-05')).toMatchObject({ visible: true, overdue: true });
  });
});

describe('the board', () => {
  it('leaves out retired homework', async () => {
    const old = await item({ title: 'Old', isActive: false });
    expect(await done(ruby.id, old.id, MON)).toBeUndefined();
    expect((await addTick(old.id, ruby.id, MON, THU)).ok).toBe(false);
  });

  it('keeps each child\'s homework to themselves', async () => {
    const board = await getHomeworkBoard([ruby.id, younger.id], MON, THU);
    expect(board.get(younger.id)).toEqual([]);
    expect(board.get(ruby.id)?.length).toBeGreaterThan(0);
  });
});
