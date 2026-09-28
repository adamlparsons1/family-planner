'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { choreCompletions, pointsLedger, rewards } from '@/db/schema';
import { approveCompletion, recordCompletion, rejectCompletion, type Result } from '@/lib/chore-ledger';
import { requireHousehold, requireParentPin } from '@/lib/guards';
import { isPinUnlocked } from '@/lib/session';
import { getCurrentAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';
import { getBalance } from '@/lib/queries/points';

export type { Result };

/**
 * Complete a chore.
 *
 * Approval by default: a claim waits
 * for a grown-up before any stars land, unless that chore has been switched to
 * pay out straight away. The rules live in `lib/chore-ledger.ts`.
 */
export async function completeChore(choreId: number, personId: number): Promise<Result> {
  await requireHousehold();

  const parsed = z
    .object({ choreId: z.number().int().positive(), personId: z.number().int().positive() })
    .safeParse({ choreId, personId });
  if (!parsed.success) return { ok: false, error: 'That job could not be found.' };

  const settings = await getSettings();
  const date = getCurrentAppDate(new Date(), settings.dayRolloverHour);

  const result = await recordCompletion(parsed.data.choreId, parsed.data.personId, date);
  revalidateChores();
  return result;
}

/** Undo a completion made in error. Removes the matching ledger row too. */
export async function undoChore(choreId: number, personId: number): Promise<Result> {
  await requireHousehold();
  const settings = await getSettings();
  const date = getCurrentAppDate(new Date(), settings.dayRolloverHour);

  const db = await getDb();
  const [completion] = await db
    .select().from(choreCompletions)
    .where(and(
      eq(choreCompletions.choreId, choreId),
      eq(choreCompletions.personId, personId),
      eq(choreCompletions.date, date),
    ));
  if (!completion) return { ok: false, error: 'Nothing to undo.' };

  // An approved completion has been paid; reverse it with a negative row rather
  // than deleting the original, so the ledger stays append-only and auditable.
  if (completion.approvedAt) {
    await db.insert(pointsLedger).values({
      personId,
      delta: -completion.pointsAwarded,
      reason: `Undo: ${completion.choreTitle}`,
      sourceType: 'chore',
      sourceId: choreId,
    });
  }
  await db.delete(choreCompletions).where(eq(choreCompletions.id, completion.id));

  revalidatePath('/chores');
  revalidatePath('/');
  return { ok: true };
}

/** Approve a pending completion. Parent PIN required. */
export async function approveChore(completionId: number): Promise<Result> {
  await requireParentPin('/admin/chores');
  const parsed = z.number().int().positive().safeParse(completionId);
  if (!parsed.success) return { ok: false, error: 'That could not be found.' };
  const result = await approveCompletion(parsed.data);
  revalidateChores();
  return result;
}

/** Approve every claim still waiting. The evening "Approve all". */
export async function approveAllChores(completionIds: number[]): Promise<Result> {
  await requireParentPin('/admin/chores');
  const parsed = z.array(z.number().int().positive()).max(500).safeParse(completionIds);
  if (!parsed.success) return { ok: false, error: 'That could not be approved.' };
  // Sequential on purpose: the Neon HTTP driver has no interactive
  // transactions, and each approval is idempotent, so a retry is safe.
  for (const id of parsed.data) await approveCompletion(id);
  revalidateChores();
  return { ok: true };
}

/** "Not done": remove a claim that is still waiting. No stars ever moved. */
export async function rejectChore(completionId: number): Promise<Result> {
  await requireParentPin('/admin/chores');
  const parsed = z.number().int().positive().safeParse(completionId);
  if (!parsed.success) return { ok: false, error: 'That could not be found.' };
  const result = await rejectCompletion(parsed.data);
  revalidateChores();
  return result;
}

function revalidateChores() {
  revalidatePath('/chores', 'layout');
  revalidatePath('/admin/chores');
  revalidatePath('/');
}

/** Redeem a reward. Always requires the parent PIN (spec section 7.4). */
export async function redeemReward(rewardId: number, personId: number): Promise<Result> {
  await requireParentPin('/chores');

  const db = await getDb();
  const [reward] = await db
    .select().from(rewards).where(and(eq(rewards.id, rewardId), eq(rewards.isActive, true)));
  if (!reward) return { ok: false, error: 'That reward could not be found.' };
  if (reward.personId !== null && reward.personId !== personId) {
    return { ok: false, error: 'That reward is not for them.' };
  }

  const balance = await getBalance(personId);
  if (balance < reward.costPoints) {
    return { ok: false, error: `Not enough stars yet — ${reward.costPoints - balance} more needed.` };
  }

  await db.insert(pointsLedger).values({
    personId,
    delta: -reward.costPoints,
    reason: reward.title,
    sourceType: 'reward',
    sourceId: reward.id,
  });

  revalidatePath('/chores');
  revalidatePath('/');
  return { ok: true, message: `Redeemed ${reward.title}` };
}

/** Manual adjustment. A reason is required and goes in the ledger. */
export async function adjustPoints(_prev: { error: string | null; ok?: string }, form: FormData) {
  await requireParentPin('/admin/points');

  const parsed = z
    .object({
      personId: z.coerce.number().int().positive(),
      delta: z.coerce.number().int().refine((n) => n !== 0, 'Enter a number of points'),
      reason: z.string().trim().min(1, 'Give a reason').max(120),
    })
    .safeParse({
      personId: form.get('personId'),
      delta: form.get('delta'),
      reason: form.get('reason'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.insert(pointsLedger).values({
    personId: parsed.data.personId,
    delta: parsed.data.delta,
    reason: parsed.data.reason,
    sourceType: 'manual',
  });

  revalidatePath('/admin/points');
  revalidatePath('/chores');
  return {
    error: null,
    ok: `${parsed.data.delta > 0 ? '+' : ''}${parsed.data.delta} recorded`,
  };
}

/** Whether the current session may redeem without a further PIN prompt. */
export async function canRedeem(): Promise<boolean> {
  return isPinUnlocked();
}
