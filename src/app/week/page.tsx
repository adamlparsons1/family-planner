import Link from 'next/link';
import { requireHousehold } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import {
  addAppDays, formatShortDay, getCurrentAppDate, weekOf, type AppDate,
} from '@/lib/date';
import { KioskRefresh } from '@/components/KioskRefresh';
import { getEventsForDates } from '@/lib/queries/events';
import { loadNonSchoolDates } from '@/lib/queries/routine';
import { EventChip } from '@/components/EventChip';
import { appDateToDate } from '@/lib/date';
import { getLunchGrid, getMealsForDates } from '@/lib/queries/meals';
import { isSchoolDay } from '@/lib/school';
import { LUNCH_ICONS, lunchKey } from '@/lib/lunch';
import { getChildren } from '@/lib/queries/routine';

/**
 * Monday to Sunday. Read-only in kiosk mode; editing lives behind the PIN in
 * admin. This is the "what's coming up" view the children actually use.
 */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireHousehold('/week');
  const { from } = await searchParams;

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const anchor = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? (from as AppDate) : today;
  const days = weekOf(anchor);

  const [eventsByDate, nonSchool, children] = await Promise.all([
    getEventsForDates(days),
    loadNonSchoolDates(days),
    getChildren(),
  ]);
  const schoolDay = (d: AppDate) => isSchoolDay(d, nonSchool);
  const [mealsByDate, lunches] = await Promise.all([
    getMealsForDates(days),
    getLunchGrid(days, children.map((c) => c.id), schoolDay),
  ]);

  const prev = addAppDays(days[0], -7);
  const next = addAppDays(days[0], 7);

  return (
    <main className="min-h-dvh p-6">
      <KioskRefresh />
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="serif text-[2.4rem] font-bold leading-tight">This week</h1>
        <nav className="flex gap-2">
          <Link href={`/week?from=${prev}`} className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            ← Back
          </Link>
          <Link href="/week" className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            This week
          </Link>
          <Link href={`/week?from=${next}`} className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            Next →
          </Link>
          <Link href="/" className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            Home
          </Link>
        </nav>
      </header>

      <div className="grid gap-3 sm:grid-cols-7">
        {days.map((date) => {
          const isToday = date === today;
          const dayEvents = eventsByDate.get(date) ?? [];
          const offSchool = nonSchool.has(date);
          const dayNumber = appDateToDate(date).getDate();

          return (
            <section
              key={date}
              className="paper flex flex-col p-3"
              style={{ boxShadow: isToday ? '0 12px 26px rgba(43,38,32,0.3)' : undefined }}
            >
              <header className="mb-2">
                <p className="serif text-[1.15rem] font-bold">
                  {formatShortDay(date)} {dayNumber}
                </p>
                {isToday ? (
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">Today</p>
                ) : null}
                {offSchool ? (
                  <p className="text-[0.75rem] font-semibold text-ink-soft">No school</p>
                ) : null}
              </header>

              {/* Lunches, as icons a child can read: lunchbox versus plate. */}
              {offSchool ? null : (
                <ul className="mb-2 flex gap-1">
                  {children.map((c) => {
                    const lunch = lunches.get(lunchKey(c.id, date));
                    if (!lunch || lunch.choice === 'none') return null;
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[0.75rem] font-bold"
                        style={{ backgroundColor: c.colour }}
                        title={`${c.displayName}: ${lunch.dish ?? lunch.choice}`}
                      >
                        <span aria-hidden>{c.icon}</span>
                        <span aria-hidden>{LUNCH_ICONS[lunch.choice]}</span>
                        <span className="sr-only">{c.displayName}: {lunch.dish ?? lunch.choice}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {dayEvents.length === 0 ? (
                <p className="text-[0.8rem] text-ink-soft">—</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((e) => (
                    <li key={`${e.eventId}-${e.date}`}>
                      <EventChip
                        title={e.title}
                        icon={e.icon}
                        startTime={e.startTime}
                        people={e.people}
                        compact
                      />
                    </li>
                  ))}
                </ul>
              )}

              {/* The evening meal. */}
              {(() => {
                const meal = mealsByDate.get(date);
                if (!meal) return null;
                return (
                  <p className="mt-2 border-t-[1.5px] border-line pt-2 text-[0.8rem] font-extrabold">
                    <span aria-hidden className="mr-1">{meal.icon}</span>{meal.title}
                  </p>
                );
              })()}
            </section>
          );
        })}
      </div>
    </main>
  );
}
