import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { choreCompletions, chores, people, pointsLedger, rewards } from '@/db/schema';
import { appDayOfWeek, type AppDate } from '@/lib/date';

/**
 * A balance is ALWAYS the sum of the ledger. There is no balance column and
 * there must never be one: a running total drifts the first time something is
 * edited, and then a child notices, and then you are relitigating the
 * accounting at bedtime.
 */
export async function getBalances(personIds: number[]): Promise<Map<number, number>> {
  if (personIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({
      personId: pointsLedger.personId,
      total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
    })
    .from(pointsLedger)
    .where(inArray(pointsLedger.personId, personIds))
    .groupBy(pointsLedger.personId);

  const map = new Map<number, number>(personIds.map((id) => [id, 0]));
  for (const r of rows) map.set(r.personId, r.total);
  return map;
}

export async function getBalance(personId: number): Promise<number> {
  return (await getBalances([personId])).get(personId) ?? 0;
}

/** Points earned since a date, per person. Drives the weekly summary. */
export async function getEarnedSince(personIds: number[], since: AppDate): Promise<Map<number, number>> {
  if (personIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({
      personId: pointsLedger.personId,
      total: sql<number>`coalesce(sum(case when ${pointsLedger.delta} > 0 then ${pointsLedger.delta} else 0 end), 0)::int`,
    })
    .from(pointsLedger)
    .where(
      and(
        inArray(pointsLedger.personId, personIds),
        gte(pointsLedger.createdAt, new Date(`${since}T00:00:00Z`)),
      ),
    )
    .groupBy(pointsLedger.personId);

  const map = new Map<number, number>(personIds.map((id) => [id, 0]));
  for (const r of rows) map.set(r.personId, r.total);
  return map;
}

export type ChoreForDay = {
  id: number;
  title: string;
  icon: string;
  points: number;
  requiresApproval: boolean;
  personId: number | null;
  onePerDay: boolean;
  /** Set when this child has already done it today. */
  completion: { id: number; approvedAt: Date | null } | null;
  /**
   * A shared job another child has already claimed today. Shown greyed
   * out with the claimer's icon, and cannot be claimed again.
   */
  claimedBy: { personId: number; displayName: string; icon: string } | null;
};

/** Chores available to one child today, with their completion state. */
export async function getChoresForChild(personId: number, date: AppDate): Promise<ChoreForDay[]> {
  const db = await getDb();
  const dayOfWeek = appDayOfWeek(date);

  const [all, doneToday, everyone] = await Promise.all([
    db.select().from(chores).where(eq(chores.isActive, true)).orderBy(asc(chores.title)),
    db.select().from(choreCompletions).where(eq(choreCompletions.date, date)),
    db.select().from(people),
  ]);

  const doneByChore = new Map(
    doneToday.filter((d) => d.personId === personId).map((d) => [d.choreId, d]),
  );
  const claimedByOther = new Map(
    doneToday.filter((d) => d.personId !== personId).map((d) => [d.choreId, d.personId]),
  );
  const personById = new Map(everyone.map((p) => [p.id, p]));

  return all
    // Unassigned chores (personId null) are up for grabs by anyone.
    .filter((c) => c.personId === null || c.personId === personId)
    .filter((c) => !c.daysOfWeek || c.daysOfWeek.includes(dayOfWeek))
    .map((c) => {
      const completion = doneByChore.get(c.id);
      const claimer = c.personId === null && c.onePerDay && !completion
        ? personById.get(claimedByOther.get(c.id) ?? -1)
        : undefined;
      return {
        id: c.id,
        title: c.title,
        icon: c.icon,
        points: c.points,
        requiresApproval: c.requiresApproval,
        personId: c.personId,
        onePerDay: c.onePerDay,
        completion: completion ? { id: completion.id, approvedAt: completion.approvedAt } : null,
        claimedBy: claimer
          ? { personId: claimer.id, displayName: claimer.displayName, icon: claimer.icon }
          : null,
      };
    });
}

export async function getRewardsForChild(personId: number) {
  const db = await getDb();
  const all = await db.select().from(rewards).where(eq(rewards.isActive, true)).orderBy(asc(rewards.costPoints));
  return all.filter((r) => r.personId === null || r.personId === personId);
}

/** Stars each child has claimed but a grown-up has not yet approved. */
export async function getPendingStars(personIds: number[]): Promise<Map<number, number>> {
  if (personIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({
      personId: choreCompletions.personId,
      total: sql<number>`coalesce(sum(${choreCompletions.pointsAwarded}), 0)::int`,
    })
    .from(choreCompletions)
    .where(and(inArray(choreCompletions.personId, personIds), isNull(choreCompletions.approvedAt)))
    .groupBy(choreCompletions.personId);

  const map = new Map<number, number>(personIds.map((id) => [id, 0]));
  for (const r of rows) map.set(r.personId, r.total);
  return map;
}

/** How many claims are waiting, for the badge on the home screen. */
export async function countPendingApprovals(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(choreCompletions)
    .where(isNull(choreCompletions.approvedAt));
  return row?.n ?? 0;
}

/** Completions still waiting on a grown-up, across the family. */
export async function getPendingApprovals() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(choreCompletions)
    .where(sql`${choreCompletions.approvedAt} is null`)
    .orderBy(desc(choreCompletions.completedAt));

  const everyone = await db.select().from(people);
  const byId = new Map(everyone.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, person: byId.get(r.personId) ?? null }));
}

export async function getLedger(personId: number, limit = 30) {
  const db = await getDb();
  return db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.personId, personId))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(limit);
}
