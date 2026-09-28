import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { choreCompletions, chores, people, pointsLedger } from '@/db/schema';
import type { AppDate } from '@/lib/date';

/**
 * The rules for claiming, approving and rejecting a job, with no auth in them.
 *
 * The server actions in `lib/actions/chores.ts` check the household session or
 * parent PIN and then call these. Keeping the rules here means they can be
 * tested directly, without a cookie.
 */

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/**
 * One child claims one job on one day.
 *
 * A job open to anyone and marked `one_per_day` can be claimed by ONE child a
 * day, not one each. Before this, every child could claim "Feed
 * the dog" for a single feed. Other open jobs ("Make your bed") stay one per
 * child.
 */
export async function recordCompletion(choreId: number, personId: number, date: AppDate): Promise<Result> {
  const db = await getDb();
  const [chore] = await db
    .select().from(chores)
    .where(and(eq(chores.id, choreId), eq(chores.isActive, true)));
  if (!chore) return { ok: false, error: 'That job could not be found.' };

  if (chore.personId !== null && chore.personId !== personId) {
    return { ok: false, error: 'That job is for someone else.' };
  }

  const today = await db
    .select().from(choreCompletions)
    .where(and(eq(choreCompletions.choreId, chore.id), eq(choreCompletions.date, date)));

  if (today.some((c) => c.personId === personId)) {
    return { ok: false, error: 'That one is already done today.' };
  }
  if (chore.personId === null && chore.onePerDay && today.length > 0) {
    const [claimer] = await db.select().from(people).where(eq(people.id, today[0].personId));
    return { ok: false, error: `${claimer?.displayName ?? 'Someone'} already did that one today.` };
  }

  const approvedAt = chore.requiresApproval ? null : new Date();

  await db.insert(choreCompletions).values({
    choreId: chore.id,
    personId,
    // Snapshot title and points so history survives the chore being edited.
    choreTitle: chore.title,
    pointsAwarded: chore.points,
    date,
    approvedAt,
  });

  if (approvedAt) {
    await db.insert(pointsLedger).values({
      personId,
      delta: chore.points,
      reason: chore.title,
      sourceType: 'chore',
      sourceId: chore.id,
    });
  }

  return { ok: true, message: approvedAt ? `+${chore.points}` : 'Waiting for a grown-up' };
}

/** A grown-up confirms a job was done. Only now do the stars land. */
export async function approveCompletion(completionId: number): Promise<Result> {
  const db = await getDb();
  const [completion] = await db
    .select().from(choreCompletions).where(eq(choreCompletions.id, completionId));
  if (!completion) return { ok: false, error: 'That could not be found.' };
  if (completion.approvedAt) return { ok: true };

  await db.update(choreCompletions)
    .set({ approvedAt: new Date() })
    .where(eq(choreCompletions.id, completionId));

  await db.insert(pointsLedger).values({
    personId: completion.personId,
    delta: completion.pointsAwarded,
    reason: completion.choreTitle,
    sourceType: 'chore',
    sourceId: completion.choreId,
  });

  return { ok: true };
}

/**
 * A grown-up says a job was not done. The claim is deleted, and because a
 * pending claim never paid anything, no ledger row is written or needed.
 *
 * Only pending claims can be rejected. An approved one has already paid; taking
 * stars back after the fact is a manual adjustment with a reason, not this.
 */
export async function rejectCompletion(completionId: number): Promise<Result> {
  const db = await getDb();
  const [completion] = await db
    .select().from(choreCompletions).where(eq(choreCompletions.id, completionId));
  if (!completion) return { ok: true };
  if (completion.approvedAt) {
    return { ok: false, error: 'That one was already approved. Use a points adjustment instead.' };
  }
  await db.delete(choreCompletions).where(eq(choreCompletions.id, completionId));
  return { ok: true };
}
