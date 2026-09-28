'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { homeworkItems, settings as settingsTable } from '@/db/schema';
import { requireHousehold, requireParentPin } from '@/lib/guards';
import { getCurrentAppDate, isAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';
import { addTick, removeTick, type Result } from '@/lib/homework-store';

export type ActionState = { error: string | null; ok?: string };

const ids = z.object({ itemId: z.number().int().positive(), personId: z.number().int().positive() });

async function today() {
  const s = await getSettings();
  return { date: getCurrentAppDate(new Date(), s.dayRolloverHour), startDay: s.homeworkWeekStartDay };
}

function revalidateHomework() {
  revalidatePath('/homework');
  revalidatePath('/admin/homework');
}

/** A child ticks one off. Household session: this is the kiosk. */
export async function tickHomework(itemId: number, personId: number): Promise<Result> {
  await requireHousehold('/homework');
  const parsed = ids.safeParse({ itemId, personId });
  if (!parsed.success) return { ok: false, error: 'That homework could not be found.' };
  const { date, startDay } = await today();
  const result = await addTick(parsed.data.itemId, parsed.data.personId, date, startDay);
  revalidateHomework();
  return result;
}

export async function untickHomework(itemId: number, personId: number): Promise<Result> {
  await requireHousehold('/homework');
  const parsed = ids.safeParse({ itemId, personId });
  if (!parsed.success) return { ok: false, error: 'That homework could not be found.' };
  const { date, startDay } = await today();
  const result = await removeTick(parsed.data.itemId, parsed.data.personId, date, startDay);
  revalidateHomework();
  return result;
}

/* ------------------------------------------------------------------ admin */

const itemSchema = z
  .object({
    personId: z.coerce.number().int().positive('Pick a child'),
    title: z.string().trim().min(1, 'Say what the homework is').max(60),
    icon: z.string().trim().min(1, 'Pick an icon').max(16),
    kind: z.enum(['weekly', 'one_off']),
    targetPerWeek: z.coerce.number().int().min(1, 'At least once a week').max(20).nullable(),
    unitLabel: z.string().trim().max(30).nullable(),
    dueDate: z.string().refine(isAppDate, 'Pick a date').nullable(),
  })
  .transform((v) => ({
    ...v,
    // Each kind keeps only its own fields, so switching kind cannot leave a
    // stray due date on weekly homework.
    targetPerWeek: v.kind === 'weekly' ? (v.targetPerWeek ?? 1) : null,
    unitLabel: v.kind === 'weekly' ? v.unitLabel || null : null,
    dueDate: v.kind === 'one_off' ? v.dueDate : null,
  }));

function parseItem(form: FormData) {
  const blank = (k: string) => {
    const v = form.get(k);
    return v === null || v === '' ? null : v;
  };
  return itemSchema.safeParse({
    personId: form.get('personId'),
    title: form.get('title'),
    icon: form.get('icon'),
    kind: form.get('kind'),
    targetPerWeek: blank('targetPerWeek'),
    unitLabel: blank('unitLabel'),
    dueDate: blank('dueDate'),
  });
}

export async function createHomework(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/homework');
  const parsed = parseItem(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const { date } = await today();
  const db = await getDb();
  await db.insert(homeworkItems).values({ ...parsed.data, setOn: date });
  revalidateHomework();
  return { error: null, ok: `Added "${parsed.data.title}"` };
}

export async function updateHomework(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/homework');
  const id = z.coerce.number().int().positive().safeParse(form.get('id'));
  if (!id.success) return { error: 'That homework could not be found.' };
  const parsed = parseItem(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.update(homeworkItems).set(parsed.data).where(eq(homeworkItems.id, id.data));
  revalidateHomework();
  return { error: null, ok: 'Saved' };
}

/** Retire rather than delete, so the ticks it earned stay in the export. */
export async function setHomeworkActive(id: number, isActive: boolean): Promise<void> {
  await requireParentPin('/admin/homework');
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(homeworkItems).set({ isActive }).where(eq(homeworkItems.id, parsed.data));
  revalidateHomework();
}

export async function setHomeworkWeekStart(day: number): Promise<Result> {
  await requireParentPin('/admin/homework');
  const parsed = z.number().int().min(0).max(6).safeParse(day);
  if (!parsed.success) return { ok: false, error: 'Pick a day' };
  const db = await getDb();
  await db.update(settingsTable).set({ homeworkWeekStartDay: parsed.data, updatedAt: new Date() });
  revalidateHomework();
  return { ok: true };
}
