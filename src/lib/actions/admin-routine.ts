'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { nonSchoolDays, routineTasks } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { datesBetween, isAppDate, isWeekend } from '@/lib/date';
import { ROUTINE_CATEGORIES } from '@/lib/family';

export type ActionState = { error: string | null; ok?: string };

const CATEGORIES = ROUTINE_CATEGORIES as readonly string[];

const taskSchema = z.object({
  personId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Give the job a name').max(60),
  icon: z.string().trim().min(1, 'Pick an icon').max(16),
  category: z.string().refine((c) => CATEGORIES.includes(c), 'Unknown stage'),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Pick at least one day'),
  schoolDaysOnly: z.boolean(),
});

function daysFromForm(form: FormData): number[] {
  return form.getAll('daysOfWeek').map((d) => Number(d)).filter((n) => Number.isInteger(n));
}

export async function createRoutineTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/routines');

  const parsed = taskSchema.safeParse({
    personId: form.get('personId'),
    title: form.get('title'),
    icon: form.get('icon'),
    category: form.get('category'),
    daysOfWeek: daysFromForm(form),
    schoolDaysOnly: form.get('schoolDaysOnly') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  const [{ highest }] = await db
    .select({ highest: max(routineTasks.sortOrder) })
    .from(routineTasks)
    .where(eq(routineTasks.personId, parsed.data.personId));

  await db.insert(routineTasks).values({
    ...parsed.data,
    partOfDay: 'morning',
    sortOrder: (highest ?? 0) + 1,
  });

  revalidatePath('/admin/routines');
  revalidatePath('/');
  return { error: null, ok: `Added "${parsed.data.title}"` };
}

export async function updateRoutineTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/routines');

  const id = z.coerce.number().int().positive().safeParse(form.get('id'));
  if (!id.success) return { error: 'That job could not be found.' };

  const parsed = taskSchema.safeParse({
    personId: form.get('personId'),
    title: form.get('title'),
    icon: form.get('icon'),
    category: form.get('category'),
    daysOfWeek: daysFromForm(form),
    schoolDaysOnly: form.get('schoolDaysOnly') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.update(routineTasks).set(parsed.data).where(eq(routineTasks.id, id.data));

  revalidatePath('/admin/routines');
  revalidatePath('/');
  return { error: null, ok: 'Saved' };
}

/**
 * Deactivates rather than deletes. A hard delete would cascade the child's
 * completion history away with it.
 */
export async function setRoutineTaskActive(id: number, isActive: boolean): Promise<void> {
  await requireParentPin('/admin/routines');
  const db = await getDb();
  await db.update(routineTasks).set({ isActive }).where(eq(routineTasks.id, id));
  revalidatePath('/admin/routines');
  revalidatePath('/');
}

export async function moveRoutineTask(id: number, direction: 'up' | 'down'): Promise<void> {
  await requireParentPin('/admin/routines');
  const db = await getDb();
  const [task] = await db.select().from(routineTasks).where(eq(routineTasks.id, id));
  if (!task) return;

  const siblings = await db
    .select()
    .from(routineTasks)
    .where(and(eq(routineTasks.personId, task.personId), eq(routineTasks.category, task.category)));
  siblings.sort((a, b) => a.sortOrder - b.sortOrder);

  const i = siblings.findIndex((s) => s.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;

  // Swap sort orders with the neighbour in the same stage.
  await db.update(routineTasks).set({ sortOrder: siblings[j].sortOrder }).where(eq(routineTasks.id, siblings[i].id));
  await db.update(routineTasks).set({ sortOrder: siblings[i].sortOrder }).where(eq(routineTasks.id, siblings[j].id));

  revalidatePath('/admin/routines');
}

/* ------------------------------------------------------ non-school days */

const rangeSchema = z
  .object({
    from: z.string().refine(isAppDate, 'Pick a start date'),
    to: z.string().refine(isAppDate, 'Pick an end date'),
    reason: z.enum(['holiday', 'inset', 'sick', 'other']),
    label: z.string().trim().max(60).optional(),
  })
  .refine((v) => v.to >= v.from, { message: 'The end date is before the start date' });

export async function addNonSchoolRange(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/school');

  const parsed = rangeSchema.safeParse({
    from: form.get('from'),
    to: form.get('to'),
    reason: form.get('reason'),
    label: form.get('label') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the dates' };

  const { from, to, reason, label } = parsed.data;
  // Weekends are derived, never stored.
  const rows = datesBetween(from, to)
    .filter((d) => !isWeekend(d))
    .map((date) => ({ date, reason, label: label ?? null }));

  if (rows.length === 0) {
    return { error: null, ok: 'That range is all weekend, so there was nothing to add.' };
  }

  const db = await getDb();
  await db.insert(nonSchoolDays).values(rows).onConflictDoNothing();

  revalidatePath('/admin/school');
  revalidatePath('/');
  return { error: null, ok: `Added ${rows.length} non-school day${rows.length === 1 ? '' : 's'}` };
}

export async function removeNonSchoolDay(date: string): Promise<void> {
  await requireParentPin('/admin/school');
  if (!isAppDate(date)) return;
  const db = await getDb();
  await db.delete(nonSchoolDays).where(eq(nonSchoolDays.date, date));
  revalidatePath('/admin/school');
  revalidatePath('/');
}
