import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { choreCompletions, chores, people, pointsLedger, rewards } from '@/db/schema';
import {
  getBalance, getBalances, getChoresForChild, getPendingStars, getRewardsForChild,
} from '@/lib/queries/points';
import { approveCompletion, recordCompletion, rejectCompletion } from '@/lib/chore-ledger';

let kid: typeof people.$inferSelect;
let other: typeof people.$inferSelect;

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  [kid] = await db.insert(people).values({
    name: 'P', displayName: 'Points', role: 'child', colour: '#7FB3DA', icon: 'P',
  }).returning();
  [other] = await db.insert(people).values({
    name: 'O', displayName: 'Other', role: 'child', colour: '#EFB0CC', icon: 'O',
  }).returning();
});

describe('a balance is always the sum of the ledger', () => {
  it('starts at zero with no rows', async () => {
    expect(await getBalance(kid.id)).toBe(0);
  });

  it('sums earnings and spending', async () => {
    const db = await getDb();
    await db.insert(pointsLedger).values([
      { personId: kid.id, delta: 5, reason: 'Tidy room', sourceType: 'chore' },
      { personId: kid.id, delta: 3, reason: 'Lay table', sourceType: 'chore' },
      { personId: kid.id, delta: -6, reason: 'Ice cream', sourceType: 'reward' },
      { personId: kid.id, delta: 2, reason: 'Being kind', sourceType: 'manual' },
    ]);
    expect(await getBalance(kid.id)).toBe(4);
  });

  it('agrees with a direct sum, always', async () => {
    const db = await getDb();
    const rows = await db.select().from(pointsLedger).where(eq(pointsLedger.personId, kid.id));
    const direct = rows.reduce((n, r) => n + r.delta, 0);
    expect(await getBalance(kid.id)).toBe(direct);
  });

  it('keeps children separate', async () => {
    expect(await getBalance(other.id)).toBe(0);
    const balances = await getBalances([kid.id, other.id]);
    expect(balances.get(kid.id)).toBe(4);
    expect(balances.get(other.id)).toBe(0);
  });

  it('can go negative rather than silently clamping', async () => {
    const db = await getDb();
    await db.insert(pointsLedger).values({
      personId: other.id, delta: -3, reason: 'Correction', sourceType: 'manual',
    });
    expect(await getBalance(other.id)).toBe(-3);
  });
});

describe('deleting a chore does not corrupt any historical balance', () => {
  it('leaves the balance and the record intact', async () => {
    const db = await getDb();
    const [chore] = await db.insert(chores).values({
      title: 'Feed the dog', icon: 'D', personId: kid.id, points: 7,
    }).returning();

    await db.insert(choreCompletions).values({
      choreId: chore.id, personId: kid.id, choreTitle: chore.title,
      pointsAwarded: chore.points, date: '2026-09-02', approvedAt: new Date(),
    });
    await db.insert(pointsLedger).values({
      personId: kid.id, delta: 7, reason: chore.title, sourceType: 'chore', sourceId: chore.id,
    });

    const before = await getBalance(kid.id);
    expect(before).toBe(11);

    await db.delete(chores).where(eq(chores.id, chore.id));

    expect(await getBalance(kid.id)).toBe(before);
    const [completion] = await db.select().from(choreCompletions)
      .where(eq(choreCompletions.personId, kid.id));
    expect(completion.choreTitle).toBe('Feed the dog');
    expect(completion.pointsAwarded).toBe(7);
  });

  it('survives the chore being renamed and re-priced afterwards', async () => {
    const db = await getDb();
    const [chore] = await db.insert(chores).values({
      title: 'Original', icon: 'X', personId: kid.id, points: 4,
    }).returning();
    await db.insert(choreCompletions).values({
      choreId: chore.id, personId: kid.id, choreTitle: chore.title,
      pointsAwarded: chore.points, date: '2026-09-03', approvedAt: new Date(),
    });
    await db.insert(pointsLedger).values({
      personId: kid.id, delta: 4, reason: chore.title, sourceType: 'chore', sourceId: chore.id,
    });
    const before = await getBalance(kid.id);

    await db.update(chores).set({ title: 'Renamed', points: 99 }).where(eq(chores.id, chore.id));

    // History keeps what was actually earned, not what the chore is worth now.
    expect(await getBalance(kid.id)).toBe(before);
    const [completion] = await db.select().from(choreCompletions)
      .where(eq(choreCompletions.date, '2026-09-03'));
    expect(completion.choreTitle).toBe('Original');
    expect(completion.pointsAwarded).toBe(4);
  });
});

describe('chores available to a child', () => {
  it('includes unassigned chores and their own, but not another child\'s', async () => {
    const db = await getDb();
    await db.insert(chores).values([
      { title: 'Anyone job', icon: 'A', personId: null, points: 1 },
      { title: 'Their job', icon: 'T', personId: kid.id, points: 1 },
      { title: 'Someone else job', icon: 'S', personId: other.id, points: 1 },
    ]);
    const list = await getChoresForChild(kid.id, '2026-09-02');
    const titles = list.map((c) => c.title);
    expect(titles).toContain('Anyone job');
    expect(titles).toContain('Their job');
    expect(titles).not.toContain('Someone else job');
  });

  it('respects a chore restricted to certain days', async () => {
    const db = await getDb();
    await db.insert(chores).values({
      title: 'Recycling', icon: 'R', personId: null, points: 2, daysOfWeek: [2],
    });
    const tuesday = await getChoresForChild(kid.id, '2026-09-08');
    const wednesday = await getChoresForChild(kid.id, '2026-09-09');
    expect(tuesday.map((c) => c.title)).toContain('Recycling');
    expect(wednesday.map((c) => c.title)).not.toContain('Recycling');
  });

  it('hides retired chores', async () => {
    const db = await getDb();
    const [retired] = await db.insert(chores).values({
      title: 'Retired job', icon: 'Z', personId: null, points: 1, isActive: false,
    }).returning();
    const list = await getChoresForChild(kid.id, '2026-09-02');
    expect(list.map((c) => c.id)).not.toContain(retired.id);
  });
});

describe('rewards', () => {
  it('offers shared rewards to everyone and personal ones only to their owner', async () => {
    const db = await getDb();
    await db.insert(rewards).values([
      { title: 'Film night', icon: 'F', costPoints: 15 },
      { title: 'Just theirs', icon: 'J', costPoints: 10, personId: kid.id },
    ]);
    const theirs = await getRewardsForChild(kid.id);
    const others = await getRewardsForChild(other.id);
    expect(theirs.map((r) => r.title)).toEqual(expect.arrayContaining(['Film night', 'Just theirs']));
    expect(others.map((r) => r.title)).toContain('Film night');
    expect(others.map((r) => r.title)).not.toContain('Just theirs');
  });
});

describe('claiming jobs', () => {
  const day = '2026-09-28';

  async function makeChore(values: Partial<typeof chores.$inferInsert> = {}) {
    const db = await getDb();
    const [c] = await db.insert(chores).values({
      title: 'Feed the dog', icon: 'd', points: 2, onePerDay: true, ...values,
    }).returning();
    return c;
  }

  it('new jobs need approval, and are one per child, unless told otherwise', async () => {
    const db = await getDb();
    const [c] = await db.insert(chores).values({ title: 'Plain', icon: 'x' }).returning();
    expect(c.requiresApproval).toBe(true);
    expect(c.onePerDay).toBe(false);
  });

  it('lets only one child claim a shared job on a day', async () => {
    const c = await makeChore();
    expect((await recordCompletion(c.id, kid.id, day)).ok).toBe(true);
    const second = await recordCompletion(c.id, other.id, day);
    expect(second).toEqual({ ok: false, error: 'Points already did that one today.' });
  });

  it('shows the other child who claimed it', async () => {
    const c = await makeChore({ title: 'Lay the table for dinner' });
    await recordCompletion(c.id, kid.id, day);
    const theirs = (await getChoresForChild(other.id, day)).find((x) => x.id === c.id);
    expect(theirs?.claimedBy).toEqual({ personId: kid.id, displayName: 'Points', icon: 'P' });
    const mine = (await getChoresForChild(kid.id, day)).find((x) => x.id === c.id);
    expect(mine?.claimedBy).toBeNull();
    expect(mine?.completion).not.toBeNull();
  });

  it('lets every child do an open job that is not one-per-day', async () => {
    const c = await makeChore({ title: 'Make your bed', onePerDay: false });
    expect((await recordCompletion(c.id, kid.id, day)).ok).toBe(true);
    expect((await recordCompletion(c.id, other.id, day)).ok).toBe(true);
    const theirs = (await getChoresForChild(other.id, day)).find((x) => x.id === c.id);
    expect(theirs?.claimedBy).toBeNull();
  });

  it('frees the shared job again on the next day', async () => {
    const c = await makeChore();
    await recordCompletion(c.id, kid.id, day);
    expect((await recordCompletion(c.id, other.id, '2026-09-29')).ok).toBe(true);
  });

  it('refuses a job assigned to someone else', async () => {
    const c = await makeChore({ personId: kid.id });
    expect((await recordCompletion(c.id, other.id, day)).ok).toBe(false);
  });

  it('pays nothing until approved, then pays once', async () => {
    const before = await getBalance(kid.id);
    const c = await makeChore({ points: 3 });
    await recordCompletion(c.id, kid.id, day);
    expect(await getBalance(kid.id)).toBe(before);
    expect((await getPendingStars([kid.id])).get(kid.id)).toBeGreaterThanOrEqual(3);

    const db = await getDb();
    const [row] = await db.select().from(choreCompletions).where(eq(choreCompletions.choreId, c.id));
    await approveCompletion(row.id);
    await approveCompletion(row.id); // idempotent: a double tap must not pay twice
    expect(await getBalance(kid.id)).toBe(before + 3);
  });

  it('"Not done" removes a waiting claim and writes no ledger row', async () => {
    const db = await getDb();
    const c = await makeChore({ points: 5 });
    await recordCompletion(c.id, other.id, day);
    const [row] = await db.select().from(choreCompletions).where(eq(choreCompletions.choreId, c.id));
    const ledgerBefore = (await db.select().from(pointsLedger)).length;

    expect((await rejectCompletion(row.id)).ok).toBe(true);
    expect(await db.select().from(choreCompletions).where(eq(choreCompletions.id, row.id))).toHaveLength(0);
    expect((await db.select().from(pointsLedger)).length).toBe(ledgerBefore);
    // And the shared job is free to be claimed properly now.
    expect((await recordCompletion(c.id, kid.id, day)).ok).toBe(true);
  });

  it('will not reject a claim that has already paid', async () => {
    const db = await getDb();
    const c = await makeChore();
    await recordCompletion(c.id, kid.id, day);
    const [row] = await db.select().from(choreCompletions).where(eq(choreCompletions.choreId, c.id));
    await approveCompletion(row.id);
    expect((await rejectCompletion(row.id)).ok).toBe(false);
  });

  it('still pays instantly for a job switched off approval', async () => {
    const before = await getBalance(other.id);
    const c = await makeChore({ requiresApproval: false, points: 4 });
    await recordCompletion(c.id, other.id, day);
    expect(await getBalance(other.id)).toBe(before + 4);
  });
});
