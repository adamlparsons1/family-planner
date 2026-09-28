import 'server-only';
import { and, asc, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { homeworkCompletions, homeworkItems } from '@/db/schema';
import type { AppDate } from '@/lib/date';
import { homeworkState, homeworkWeek, type HomeworkState } from '@/lib/homework';

/**
 * Homework reads and writes, with no auth in them (the pattern from
 * `chore-ledger.ts`). The server actions check the session or PIN, then call
 * these; the tests call them directly.
 */

export type Result = { ok: true } | { ok: false; error: string };
export type HomeworkItem = typeof homeworkItems.$inferSelect;
export type HomeworkView = HomeworkItem & HomeworkState;

async function tickDatesFor(itemIds: number[], weekStart: AppDate) {
  if (itemIds.length === 0) return new Map<number, AppDate[]>();
  const db = await getDb();
  // Weekly items only need this week's ticks; a one-off needs all of its own.
  const rows = await db
    .select({ itemId: homeworkCompletions.itemId, date: homeworkCompletions.date })
    .from(homeworkCompletions)
    .innerJoin(homeworkItems, eq(homeworkItems.id, homeworkCompletions.itemId))
    .where(and(
      inArray(homeworkCompletions.itemId, itemIds),
      or(eq(homeworkItems.kind, 'one_off'), gte(homeworkCompletions.date, weekStart)),
    ));
  const map = new Map<number, AppDate[]>();
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.date]);
  return map;
}

/** What the Homework page shows today, per child. */
export async function getHomeworkBoard(
  personIds: number[],
  today: AppDate,
  startDay: number,
): Promise<Map<number, HomeworkView[]>> {
  const board = new Map<number, HomeworkView[]>(personIds.map((id) => [id, []]));
  if (personIds.length === 0) return board;

  const db = await getDb();
  const items = await db
    .select().from(homeworkItems)
    .where(and(inArray(homeworkItems.personId, personIds), eq(homeworkItems.isActive, true)))
    .orderBy(asc(homeworkItems.sortOrder), asc(homeworkItems.createdAt));

  const ticks = await tickDatesFor(items.map((i) => i.id), homeworkWeek(today, startDay).start);
  for (const item of items) {
    const state = homeworkState(item, ticks.get(item.id) ?? [], today, startDay);
    if (state.visible) board.get(item.personId)?.push({ ...item, ...state });
  }
  return board;
}

async function activeItem(itemId: number, personId: number) {
  const db = await getDb();
  const [item] = await db
    .select().from(homeworkItems)
    .where(and(eq(homeworkItems.id, itemId), eq(homeworkItems.isActive, true)));
  return item && item.personId === personId ? item : null;
}

/** One tick. Stops at the week's target: four lots of practice is 4, not 40. */
export async function addTick(itemId: number, personId: number, today: AppDate, startDay: number): Promise<Result> {
  const item = await activeItem(itemId, personId);
  if (!item) return { ok: false, error: 'That homework could not be found.' };

  const ticks = (await tickDatesFor([item.id], homeworkWeek(today, startDay).start)).get(item.id) ?? [];
  const state = homeworkState(item, ticks, today, startDay);
  if (state.complete) {
    return { ok: false, error: item.kind === 'weekly' ? 'All done for this week!' : 'That one is already done.' };
  }

  const db = await getDb();
  await db.insert(homeworkCompletions).values({ itemId: item.id, personId, date: today });
  return { ok: true };
}

/**
 * Take one tick back: the latest this week for weekly homework, or the one
 * tick on a one-off. Never reaches into a previous week, which is history.
 */
export async function removeTick(itemId: number, personId: number, today: AppDate, startDay: number): Promise<Result> {
  const item = await activeItem(itemId, personId);
  if (!item) return { ok: false, error: 'That homework could not be found.' };

  const db = await getDb();
  const { start } = homeworkWeek(today, startDay);
  const [latest] = await db
    .select().from(homeworkCompletions)
    .where(and(
      eq(homeworkCompletions.itemId, item.id),
      ...(item.kind === 'weekly' ? [gte(homeworkCompletions.date, start)] : []),
    ))
    .orderBy(desc(homeworkCompletions.completedAt), desc(homeworkCompletions.id))
    .limit(1);
  if (!latest) return { ok: true };

  await db.delete(homeworkCompletions).where(eq(homeworkCompletions.id, latest.id));
  return { ok: true };
}
