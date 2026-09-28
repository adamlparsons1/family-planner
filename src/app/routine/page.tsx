import Link from 'next/link';
import { requireHousehold } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { formatFriendlyDate, getCurrentAppDate } from '@/lib/date';
import { getAllChildRoutines, loadNonSchoolDates } from '@/lib/queries/routine';
import { getLunchGrid, getMealsForDates } from '@/lib/queries/meals';
import { isSchoolDay } from '@/lib/school';
import { lunchKey } from '@/lib/lunch';
import { RoutineColumns } from '@/components/RoutineColumns';
import { KioskRefresh } from '@/components/KioskRefresh';

/**
 * The morning, every child at once. This is the screen that is up at
 * 7:15am: each child has their own column and their own stage, because they do
 * not move at the same speed.
 */
export default async function RoutinePage() {
  await requireHousehold('/routine');

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const [routines, nonSchool, meals] = await Promise.all([
    getAllChildRoutines(today),
    loadNonSchoolDates([today]),
    getMealsForDates([today]),
  ]);
  const schoolToday = isSchoolDay(today, nonSchool);
  // Lunch shows on a school day, for a child whose card has it on.
  const withLunch = routines.filter((r) => r.person.showLunchOnCard).map((r) => r.person.id);
  const lunches = schoolToday && withLunch.length
    ? await getLunchGrid([today], withLunch, () => true)
    : new Map();
  const dinner = meals.get(today);
  const subtitle = [
    nonSchool.has(today) ? 'No school today' : 'School day',
    dinner ? `${dinner.title} tonight` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    // Fixed height only where the three columns sit side by side. On a phone
    // they stack, and the page itself scrolls instead.
    <main className="safe-pad flex min-h-dvh flex-col md:h-dvh">
      <KioskRefresh />
      {/* Stacked above the cards, with a gap wider than the washi tape and
          the card tilt reach, so neither can sit over these links. */}
      <header className="relative z-10 mb-5 flex flex-wrap items-baseline justify-between gap-3 px-1">
        <div>
          <h1 className="serif text-[2.1rem] font-bold leading-none">{formatFriendlyDate(today)}</h1>
          <p className="mt-1.5 text-[13px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">
            {subtitle}
          </p>
        </div>
        <nav className="flex gap-2">
          <Link href="/" className="tap rounded-full border-2 border-line px-5 py-2 text-[1rem] font-semibold">
            Home
          </Link>
          <Link href="/chores" className="tap rounded-full border-2 border-line px-5 py-2 text-[1rem] font-semibold">
            Jobs
          </Link>
          <Link href="/homework" className="tap rounded-full border-2 border-line px-5 py-2 text-[1rem] font-semibold">
            Homework
          </Link>
        </nav>
      </header>

      <RoutineColumns
        children={routines.map((r) => ({
          id: r.person.id,
          name: r.person.name,
          displayName: r.person.displayName,
          colour: r.person.colour,
          icon: r.person.icon,
          lunch: (() => {
            const cell = lunches.get(lunchKey(r.person.id, today));
            if (!cell) return null;
            // What today resolves to, standing default included, like /week.
            // Nothing set, or at home, shows nothing.
            const choice = !cell.isUnset && (cell.choice === 'school' || cell.choice === 'packed')
              ? cell.choice
              : null;
            return { choice, dish: cell.dish };
          })(),
          stages: r.stages.map((s) => ({
            category: s.category,
            tasks: s.tasks.map((t) => ({
              id: t.id, title: t.title, icon: t.icon, category: t.category, done: t.done,
            })),
          })),
        }))}
      />
    </main>
  );
}
