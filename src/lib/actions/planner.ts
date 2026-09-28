'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { lunchChoices, lunchDefaults, meals } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { isAppDate } from '@/lib/date';
import { DISH_MAX, saveLunch } from '@/lib/lunch-store';

export type ActionState = { error: string | null; ok?: string };

const choiceEnum = z.enum(['school', 'packed', 'none']);

/** Set or clear one person's lunch on one date. */
export async function setLunchChoice(input: {
  personId: number;
  date: string;
  choice: 'school' | 'packed' | 'none' | 'clear';
}): Promise<{ ok: boolean }> {
  await requireParentPin('/admin/planner');

  const parsed = z
    .object({
      personId: z.number().int().positive(),
      date: z.string().refine(isAppDate),
      choice: z.union([choiceEnum, z.literal('clear')]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };

  const db = await getDb();
  const { personId, date, choice } = parsed.data;

  if (choice === 'clear') {
    // Removing the override falls back to the standing default.
    await db
      .delete(lunchChoices)
      .where(and(eq(lunchChoices.personId, personId), eq(lunchChoices.date, date)));
  } else {
    // Moving off school dinner clears the dish.
    await saveLunch({ personId, date, choice });
  }

  revalidateLunches();
  return { ok: true };
}

/**
 * What the school dinner is on one date. Grown-ups only: the children
 * see it on the morning card but cannot change it. Writing a dish means school
 * dinner that day; an empty dish just clears the menu line.
 */
export async function setLunchDish(input: {
  personId: number;
  date: string;
  dish: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireParentPin('/admin/planner');

  const parsed = z
    .object({
      personId: z.number().int().positive(),
      date: z.string().refine(isAppDate),
      dish: z.string().max(DISH_MAX, `Keep it under ${DISH_MAX} letters`),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'That did not save.' };

  await saveLunch({ ...parsed.data, choice: 'school' });
  revalidateLunches();
  return { ok: true };
}

function revalidateLunches() {
  revalidatePath('/admin/planner');
  revalidatePath('/routine');
  revalidatePath('/week');
  revalidatePath('/');
}

/** Set or clear the standing pattern for one person on one weekday. */
export async function setLunchDefault(input: {
  personId: number;
  dayOfWeek: number;
  choice: 'school' | 'packed' | 'none' | 'clear';
}): Promise<{ ok: boolean }> {
  await requireParentPin('/admin/planner');

  const parsed = z
    .object({
      personId: z.number().int().positive(),
      dayOfWeek: z.number().int().min(0).max(6),
      choice: z.union([choiceEnum, z.literal('clear')]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };

  const db = await getDb();
  const { personId, dayOfWeek, choice } = parsed.data;

  if (choice === 'clear') {
    await db
      .delete(lunchDefaults)
      .where(and(eq(lunchDefaults.personId, personId), eq(lunchDefaults.dayOfWeek, dayOfWeek)));
  } else {
    await db
      .insert(lunchDefaults)
      .values({ personId, dayOfWeek, choice })
      .onConflictDoUpdate({
        target: [lunchDefaults.personId, lunchDefaults.dayOfWeek],
        set: { choice },
      });
  }

  revalidatePath('/admin/planner');
  return { ok: true };
}

const mealSchema = z.object({
  date: z.string().refine(isAppDate, 'Not a valid date'),
  title: z.string().trim().max(80),
  icon: z.string().trim().max(16),
  notes: z.string().trim().max(300).optional(),
});

/** Set the evening meal for one date. An empty title clears it. */
export async function setMeal(input: {
  date: string;
  title: string;
  icon: string;
  notes?: string;
}): Promise<{ ok: boolean }> {
  await requireParentPin('/admin/planner');
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const db = await getDb();
  const { date, title, icon, notes } = parsed.data;

  if (title === '') {
    await db.delete(meals).where(eq(meals.date, date));
  } else {
    await db
      .insert(meals)
      .values({ date, title, icon: icon || '🍽️', notes: notes || null })
      .onConflictDoUpdate({
        target: meals.date,
        set: { title, icon: icon || '🍽️', notes: notes || null },
      });
  }

  revalidatePath('/admin/planner');
  revalidatePath('/week');
  revalidatePath('/');
  return { ok: true };
}
