'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { chores, rewards } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';

export type ActionState = { error: string | null; ok?: string };

const choreSchema = z.object({
  title: z.string().trim().min(1, 'Give the job a name').max(60),
  icon: z.string().trim().min(1, 'Pick an icon').max(16),
  points: z.coerce.number().int().min(0).max(100),
  personId: z.coerce.number().int().positive().nullable(),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).nullable(),
  requiresApproval: z.boolean(),
  onePerDay: z.boolean(),
});

function parseChore(form: FormData) {
  const days = form.getAll('daysOfWeek').map(Number).filter(Number.isInteger);
  const personRaw = form.get('personId');
  return choreSchema.safeParse({
    title: form.get('title'),
    icon: form.get('icon'),
    points: form.get('points'),
    personId: personRaw && personRaw !== '' ? personRaw : null,
    // No days chosen means every day.
    daysOfWeek: days.length > 0 && days.length < 7 ? days : null,
    requiresApproval: form.get('requiresApproval') === 'on',
    // Only meaningful for a job open to anyone.
    onePerDay: form.get('onePerDay') === 'on' && !(personRaw && personRaw !== ''),
  });
}

export async function createChore(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/chores');
  const parsed = parseChore(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.insert(chores).values(parsed.data);
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
  return { error: null, ok: `Added "${parsed.data.title}"` };
}

export async function updateChore(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/chores');
  const id = z.coerce.number().int().positive().safeParse(form.get('id'));
  if (!id.success) return { error: 'That job could not be found.' };
  const parsed = parseChore(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.update(chores).set(parsed.data).where(eq(chores.id, id.data));
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
  return { error: null, ok: 'Saved' };
}

/**
 * Retires a chore rather than deleting it. A hard delete would leave the
 * completion rows orphaned (their chore_id becomes null) and, while balances
 * survive by design, there is no reason to lose the link.
 */
export async function setChoreActive(id: number, isActive: boolean): Promise<void> {
  await requireParentPin('/admin/chores');
  const db = await getDb();
  await db.update(chores).set({ isActive }).where(eq(chores.id, id));
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
}

const rewardSchema = z.object({
  title: z.string().trim().min(1, 'Give the reward a name').max(60),
  icon: z.string().trim().min(1, 'Pick an icon').max(16),
  costPoints: z.coerce.number().int().min(1, 'A reward must cost something').max(1000),
  personId: z.coerce.number().int().positive().nullable(),
});

export async function createReward(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/chores');
  const personRaw = form.get('personId');
  const parsed = rewardSchema.safeParse({
    title: form.get('title'),
    icon: form.get('icon'),
    costPoints: form.get('costPoints'),
    personId: personRaw && personRaw !== '' ? personRaw : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.insert(rewards).values(parsed.data);
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
  return { error: null, ok: `Added "${parsed.data.title}"` };
}

export async function updateReward(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/chores');
  const id = z.coerce.number().int().positive().safeParse(form.get('id'));
  if (!id.success) return { error: 'That reward could not be found.' };
  const personRaw = form.get('personId');
  const parsed = rewardSchema.safeParse({
    title: form.get('title'),
    icon: form.get('icon'),
    costPoints: form.get('costPoints'),
    personId: personRaw && personRaw !== '' ? personRaw : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.update(rewards).set(parsed.data).where(eq(rewards.id, id.data));
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
  return { error: null, ok: 'Saved' };
}

export async function setRewardActive(id: number, isActive: boolean): Promise<void> {
  await requireParentPin('/admin/chores');
  const db = await getDb();
  await db.update(rewards).set({ isActive }).where(eq(rewards.id, id));
  revalidatePath('/admin/chores');
  revalidatePath('/chores');
}
