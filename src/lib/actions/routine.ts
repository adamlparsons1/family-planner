'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { routineCompletions, routineTasks } from '@/db/schema';
import { requireHousehold } from '@/lib/guards';
import { getCurrentAppDate, isAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';

const toggleSchema = z.object({
  taskId: z.number().int().positive(),
  /** Optional: the client's idea of today. Validated, then ignored if wrong. */
  date: z.string().refine(isAppDate, 'Not a YYYY-MM-DD date').optional(),
});

export type ToggleResult = { ok: true; done: boolean } | { ok: false; error: string };

/**
 * Tick or untick a task. Idempotent in both directions, because children mistap
 * and a double-tap must never end up in a confusing half state.
 *
 * Unticking DELETES the row - undo is instant and leaves no trace.
 */
export async function toggleRoutineTask(input: {
  taskId: number;
  date?: string;
  done: boolean;
}): Promise<ToggleResult> {
  await requireHousehold();

  const parsed = toggleSchema.safeParse({ taskId: input.taskId, date: input.date });
  if (!parsed.success) return { ok: false, error: 'That task could not be found.' };

  const settings = await getSettings();
  const serverDate = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  // The server decides what "today" is. A stale client cannot write to the wrong day.
  const date = serverDate;

  const db = await getDb();
  const [task] = await db
    .select()
    .from(routineTasks)
    .where(and(eq(routineTasks.id, parsed.data.taskId), eq(routineTasks.isActive, true)));
  if (!task) return { ok: false, error: 'That task could not be found.' };

  if (input.done) {
    await db
      .insert(routineCompletions)
      .values({ taskId: task.id, date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(routineCompletions)
      .where(and(eq(routineCompletions.taskId, task.id), eq(routineCompletions.date, date)));
  }

  revalidatePath('/');
  revalidatePath(`/routine/${task.personId}`);
  return { ok: true, done: input.done };
}
