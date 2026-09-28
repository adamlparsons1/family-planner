import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { nonSchoolDays, people, routineCompletions, routineTasks } from '@/db/schema';
import { appDayOfWeek, type AppDate } from '@/lib/date';
import { taskAppliesOn } from '@/lib/school';

export type RoutineTask = {
  id: number;
  title: string;
  icon: string;
  category: string;
  sortOrder: number;
  done: boolean;
};

export type RoutineStage = { category: string; tasks: RoutineTask[] };

export type ChildRoutine = {
  person: typeof people.$inferSelect;
  date: AppDate;
  stages: RoutineStage[];
  total: number;
  completed: number;
};

/** Non-school dates in a set, for isSchoolDay(). */
export async function loadNonSchoolDates(dates: AppDate[]): Promise<Set<AppDate>> {
  if (dates.length === 0) return new Set();
  const db = await getDb();
  const rows = await db
    .select({ date: nonSchoolDays.date })
    .from(nonSchoolDays)
    .where(inArray(nonSchoolDays.date, dates));
  return new Set(rows.map((r) => r.date));
}

export async function getPersonBySlug(slug: string) {
  const db = await getDb();
  const all = await db.select().from(people).where(eq(people.isActive, true));
  return all.find((p) => p.name.toLowerCase() === slug.toLowerCase()) ?? null;
}

export async function getChildren() {
  const db = await getDb();
  return db
    .select()
    .from(people)
    .where(and(eq(people.role, 'child'), eq(people.isActive, true)))
    .orderBy(asc(people.sortOrder));
}

/**
 * A child's routine for one date, grouped into stages.
 *
 * Tasks are filtered by days_of_week AND school_days_only,
 * so "water bottle" vanishes in the holidays while "brush teeth" does not.
 */
export async function getChildRoutine(
  person: typeof people.$inferSelect,
  date: AppDate,
): Promise<ChildRoutine> {
  const db = await getDb();
  const [tasks, completions, nonSchool] = await Promise.all([
    db
      .select()
      .from(routineTasks)
      .where(and(eq(routineTasks.personId, person.id), eq(routineTasks.partOfDay, 'morning')))
      .orderBy(asc(routineTasks.sortOrder)),
    db.select().from(routineCompletions).where(eq(routineCompletions.date, date)),
    loadNonSchoolDates([date]),
  ]);

  const doneTaskIds = new Set(completions.map((c) => c.taskId));
  const dayOfWeek = appDayOfWeek(date);

  const stages: RoutineStage[] = [];
  let total = 0;
  let completed = 0;

  for (const task of tasks) {
    if (!taskAppliesOn(task, date, nonSchool, dayOfWeek)) continue;
    const done = doneTaskIds.has(task.id);
    total += 1;
    if (done) completed += 1;

    const stage = stages.find((s) => s.category === task.category);
    const row: RoutineTask = {
      id: task.id,
      title: task.title,
      icon: task.icon,
      category: task.category,
      sortOrder: task.sortOrder,
      done,
    };
    if (stage) stage.tasks.push(row);
    else stages.push({ category: task.category, tasks: [row] });
  }

  return { person, date, stages, total, completed };
}

/** Progress for every child, for the home screen. */
export async function getAllChildRoutines(date: AppDate): Promise<ChildRoutine[]> {
  const children = await getChildren();
  return Promise.all(children.map((c) => getChildRoutine(c, date)));
}
