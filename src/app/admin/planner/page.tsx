import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { WeekPlanner } from '@/components/WeekPlanner';
import { getCurrentAppDate, addAppDays, weekOf, formatShortDay, appDateToDate, type AppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';
import { getLunchDefaults, getLunchGrid, getMealsForDates } from '@/lib/queries/meals';
import { loadNonSchoolDates } from '@/lib/queries/routine';
import { isSchoolDay } from '@/lib/school';
import { lunchKey } from '@/lib/lunch';

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireParentPin('/admin/planner');
  const { from } = await searchParams;

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const anchor = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? (from as AppDate) : today;
  const dates = weekOf(anchor);

  const db = await getDb();
  const children = await db
    .select().from(people).where(eq(people.role, 'child')).orderBy(asc(people.sortOrder));
  const childIds = children.map((c) => c.id);

  const nonSchool = await loadNonSchoolDates(dates);
  const schoolDay = (d: AppDate) => isSchoolDay(d, nonSchool);

  const [mealsByDate, lunchGrid, defaults] = await Promise.all([
    getMealsForDates(dates),
    getLunchGrid(dates, childIds, schoolDay),
    getLunchDefaults(),
  ]);

  const days = dates.map((date) => {
    const meal = mealsByDate.get(date);
    const lunches: Record<number, { choice: 'school' | 'packed' | 'none'; isOverride: boolean; isUnset: boolean; dish: string | null }> = {};
    for (const id of childIds) {
      const r = lunchGrid.get(lunchKey(id, date));
      if (r) lunches[id] = { choice: r.choice, isOverride: r.isOverride, isUnset: r.isUnset, dish: r.dish };
    }
    return {
      date,
      label: `${formatShortDay(date)} ${appDateToDate(date).getDate()}`,
      isSchoolDay: schoolDay(date),
      isToday: date === today,
      meal: meal ? { title: meal.title, icon: meal.icon } : null,
      lunches,
    };
  });

  const prev = addAppDays(dates[0], -7);
  const next = addAppDays(dates[0], 7);

  return (
    <AdminShell title="Week planner">
      <nav className="mb-5 flex flex-wrap gap-2">
        <Link href={`/admin/planner?from=${prev}`} className="tap rounded-full border-2 border-line px-5 py-2 font-semibold">
          ← Last week
        </Link>
        <Link href="/admin/planner" className="tap rounded-full border-2 border-line px-5 py-2 font-semibold">
          This week
        </Link>
        <Link href={`/admin/planner?from=${next}`} className="tap rounded-full border-2 border-line px-5 py-2 font-semibold">
          Next week →
        </Link>
      </nav>

      <WeekPlanner
        days={days}
        people={children.map((c) => ({
          id: c.id, displayName: c.displayName, colour: c.colour, icon: c.icon, showLunchOnCard: c.showLunchOnCard,
        }))}
        weekLabel={`${dates[0]} to ${dates[6]}`}
        defaults={defaults.map((d) => ({ personId: d.personId, dayOfWeek: d.dayOfWeek, choice: d.choice }))}
      />
    </AdminShell>
  );
}
